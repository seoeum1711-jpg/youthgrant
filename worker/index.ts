import handler from "vinext/server/app-router-entry";
import { betaCollectors } from "../lib/collectors/run.ts";
import { CollectionLockedError, runCollectionToD1 } from "../lib/collectors/persist.ts";
import type { YouthGrantEnv } from "../lib/cloudflare.ts";
import { isOpsAuthorized, isProtectedOpsPath, opsDeniedResponse } from "../lib/security/ops-auth.ts";
import { applyOpportunityReview, parseReviewMutation } from "../lib/data/review-mutation.ts";
import { processAttachmentMessage } from "../lib/attachments/pipeline.ts";
import type { AttachmentQueueMessage } from "../lib/attachments/contracts.ts";
import { ContactValidationError, parseContactSubmission, sendContactEmail } from "../lib/contact.ts";

type WorkerExecutionContext={waitUntil(promise:Promise<unknown>):void;passThroughOnException():void};
type ScheduledControllerLike={cron:string;scheduledTime:number;type:string};
type QueueMessageLike<T>={body:T;ack():void;retry(options?:{delaySeconds?:number}):void};
type QueueBatchLike<T>={messages:QueueMessageLike<T>[]};

const worker={
  async fetch(request:Request,env:YouthGrantEnv,ctx:WorkerExecutionContext):Promise<Response>{
    const url=new URL(request.url);
    if(isProtectedOpsPath(url.pathname)&&!await isOpsAuthorized(request,env))return opsDeniedResponse(env);
    if(url.pathname==="/api/contact"){
      if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:{allow:"POST"}});
      try{
        const parsed=parseContactSubmission(await request.text());if(parsed.spam)return Response.json({ok:true});
        if(env.CONTACT_RATE_LIMIT){const key=request.headers.get("cf-connecting-ip")??"anonymous";const allowed=await env.CONTACT_RATE_LIMIT.limit({key:`contact:${key}`});if(!allowed.success)return Response.json({error:"잠시 후 다시 시도해 주세요."},{status:429});}
        await sendContactEmail(parsed.submission,env);return Response.json({ok:true});
      }catch(error){if(error instanceof ContactValidationError)return Response.json({error:"입력 내용을 확인해 주세요."},{status:400});console.error("Contact delivery failed");return Response.json({error:"문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요."},{status:503});}
    }
    if(url.pathname==="/api/ops/collect"){
      if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:{allow:"POST"}});
      try{const result=await runCollectionToD1(env.DB,betaCollectors(env),"MANUAL",{queue:env.ATTACHMENT_QUEUE,telegram:{environment:env.ENVIRONMENT,siteOrigin:env.SITE_ORIGIN,botToken:env.TELEGRAM_BOT_TOKEN,chatId:env.TELEGRAM_CHAT_ID}});return Response.json(result);}
      catch(error){if(error instanceof CollectionLockedError)return Response.json({error:error.message},{status:423});throw error;}
    }
    const reviewMatch=url.pathname.match(/^\/api\/ops\/review\/([^/]+)$/);
    if(reviewMatch){
      if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:{allow:"POST"}});
      try{const input=parseReviewMutation(await request.json());const updated=await applyOpportunityReview(env.DB,decodeURIComponent(reviewMatch[1]),input);return updated?Response.json({ok:true}):Response.json({error:"Review opportunity not found"},{status:404});}
      catch(error){return Response.json({error:error instanceof Error?error.message:"Invalid review input"},{status:400});}
    }
    if(url.pathname==="/api/health")return Response.json({service:"YouthGrant",status:"ok",environment:env.ENVIRONMENT??"unknown"});
    return handler.fetch(request,env,ctx);
  },
  async scheduled(_controller:ScheduledControllerLike,env:YouthGrantEnv){
    try{await runCollectionToD1(env.DB,betaCollectors(env),"AUTOMATION",{queue:env.ATTACHMENT_QUEUE,telegram:{environment:env.ENVIRONMENT,siteOrigin:env.SITE_ORIGIN,botToken:env.TELEGRAM_BOT_TOKEN,chatId:env.TELEGRAM_CHAT_ID}});}
    catch(error){if(error instanceof CollectionLockedError)return;throw error;}
  },
  async queue(batch:QueueBatchLike<AttachmentQueueMessage>,env:YouthGrantEnv){for(const message of batch.messages){try{await processAttachmentMessage(env,message.body);message.ack();}catch{message.retry({delaySeconds:60});}}},
};

export default worker;
