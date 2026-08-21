import handler from "vinext/server/app-router-entry";
import { betaCollectors } from "../lib/collectors/run.ts";
import { CollectionLockedError, runCollectionToD1 } from "../lib/collectors/persist.ts";
import type { YouthGrantEnv } from "../lib/cloudflare.ts";
import { isOpsAuthorized, isProtectedOpsPath, opsDeniedResponse } from "../lib/security/ops-auth.ts";
import { applyOpportunityReview, parseReviewMutation } from "../lib/data/review-mutation.ts";

type WorkerExecutionContext={waitUntil(promise:Promise<unknown>):void;passThroughOnException():void};
type ScheduledControllerLike={cron:string;scheduledTime:number;type:string};

const worker={
  async fetch(request:Request,env:YouthGrantEnv,ctx:WorkerExecutionContext):Promise<Response>{
    const url=new URL(request.url);
    if(isProtectedOpsPath(url.pathname)&&!await isOpsAuthorized(request,env))return opsDeniedResponse(env);
    if(url.pathname==="/api/ops/collect"){
      if(request.method!=="POST")return Response.json({error:"Method not allowed"},{status:405,headers:{allow:"POST"}});
      try{const result=await runCollectionToD1(env.DB,betaCollectors(env),"MANUAL");return Response.json(result);}
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
    try{await runCollectionToD1(env.DB,betaCollectors(env),"AUTOMATION");}
    catch(error){if(error instanceof CollectionLockedError)return;throw error;}
  },
};

export default worker;
