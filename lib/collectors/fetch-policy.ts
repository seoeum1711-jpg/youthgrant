export const SOURCE_FETCH_TIMEOUT_MS=20_000;
export const SOURCE_FETCH_MAX_ATTEMPTS=3;

export type FetchFailureCode="FETCH_TIMEOUT"|"RATE_LIMITED"|"ACCESS_BLOCKED"|"HTTP_CLIENT_ERROR"|"HTTP_SERVER_ERROR"|"NETWORK_ERROR";
export type SourceFailureCode=FetchFailureCode|"PARSER_ERROR"|"COLLECTOR_ERROR";
export type Sleep=(milliseconds:number)=>Promise<void>;

export class FetchPolicyError extends Error{
  readonly code:FetchFailureCode;
  readonly status:number|null;
  readonly attempts:number;
  constructor(code:FetchFailureCode,message:string,status:number|null,attempts:number,options?:ErrorOptions){super(message,options);this.name="FetchPolicyError";this.code=code;this.status=status;this.attempts=attempts;}
}

export type FetchPolicyOptions={
  fetcher?:typeof fetch;
  sleep?:Sleep;
  timeoutMs?:number;
  maxAttempts?:number;
  baseBackoffMs?:number;
  maxBackoffMs?:number;
};

const defaultSleep:Sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
const retryable=new Set<FetchFailureCode>(["FETCH_TIMEOUT","RATE_LIMITED","HTTP_SERVER_ERROR","NETWORK_ERROR"]);

function httpFailure(status:number,attempts:number){
  const code:FetchFailureCode=status===408?"FETCH_TIMEOUT":status===429?"RATE_LIMITED":status===403?"ACCESS_BLOCKED":status>=500?"HTTP_SERVER_ERROR":"HTTP_CLIENT_ERROR";
  return new FetchPolicyError(code,`HTTP ${status}`,status,attempts);
}

function withAttempts(error:FetchPolicyError,attempts:number){return new FetchPolicyError(error.code,error.message,error.status,attempts,{cause:error});}

function retryAfterMs(value:string|null,maximum:number){
  if(!value)return null;
  const seconds=Number(value);const milliseconds=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-Date.now();
  if(!Number.isFinite(milliseconds)||milliseconds<0)return null;
  return Math.min(milliseconds,maximum);
}

export async function fetchWithTimeout(input:RequestInfo|URL,init:RequestInit={},options:Pick<FetchPolicyOptions,"fetcher"|"timeoutMs">={}):Promise<Response>{
  const fetcher=options.fetcher??globalThis.fetch.bind(globalThis);const timeoutMs=options.timeoutMs??SOURCE_FETCH_TIMEOUT_MS;const timeoutSignal=AbortSignal.timeout(timeoutMs);const signal=init.signal?AbortSignal.any([init.signal,timeoutSignal]):timeoutSignal;
  try{return await fetcher(input,{...init,signal});}
  catch(error){
    if(timeoutSignal.aborted)throw new FetchPolicyError("FETCH_TIMEOUT",`Request timed out after ${timeoutMs}ms`,null,1,{cause:error});
    if(error instanceof FetchPolicyError)throw error;
    throw new FetchPolicyError("NETWORK_ERROR",error instanceof Error?error.message:"Network request failed",null,1,{cause:error});
  }
}

export async function fetchWithPolicy(input:RequestInfo|URL,init:RequestInit={},options:FetchPolicyOptions={}):Promise<Response>{
  const maxAttempts=Math.max(1,options.maxAttempts??SOURCE_FETCH_MAX_ATTEMPTS);const baseBackoffMs=options.baseBackoffMs??1_000;const maxBackoffMs=options.maxBackoffMs??5_000;const sleep=options.sleep??defaultSleep;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    let failure:FetchPolicyError;let response:Response|null=null;
    try{
      response=await fetchWithTimeout(input,init,{fetcher:options.fetcher,timeoutMs:options.timeoutMs});
      if(response.ok)return response;
      failure=httpFailure(response.status,attempt);
    }catch(error){failure=error instanceof FetchPolicyError?withAttempts(error,attempt):new FetchPolicyError("NETWORK_ERROR",error instanceof Error?error.message:"Network request failed",null,attempt,{cause:error});}
    if(!retryable.has(failure.code)||attempt===maxAttempts)throw failure;
    const exponential=Math.min(baseBackoffMs*2**(attempt-1),maxBackoffMs);const delay=retryAfterMs(response?.headers.get("retry-after")??null,maxBackoffMs)??exponential;
    await sleep(delay);
  }
  throw new FetchPolicyError("NETWORK_ERROR","Request failed",null,maxAttempts);
}

export function classifySourceFailure(error:unknown):{code:SourceFailureCode;message:string;httpStatus:number|null}{
  if(error instanceof FetchPolicyError)return{code:error.code,message:error.message,httpStatus:error.status};
  const message=error instanceof Error?error.message:"Unknown collector error";
  if(error instanceof SyntaxError||/parse|invalid response|invalid xml|invalid json|Seoul API/i.test(message))return{code:"PARSER_ERROR",message,httpStatus:null};
  return{code:"COLLECTOR_ERROR",message,httpStatus:null};
}
