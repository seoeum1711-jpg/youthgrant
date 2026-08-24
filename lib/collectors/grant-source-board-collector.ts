import { makeDedupeKey } from "./dedupe.ts";
import { FetchPolicyError, fetchWithPolicy } from "./fetch-policy.ts";
import type { Collector, RawNotice, SourceDefinition } from "./contracts.ts";

const SUPPORTED_SOURCES=new Set(["mogef","fry","sdream"]);
const MOGEF_TITLE_HINT=/(?:공모|지원사업|모집\s*공고)/;
const FRY_TITLE_HINT=/(?:(?:성장\s*네트워크|꿈자람)[^\n]{0,80}(?:지원사업|공모|모집)|지원사업[^\n]{0,80}(?:공모|모집))/;
const FRY_RESULT_NOTICE=/(?:심사|선정)\s*결과|결과\s*발표|사업\s*시행/;
const SDREAM_TITLE_HINT=/배움터\s*교육지원사업\s*공모/;

function decode(value:string){return value.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(Number(code))).replace(/&(?:#39|apos);/gi,"'").replace(/\s+/g," ").trim();}
function absolute(base:string,href:string){return new URL(href.replace(/&amp;/g,"&"),base).toString();}
function published(value:string|null){if(!value)return null;const [year,month,day]=value.split(/[.\-/]/).map(Number);if(!year||!month||!day)return null;return new Date(Date.UTC(year,month-1,day)).toISOString();}
function dateNear(html:string,index:number){return published(html.slice(index,Math.min(html.length,index+1400)).match(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/)?.[0]??null);}

function raw(source:SourceDefinition,id:string,title:string,url:string,publishedAt:string|null,collectedAt:string):RawNotice{return{sourceId:source.id,sourceNoticeId:id,title,url,publishedAt,rawText:title,collectedAt,dedupeKey:makeDedupeKey(source.id,title,url)};}

function parseMogef(source:SourceDefinition,html:string,collectedAt:string){const results:RawNotice[]=[];const seen=new Set<string>();for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const id=row[1].match(/fn_selectView\(['"]?(\d+)/i)?.[1];if(!id||seen.has(id))continue;const anchor=row[1].match(/<a\b[^>]*fn_selectView[^>]*>([\s\S]*?)<\/a>/i);const title=decode(anchor?.[1]??"");if(!MOGEF_TITLE_HINT.test(title))continue;const dates=[...row[1].matchAll(/20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}/g)].map(match=>match[0]);const url=absolute(source.url,`/nw/ntc/nw_ntc_s001d.do?mid=news400&bbtSn=${encodeURIComponent(id)}`);seen.add(id);results.push(raw(source,id,title,url,published(dates.at(-1)??null),collectedAt));}return results;}

function parseFry(source:SourceDefinition,html:string,collectedAt:string){const results:RawNotice[]=[];const seen=new Set<string>();for(const link of html.matchAll(/<a\b[^>]*href=["']([^"']*view\.php\?[^"']*\btn=board_news01[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)){const title=decode(link[2]);if(!FRY_TITLE_HINT.test(title)||FRY_RESULT_NOTICE.test(title))continue;const parsed=new URL(absolute(source.url,link[1]));const id=parsed.searchParams.get("uid");const gid=parsed.searchParams.get("gid");if(!id||!gid||seen.has(id))continue;const url=absolute(source.url,`/board_news01/view.php?tn=board_news01&uid=${encodeURIComponent(id)}&gid=${encodeURIComponent(gid)}`);seen.add(id);results.push(raw(source,id,title,url,dateNear(html,link.index),collectedAt));}return results;}

function parseSdream(source:SourceDefinition,html:string,collectedAt:string){const results:RawNotice[]=[];const seen=new Set<string>();for(const link of html.matchAll(/<a\b[^>]*onclick=["'][^"']*onView\(['"]([^'"]+)['"][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){const id=link[1];const date=link[2].match(/<span\b[^>]*class=["']date["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]??null;const title=decode(link[2].replace(/<span\b[^>]*class=["']date["'][^>]*>[\s\S]*?<\/span>/gi,""));if(!SDREAM_TITLE_HINT.test(title)||seen.has(id))continue;const url=absolute(source.url,`/w/bbs0103V?BBS_SID=${encodeURIComponent(id)}`);seen.add(id);results.push(raw(source,id,title,url,published(date?decode(date):null),collectedAt));}return results;}

export class GrantSourceBoardCollector implements Collector{
  source:SourceDefinition;parserVersion="v1-grant-source-board";lastHttpStatus:number|null=null;private fetcher:typeof fetch;
  constructor(source:SourceDefinition,fetcher:typeof fetch=globalThis.fetch.bind(globalThis)){if(!SUPPORTED_SOURCES.has(source.id))throw new Error(`Unsupported grant source board: ${source.id}`);this.source=source;this.fetcher=fetcher;}
  async collect(signal?:AbortSignal){
    let response:Response;try{response=await fetchWithPolicy(this.source.url,{signal,headers:{"user-agent":"YouthGrant-Public-Beta/4.0 (+https://youthgrant.seoeum1711.workers.dev)"}},{fetcher:this.fetcher});}catch(error){if(error instanceof FetchPolicyError)this.lastHttpStatus=error.status;throw error;}this.lastHttpStatus=response.status;
    const charset=response.headers.get("content-type")?.match(/charset=([^;\s]+)/i)?.[1]??"utf-8";const encoding=/euc-?kr|ks_c_5601/i.test(charset)?"euc-kr":"utf-8";const html=new TextDecoder(encoding).decode(await response.arrayBuffer());const collectedAt=new Date().toISOString();
    const notices=this.source.id==="mogef"?parseMogef(this.source,html,collectedAt):this.source.id==="fry"?parseFry(this.source,html,collectedAt):parseSdream(this.source,html,collectedAt);return notices.slice(0,60);
  }
}
