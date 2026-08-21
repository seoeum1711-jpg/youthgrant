import type { YouthGrantEnv } from "../cloudflare.ts";

export function isProtectedOpsPath(pathname:string){return pathname==="/ops"||pathname.startsWith("/ops/")||pathname.startsWith("/api/ops/");}

async function sameSecret(actual:string,expected:string){
  const encoder=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",encoder.encode(actual)),crypto.subtle.digest("SHA-256",encoder.encode(expected))]);
  const aa=new Uint8Array(a);const bb=new Uint8Array(b);let mismatch=aa.length^bb.length;for(let index=0;index<Math.min(aa.length,bb.length);index++)mismatch|=aa[index]^bb[index];return mismatch===0;
}

export async function isOpsAuthorized(request:Request,env:Pick<YouthGrantEnv,"ENVIRONMENT"|"OPS_ACCESS_TOKEN">){
  if(env.ENVIRONMENT==="development"&&!env.OPS_ACCESS_TOKEN)return true;
  if(!env.OPS_ACCESS_TOKEN)return false;
  const header=request.headers.get("authorization")??"";
  if(header.startsWith("Bearer "))return sameSecret(header.slice(7),env.OPS_ACCESS_TOKEN);
  if(header.startsWith("Basic ")){try{const decoded=atob(header.slice(6));const separator=decoded.indexOf(":");return separator>=0&&sameSecret(decoded.slice(separator+1),env.OPS_ACCESS_TOKEN);}catch{return false;}}
  return false;
}

export function opsDeniedResponse(env:Pick<YouthGrantEnv,"OPS_ACCESS_TOKEN">){
  const configured=Boolean(env.OPS_ACCESS_TOKEN);return new Response(configured?"Ops authentication required.":"Ops access is disabled until OPS_ACCESS_TOKEN is configured.",{status:configured?401:503,headers:{"content-type":"text/plain; charset=utf-8",...(configured?{"www-authenticate":'Basic realm="YouthGrant Ops"'}:{})}});
}
