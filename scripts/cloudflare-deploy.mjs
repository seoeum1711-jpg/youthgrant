import { spawnSync } from "node:child_process";

const environment=process.argv[2];
if(!["preview","production"].includes(environment)){
  console.error("Usage: node scripts/cloudflare-deploy.mjs <preview|production>");
  process.exit(2);
}

const env={...process.env,CLOUDFLARE_ENV:environment};
const run=(command,args)=>{
  const result=spawnSync(command,args,{stdio:"inherit",env,shell:process.platform==="win32"});
  if(result.error)console.error(result.error.message);
  return result.status??1;
};

let status=run("npm",["run","build"]);
if(status!==0)process.exit(status);
status=run("npx",["wrangler","deploy","--env",environment]);
if(status!==0)process.exit(status);
status=run("npx",["wrangler","d1","migrations","apply","DB","--remote","--env",environment]);
if(status!==0)process.exit(status);
process.exit(run("npx",["wrangler","deploy","--env",environment]));
