import type { DiscoveredAttachment } from "../attachments/contracts.ts";
import { detectAttachmentFormat } from "../attachments/file-type.ts";
import { parseAttachmentBytes } from "../attachments/parsers.ts";
import { fetchWithTimeout } from "../collectors/fetch-policy.ts";

const MAX_RELEVANCE_ATTACHMENTS=2;
const MAX_ATTACHMENT_BYTES=10*1024*1024;
const MAX_TEXT_CHARACTERS=100_000;

async function parsedText(item:DiscoveredAttachment,index:number,fetcher:typeof fetch){
  if(item.role==="FORM"||item.role==="MEDIA")return[];const response=await fetchWithTimeout(item.url,{headers:{"user-agent":"YouthGrant-Public-Beta/4.0 (+https://youthgrant.seoeum1711.workers.dev)"}},{fetcher});if(!response.ok)return[];const declared=Number(response.headers.get("content-length")??0);if(declared>MAX_ATTACHMENT_BYTES)return[];const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>MAX_ATTACHMENT_BYTES)return[];const detected=detectAttachmentFormat(bytes,item.filename,response.headers.get("content-type")??item.mimeType);if(detected.mismatch||detected.format==="UNSUPPORTED")return[];const parsed=await parseAttachmentBytes({attachmentId:`relevance-${index}`,filename:item.filename,format:detected.format,role:item.role,bytes,archiveDepth:0});const texts=parsed.status==="PARSED"&&parsed.artifact?parsed.artifact.blocks.map(block=>block.text):[];
  if(parsed.children?.length){for(const [childIndex,child] of parsed.children.entries()){const childDetected=detectAttachmentFormat(child.bytes,child.filename,null);if(childDetected.mismatch||childDetected.format==="UNSUPPORTED")continue;const childParsed=await parseAttachmentBytes({attachmentId:`relevance-${index}-${childIndex}`,filename:child.filename,format:childDetected.format,role:"UNKNOWN",bytes:child.bytes,archiveDepth:1});if(childParsed.status==="PARSED"&&childParsed.artifact)texts.push(...childParsed.artifact.blocks.map(block=>block.text));}}
  return texts;
}

export async function extractRelevanceAttachmentText(items:DiscoveredAttachment[],fetcher:typeof fetch=globalThis.fetch.bind(globalThis)){
  const texts:string[]=[];for(const [index,item] of items.filter(item=>item.role!=="FORM"&&item.role!=="MEDIA").slice(0,MAX_RELEVANCE_ATTACHMENTS).entries()){try{texts.push(...await parsedText(item,index,fetcher));}catch{/** Attachment enrichment is best-effort and never weakens relevance. */}if(texts.reduce((sum,text)=>sum+text.length,0)>=MAX_TEXT_CHARACTERS)break;}let remaining=MAX_TEXT_CHARACTERS;return texts.map(text=>{const limited=text.slice(0,remaining);remaining-=limited.length;return limited;}).filter(Boolean);
}
