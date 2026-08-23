import assert from "node:assert/strict";
import test from "node:test";
import { classifyOpportunityRelevance } from "../lib/relevance/classifier.ts";
import { assessNoticeRelevance } from "../lib/relevance/gate.ts";
import { makeDedupeKey } from "../lib/collectors/dedupe.ts";
import type { RawNotice } from "../lib/collectors/contracts.ts";

const classify=(title:string,body?:string)=>classifyOpportunityRelevance({title,body});

test("financial support plus institution delivery is IN_SCOPE",()=>{
  const cases=[
    ["청소년 문화예술 프로그램 운영기관 모집","신청대상은 청소년수련시설입니다. 선정기관은 문화예술 프로그램을 운영하며 기관당 최대 2,000만원의 사업비를 지원합니다. 사업계획서를 제출합니다."],
    ["청소년 진로사업 수행기관 공모","지원자격은 비영리 청소년단체입니다. 선정된 단체가 진로사업을 수행하고 보조금 1,500만원을 교부받으며 자부담 10%를 부담합니다."],
    ["청소년 환경활동 참여기관 모집","모집대상은 경기도 청소년시설입니다. 선정된 기관은 환경 프로젝트를 운영하고 개소당 500만원 지원금을 지급받습니다. 지원신청서를 제출합니다."],
  ];
  for(const [title,body] of cases)assert.equal(classify(title,body).status,"IN_SCOPE",title);
});

test("known participant, education, event and cooperation noise is OUT_OF_SCOPE",()=>{
  const cases=[
    ["청소년 디지털 성평등 교육 참가기관 추가 모집","교육 참여를 희망하는 학교와 청소년기관을 모집합니다. 교육은 강사가 방문하여 무료로 진행합니다."],
    ["청소년수련시설 협력강화사업 참가자 모집","청소년운영위원회 소속 청소년 참가자를 모집하며 교류 활동과 캠프에 참여합니다."],
    ["청소년수련시설 종사자 힐링 프로그램 참가자 모집","수련시설 종사자를 위한 힐링 프로그램 참가자 30명을 모집합니다."],
    ["청소년활동 프로그램 공모전 안내 및 참여 협조 요청","우수 프로그램과 활동 사례를 발굴하는 공모전이니 소속 기관에 참여 협조 요청드립니다."],
    ["청소년자원봉사활동 우수사례 공모전","청소년과 지도자, 운영기관의 우수 사례와 수기를 접수하고 수상작을 시상합니다."],
    ["학교단체 수련활동 상시 모집","국립청소년시설 수련활동에 참가할 학교단체의 예약 신청을 받습니다."],
    ["청소년 축제 참가 신청","시민과 청소년 개인을 대상으로 행사 참가 신청을 받으며 기념 물품을 제공합니다."],
    ["청소년 프로그램 참여기관 모집","선정된 학교와 기관은 무료 체험 프로그램에 참여하며 강사와 교구를 제공받습니다."],
  ];
  for(const [title,body] of cases)assert.equal(classify(title,body).status,"OUT_OF_SCOPE",title);
});

test("G-ROUND participant clubs are OUT_OF_SCOPE despite an operating-cost benefit",()=>{
  const result=classify("청소년참여주도형활동 G-ROUND 참가 동아리 모집","모집대상은 경기도 내 만 13세부터 19세 청소년 댄스동아리입니다. 학교, 청소년시설, 지역기관 소속 모두 가능하며 참가비는 무료입니다. 참여혜택으로 동아리 운영비 지원과 프로필 촬영, 굿즈를 제공합니다.");
  assert.equal(result.status,"OUT_OF_SCOPE");assert.match(result.reason,/동아리|참여/);
});

test("prize money does not turn a contest into an IN_SCOPE grant",()=>{
  const result=classify("청소년 우수사례 공모전","청소년과 지도자가 사례를 제출하며 최우수상 상금 30만원과 기관장상을 시상합니다. 신청서와 활동계획서를 제출합니다.");
  assert.equal(result.status,"OUT_OF_SCOPE");assert.match(result.reason,/상금|공모전/);
});

test("a title keyword alone never causes automatic exclusion",()=>{
  assert.equal(classify("청소년 힐링 프로그램 참가자 모집").status,"RELEVANCE_REVIEW");
  assert.equal(classify("청소년 우수사례 공모전").status,"RELEVANCE_REVIEW");
});

test("ambiguous operating institution recruitment without funding stays RELEVANCE_REVIEW",()=>{
  const result=classify("청소년 프로그램 운영기관 모집","선정기관은 프로그램을 운영합니다. 신청대상은 청소년 관련 기관이며 세부 지원 내용은 첨부를 확인해 주십시오.");
  assert.equal(result.status,"RELEVANCE_REVIEW");
});

test("gate reads detail HTML before excluding participant recruitment",async()=>{
  const title="청소년 힐링 프로그램 참가자 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"1",title,url:"https://example.com/1",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/1")};
  const fetcher:typeof fetch=async()=>new Response(`<html><body><main><h1>${title}</h1><p>청소년수련시설 종사자를 위한 힐링 프로그램 참가자 30명을 모집합니다.</p></main></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  assert.equal((await assessNoticeRelevance(notice,fetcher)).status,"OUT_OF_SCOPE");
});

test("detail focus does not use unrelated next-post keywords",async()=>{
  const title="청소년활동 안전컨설팅 참여기관 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"3",title,url:"https://example.com/3",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/3")};
  const fetcher:typeof fetch=async()=>new Response(`<html><body><h1>${title}</h1><p>전문 컨설턴트가 시설을 방문해 안전 점검 서비스를 무상으로 제공합니다. 참여기관이 온라인으로 신청합니다.</p><p>다음글</p><a>청소년 우수사례 공모전</a></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  const result=await assessNoticeRelevance(notice,fetcher);assert.equal(result.status,"OUT_OF_SCOPE");assert.match(result.reason,/컨설팅/);
});

test("detail fetch failure is isolated as RELEVANCE_REVIEW",async()=>{
  const title="청소년 활동 운영기관 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"2",title,url:"https://example.com/2",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/2")};
  const fetcher:typeof fetch=async()=>new Response("blocked",{status:403});
  assert.equal((await assessNoticeRelevance(notice,fetcher)).status,"RELEVANCE_REVIEW");
});
