import type { D1DatabaseLike, QueueLike } from "../cloudflare.ts";
import type { RawNotice, SourceDefinition } from "../collectors/contracts.ts";
import { fetchWithPolicy } from "../collectors/fetch-policy.ts";
import type { AttachmentDiscoveryStatus, AttachmentQueueMessage, DiscoveredAttachment, DocumentRole } from "./contracts.ts";
import { extensionOf } from "./file-type.ts";

const SUPPORTED=/\.(pdf|hwpx|hwp|zip|jpe?g|png)(?:$|[?#])/i;
const DOWNLOAD_HINT=/(download(?:BbsFile|ContentsFile)?\.do|atchmnflNo=|fileNo=)/i;
function decode(value:string){return value.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/\s+/g," ").trim();}
function absolute(base:string,href:string){try{const url=new URL(href.replace(/&amp;/g,"&"),base);return url.protocol==="http:"||url.protocol==="https:"?url.toString():null;}catch{return null;}}
function attachmentUrl(source:SourceDefinition,noticeUrl:string,href:string){
  if(source.id==="ggyouth"){
    const download=href.match(/^javascript:\s*fn_egov_downFile\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*;?$/i);
    if(download)return absolute(noticeUrl,`/cmm/fms/FileDown.do?atchFileId=${encodeURIComponent(download[1])}&fileSn=${encodeURIComponent(download[2])}`);
  }
  return absolute(noticeUrl,href);
}
export function classifyDocumentRole(filename:string):{role:DocumentRole;priority:number}{
  if(/\.(jpe?g|png)$/i.test(filename))return{role:"MEDIA",priority:10};
  if(/(신청서|지원신청서|제안서|사업계획서|양식|서식|동의서)/.test(filename))return{role:"FORM",priority:40};
  if(/(공고문|모집공고|공모안내|사업안내|시행계획|모집요강|안내문)/.test(filename))return{role:"PRIMARY",priority:100};
  if(/(FAQ|자주\s*묻는|예산편성지침|사업지침|운영지침|세부안내|질의답변)/i.test(filename))return{role:"SUPPORTING",priority:80};
  return{role:"UNKNOWN",priority:20};
}
function filenameFrom(text:string,url:string){const textMatch=text.match(/([^/<>]{1,180}\.(?:pdf|hwpx|hwp|zip|jpe?g|png))/i);if(textMatch)return textMatch[1].trim();try{const path=decodeURIComponent(new URL(url).pathname);const last=path.split("/").pop()??"";if(SUPPORTED.test(last))return last;}catch{/**/}const uuid=url.match(/[?&]uuid=([^&]+)/i)?.[1];if(uuid)return decodeURIComponent(uuid);return text.slice(0,120)||"attachment";}
function mime(extension:string|null){return extension==="pdf"?"application/pdf":extension==="hwpx"?"application/vnd.hancom.hwpx":extension==="hwp"?"application/x-hwp":extension==="zip"?"application/zip":extension==="jpg"||extension==="jpeg"?"image/jpeg":extension==="png"?"image/png":null;}
export function supportsAttachmentDiscovery(source:SourceDefinition,notice:RawNotice){
  if(source.id==="gfgf"||source.id==="mpva")return true;
  if(source.id==="kywa")return /\/pressinfo\/notice_view\.jsp(?:[?#]|$)/i.test(notice.url);
  if(source.id==="ggyouth")return /\/07_openYard\/noticeView\.do(?:[?#]|$)/i.test(notice.url);
  return/selectBbsNttView\.do|\/view\.do/.test(notice.url);
}

export async function discoverAttachments(source:SourceDefinition,notice:RawNotice,fetcher:typeof fetch=globalThis.fetch.bind(globalThis)):Promise<DiscoveredAttachment[]>{
  if(!supportsAttachmentDiscovery(source,notice))return[];const response=await fetchWithPolicy(notice.url,{headers:{"user-agent":"YouthGrant-Public-Beta/3.0 (+https://youthgrant.seoeum1711.workers.dev)"}},{fetcher});const contentType=response.headers.get("content-type")??"";if(contentType&&!/html|text/.test(contentType))return[];const html=await response.text();const found=new Map<string,DiscoveredAttachment>();
  for(const match of html.matchAll(/<a\b[^>]*href=(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){const href=match[2];const text=decode(match[3]);if(/^미리보기\s*$/i.test(text)||(!SUPPORTED.test(href)&&!SUPPORTED.test(text)&&!DOWNLOAD_HINT.test(href)))continue;const url=attachmentUrl(source,notice.url,href);if(!url||/\/images\/wa\/|wa_certificate/i.test(url))continue;const filename=filenameFrom(text,url);const extension=extensionOf(filename);if(!extension&&!DOWNLOAD_HINT.test(url))continue;const classified=classifyDocumentRole(filename);found.set(url,{url,filename,extension,mimeType:mime(extension),...classified});}
  return[...found.values()].sort((a,b)=>b.priority-a.priority);
}

async function stableId(value:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));return`att_${[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("").slice(0,24)}`;}
function changes(result:{meta?:{changes?:number}}){return result.meta?.changes??0;}

export async function discoverAndQueueAttachments(db:D1DatabaseLike,queue:QueueLike<AttachmentQueueMessage>|undefined,source:SourceDefinition,notice:RawNotice,rawNoticeId:string,sourceRunId:string,fetcher?:typeof fetch){
  if(!supportsAttachmentDiscovery(source,notice)){await db.prepare("UPDATE raw_notices SET attachment_discovery_status='UNSUPPORTED',attachment_discovered_at=? WHERE id=?").bind(new Date().toISOString(),rawNoticeId).run();return 0;}
  const state=await db.prepare("SELECT attachment_discovery_status FROM raw_notices WHERE id=?").bind(rawNoticeId).first<{attachment_discovery_status:AttachmentDiscoveryStatus}>();if(state?.attachment_discovery_status==="COMPLETE")return 0;let discovered:DiscoveredAttachment[];
  try{discovered=await discoverAttachments(source,notice,fetcher);}catch(error){await db.prepare("UPDATE raw_notices SET attachment_discovery_status='FAILED',attachment_discovered_at=? WHERE id=?").bind(new Date().toISOString(),rawNoticeId).run();throw error;}
  let inserted=0;for(const item of discovered){const id=await stableId(`${rawNoticeId}:${item.url}`);const now=new Date().toISOString();const result=await db.prepare(`INSERT OR IGNORE INTO attachments (id,raw_notice_id,source_id,source_run_id,name,url,content_type,extension,document_role,priority,fetch_status,parse_status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'DISCOVERED','PENDING',?)`).bind(id,rawNoticeId,source.id,sourceRunId,item.filename,item.url,item.mimeType,item.extension,item.role,item.priority,now).run();if(changes(result)===0)continue;inserted++;if(queue){try{await queue.send({attachmentId:id,rawNoticeId,sourceId:source.id,url:item.url});}catch(error){const message=error instanceof Error?error.message:"Queue send failed";await db.prepare("UPDATE attachments SET parse_status='QUEUE_BLOCKED',error_code='QUEUE_SEND_FAILED',error_message=? WHERE id=?").bind(message,id).run();}}else await db.prepare("UPDATE attachments SET parse_status='QUEUE_BLOCKED',error_code='QUEUE_UNAVAILABLE',error_message='ATTACHMENT_QUEUE binding is unavailable' WHERE id=?").bind(id).run();}
  const now=new Date().toISOString();await db.batch([db.prepare("UPDATE raw_notices SET attachment_discovery_status='COMPLETE',attachment_discovered_at=? WHERE id=?").bind(now,rawNoticeId),db.prepare("UPDATE source_runs SET attachments_discovered=attachments_discovered+? WHERE id=?").bind(inserted,sourceRunId)]);return inserted;
}
