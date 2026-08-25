import assert from "node:assert/strict";
import test from "node:test";
import type { YouthGrantEnv } from "../lib/cloudflare.ts";
import { runCronWatchdog, WATCHDOG_CRON } from "../lib/collectors/cron-watchdog.ts";

const slots=["2026-08-24T18:10:00Z","2026-08-25T00:10:00Z","2026-08-25T06:10:00Z","2026-08-25T12:10:00Z"];
const env={ENVIRONMENT:"production",TELEGRAM_BOT_TOKEN:"secret-token",TELEGRAM_CHAT_ID:"secret-chat"} as YouthGrantEnv;
const controller=(scheduledTime:string)=>({cron:WATCHDOG_CRON,scheduledTime:Date.parse(scheduledTime),type:"scheduled"});

function harness(options:{run?:{id:string;status:string;startedAt:string}|null;claimed?:boolean;latest?:{id:string;status:string;startedAt:string}|null}={}){
  const messages:string[]=[];const notifications:string[]=[];const windows:{start:string;end:string}[]=[];let claims=0;
  return{messages,notifications,windows,get claims(){return claims;},dependencies:{
    async findExpectedRun(_db:unknown,start:string,end:string){assert.ok(start<end);windows.push({start,end});const run=options.run??null;return run&&run.startedAt>=start&&run.startedAt<=end?run:null;},
    async findLatestRunBefore(){return options.latest??null;},
    async claimAlert(){claims++;return options.claimed??true;},
    async notify(message:string){notifications.push(message);return true;},
    logger:{log(message:string){messages.push(message);},error(message:string){messages.push(message);}},
    now:()=>new Date("2026-08-25T12:10:05Z"),
  }};
}

test("watchdog UTC schedule maps to 03:10, 09:10, 15:10, and 21:10 KST",()=>{
  assert.equal(WATCHDOG_CRON,"10 0,6,12,18 * * *");
  assert.deepEqual(slots.map(value=>new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(value))),["03:10","09:10","15:10","21:10"]);
});

for(const status of ["PARTIAL","FAILED"]){
  test(`expected ${status} AUTOMATION run suppresses a missing-run alert`,async()=>{
    const h=harness({run:{id:`run-${status.toLowerCase()}`,status,startedAt:"2026-08-25T12:02:00Z"}});
    const result=await runCronWatchdog(controller(slots[3]),env,h.dependencies as never);
    assert.equal(result.status,"RUN_FOUND");assert.equal(h.notifications.length,0);assert.equal(h.claims,0);
    assert.ok(h.messages.some(message=>{const entry=JSON.parse(message);return entry.event==="watchdog_check"&&entry.run_found===true;}));
  });
}

test("missing expected slot sends one owner alert even when an older latest run exists",async()=>{
  const h=harness({latest:{id:"run-15",status:"PARTIAL",startedAt:"2026-08-25T06:00:50Z"}});
  const result=await runCronWatchdog(controller(slots[3]),env,h.dependencies as never);
  assert.equal(result.status,"ALERT_SENT");assert.equal(h.notifications.length,1);assert.match(h.notifications[0],/예정된 21:00 KST/);assert.match(h.notifications[0],/최근 수집: 2026-08-25 15:00 · PARTIAL/);
});

test("dispatch seconds do not shift the canonical collection slot",async()=>{
  const h=harness({run:{id:"run-03",status:"PARTIAL",startedAt:"2026-08-25T18:00:52.668Z"}});
  const result=await runCronWatchdog(controller("2026-08-25T18:10:56.000Z"),env,h.dependencies as never);
  assert.equal(result.status,"RUN_FOUND");assert.deepEqual(h.windows,[{start:"2026-08-25T18:00:00.000Z",end:"2026-08-25T18:10:56.000Z"}]);assert.equal(h.notifications.length,0);
});

test("an already claimed slot skips a duplicate alert",async()=>{
  const h=harness({claimed:false});const result=await runCronWatchdog(controller(slots[3]),env,h.dependencies as never);
  assert.equal(result.status,"DUPLICATE");assert.equal(h.notifications.length,0);assert.ok(h.messages.some(message=>JSON.parse(message).event==="alert_skipped_duplicate"));
});

test("lookup is bounded to the expected slot instead of accepting the latest run",async()=>{
  const h=harness({latest:{id:"run-09",status:"SUCCESS",startedAt:"2026-08-25T00:01:00Z"}});
  await runCronWatchdog(controller(slots[2]),env,h.dependencies as never);
  assert.equal(h.notifications.length,1);assert.match(h.notifications[0],/예정된 15:00 KST/);
});
