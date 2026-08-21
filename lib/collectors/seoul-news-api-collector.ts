import { makeDedupeKey } from "./dedupe.ts";
import type { Collector, RawNotice, SourceDefinition } from "./contracts.ts";

const NOTICE_HINT=/(공모|모집|지원\s*사업|참여\s*(기관|단체)|운영기관|신청)/;
type SeoulNewsRow={POST_ID?:string|number;POST_TITLE?:string;POST_CONTENT?:string;POST_EXCERPT?:string;PUBLISH_DATE?:string;BLOG_NAME?:string};
type SeoulNewsResponse={SeoulNewsList?:{RESULT?:{CODE?:string;MESSAGE?:string};row?:SeoulNewsRow[]};RESULT?:{CODE?:string;MESSAGE?:string}};
function strip(value:string){return value.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ").trim();}
function published(value:string|undefined){if(!value)return null;const parsed=new Date(`${value.trim().replace(" ","T")}+09:00`);return Number.isNaN(parsed.getTime())?null:parsed.toISOString();}

export class SeoulNewsApiCollector implements Collector{
  parserVersion="v3-api-seoul-news-1";lastHttpStatus:number|null=null;source:SourceDefinition;private apiKey?:string;private fetcher:typeof fetch;
  constructor(source:SourceDefinition,apiKey?:string,fetcher?:typeof fetch){this.source=source;this.apiKey=apiKey;this.fetcher=fetcher??globalThis.fetch.bind(globalThis);}
  async collect(signal?:AbortSignal):Promise<RawNotice[]>{
    if(!this.apiKey)throw new Error("SEOUL_OPEN_API_KEY is not configured");
    const endpoint=`${this.source.url}/${encodeURIComponent(this.apiKey)}/json/SeoulNewsList/1/100/`;const response=await this.fetcher(endpoint,{signal,headers:{"user-agent":"YouthGrant-Public-Beta/3.0 (+https://youthgrant.seoeum1711.workers.dev)"}});this.lastHttpStatus=response.status;if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const body=await response.json() as SeoulNewsResponse;const service=body.SeoulNewsList;const code=service?.RESULT?.CODE??body.RESULT?.CODE;if(!service||code!=="INFO-000")throw new Error(`Seoul API ${code??"UNKNOWN"}: ${service?.RESULT?.MESSAGE??body.RESULT?.MESSAGE??"invalid response"}`);
    const collectedAt=new Date().toISOString();return(service.row??[]).flatMap(row=>{const title=strip(row.POST_TITLE??"");if(!title||!NOTICE_HINT.test(title))return[];const id=String(row.POST_ID??"");const url=`https://www.seoul.go.kr/news/news.do?postId=${encodeURIComponent(id)}`;const rawText=strip(row.POST_CONTENT??row.POST_EXCERPT??title);return[{sourceId:this.source.id,sourceNoticeId:id||null,title,url,publishedAt:published(row.PUBLISH_DATE),rawText,collectedAt,dedupeKey:makeDedupeKey(this.source.id,title,url)} satisfies RawNotice];});
  }
}
