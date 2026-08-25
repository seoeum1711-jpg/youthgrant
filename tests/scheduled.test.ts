import assert from "node:assert/strict";
import test from "node:test";
import type { YouthGrantEnv } from "../lib/cloudflare.ts";
import { runScheduledTask } from "../lib/collectors/scheduled-run.ts";

const controller={cron:"0 */6 * * *",scheduledTime:Date.parse("2026-08-25T12:00:00Z"),type:"scheduled"};
const env={ENVIRONMENT:"production",CF_VERSION_METADATA:{id:"version-1"}} as YouthGrantEnv;

test("scheduled task logs handler entry and collection lifecycle",async()=>{
  const messages:string[]=[];
  const logger={log(message:string){messages.push(message);},error(message:string){messages.push(message);}};
  const result=await runScheduledTask(controller,env,async()=>({id:"crawl-1",status:"SUCCESS"}),logger);
  assert.deepEqual(result,{id:"crawl-1",status:"SUCCESS"});
  assert.deepEqual(messages.map(message=>JSON.parse(message).event),["scheduled_start","collection_start","collection_finish"]);
  const finish=JSON.parse(messages[2]);
  assert.equal(finish.cron,"0 */6 * * *");
  assert.equal(finish.scheduledTime,"2026-08-25T12:00:00.000Z");
  assert.equal(finish.environment,"production");
  assert.equal(finish.workerVersion,"version-1");
  assert.equal(finish.crawlRunId,"crawl-1");
});

test("scheduled task logs failures before a crawl run can be recorded",async()=>{
  const messages:string[]=[];
  const logger={log(message:string){messages.push(message);},error(message:string){messages.push(message);}};
  await assert.rejects(runScheduledTask(controller,env,async()=>{throw new TypeError("database unavailable");},logger),TypeError);
  const failure=JSON.parse(messages.at(-1)??"{}");
  assert.equal(failure.event,"collection_failure");
  assert.equal(failure.errorName,"TypeError");
  assert.equal(JSON.stringify(failure).includes("database unavailable"),false);
});
