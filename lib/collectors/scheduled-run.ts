import type { YouthGrantEnv } from "../cloudflare.ts";

export type ScheduledControllerLike={cron:string;scheduledTime:number;type:string};

type ScheduledResult={id?:string|null;status?:string};
type ScheduledLogger={log(message:string):void;error(message:string):void};

function scheduledContext(controller:ScheduledControllerLike,env:YouthGrantEnv){
  return{
    cron:controller.cron,
    scheduledTime:new Date(controller.scheduledTime).toISOString(),
    environment:env.ENVIRONMENT??"unknown",
    workerVersion:env.CF_VERSION_METADATA?.id??"unknown",
  };
}

export async function runScheduledTask<T extends ScheduledResult>(controller:ScheduledControllerLike,env:YouthGrantEnv,task:()=>Promise<T>,logger:ScheduledLogger=console):Promise<T>{
  const context=scheduledContext(controller,env);
  logger.log(JSON.stringify({event:"scheduled_start",...context}));
  logger.log(JSON.stringify({event:"collection_start",...context}));
  try{
    const result=await task();
    logger.log(JSON.stringify({event:"collection_finish",...context,crawlRunId:result.id??null,status:result.status??"unknown"}));
    return result;
  }catch(error){
    logger.error(JSON.stringify({event:"collection_failure",...context,errorName:error instanceof Error?error.name:"UnknownError"}));
    throw error;
  }
}
