import { dedupeNotices } from "./dedupe.ts";
import { OfficialBoardCollector } from "./web-collector.ts";
import { sourceRegistry } from "./registry.ts";
import type { Collector, CrawlRunResult, SourceRunResult } from "./contracts.ts";

export function betaCollectors():Collector[]{return sourceRegistry.filter(source=>source.implemented).map(source=>new OfficialBoardCollector(source));}

export async function runCollection(collectors:Collector[]):Promise<CrawlRunResult>{
  const startedAt=new Date().toISOString();
  const sourceRuns:SourceRunResult[]=await Promise.all(collectors.map(async collector=>{
    const sourceStarted=new Date().toISOString();
    try{const raw=await collector.collect();const notices=dedupeNotices(raw);return{sourceId:collector.source.id,status:"SUCCESS" as const,startedAt:sourceStarted,finishedAt:new Date().toISOString(),found:raw.length,inserted:notices.length,updated:0,matched:0,analyzed:notices.length,httpStatus:collector.lastHttpStatus??null,parserVersion:collector.parserVersion??"v3-unknown",error:null,notices};}
    catch(error){return{sourceId:collector.source.id,status:"FAILED" as const,startedAt:sourceStarted,finishedAt:new Date().toISOString(),found:0,inserted:0,updated:0,matched:0,analyzed:0,httpStatus:collector.lastHttpStatus??null,parserVersion:collector.parserVersion??"v3-unknown",error:error instanceof Error?error.message:"Unknown collector error",notices:[]};}
  }));
  const failures=sourceRuns.filter(run=>run.status==="FAILED").length;
  return{startedAt,finishedAt:new Date().toISOString(),status:failures===0?"SUCCESS":failures===sourceRuns.length?"FAILED":"PARTIAL",sourceRuns};
}
