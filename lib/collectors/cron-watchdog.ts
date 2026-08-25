import type { D1DatabaseLike, YouthGrantEnv } from "../cloudflare.ts";
import { sendOwnerTelegramMessage, type TelegramNotificationConfig } from "../notifications/telegram.ts";
import type { ScheduledControllerLike } from "./scheduled-run.ts";

export const COLLECTION_CRON="0 */6 * * *";
export const WATCHDOG_CRON="10 0,6,12,18 * * *";
const WATCHDOG_DELAY_MS=10*60*1000;

type CrawlRun={id:string;status:string;startedAt:string};
type WatchdogLogger={log(message:string):void;error(message:string):void};
type WatchdogDependencies={
  findExpectedRun(db:D1DatabaseLike,start:string,end:string):Promise<CrawlRun|null>;
  findLatestRunBefore(db:D1DatabaseLike,before:string):Promise<CrawlRun|null>;
  claimAlert(db:D1DatabaseLike,scheduledAt:string,claimedAt:string):Promise<boolean>;
  notify(message:string,config:TelegramNotificationConfig):Promise<boolean>;
  logger:WatchdogLogger;
  now():Date;
};

async function findExpectedRun(db:D1DatabaseLike,start:string,end:string){
  const row=await db.prepare("SELECT id,status,started_at FROM crawl_runs WHERE trigger='AUTOMATION' AND started_at>=? AND started_at<=? ORDER BY started_at ASC LIMIT 1").bind(start,end).first<Record<string,unknown>>();
  return row?{id:String(row.id),status:String(row.status),startedAt:String(row.started_at)}:null;
}
async function findLatestRunBefore(db:D1DatabaseLike,before:string){
  const row=await db.prepare("SELECT id,status,started_at FROM crawl_runs WHERE trigger='AUTOMATION' AND status='SUCCESS' AND started_at<? ORDER BY started_at DESC LIMIT 1").bind(before).first<Record<string,unknown>>();
  return row?{id:String(row.id),status:String(row.status),startedAt:String(row.started_at)}:null;
}
async function claimAlert(db:D1DatabaseLike,scheduledAt:string,claimedAt:string){
  const result=await db.prepare("INSERT OR IGNORE INTO cron_watchdog_alerts (expected_scheduled_at,claimed_at) VALUES (?,?)").bind(scheduledAt,claimedAt).run();
  return (result.meta?.changes??0)>0;
}

const defaults:WatchdogDependencies={findExpectedRun,findLatestRunBefore,claimAlert,notify:(message,config)=>sendOwnerTelegramMessage({text:message},config),logger:console,now:()=>new Date()};

function kst(value:Date){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(value);
  const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??"";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function alertMessage(expected:Date,latest:CrawlRun|null){
  return `[YouthGrant 수집 확인 필요]\n\n예정된 ${kst(expected).slice(11)} KST 수집 기록이\n${kst(new Date(expected.getTime()+WATCHDOG_DELAY_MS)).slice(11)}까지 확인되지 않았습니다.\n\n예정 시각: ${kst(expected)}\n최근 정상 수집: ${latest?kst(new Date(latest.startedAt)):"확인되지 않음"}\n\nCloudflare Scheduled Event 및 Worker Logs를 확인해 주세요.`;
}

export async function runCronWatchdog(controller:ScheduledControllerLike,env:YouthGrantEnv,overrides:Partial<WatchdogDependencies>={}){
  const dependencies={...defaults,...overrides};
  const expected=new Date(controller.scheduledTime-WATCHDOG_DELAY_MS);
  const expectedIso=expected.toISOString();
  const windowEnd=new Date(controller.scheduledTime).toISOString();
  const context={cron:controller.cron,expected_scheduled_time:expectedIso,watchdog_scheduled_time:windowEnd,environment:env.ENVIRONMENT??"unknown",worker_version:env.CF_VERSION_METADATA?.id??"unknown"};
  dependencies.logger.log(JSON.stringify({event:"watchdog_start",...context}));
  const run=await dependencies.findExpectedRun(env.DB,expectedIso,windowEnd);
  dependencies.logger.log(JSON.stringify({event:"watchdog_check",...context,run_found:Boolean(run),crawl_run_id:run?.id??null,crawl_run_status:run?.status??null}));
  if(run)return{status:"RUN_FOUND" as const,expectedScheduledTime:expectedIso,runId:run.id};
  const claimed=await dependencies.claimAlert(env.DB,expectedIso,dependencies.now().toISOString());
  if(!claimed){dependencies.logger.log(JSON.stringify({event:"alert_skipped_duplicate",...context}));return{status:"DUPLICATE" as const,expectedScheduledTime:expectedIso};}
  const latest=await dependencies.findLatestRunBefore(env.DB,expectedIso);
  const sent=await dependencies.notify(alertMessage(expected,latest),{environment:env.ENVIRONMENT,siteOrigin:env.SITE_ORIGIN,botToken:env.TELEGRAM_BOT_TOKEN,chatId:env.TELEGRAM_CHAT_ID});
  if(sent){dependencies.logger.log(JSON.stringify({event:"alert_sent",...context}));return{status:"ALERT_SENT" as const,expectedScheduledTime:expectedIso};}
  dependencies.logger.error(JSON.stringify({event:"alert_failed",...context}));
  return{status:"ALERT_FAILED" as const,expectedScheduledTime:expectedIso};
}
