import type { D1DatabaseLike, QueueLike, YouthGrantEnv } from "../cloudflare.ts";
import type { AttachmentQueueMessage } from "../attachments/contracts.ts";
import { discoverAndQueueAttachments } from "../attachments/discovery.ts";
import { processAttachmentMessage } from "../attachments/pipeline.ts";
import { CURRENT_VERIFICATION_VERSION } from "../attachments/verification.ts";
import type { RawNotice } from "../collectors/contracts.ts";
import { getSource } from "../collectors/registry.ts";
import { finalizeOpportunityVerification } from "./opportunity-finalization.ts";

type TargetRow={id:string;review_status:string;raw_notice_id:string;source_id:string;source_run_id:string|null;source_notice_id:string|null;title:string;url:string;published_at:string|null;raw_text:string;collected_at:string;dedupe_key:string;relevance_status:string;attachment_discovery_status:string};
type ResultRow={review_status:string;deadline:string|null;deadline_verification:string;eligibility_verification:string;facility_types_json:string};
type ReverificationEnv=Pick<YouthGrantEnv,"DB"|"ENVIRONMENT"|"SITE_ORIGIN"|"TELEGRAM_BOT_TOKEN"|"TELEGRAM_CHAT_ID">;
type Dependencies={processMessage?:typeof processAttachmentMessage;fetcher?:typeof fetch};

export type TargetedReverificationResult={opportunityId:string;processed:number;failed:number;reviewStatus:string;deadline:string|null;deadlineVerification:string;eligibilityVerification:string;facilityTypes:string[]};

export class TargetedReverificationError extends Error{
  readonly status:number;
  constructor(message:string,status:number){super(message);this.name="TargetedReverificationError";this.status=status;}
}

function changes(result:{meta?:{changes?:number}}){return result.meta?.changes??0;}
function facilities(value:string){try{const parsed=JSON.parse(value);return Array.isArray(parsed)&&parsed.every(item=>typeof item==="string")?parsed:[];}catch{return[];}}
function rawNotice(row:TargetRow):RawNotice{return{sourceId:row.source_id,sourceNoticeId:row.source_notice_id,title:row.title,url:row.url,publishedAt:row.published_at,rawText:row.raw_text,collectedAt:row.collected_at,dedupeKey:row.dedupe_key};}

async function claimRecoverableAttachments(db:D1DatabaseLike,target:TargetRow){
  const candidates=await db.prepare(`SELECT id,url FROM attachments
    WHERE raw_notice_id=? AND parent_attachment_id IS NULL AND (
      (parse_status='PARSED' AND (verification_version IS NULL OR verification_version<>?))
      OR (parse_status='PARSE_FAILED' AND (error_code='ATTACHMENT_TYPE_MISMATCH' OR error_code IN ('FETCH_TIMEOUT','RATE_LIMITED','HTTP_SERVER_ERROR','NETWORK_ERROR') OR error_code LIKE 'ATTACHMENT_HTTP_5__'))
      OR parse_status='QUEUE_BLOCKED'
    ) ORDER BY priority DESC,created_at ASC`).bind(target.raw_notice_id,CURRENT_VERIFICATION_VERSION).all<{id:string;url:string}>();
  const messages:AttachmentQueueMessage[]=[];
  for(const item of candidates.results){const claimed=await db.prepare(`UPDATE attachments SET parse_status='PENDING',error_code=NULL,error_message=NULL
    WHERE id=? AND (
      (parse_status='PARSED' AND (verification_version IS NULL OR verification_version<>?))
      OR (parse_status='PARSE_FAILED' AND (error_code='ATTACHMENT_TYPE_MISMATCH' OR error_code IN ('FETCH_TIMEOUT','RATE_LIMITED','HTTP_SERVER_ERROR','NETWORK_ERROR') OR error_code LIKE 'ATTACHMENT_HTTP_5__'))
      OR parse_status='QUEUE_BLOCKED'
    )`).bind(item.id,CURRENT_VERIFICATION_VERSION).run();if(changes(claimed)>0)messages.push({attachmentId:item.id,rawNoticeId:target.raw_notice_id,sourceId:target.source_id,url:item.url,reverify:true});}
  return messages;
}

export async function reverifyOpportunity(env:ReverificationEnv,opportunityId:string,dependencies:Dependencies={}):Promise<TargetedReverificationResult>{
  const target=await env.DB.prepare(`SELECT o.id,o.review_status,rn.id AS raw_notice_id,rn.source_id,rn.source_run_id,rn.source_notice_id,rn.title,rn.url,rn.published_at,rn.raw_text,rn.collected_at,rn.dedupe_key,rn.relevance_status,rn.attachment_discovery_status
    FROM opportunities o JOIN opportunity_sources os ON os.opportunity_id=o.id AND os.is_primary=1 JOIN raw_notices rn ON rn.id=os.raw_notice_id WHERE o.id=? LIMIT 1`).bind(opportunityId).first<TargetRow>();
  if(!target)throw new TargetedReverificationError("검토할 공고를 찾을 수 없습니다.",404);
  if(target.relevance_status!=="IN_SCOPE")throw new TargetedReverificationError("YouthGrant 대상 공고만 자동 재검증할 수 있습니다.",409);
  if(target.review_status!=="PENDING"&&target.review_status!=="REVIEW_REQUIRED")throw new TargetedReverificationError("PENDING 또는 REVIEW_REQUIRED 공고만 자동 재검증할 수 있습니다.",409);
  const source=getSource(target.source_id);if(!source)throw new TargetedReverificationError("공고 출처 설정을 확인할 수 없습니다.",409);

  console.info("Targeted opportunity reverification started",{opportunityId});
  const messages:AttachmentQueueMessage[]=[];const capture:QueueLike<AttachmentQueueMessage>={async send(message){messages.push({...message,notifyOnFinalize:false});}};
  if(target.attachment_discovery_status!=="COMPLETE"){
    if(!target.source_run_id)throw new TargetedReverificationError("첨부 발견 기록을 다시 처리할 수 없습니다.",409);
    await discoverAndQueueAttachments(env.DB,capture,source,rawNotice(target),target.raw_notice_id,target.source_run_id,dependencies.fetcher,false);
  }
  messages.push(...await claimRecoverableAttachments(env.DB,target));
  const unique=[...new Map(messages.map(message=>[message.attachmentId,message])).values()];
  if(!unique.length){const pending=await env.DB.prepare("SELECT COUNT(*) AS count FROM attachments WHERE raw_notice_id=? AND parse_status='PENDING'").bind(target.raw_notice_id).first<{count:number}>();if(Number(pending?.count??0)>0)throw new TargetedReverificationError("이미 자동 재검증이 진행 중입니다.",409);}
  let failed=0;
  for(const message of unique){try{await (dependencies.processMessage??processAttachmentMessage)(env,{...message,notifyOnFinalize:false},dependencies.fetcher);}catch{failed++;}}
  await finalizeOpportunityVerification(env.DB,target.raw_notice_id);
  const result=await env.DB.prepare("SELECT review_status,deadline,deadline_verification,eligibility_verification,facility_types_json FROM opportunities WHERE id=?").bind(opportunityId).first<ResultRow>();
  if(!result)throw new TargetedReverificationError("재검증 결과를 확인할 수 없습니다.",404);
  console.info("Targeted opportunity reverification completed",{opportunityId,reviewStatus:result.review_status});
  return{opportunityId,processed:unique.length,failed,reviewStatus:result.review_status,deadline:result.deadline,deadlineVerification:result.deadline_verification,eligibilityVerification:result.eligibility_verification,facilityTypes:facilities(result.facility_types_json)};
}
