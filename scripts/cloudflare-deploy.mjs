import { spawnSync } from "node:child_process";

const environment=process.argv[2];
if(!["preview","production"].includes(environment)){
  console.error("Usage: node scripts/cloudflare-deploy.mjs <preview|production>");
  process.exit(2);
}

const env={...process.env,CLOUDFLARE_ENV:environment};
const npm=process.platform==="win32"?"npm.cmd":"npm";
const npx=process.platform==="win32"?"npx.cmd":"npx";
const build=spawnSync(npm,["run","build"],{stdio:"inherit",env});
if(build.status!==0)process.exit(build.status??1);
const deploy=spawnSync(npx,["wrangler","deploy"],{stdio:"inherit",env});
if(deploy.status!==0)process.exit(deploy.status??1);
const migrate=spawnSync(npx,["wrangler","d1","migrations","apply","DB","--remote","--env",environment],{stdio:"inherit",env});
if(migrate.status!==0)process.exit(migrate.status??1);
const finalDeploy=spawnSync(npx,["wrangler","deploy"],{stdio:"inherit",env});
process.exit(finalDeploy.status??1);
