import { makeDedupeKey } from "./dedupe.ts";
import type { Collector, RawNotice, SourceDefinition } from "./contracts.ts";

const TITLE_HINT=/(공모|모집\s*공고|사업\s*공고|참가.{0,20}모집|지원사업|참여기관)/;
function decode(value:string){return value.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&(?:#39|apos);/g,"'").replace(/\s+/g," ").trim();}
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

const YOUTH_SOURCE_IDS=new Set(["kywa","ggyouth","ggyouthnet"]);
const YOUTH_NOTICE_HINT=/(공모|모집|지원사업|참여.{0,20}(?:기관|시설)|(?:기관|시설).{0,20}(?:신청|접수)|신청\s*안내)/;
function dateNear(html:string,index:number){const context=html.slice(index,Math.min(html.length,index+1600));const value=context.match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/)?.[0];if(!value)return null;const [year,month,day]=value.split(/[.\-/]/).map(Number);return new Date(Date.UTC(year,month-1,day)).toISOString();}
function noticeId(url:string){try{const parsed=new URL(url);return parsed.searchParams.get("no")??parsed.searchParams.get("idx")??parsed.searchParams.get("wr_id");}catch{return null;}}

export class YouthBoardCollector implements Collector{
  source:SourceDefinition;parserVersion="v4-youth-board-1";lastHttpStatus:number|null=null;private fetcher:typeof fetch;
  constructor(source:SourceDefinition,fetcher:typeof fetch=fetch){if(!YOUTH_SOURCE_IDS.has(source.id))throw new Error(`Unsupported youth board source: ${source.id}`);this.source=source;this.fetcher=fetcher;}
  async collect(signal?:AbortSignal):Promise<RawNotice[]>{
    const response=await this.fetcher(this.source.url,{signal,headers:{"user-agent":"YouthGrant-Public-Beta/4.0 (+https://youthgrant.seoeum1711.workers.dev)"}});this.lastHttpStatus=response.status;if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const charset=response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1]??"utf-8";const encoding=/euc-?kr|ks_c_5601/i.test(charset)?"euc-kr":"utf-8";const html=new TextDecoder(encoding).decode(await response.arrayBuffer());const collectedAt=new Date().toISOString();const results:RawNotice[]=[];const seen=new Set<string>();
    const add=(title:string,url:string,index:number)=>{title=decode(title);if(title.length<8||title.length>180||!YOUTH_NOTICE_HINT.test(title)||seen.has(url))return;seen.add(url);results.push({sourceId:this.source.id,sourceNoticeId:noticeId(url),title,url,publishedAt:dateNear(html,index),rawText:title,collectedAt,dedupeKey:makeDedupeKey(this.source.id,title,url)});};
    if(this.source.id==="ggyouth"){
      for(const match of html.matchAll(/<a\b(?=[^>]*\bdata-view\b)(?=[^>]*\bidx=["']?(\d+)["']?)(?=[^>]*\batchFileId=["']([^"']*)["'])[^>]*>([\s\S]*?)<\/a>/gi)){const idx=match[1];const file=match[2];add(match[3],absolute(this.source.url,`/07_openYard/noticeView.do?idx=${encodeURIComponent(idx)}&atchFileId=${encodeURIComponent(file)}`),match.index);}
    }else{
      const hrefPattern=this.source.id==="kywa"?/notice_view\.jsp\?[^"']*\bno=\d+/i:/board\.php\?[^"']*\bbo_table=notice_n(?:&amp;|&)wr_id=\d+/i;
      for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){if(hrefPattern.test(match[1]))add(match[2],absolute(this.source.url,match[1]),match.index);}
    }
    return results.slice(0,60);
  }
}
