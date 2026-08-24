import assert from "node:assert/strict";
import test from "node:test";
import { RelevanceStatus } from "../lib/domain/types.ts";
import { notifyOwnerOfNewOpportunity, type NewOpportunityNotification } from "../lib/notifications/telegram.ts";

const config={environment:"production" as const,siteOrigin:"https://youthgrant.example",botToken:"test-secret-token",chatId:"123456"};
const base:NewOpportunityNotification={state:"NEW",relevanceStatus:RelevanceStatus.IN_SCOPE,opportunityCreated:true,opportunityId:"opp_123",title:"청소년 활동 지원사업",organization:"한국청소년기관",deadline:null,eligibleRegion:null,reviewReason:null};

function capture(response=new Response("ok")){const requests:{url:string;body:Record<string,unknown>}[]=[];const logs:string[]=[];return{requests,logs,dependencies:{fetcher:async(input:RequestInfo|URL,init?:RequestInit)=>{requests.push({url:String(input),body:JSON.parse(String(init?.body)) as Record<string,unknown>});return response},logger:{info:(message:string)=>logs.push(message),error:(message:string)=>logs.push(message)}}};}

test("new IN_SCOPE opportunity sends one public-detail notification",async()=>{const captured=capture();assert.equal(await notifyOwnerOfNewOpportunity(base,config,captured.dependencies),true);assert.equal(captured.requests.length,1);const body=captured.requests[0].body;assert.match(String(body.text),/^\[YouthGrant 신규 공모\]/);assert.match(String(body.text),/마감: 확인 필요/);const markup=body.reply_markup as {inline_keyboard:{text:string;url:string}[][]};assert.deepEqual(markup.inline_keyboard[0][0],{text:"YouthGrant에서 보기",url:"https://youthgrant.example/grants/opp_123"})});

test("new RELEVANCE_REVIEW sends one Ops notification with the existing reason",async()=>{const captured=capture();await notifyOwnerOfNewOpportunity({...base,relevanceStatus:RelevanceStatus.RELEVANCE_REVIEW,opportunityCreated:false,opportunityId:undefined,reviewReason:"기관 신청형 재정지원 구조 확인 필요"},config,captured.dependencies);assert.equal(captured.requests.length,1);const body=captured.requests[0].body;assert.match(String(body.text),/^\[YouthGrant 검토 필요\]/);assert.match(String(body.text),/기관 신청형 재정지원 구조 확인 필요/);const markup=body.reply_markup as {inline_keyboard:{text:string;url:string}[][]};assert.deepEqual(markup.inline_keyboard[0][0],{text:"Ops에서 검토하기",url:"https://youthgrant.example/ops/review"})});

test("OUT_OF_SCOPE and existing opportunities send nothing",async()=>{const captured=capture();await notifyOwnerOfNewOpportunity({...base,relevanceStatus:RelevanceStatus.OUT_OF_SCOPE},config,captured.dependencies);await notifyOwnerOfNewOpportunity({...base,state:"MATCHED"},config,captured.dependencies);assert.equal(captured.requests.length,0)});

test("missing config and non-production environments never call Telegram",async()=>{const captured=capture();await notifyOwnerOfNewOpportunity(base,{environment:"production"},captured.dependencies);await notifyOwnerOfNewOpportunity(base,{...config,environment:"development"},captured.dependencies);assert.equal(captured.requests.length,0);assert.equal(captured.logs.length,2)});

test("Telegram failure is isolated and does not expose secrets in content, links, or logs",async()=>{const captured=capture(new Response("denied",{status:500}));assert.equal(await notifyOwnerOfNewOpportunity(base,config,captured.dependencies),false);assert.equal(captured.requests.length,1);const body=captured.requests[0].body;const markup=body.reply_markup as {inline_keyboard:{url:string}[][]};const exposed=JSON.stringify({text:body.text,links:markup.inline_keyboard.flat().map(button=>button.url),logs:captured.logs});assert.ok(!exposed.includes(config.botToken));assert.ok(!exposed.includes(config.chatId))});

test("IN_SCOPE without an actual opportunity insert does not notify",async()=>{const captured=capture();await notifyOwnerOfNewOpportunity({...base,opportunityCreated:false},config,captured.dependencies);assert.equal(captured.requests.length,0)});

test("invalid site configuration is isolated from collection",async()=>{const captured=capture();assert.equal(await notifyOwnerOfNewOpportunity(base,{...config,siteOrigin:"not a URL"},captured.dependencies),false);assert.equal(captured.requests.length,0);assert.match(captured.logs.join(" "),/collection will continue/)});
