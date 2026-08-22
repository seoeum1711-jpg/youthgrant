import { unzipSync } from "fflate";
import { extractText } from "unpdf";
import type { AttachmentFormat, AttachmentProcessResult, DocumentRole, ExtractedBlock, ExtractionArtifact } from "./contracts.ts";
import { extensionOf, imageDimensions } from "./file-type.ts";

const MAX_ARCHIVE_ENTRIES=200;
const MAX_UNPACKED_BYTES=25*1024*1024;
const SUPPORTED_CHILD=/\.(pdf|hwpx|hwp|zip|jpe?g|png)$/i;

function safeArchiveName(name:string){const normalized=name.replace(/\\/g,"/");return!normalized.startsWith("/")&&!/^[a-z]:/i.test(normalized)&&!normalized.split("/").includes("..");}
function unzipSafely(bytes:Uint8Array){let entries=0;let total=0;return unzipSync(bytes,{filter(info){entries++;total+=info.originalSize;if(entries>MAX_ARCHIVE_ENTRIES)throw new Error("ZIP_ENTRY_LIMIT");if(total>MAX_UNPACKED_BYTES)throw new Error("ZIP_SIZE_LIMIT");if(!safeArchiveName(info.name))throw new Error("ZIP_PATH_TRAVERSAL");return!info.name.endsWith("/");}});}
function xmlDecode(value:string){return value.replace(/<[^>]+>/g," ").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_match,code)=>String.fromCodePoint(Number(code))).replace(/\s+/g," ").trim();}

export function extractHwpx(bytes:Uint8Array):ExtractedBlock[]{
  const files=unzipSafely(bytes);const names=Object.keys(files);const sections=names.filter(name=>/^Contents\/section\d+\.xml$/i.test(name)).sort((a,b)=>Number(a.match(/\d+/)?.[0]??0)-Number(b.match(/\d+/)?.[0]??0));if(!sections.length)throw new Error("HWPX_PACKAGE_INVALID");const decoder=new TextDecoder();const blocks:ExtractedBlock[]=[];
  sections.forEach((name,sectionIndex)=>{const xml=decoder.decode(files[name]);const paragraphs=[...xml.matchAll(/<(?:\w+:)?p\b[^>]*>([\s\S]*?)<\/(?:\w+:)?p>/gi)];paragraphs.forEach((paragraph,paragraphIndex)=>{const runs=[...paragraph[1].matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi)].map(match=>xmlDecode(match[1])).filter(Boolean);const text=runs.join(" ").trim();if(text)blocks.push({location:`section ${sectionIndex+1} · paragraph ${paragraphIndex+1}`,text});});});if(!blocks.length)throw new Error("HWPX_TEXT_EMPTY");return blocks;
}

export function extractZipChildren(bytes:Uint8Array){const files=unzipSafely(bytes);return Object.entries(files).filter(([name])=>SUPPORTED_CHILD.test(name)).map(([filename,data])=>({filename:filename.replace(/\\/g,"/"),bytes:data}));}

async function pdfBlocks(bytes:Uint8Array){const result=await extractText(bytes,{mergePages:false});const blocks=result.text.map((text,index)=>({location:`page ${index+1}`,text:text.replace(/\s+\n/g,"\n").trim()})).filter(block=>block.text);return{blocks,totalPages:result.totalPages};}

function artifact(attachmentId:string,filename:string,format:AttachmentFormat,role:DocumentRole,blocks:ExtractedBlock[],metadata:ExtractionArtifact["metadata"]):ExtractionArtifact{return{version:"attachment-v1",attachmentId,filename,format,role,blocks,metadata};}

export async function parseAttachmentBytes(input:{attachmentId:string;filename:string;format:AttachmentFormat;role:DocumentRole;bytes:Uint8Array;archiveDepth:number}):Promise<AttachmentProcessResult>{
  const{attachmentId,filename,format,role,bytes,archiveDepth}=input;
  try{
    if(format==="PDF"){const parsed=await pdfBlocks(bytes);const chars=parsed.blocks.reduce((sum,block)=>sum+block.text.length,0);if(chars<20)return{status:"OCR_REQUIRED",format,parseMethod:"unpdf-1",artifact:artifact(attachmentId,filename,format,role,parsed.blocks,{pages:parsed.totalPages,textCharacters:chars}),errorCode:"PDF_TEXT_LAYER_EMPTY",errorMessage:"PDF text layer is empty or insufficient"};return{status:"PARSED",format,parseMethod:"unpdf-1",artifact:artifact(attachmentId,filename,format,role,parsed.blocks,{pages:parsed.totalPages,textCharacters:chars})};}
    if(format==="HWPX"){const blocks=extractHwpx(bytes);return{status:"PARSED",format,parseMethod:"hwpx-zip-xml-1",artifact:artifact(attachmentId,filename,format,role,blocks,{sections:new Set(blocks.map(block=>block.location.split(" · ")[0])).size,textCharacters:blocks.reduce((sum,block)=>sum+block.text.length,0)})};}
    if(format==="HWP")return{status:"HWP_PARSER_BLOCKED",format,parseMethod:"hwp-blocked-1",artifact:null,errorCode:"HWP_PARSER_BLOCKED",errorMessage:"No HWP parser passed the Cloudflare Workers compatibility and bundle checks"};
    if(format==="ZIP"){if(archiveDepth>=1)return{status:"PARSE_FAILED",format,parseMethod:"fflate-zip-1",artifact:null,errorCode:"ZIP_DEPTH_LIMIT",errorMessage:"Nested ZIP recursion depth exceeded"};const children=extractZipChildren(bytes);return{status:"PARSED",format,parseMethod:"fflate-zip-1",artifact:artifact(attachmentId,filename,format,role,[],{childAttachments:children.length}),children};}
    if(format==="JPG"||format==="PNG"){const dimensions=imageDimensions(bytes,format);return{status:"OCR_REQUIRED",format,parseMethod:"image-metadata-1",artifact:artifact(attachmentId,filename,format,role,[],{width:dimensions?.width??null,height:dimensions?.height??null}),errorCode:"OCR_REQUIRED",errorMessage:"Image capture completed; OCR is intentionally deferred"};}
    return{status:"UNSUPPORTED",format,parseMethod:"none",artifact:null,errorCode:"UNSUPPORTED_TYPE",errorMessage:`Unsupported attachment extension: ${extensionOf(filename)??"unknown"}`};
  }catch(error){const message=error instanceof Error?error.message:"Attachment parse failed";return{status:"PARSE_FAILED",format,parseMethod:format==="HWPX"?"hwpx-zip-xml-1":format==="ZIP"?"fflate-zip-1":format==="PDF"?"unpdf-1":"none",artifact:null,errorCode:/^[A-Z0-9_]+$/.test(message)?message:"PARSE_FAILED",errorMessage:message};}
}
