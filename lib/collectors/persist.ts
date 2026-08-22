import type { D1DatabaseLike } from "../cloudflare.ts";
import { Verification, ReviewStatus } from "../domain/types.ts";
import { dedupeNotices } from "./dedupe.ts";
import { sourceRegistry } from "./registry.ts";
import type { Collector, CrawlRunResult, RawNotice, SourceDefinition, SourceRunResult } from "./contracts.ts";
import type { AttachmentQueueMessage } from "../attachments/contracts.ts";
import type { QueueLike } from "../cloudflare.ts";
import { discoverAndQueueAttachments } from "../attachments/discovery.ts";

export type CollectionTrigger="MANUAL"|"AUTOMATION";

export class CollectionLockedError extends Error {
  constructor(){super("A collection run is already active.");this.name="CollectionLockedError";}
}

const LOCK_NAME="collector-v3";
const LOCK_TTL_MS=20*60*1000;

function iso(date=new Date()){return date.toISOString();}
function changes(result:{meta?:{changes?:number}}){return result.meta?.changes??0;}
async function stableId(prefix:string,value:string){const bytes=new TextEncoder().encode(value);const digest=await crypto.subtle.digest("SHA-256",bytes);const hex=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");return `${prefix}_${hex.slice(0,24)}`;}

async function seedSources(db:D1DatabaseLike,now:string){
  for(const source of sourceRegistry){
    await db.prepare(`INSERT INTO sources (id,name,method,region,url,implemented,health,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,method=excluded.method,region=excluded.region,url=excluded.url,implemented=excluded.implemented,health=excluded.health,updated_at=excluded.updated_at`)
      .bind(source.id,source.name,source.method,source.region,source.url,source.implemented?1:0,source.health,now,now).run();
  }
}

async function acquireLock(db:D1DatabaseLike,holder:string,now:Date){
  const expiresAt=new Date(now.getTime()+LOCK_TTL_MS).toISOString();
  const result=await db.prepare(`INSERT INTO collection_locks (name,holder,acquired_at,expires_at) VALUES (?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET holder=excluded.holder,acquired_at=excluded.acquired_at,expires_at=excluded.expires_at
    WHERE collection_locks.expires_at <= ?`).bind(LOCK_NAME,holder,now.toISOString(),expiresAt,now.toISOString()).run();
  return changes(result)>0;
}

async function releaseLock(db:D1DatabaseLike,holder:string){await db.prepare("DELETE FROM collection_locks WHERE name=? AND holder=?").bind(LOCK_NAME,holder).run();}

function inferField(title:string){if(/문화|예술/.test(title))return "문화·예술";if(/안전|보호/.test(title))return "안전·보호";if(/국제|교류/.test(title))return "국제교류";if(/진로|창업/.test(title))return "진로·창업";return "청소년 활동";}
function isOpportunityCandidate(title:string){return /(청소년|청년)/.test(title)&&/(공모|모집)/.test(title)&&/(시설|기관|단체|동아리|프로그램|활동)/.test(title);}

async function persistNotice(db:D1DatabaseLike,notice:RawNotice,source:SourceDefinition,sourceRunId:string){
  const rawId=await stableId("raw",notice.dedupeKey);
  const opportunityId=await stableId("opp",notice.dedupeKey);
  const existing=await db.prepare("SELECT id FROM raw_notices WHERE dedupe_key=?").bind(notice.dedupeKey).first<{id:string}>();
  if(existing){
    await db.prepare("UPDATE raw_notices SET source_run_id=?,title=?,url=?,published_at=?,raw_text=?,collected_at=? WHERE id=?")
      .bind(sourceRunId,notice.title,notice.url,notice.publishedAt,notice.rawText,notice.collectedAt,existing.id).run();
  }else{
    await db.prepare("INSERT INTO raw_notices (id,source_id,source_run_id,source_notice_id,title,url,published_at,raw_text,dedupe_key,collected_at) VALUES (?,?,?,?,?,?,?,?,?,?)")
      .bind(rawId,source.id,sourceRunId,notice.sourceNoticeId,notice.title,notice.url,notice.publishedAt,notice.rawText,notice.dedupeKey,notice.collectedAt).run();
    if(isOpportunityCandidate(notice.title)){
      await db.prepare(`INSERT OR IGNORE INTO opportunities
        (id,dedupe_key,title,organization,region,field,facility_types_json,application_start,deadline,deadline_verification,deadline_evidence,deadline_evidence_location,eligibility_verification,eligibility_evidence,eligibility_evidence_location,amount_won,amount_text,self_burden,support_details,review_status,published_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(opportunityId,notice.dedupeKey,notice.title,source.name,source.region,inferField(notice.title),JSON.stringify(["기타 / 확인 필요"]),null,null,Verification.UNKNOWN,null,null,Verification.UNKNOWN,null,null,null,null,null,null,ReviewStatus.REVIEW_REQUIRED,notice.publishedAt,notice.collectedAt).run();
      await db.prepare("INSERT OR IGNORE INTO opportunity_sources (opportunity_id,raw_notice_id,is_primary,created_at) VALUES (?,?,1,?)")
        .bind(opportunityId,rawId,notice.collectedAt).run();
    }
  }
  return{state:existing?"MATCHED" as const:"NEW" as const,rawNoticeId:existing?.id??rawId};
}

export type AttachmentDiscoveryDependencies={queue?:QueueLike<AttachmentQueueMessage>;fetcher?:typeof fetch};

async function runSource(db:D1DatabaseLike,crawlRunId:string,collector:Collector,attachments?:AttachmentDiscoveryDependencies):Promise<SourceRunResult>{
  const sourceRunId=crypto.randomUUID();const startedAt=iso();const parserVersion=collector.parserVersion??"v3-unknown";
  await db.prepare(`INSERT INTO source_runs
    (id,crawl_run_id,source_id,status,started_at,found,inserted,matched,error,items_found,items_new,items_updated,items_matched,items_analyzed,result,http_status,parser_version,error_code,error_message)
    VALUES (?,?,?,'RUNNING',?,0,0,0,NULL,0,0,0,0,0,'RUNNING',NULL,?,NULL,NULL)`).bind(sourceRunId,crawlRunId,collector.source.id,startedAt,parserVersion).run();
  try{
    const raw=await collector.collect();const notices=dedupeNotices(raw);let itemsNew=0;let itemsUpdated=0;let itemsMatched=0;
    for(const notice of notices){const persisted=await persistNotice(db,notice,collector.source,sourceRunId);if(persisted.state==="NEW")itemsNew++;else{itemsUpdated++;itemsMatched++;}if(attachments)await discoverAndQueueAttachments(db,attachments.queue,collector.source,notice,persisted.rawNoticeId,sourceRunId,attachments.fetcher).catch(()=>undefined);}
    const finishedAt=iso();const httpStatus=collector.lastHttpStatus??null;
    await db.prepare(`UPDATE source_runs SET status='SUCCESS',finished_at=?,found=?,inserted=?,matched=?,items_found=?,items_new=?,items_updated=?,items_matched=?,items_analyzed=?,result='SUCCESS',http_status=?,parser_version=?,error=NULL,error_code=NULL,error_message=NULL WHERE id=?`)
      .bind(finishedAt,raw.length,itemsNew,itemsMatched,raw.length,itemsNew,itemsUpdated,itemsMatched,notices.length,httpStatus,parserVersion,sourceRunId).run();
    return{sourceId:collector.source.id,status:"SUCCESS",startedAt,finishedAt,found:raw.length,inserted:itemsNew,updated:itemsUpdated,matched:itemsMatched,analyzed:notices.length,httpStatus,parserVersion,error:null,notices};
  }catch(error){
    const finishedAt=iso();const message=error instanceof Error?error.message:"Unknown collector error";const httpStatus=collector.lastHttpStatus??null;
    await db.prepare(`UPDATE source_runs SET status='FAILED',finished_at=?,result='FAILED',http_status=?,parser_version=?,error=?,error_code='COLLECTOR_ERROR',error_message=? WHERE id=?`)
      .bind(finishedAt,httpStatus,parserVersion,message,message,sourceRunId).run();
    return{sourceId:collector.source.id,status:"FAILED",startedAt,finishedAt,found:0,inserted:0,updated:0,matched:0,analyzed:0,httpStatus,parserVersion,error:message,notices:[]};
  }
}

export async function runCollectionToD1(db:D1DatabaseLike,collectors:Collector[],trigger:CollectionTrigger,attachments?:AttachmentDiscoveryDependencies):Promise<CrawlRunResult>{
  const holder=crypto.randomUUID();const lockTime=new Date();if(!await acquireLock(db,holder,lockTime))throw new CollectionLockedError();
  const crawlRunId=crypto.randomUUID();const startedAt=lockTime.toISOString();
  try{
    await seedSources(db,startedAt);
    await db.prepare("INSERT INTO crawl_runs (id,status,started_at,trigger,error_count) VALUES (?,'RUNNING',?,?,0)").bind(crawlRunId,startedAt,trigger).run();
    const sourceRuns:SourceRunResult[]=[];
    for(const collector of collectors)sourceRuns.push(await runSource(db,crawlRunId,collector,attachments));
    const failures=sourceRuns.filter(run=>run.status==="FAILED").length;const status=failures===0?"SUCCESS":failures===sourceRuns.length?"FAILED":"PARTIAL";const finishedAt=iso();
    await db.prepare("UPDATE crawl_runs SET status=?,finished_at=?,error_count=? WHERE id=?").bind(status,finishedAt,failures,crawlRunId).run();
    return{id:crawlRunId,trigger,startedAt,finishedAt,status,sourceRuns};
  }catch(error){
    const finishedAt=iso();await db.prepare("UPDATE crawl_runs SET status='FAILED',finished_at=?,error_count=error_count+1 WHERE id=?").bind(finishedAt,crawlRunId).run().catch(()=>undefined);throw error;
  }finally{await releaseLock(db,holder);}
}
