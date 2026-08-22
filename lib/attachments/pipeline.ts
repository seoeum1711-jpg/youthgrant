import type { D1DatabaseLike, YouthGrantEnv } from "../cloudflare.ts";
import type { AttachmentEvidence, AttachmentProcessResult, AttachmentQueueMessage, DocumentRole } from "./contracts.ts";
import { classifyDocumentRole } from "./discovery.ts";
import { detectAttachmentFormat, extensionOf } from "./file-type.ts";
import { parseAttachmentBytes } from "./parsers.ts";
import { applyAttachmentEvidence, extractAttachmentEvidence } from "./verification.ts";

const MAX_ATTACHMENT_BYTES=10*1024*1024;
const FINAL_STATUSES=new Set(["PARSED","OCR_REQUIRED","UNSUPPORTED","HWP_PARSER_BLOCKED"]);

type AttachmentRow={
  id:string;
  raw_notice_id:string;
  source_id:string|null;
  source_run_id:string|null;
  parent_attachment_id:string|null;
  name:string;
  url:string;
  content_type:string|null;
  extension:string|null;
  document_role:DocumentRole;
  priority:number;
  fetch_status:string;
  parse_status:string;
  content_hash:string|null;
  archive_depth:number;
};

export async function attachmentContentHash(bytes:Uint8Array){
  const digest=await crypto.subtle.digest("SHA-256",bytes.slice().buffer);
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function stableId(value:string){return`att_${(await attachmentContentHash(new TextEncoder().encode(value))).slice(0,24)}`;}

function dispositionFilename(value:string|null){
  if(!value)return null;
  const encoded=value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if(encoded){try{return decodeURIComponent(encoded);}catch{/**/}}
  const plain=value.match(/filename="?([^";]+)"?/i)?.[1]?.trim()??null;
  if(plain?.includes("%")){try{return decodeURIComponent(plain);}catch{/**/}}
  return plain;
}

async function metric(db:D1DatabaseLike,sourceRunId:string|null,column:string,amount=1){
  if(!sourceRunId)return;
  const allowed=new Set(["attachments_discovered","attachments_fetch_success","attachments_parse_success","attachments_parse_failed","attachments_ocr_required","fields_recovered","fields_verified_by_attachment"]);
  if(!allowed.has(column))return;
  await db.prepare(`UPDATE source_runs SET ${column}=${column}+? WHERE id=?`).bind(amount,sourceRunId).run();
}

async function loadBytes(row:AttachmentRow,fetcher:typeof fetch){
  if(row.url.startsWith("zip:"))throw new Error("ZIP_CHILD_REPROCESS_REQUIRES_PARENT");
  const response=await fetcher(row.url,{headers:{"user-agent":"YouthGrant-Public-Beta/3.0 (+https://youthgrant.seoeum1711.workers.dev)"}});
  if(!response.ok)throw new Error(`ATTACHMENT_HTTP_${response.status}`);
  const declared=Number(response.headers.get("content-length")??0);
  if(declared>MAX_ATTACHMENT_BYTES)throw new Error("ATTACHMENT_TOO_LARGE");
  const buffer=await response.arrayBuffer();
  if(buffer.byteLength>MAX_ATTACHMENT_BYTES)throw new Error("ATTACHMENT_TOO_LARGE");
  return{bytes:new Uint8Array(buffer),contentType:response.headers.get("content-type")??row.content_type,filename:dispositionFilename(response.headers.get("content-disposition"))??row.name};
}

async function persistParseResult(db:D1DatabaseLike,row:Pick<AttachmentRow,"id">,parsed:AttachmentProcessResult,evidence:AttachmentEvidence[]){
  await db.prepare("UPDATE attachments SET parse_status=?,parse_method=?,evidence_json=?,text_extracted=?,error_code=?,error_message=?,processed_at=? WHERE id=?")
    .bind(parsed.status,parsed.parseMethod,JSON.stringify(evidence),parsed.artifact?.blocks.length?1:0,parsed.errorCode??null,parsed.errorMessage??null,new Date().toISOString(),row.id).run();
}

