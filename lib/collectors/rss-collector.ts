import { makeDedupeKey } from "./dedupe.ts";
import type { Collector, RawNotice, SourceDefinition } from "./contracts.ts";
import { FetchPolicyError, fetchWithPolicy } from "./fetch-policy.ts";

const NOTICE_HINT=/(공모|모집|지원\s*사업|참여\s*(기관|단체)|운영기관|수탁기관)/;
function field(block:string,name:string){const match=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));return match?.[1]??"";}
function decode(value:string){return value.replace(/^\s*<!\[CDATA\[/," ").replace(/\]\]>\s*$/," ").replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/\s+/g," ").trim();}
function published(value:string){const normalized=value.trim().replace(" ","T");const parsed=new Date(`${normalized}+09:00`);return Number.isNaN(parsed.getTime())?null:parsed.toISOString();}

export class RssCollector implements Collector{
  parserVersion="v3-rss-1";lastHttpStatus:number|null=null;source:SourceDefinition;private fetcher:typeof fetch;
  constructor(source:SourceDefinition,fetcher?:typeof fetch){this.source=source;this.fetcher=fetcher??globalThis.fetch.bind(globalThis);}
  async collect(signal?:AbortSignal):Promise<RawNotice[]>{
    let response:Response;try{response=await fetchWithPolicy(this.source.url,{signal,headers:{"user-agent":"YouthGrant-Public-Beta/3.0 (+https://youthgrant.seoeum1711.workers.dev)"}},{fetcher:this.fetcher});}catch(error){if(error instanceof FetchPolicyError)this.lastHttpStatus=error.status;throw error;}this.lastHttpStatus=response.status;
    const xml=await response.text();const collectedAt=new Date().toISOString();const notices:RawNotice[]=[];
    for(const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){const block=match[1];const title=decode(field(block,"title"));if(!title||!NOTICE_HINT.test(title))continue;const url=decode(field(block,"link"))||this.source.url;const rawText=decode(field(block,"cn"))||title;const noticeId=url.match(/#view\/(\d+)/)?.[1]??null;const dedupeKey=noticeId?`${this.source.id}:notice:${noticeId}`:makeDedupeKey(this.source.id,title,url);notices.push({sourceId:this.source.id,sourceNoticeId:noticeId,title,url,publishedAt:published(decode(field(block,"pubDate"))),rawText,collectedAt,dedupeKey});}
    return notices;
  }
}
