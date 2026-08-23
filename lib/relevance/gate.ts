import type { RawNotice } from "../collectors/contracts.ts";
import { fetchWithPolicy } from "../collectors/fetch-policy.ts";
import { classifyOpportunityRelevance, type RelevanceDecision } from "./classifier.ts";

function decodeEntities(value:string){return value.replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&(?:#39|apos);/gi,"'").replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code)));}
export function htmlToRelevantText(html:string){return decodeEntities(html.replace(/<(script|style|svg|noscript|head|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<br\s*\/?\s*>|<\/p>|<\/li>|<\/tr>|<\/div>|<\/h[1-6]>/gi,"\n").replace(/<[^>]+>/g," ")).replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim().slice(0,100_000);}
export function focusDetailText(text:string,title:string){const start=text.indexOf(title);const detail=text.slice(start>=0?start:0);const minimum=title.length+20;const stops=["다음글","이전글","목록보기","담당자 정보","개인정보처리방침"].map(marker=>detail.indexOf(marker,minimum)).filter(index=>index>=0);return detail.slice(0,stops.length?Math.min(...stops):20_000).trim();}
function materialRawText(notice:RawNotice){const raw=notice.rawText.trim();return raw.length>=notice.title.trim().length+40?raw:null;}

export async function assessNoticeRelevance(notice:RawNotice,fetcher:typeof fetch=globalThis.fetch.bind(globalThis)):Promise<RelevanceDecision>{
  const raw=materialRawText(notice);if(raw)return classifyOpportunityRelevance({title:notice.title,body:raw});
  try{
    const response=await fetchWithPolicy(notice.url,{headers:{"user-agent":"YouthGrant-Public-Beta/4.0 (+https://youthgrant.seoeum1711.workers.dev)"}},{fetcher});
    const bytes=await response.arrayBuffer();const headerCharset=response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1];const ascii=new TextDecoder("windows-1252").decode(bytes.slice(0,4096));const metaCharset=ascii.match(/charset\s*=\s*["']?([^\s"'/>;]+)/i)?.[1];const hostname=new URL(notice.url).hostname;const charset=headerCharset??metaCharset??(/(?:^|\.)kywa\.or\.kr$/i.test(hostname)?"euc-kr":"utf-8");const encoding=/euc-?kr|ks_c_5601/i.test(charset)?"euc-kr":"utf-8";const html=new TextDecoder(encoding).decode(bytes);const text=focusDetailText(htmlToRelevantText(html),notice.title);return classifyOpportunityRelevance({title:notice.title,body:text});
  }catch{return{status:"RELEVANCE_REVIEW",reason:"상세 본문을 읽지 못해 공모사업 해당 여부를 운영자 검토로 보류",signals:[]};}
}