async function recordParseMetric(db:D1DatabaseLike,sourceRunId:string|null,status:string){
  if(status==="PARSED")await metric(db,sourceRunId,"attachments_parse_success");
  else if(status==="OCR_REQUIRED")await metric(db,sourceRunId,"attachments_ocr_required");
  else await metric(db,sourceRunId,"attachments_parse_failed");
}

async function processZipChildren(db:D1DatabaseLike,parent:AttachmentRow,children:{filename:string;bytes:Uint8Array}[]){
  const collected:AttachmentEvidence[]=[];
  for(const child of children){
    const childId=await stableId(`${parent.id}:${child.filename}`);
    const childUrl=`zip:${parent.url}#${encodeURIComponent(child.filename)}`;
    const extension=extensionOf(child.filename);
    const detected=detectAttachmentFormat(child.bytes,child.filename,null);
    if(detected.format==="UNSUPPORTED")continue;
    const classified=classifyDocumentRole(child.filename);
    const hash=await attachmentContentHash(child.bytes);
    const now=new Date().toISOString();
    const inserted=await db.prepare(`INSERT OR IGNORE INTO attachments (id,raw_notice_id,source_id,source_run_id,parent_attachment_id,name,url,content_type,extension,size_bytes,document_role,priority,fetch_status,parse_status,content_hash,archive_depth,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'FETCHED','PENDING',?,?,?)`)
      .bind(childId,parent.raw_notice_id,parent.source_id,parent.source_run_id,parent.id,child.filename,childUrl,detected.detectedMime,extension,child.bytes.byteLength,classified.role,classified.priority,hash,parent.archive_depth+1,now).run();
    if((inserted.meta?.changes??0)>0){
      await metric(db,parent.source_run_id,"attachments_discovered");
      await metric(db,parent.source_run_id,"attachments_fetch_success");
    }
    const childRow:{id:string}={id:childId};
    if(detected.mismatch){
      const failed:AttachmentProcessResult={status:"PARSE_FAILED",format:detected.format,parseMethod:"signature-check-1",artifact:null,errorCode:"ATTACHMENT_TYPE_MISMATCH",errorMessage:"ZIP child extension, MIME, or signature did not match"};
      await persistParseResult(db,childRow,failed,[]);
      await recordParseMetric(db,parent.source_run_id,failed.status);
      continue;
    }
    const parsed=await parseAttachmentBytes({attachmentId:childId,filename:child.filename,format:detected.format,role:classified.role,bytes:child.bytes,archiveDepth:parent.archive_depth+1});
    const evidence=parsed.artifact&&parsed.status==="PARSED"?extractAttachmentEvidence(parsed.artifact,parent.url):[];
    await persistParseResult(db,childRow,parsed,evidence);
    await recordParseMetric(db,parent.source_run_id,parsed.status);
    collected.push(...evidence);
  }
  return collected;
}

async function fail(db:D1DatabaseLike,row:AttachmentRow,error:unknown){
  const message=error instanceof Error?error.message:"Attachment processing failed";
  const code=/^[A-Z0-9_]+$/.test(message)?message:"ATTACHMENT_PROCESSING_FAILED";
  await db.prepare("UPDATE attachments SET fetch_status=CASE WHEN fetch_status='FETCHED' THEN fetch_status ELSE 'FETCH_FAILED' END,parse_status='PARSE_FAILED',error_code=?,error_message=?,processed_at=? WHERE id=?")
    .bind(code,message,new Date().toISOString(),row.id).run();
  if(row.parse_status!=="PARSE_FAILED")await metric(db,row.source_run_id,"attachments_parse_failed");
}

