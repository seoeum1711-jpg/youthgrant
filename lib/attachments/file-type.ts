import type { AttachmentFormat } from "./contracts.ts";

const MIME_BY_FORMAT:Record<Exclude<AttachmentFormat,"UNSUPPORTED">,string>={PDF:"application/pdf",HWPX:"application/vnd.hancom.hwpx",HWP:"application/x-hwp",ZIP:"application/zip",JPG:"image/jpeg",PNG:"image/png"};

export function extensionOf(filename:string){const match=filename.toLowerCase().match(/\.([a-z0-9]{1,8})$/);return match?.[1]??null;}
function starts(bytes:Uint8Array,signature:number[]){return signature.every((value,index)=>bytes[index]===value);}

export function detectAttachmentFormat(bytes:Uint8Array,filename:string,contentType:string|null){
  const extension=extensionOf(filename);let format:AttachmentFormat="UNSUPPORTED";
  if(starts(bytes,[0x25,0x50,0x44,0x46,0x2d]))format="PDF";
  else if(starts(bytes,[0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]))format="HWP";
  else if(starts(bytes,[0x50,0x4b,0x03,0x04])||starts(bytes,[0x50,0x4b,0x05,0x06]))format=extension==="hwpx"?"HWPX":"ZIP";
  else if(starts(bytes,[0xff,0xd8,0xff]))format="JPG";
  else if(starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))format="PNG";
  const expected:Record<string,AttachmentFormat>={pdf:"PDF",hwpx:"HWPX",hwp:"HWP",zip:"ZIP",jpg:"JPG",jpeg:"JPG",png:"PNG"};
  const mismatch=Boolean(extension&&expected[extension]&&expected[extension]!==format);
  const declared=(contentType??"").split(";",1)[0].trim().toLowerCase();const expectedMime=format==="UNSUPPORTED"?null:MIME_BY_FORMAT[format];const genericMime=!declared||/(?:octe[tr]-stream|x-msdownload|binary|application\/unknown)/.test(declared);
  const mimeMismatch=Boolean(!genericMime&&expectedMime&&!declared.includes(expectedMime)&&!(format==="HWPX"&&/(zip|hwpx)/.test(declared))&&!(format==="HWP"&&/hwp/.test(declared)));
  return{format,extension,mismatch:mismatch||mimeMismatch,detectedMime:expectedMime};
}

export function imageDimensions(bytes:Uint8Array,format:"JPG"|"PNG"):{width:number;height:number}|null{
  if(format==="PNG"&&bytes.length>=24){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return{width:view.getUint32(16),height:view.getUint32(20)};}
  if(format==="JPG"){let offset=2;while(offset+9<bytes.length){if(bytes[offset]!==0xff){offset++;continue;}const marker=bytes[offset+1];const length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{height:(bytes[offset+5]<<8)+bytes[offset+6],width:(bytes[offset+7]<<8)+bytes[offset+8]};if(length<2)break;offset+=2+length;}}
  return null;
}
