import { DeadlineMode, ReviewStatus, type DeadlineMode as DeadlineModeValue, type ReviewStatus as ReviewStatusValue } from "../domain/types.ts";
import { openEndedDeadlineLabel } from "../domain/verification.ts";

const TELEGRAM_API_ORIGIN="https://api.telegram.org";
const PRODUCTION_SITE_ORIGIN="https://youthgrant.seoeum1711.workers.dev";
const TELEGRAM_TIMEOUT_MS=5_000;

type NotificationLogger={info(message:string):void;error(message:string):void};
type TelegramMessage={text:string;buttonText?:string;buttonUrl?:string};

export type TelegramNotificationConfig={environment?:"development"|"preview"|"production";siteOrigin?:string;botToken?:string;chatId?:string};
export type FinalizedOpportunityNotification={
  opportunityCreated:boolean;
  opportunityId:string;
  reviewStatus:ReviewStatusValue;
  title:string;
  organization:string;
  deadline?:string|null;
  deadlineMode?:DeadlineModeValue|string;
  deadlineEvidence?:string|null;
  eligibleRegion?:string|null;
  reviewReason?:string|null;
};
export type TelegramNotificationDependencies={fetcher?:typeof fetch;logger?:NotificationLogger};

function clean(value:string|undefined|null,maxLength:number,fallback:string){const normalized=value?.replace(/\s+/g," ").trim();return normalized?normalized.slice(0,maxLength):fallback;}
function siteUrl(config:TelegramNotificationConfig,path:string){const origin=config.siteOrigin?.trim()||PRODUCTION_SITE_ORIGIN;return new URL(`/${path.replace(/^\/+/,"")}`,origin).toString();}
function messageFor(input:FinalizedOpportunityNotification,config:TelegramNotificationConfig){
  const title=clean(input.title,300,"제목 확인 필요");const organization=clean(input.organization,200,"기관 확인 필요");
  const deadline=input.deadlineMode===DeadlineMode.OPEN_ENDED?openEndedDeadlineLabel(input.deadlineEvidence):clean(input.deadline,100,"확인 필요");
  if(input.reviewStatus===ReviewStatus.PUBLISHED)return{text:`[YouthGrant 신규 공모]\n\n${title}\n${organization}\n\n상태: 공개 가능\n마감: ${deadline}\n지원지역: ${clean(input.eligibleRegion,100,"확인 필요")}`,buttonText:"YouthGrant에서 보기",buttonUrl:siteUrl(config,`grants/${encodeURIComponent(input.opportunityId)}`)};
  if(input.reviewStatus===ReviewStatus.REVIEW_REQUIRED)return{text:`[YouthGrant 검토 필요]\n\n${title}\n${organization}\n\n${clean(input.reviewReason,500,"핵심 데이터 근거 확인 필요")}`,buttonText:"Ops에서 검토하기",buttonUrl:siteUrl(config,`ops/review/${encodeURIComponent(input.opportunityId)}`)};
  return null;
}

export async function sendOwnerTelegramMessage(message:TelegramMessage,config:TelegramNotificationConfig,dependencies:TelegramNotificationDependencies={}){
  const logger=dependencies.logger??console;
  if(config.environment!=="production"){logger.info("Telegram notification skipped: non-production environment.");return false;}
  if(!config.botToken?.trim()||!config.chatId?.trim()){logger.info("Telegram notification skipped: configuration is missing.");return false;}
  const controller=new AbortController();let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
    timeout=setTimeout(()=>controller.abort(),TELEGRAM_TIMEOUT_MS);
    const replyMarkup=message.buttonText&&message.buttonUrl?{inline_keyboard:[[{text:message.buttonText,url:message.buttonUrl}]]}:undefined;
    const response=await (dependencies.fetcher??fetch)(`${TELEGRAM_API_ORIGIN}/bot${config.botToken.trim()}/sendMessage`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({chat_id:config.chatId.trim(),text:message.text,disable_web_page_preview:true,...(replyMarkup?{reply_markup:replyMarkup}:{})}),signal:controller.signal});
    if(!response.ok)throw new Error("Telegram API rejected the notification");
    return true;
  }catch{logger.error("Telegram notification failed; collection will continue.");return false;}finally{if(timeout)clearTimeout(timeout);}
}

export async function notifyOwnerOfFinalizedOpportunity(input:FinalizedOpportunityNotification,config:TelegramNotificationConfig,dependencies:TelegramNotificationDependencies={}){
  if(!input.opportunityCreated)return false;
  try{const message=messageFor(input,config);if(!message)return false;return await sendOwnerTelegramMessage(message,config,dependencies);}
  catch{(dependencies.logger??console).error("Telegram notification failed; collection will continue.");return false;}
}
