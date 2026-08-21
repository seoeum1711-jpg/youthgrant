import { makeDedupeKey } from "./dedupe.ts";
import type { Collector, RawNotice, SourceDefinition } from "./contracts.ts";

const TITLE_HINT=/(공모|모집\s*공고|사업\s*공고|참가.{0,20}모집|지원사업|참여기관)/;
function decode(value:string){return value.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();}
function absolute(base:string,href:string){try{return new URL(href.replace(/&amp;/g,"&"),base).toString();}catch{return base;}}

export class OfficialBoardCollector implements Collector{
  source:SourceDefinition;
  parserVersion="v3-web-1";
  lastHttpStatus:number|null=null;
  constructor(source:SourceDefinition){this.source=source;}
  async collect(signal?:AbortSignal):Promise<RawNotice[]>{
    const response=await fetch(this.source.url,{signal,headers:{"user-agent":"YouthGrant-Public-Beta/3.0 (+https://youthgrant.example)"}});
    this.lastHttpStatus=response.status;
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const html=await response.text();const collectedAt=new Date().toISOString();const results:RawNotice[]=[];
    const links=html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
    for(const match of links){const title=decode(match[2]);if(title.length<8||title.length>180||!TITLE_HINT.test(title))continue;const url=absolute(this.source.url,match[1]);results.push({sourceId:this.source.id,sourceNoticeId:null,title,url,publishedAt:null,rawText:title,collectedAt,dedupeKey:makeDedupeKey(this.source.id,title,url)});if(results.length>=60)break;}
    return results;
  }
}
