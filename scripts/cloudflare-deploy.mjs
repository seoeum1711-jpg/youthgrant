import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const environment=process.argv[2];
if(!["preview","production"].includes(environment)){
  console.error("Usage: node scripts/cloudflare-deploy.mjs <preview|production>");
  process.exit(2);
}

const outputPath=join(tmpdir(),`youthgrant-wrangler-${process.pid}-${Date.now()}.jsonl`);
const env={...process.env,CLOUDFLARE_ENV:environment,WRANGLER_OUTPUT_FILE_PATH:outputPath};
const run=(command,args)=>{
  const result=spawnSync(command,args,{stdio:"inherit",env,shell:process.platform==="win32"});
  if(result.error)console.error(result.error.message);
  return result.status??1;
};

let status=run("npm",["run","build"]);
if(status!==0)process.exit(status);
status=run("npx",["wrangler","versions","upload","--env",environment]);
if(status!==0)process.exit(status);
const events=readFileSync(outputPath,"utf8").split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
const uploaded=[...events].reverse().find(event=>event.type==="version-upload");
if(!uploaded?.version_id){
  console.error("Wrangler did not report an uploaded Worker version.");
  process.exit(1);
}
status=run("npx",["wrangler","d1","migrations","apply","DB","--remote","--env",environment]);
if(status!==0)process.exit(status);
status=run("npx",["wrangler","versions","deploy","--env",environment,"--version-id",uploaded.version_id,"--percentage","100","--yes"]);
rmSync(outputPath,{force:true});
process.exit(status);