export async function processAttachmentMessage(env:Pick<YouthGrantEnv,"DB">,message:AttachmentQueueMessage,fetcher:typeof fetch=globalThis.fetch.bind(globalThis),force=false){
  const row=await env.DB.prepare("SELECT * FROM attachments WHERE id=?").bind(message.attachmentId).first<AttachmentRow>();
  if(!row)return{status:"MISSING" as const};
  if(!force&&row.content_hash&&FINAL_STATUSES.has(row.parse_status))return{status:"SKIPPED" as const};
  try{
    const loaded=await loadBytes(row,fetcher);
    const detected=detectAttachmentFormat(loaded.bytes,loaded.filename,loaded.contentType);
    if(detected.mismatch)throw new Error("ATTACHMENT_TYPE_MISMATCH");
    if(detected.format==="UNSUPPORTED")throw new Error("UNSUPPORTED_TYPE");
    const hash=await attachmentContentHash(loaded.bytes);
    const extension=extensionOf(loaded.filename)??detected.format.toLowerCase();
    const classified=classifyDocumentRole(loaded.filename);
    const effectiveRole=row.document_role==="UNKNOWN"?classified.role:row.document_role;
    const effectivePriority=row.document_role==="UNKNOWN"?classified.priority:row.priority;
    await env.DB.prepare("UPDATE attachments SET name=?,extension=?,content_type=?,size_bytes=?,document_role=?,priority=?,fetch_status='FETCHED',content_hash=?,error_code=NULL,error_message=NULL WHERE id=?")
      .bind(loaded.filename,extension,detected.detectedMime,loaded.bytes.byteLength,effectiveRole,effectivePriority,hash,row.id).run();
    await metric(env.DB,row.source_run_id,"attachments_fetch_success");

    const parsed=await parseAttachmentBytes({attachmentId:row.id,filename:loaded.filename,format:detected.format,role:effectiveRole,bytes:loaded.bytes,archiveDepth:row.archive_depth});
    const evidence=parsed.artifact&&parsed.status==="PARSED"?extractAttachmentEvidence(parsed.artifact,row.url):[];
    await persistParseResult(env.DB,row,parsed,evidence);
    await recordParseMetric(env.DB,row.source_run_id,parsed.status);

    const childEvidence=parsed.children?.length?await processZipChildren(env.DB,{...row,name:loaded.filename,document_role:effectiveRole,priority:effectivePriority},parsed.children):[];
    const allEvidence=[...evidence,...childEvidence];
    if(allEvidence.length){
      const verification=await applyAttachmentEvidence(env.DB,row.raw_notice_id,allEvidence);
      await metric(env.DB,row.source_run_id,"fields_recovered",verification.recovered);
      await metric(env.DB,row.source_run_id,"fields_verified_by_attachment",verification.verified);
    }
    return{status:parsed.status,format:detected.format,evidence:allEvidence.length};
  }catch(error){
    await fail(env.DB,row,error);
    throw error;
  }
}

export async function reprocessAttachment(env:Pick<YouthGrantEnv,"DB">,attachmentId:string){
  const row=await env.DB.prepare("SELECT id,raw_notice_id,source_id,url,parent_attachment_id FROM attachments WHERE id=?").bind(attachmentId).first<{id:string;raw_notice_id:string;source_id:string|null;url:string;parent_attachment_id:string|null}>();
  if(!row)return false;
  const target=row.parent_attachment_id?await env.DB.prepare("SELECT id,raw_notice_id,source_id,url FROM attachments WHERE id=?").bind(row.parent_attachment_id).first<{id:string;raw_notice_id:string;source_id:string|null;url:string}>():row;
  if(!target)return false;
  await env.DB.prepare("UPDATE attachments SET parse_status='PENDING',error_code=NULL,error_message=NULL,processed_at=NULL WHERE id=?").bind(target.id).run();
  await processAttachmentMessage(env,{attachmentId:target.id,rawNoticeId:target.raw_notice_id,sourceId:target.source_id??"unknown",url:target.url},globalThis.fetch.bind(globalThis),true);
  return true;
}
