import { dedupeNotices } from "./dedupe.ts";
import { OfficialBoardCollector, YouthBoardCollector } from "./web-collector.ts";
import { sourceRegistry } from "./registry.ts";
import { RssCollector } from "./rss-collector.ts";
import { SeoulNewsApiCollector } from "./seoul-news-api-collector.ts";
import type { YouthGrantEnv } from "../cloudflare.ts";
import type { Collector, CrawlRunResult, SourceRunResult } from "./contracts.ts";
import { classifySourceFailure } from "./fetch-policy.ts";

export function betaCollectors(env:Pick<YouthGrantEnv,"SEOUL_OPEN_API_KEY">={}):Collector[]{return sourceRegistry.filter(source=>source.implemented&&source.enabled).map(source=>source.method==="RSS"?new RssCollector(source):source.method==="API"?new SeoulNewsApiCollector(source,env.SEOUL_OPEN_API_KEY):["kywa","ggyouth","ggyouthnet"].includes(source.id)?new YouthBoardCollector(source):new OfficialBoardCollector(source));}

export async function runCollection(collectors:Collector[]):Promise<CrawlRunResult>{
  const startedAt=new Date().toISOString();
  const sourceRuns:SourceRunResult[]=await Promise.all(collectors.map(async collector=>{
    const sourceStarted=new Date().toISOString();
    try{const raw=await collector.collect();const notices=dedupeNotices(raw);return{sourceId:collector.source.id,status:"SUCCESS" as const,result:raw.length?"SUCCESS_WITH_ITEMS" as const:"SUCCESS_NO_ITEMS" as const,startedAt:sourceStarted,finishedAt:new Date().toISOString(),found:raw.length,inserted:notices.length,updated:0,matched:0,analyzed:notices.length,httpStatus:collector.lastHttpStatus??null,parserVersion:collector.parserVersion??"v3-unknown",errorCode:null,error:null,notices};}
    catch(error){const failure=classifySourceFailure(error);return{sourceId:collector.source.id,status:"FAILED" as const,result:"FAILED" as const,startedAt:sourceStarted,finishedAt:new Date().toISOString(),found:0,inserted:0,updated:0,matched:0,analyzed:0,httpStatus:collector.lastHttpStatus??failure.httpStatus,parserVersion:collector.parserVersion??"v3-unknown",errorCode:failure.code,error:failure.message,notices:[]};}
  }));
  const failures=sourceRuns.filter(run=>run.status==="FAILED").length;
  return{startedAt,finishedAt:new Date().toISOString(),status:failures===0?"SUCCESS":failures===sourceRuns.length?"FAILED":"PARTIAL",sourceRuns};
}
