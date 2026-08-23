export type ContactType="GENERAL"|"ERROR";
export type ContactSubmission={type:ContactType;subject:string;content:string;email:string};
export type ParsedContact={spam:true}|{spam:false;submission:ContactSubmission};
export type ContactEmailEnv={RESEND_API_KEY?:string;CONTACT_FROM_EMAIL?:string};

export class ContactValidationError extends Error{constructor(message:string){super(message);this.name="ContactValidationError";}}
export class ContactDeliveryError extends Error{constructor(message:string){super(message);this.name="ContactDeliveryError";}}

const MAX_PAYLOAD_BYTES=12_000;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const labels:Record<ContactType,string>={GENERAL:"일반문의",ERROR:"오류제보"};

function string(value:unknown){return typeof value==="string"?value:"";}
function oneLine(value:string){return value.replace(/[\r\n]+/g," ").replace(/\s+/g," ").trim();}
export function escapeContactHtml(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

export function parseContactSubmission(raw:string):ParsedContact{
  if(new TextEncoder().encode(raw).byteLength>MAX_PAYLOAD_BYTES)throw new ContactValidationError("Payload too large");
  let value:unknown;try{value=JSON.parse(raw);}catch{throw new ContactValidationError("Invalid JSON");}
  if(!value||typeof value!=="object"||Array.isArray(value))throw new ContactValidationError("Invalid payload");
  const input=value as Record<string,unknown>;if(string(input.website).trim())return{spam:true};
  const type=input.type;const subject=oneLine(string(input.subject));const content=string(input.content).trim();const email=string(input.email).trim().toLowerCase();
  if(type!=="GENERAL"&&type!=="ERROR")throw new ContactValidationError("Invalid contact type");
  if(!subject||subject.length>120)throw new ContactValidationError("Invalid subject");
  if(!content||content.length>5000)throw new ContactValidationError("Invalid content");
  if(!email||email.length>254||!EMAIL.test(email))throw new ContactValidationError("Invalid email");
  return{spam:false,submission:{type,subject,content,email}};
}

function receivedAt(){return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",dateStyle:"long",timeStyle:"medium"}).format(new Date());}
export async function sendContactEmail(input:ContactSubmission,env:ContactEmailEnv,fetcher:typeof fetch=globalThis.fetch.bind(globalThis)){
  if(!env.RESEND_API_KEY||!env.CONTACT_FROM_EMAIL)throw new ContactDeliveryError("Contact email provider is not configured");
  const label=labels[input.type];const time=receivedAt();const text=`문의유형: ${label}\n제목: ${input.subject}\n내용:\n${input.content}\n\n회신 이메일: ${input.email}\n접수 시각: ${time}`;
  const html=`<p><strong>문의유형</strong>: ${escapeContactHtml(label)}</p><p><strong>제목</strong>: ${escapeContactHtml(input.subject)}</p><p><strong>내용</strong>:<br>${escapeContactHtml(input.content).replace(/\r?\n/g,"<br>")}</p><p><strong>회신 이메일</strong>: ${escapeContactHtml(input.email)}</p><p><strong>접수 시각</strong>: ${escapeContactHtml(time)}</p>`;
  const response=await fetcher("https://api.resend.com/emails",{method:"POST",headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,"content-type":"application/json","idempotency-key":crypto.randomUUID()},body:JSON.stringify({from:env.CONTACT_FROM_EMAIL,to:["youthgreen94@gmail.com"],reply_to:input.email,subject:`[YouthGrant ${label}] ${input.subject}`,text,html})});
  if(!response.ok)throw new ContactDeliveryError(`Email provider returned HTTP ${response.status}`);
}
