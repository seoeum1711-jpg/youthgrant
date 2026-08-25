import assert from "node:assert/strict";
import test from "node:test";
import type { D1DatabaseLike } from "../lib/cloudflare.ts";
import type { RawNotice, SourceDefinition } from "../lib/collectors/contracts.ts";
import { persistNotice } from "../lib/collectors/persist.ts";
import { fixtureOpportunities } from "../lib/data/fixtures.ts";
import { toGrantViewModel } from "../lib/domain/grant-view-model.ts";
import { normalizeSupportTypes, parseSupportTypesJson, supportTypeLabel } from "../lib/domain/support-types.ts";
import type { ExternalResourceType } from "../lib/domain/types.ts";
import type { RelevanceDecision } from "../lib/relevance/classifier.ts";

type Existing={id:string;relevance_status:string;opportunity_id:string|null;review_status:string|null};
type Write={query:string;values:unknown[]};

function fakeDb(existing:Existing|null=null){
  const writes:Write[]=[];
  const db={prepare(query:string){let values:unknown[]=[];return{bind(...next:unknown[]){values=next;return this;},async first(){return query.startsWith("SELECT rn.id")?existing:null;},async all(){return{results:[]};},async run(){writes.push({query,values});const inserted=query.includes("INSERT OR IGNORE INTO opportunities")&&!existing?.opportunity_id;return{meta:{changes:inserted?1:query.includes("INSERT OR IGNORE INTO opportunities")?0:1}};}};}} as unknown as D1DatabaseLike;
  return{db,writes};
}

const source:SourceDefinition={id:"support-source",name:"지원기관",method:"WEB",region:"전국",url:"https://example.com",implemented:true,enabled:true,health:"GREEN"};
const notice:RawNotice={sourceId:source.id,sourceNoticeId:"1",title:"청소년시설 지원사업",url:"https://example.com/1",publishedAt:"2026-08-25T00:00:00Z",rawText:"기관 신청 및 사업비 지원",collectedAt:"2026-08-25T01:00:00Z",dedupeKey:"support-source:1"};
function decision(supportTypes:RelevanceDecision["supportTypes"]):RelevanceDecision{return{status:"IN_SCOPE",reason:"기관 외부자원 지원 확인",signals:[],supportTypes,supportEvidence:{}};}

test("support type normalization keeps canonical multi-types once",()=>{
  assert.deepEqual(normalizeSupportTypes(["MONEY","STAFF","MONEY"]),["MONEY","STAFF"]);
  assert.deepEqual(normalizeSupportTypes(["PROFESSIONAL_SERVICE"]),["PROFESSIONAL_SERVICE"]);
  assert.deepEqual(normalizeSupportTypes(["MATERIAL"]),["MATERIAL"]);
  assert.deepEqual(normalizeSupportTypes(["PROGRAM","STAFF"]),["PROGRAM","STAFF"]);
});

test("legacy support type JSON fails safely and ignores unknown future values",()=>{
  assert.deepEqual(parseSupportTypesJson(null),[]);
  assert.deepEqual(parseSupportTypesJson("broken"),[]);
  assert.deepEqual(parseSupportTypesJson('["MONEY","FUTURE_TYPE",7]'),["MONEY"]);
});

test("support type labels have one canonical Public mapping",()=>{
  assert.equal(supportTypeLabel("MONEY"),"사업비");
  assert.equal(supportTypeLabel("STAFF"),"강사·인력");
  assert.equal(supportTypeLabel("MATERIAL"),"물품·교구");
  assert.equal(supportTypeLabel("PROGRAM"),"프로그램 제공");
  assert.equal(supportTypeLabel("PROFESSIONAL_SERVICE"),"전문서비스");
});

test("new IN_SCOPE Opportunity persists deduplicated support types",async()=>{
  const{db,writes}=fakeDb();await persistNotice(db,notice,source,"run-1",decision(["MONEY","STAFF","MONEY"]));
  const insert=writes.find(write=>write.query.includes("INSERT OR IGNORE INTO opportunities"));
  assert.equal(insert?.values[7],'["MONEY","STAFF"]');
});

test("matched automatic Opportunity refreshes support types while manual rows preserve them",async()=>{
  const automatic:Existing={id:"raw-1",relevance_status:"IN_SCOPE",opportunity_id:"opp-1",review_status:"REVIEW_REQUIRED"};
  const first=fakeDb(automatic);await persistNotice(first.db,notice,source,"run-2",decision(["PROFESSIONAL_SERVICE"]));
  assert.ok(first.writes.some(write=>write.query.startsWith("UPDATE opportunities SET support_types_json")&&write.values[0]==='["PROFESSIONAL_SERVICE"]'));
  for(const review_status of ["CONFIRMED","DEFERRED","EXCLUDED"]){const manual=fakeDb({...automatic,review_status});await persistNotice(manual.db,notice,source,"run-3",decision(["MATERIAL"]));assert.ok(!manual.writes.some(write=>write.query.startsWith("UPDATE opportunities SET support_types_json")),review_status);}
});

test("GrantViewModel receives canonical support types without changing Public filters",()=>{
  const opportunity={...fixtureOpportunities[0],supportTypes:["MONEY","STAFF"] as ExternalResourceType[]};
  const view=toGrantViewModel(opportunity,new Date("2026-08-25T09:00:00+09:00"));
  assert.deepEqual(view.supportTypes,["MONEY","STAFF"]);
  assert.equal(view.status,"마감임박");
});
