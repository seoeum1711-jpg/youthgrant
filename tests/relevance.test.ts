import assert from "node:assert/strict";
import test from "node:test";
import { strToU8, zipSync } from "fflate";
import { classifyOpportunityRelevance } from "../lib/relevance/classifier.ts";
import { assessNoticeRelevance } from "../lib/relevance/gate.ts";
import { makeDedupeKey } from "../lib/collectors/dedupe.ts";
import { shouldCreateOpportunity } from "../lib/collectors/persist.ts";
import type { RawNotice, SourceDefinition } from "../lib/collectors/contracts.ts";

const classify=(title:string,body?:string)=>classifyOpportunityRelevance({title,body});
const source=(id="test"):SourceDefinition=>({id,name:id,method:"WEB",region:"전국",url:`https://example.com/${id}`,implemented:true,enabled:true,health:"GREEN"});

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
    ["청소년 디지털 성평등 교육 참가기관 추가 모집","교육 참여를 희망하는 학교와 청소년기관을 모집합니다. 참가 기관은 무료 강의 영상을 시청합니다."],
    ["청소년수련시설 협력강화사업 참가자 모집","청소년운영위원회 소속 청소년 참가자를 모집하며 교류 활동과 캠프에 참여합니다."],
    ["청소년수련시설 종사자 힐링 프로그램 참가자 모집","수련시설 종사자를 위한 힐링 프로그램 참가자 30명을 모집합니다."],
    ["청소년활동 프로그램 공모전 안내 및 참여 협조 요청","우수 프로그램과 활동 사례를 발굴하는 공모전이니 소속 기관에 참여 협조 요청드립니다."],
    ["청소년자원봉사활동 우수사례 공모전","청소년과 지도자, 운영기관의 우수 사례와 수기를 접수하고 수상작을 시상합니다."],
    ["학교단체 수련활동 상시 모집","국립청소년시설 수련활동에 참가할 학교단체의 예약 신청을 받습니다."],
    ["청소년 축제 참가 신청","시민과 청소년 개인을 대상으로 행사 참가 신청을 받으며 기념 물품을 제공합니다."],
    ["청소년 프로그램 참여기관 모집","학교와 기관은 무료 체험 프로그램에 참가하며 일정과 이용 방법을 안내받습니다."],
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

test("patrol and unrelated participating-company candidates stay internal without Opportunity creation",()=>{for(const [title,body] of [["2026년 제5기 서울 대학생 순찰대 추가 모집 연장 공고","모집대상은 서울 소재 대학교 학생회와 동아리 단체이며 순찰 활동에 참여합니다."],["사회연대경제 청년 일경험 시범사업 참여기업 모집","청년에게 일경험을 제공할 참여기업을 모집하며 구직자가 기업에서 근무합니다."]]){const result=classify(title,body);assert.notEqual(result.status,"IN_SCOPE");assert.equal(shouldCreateOpportunity(result.status),false);}});

test("gate reads detail HTML before excluding participant recruitment",async()=>{
  const title="청소년 힐링 프로그램 참가자 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"1",title,url:"https://example.com/1",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/1")};
  const fetcher:typeof fetch=async()=>new Response(`<html><body><main><h1>${title}</h1><p>청소년수련시설 종사자를 위한 힐링 프로그램 참가자 30명을 모집합니다.</p></main></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  assert.equal((await assessNoticeRelevance(notice,source(),fetcher)).status,"OUT_OF_SCOPE");
});

test("detail focus keeps institution-delivered professional service IN_SCOPE without using next-post keywords",async()=>{
  const title="청소년활동 안전컨설팅 참여기관 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"3",title,url:"https://example.com/3",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/3")};
  const fetcher:typeof fetch=async()=>new Response(`<html><body><h1>${title}</h1><p>전문 컨설턴트가 시설을 방문해 안전 점검 서비스를 무상으로 제공합니다. 참여기관이 온라인으로 신청합니다.</p><p>다음글</p><a>청소년 우수사례 공모전</a></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8"}});
  const result=await assessNoticeRelevance(notice,source(),fetcher);assert.equal(result.status,"IN_SCOPE");assert.deepEqual(result.supportTypes,["PROFESSIONAL_SERVICE"]);assert.doesNotMatch(result.reason,/공모전/);
});

test("detail fetch failure is isolated as RELEVANCE_REVIEW",async()=>{
  const title="청소년 활동 운영기관 모집";const notice:RawNotice={sourceId:"test",sourceNoticeId:"2",title,url:"https://example.com/2",publishedAt:null,rawText:title,collectedAt:"2026-08-22T00:00:00.000Z",dedupeKey:makeDedupeKey("test",title,"https://example.com/2")};
  const fetcher:typeof fetch=async()=>new Response("blocked",{status:403});
  assert.equal((await assessNoticeRelevance(notice,source(),fetcher)).status,"RELEVANCE_REVIEW");
});

test("sdream attachment-only notice becomes IN_SCOPE from supported official document text",async()=>{
  const title="2026년 배움터 교육지원사업 공모";const notice:RawNotice={sourceId:"sdream",sourceNoticeId:"BBS25000000000506387",title,url:"https://www.sdream.or.kr/w/bbs0103V?BBS_SID=BBS25000000000506387",publishedAt:null,rawText:title,collectedAt:"2026-08-24T06:02:32.177Z",dedupeKey:"sdream:fixture"};
  const section=`<?xml version="1.0"?><hp:section xmlns:hp="urn:hancom:section"><hp:p><hp:run><hp:t>신청대상은 교육활동을 수행하는 비영리 기관 및 단체입니다. 선정된 기관은 아동청소년 교육 프로그램을 운영하고 기관당 지원금을 지급받으며 사업계획서를 제출합니다. 신청기간 2026년 8월 1일 ~ 2026년 9월 4일</hp:t></hp:run></hp:p></hp:section>`;const bytes=zipSync({mimetype:strToU8("application/hwp+zip"),"Contents/section0.xml":strToU8(section)});
  const fetcher:typeof fetch=async input=>String(input).includes("/download?")?new Response(bytes,{headers:{"content-type":"application/vnd.hancom.hwpx"}}):new Response(`<h1>${title}</h1><p>첨부파일</p><a href="#null" onclick="onFileDown('FLE_FIXTURE'); return false;">2026 배움터 교육지원사업 공모요강.hwpx</a><p>이전글</p>`,{headers:{"content-type":"text/html; charset=utf-8"}});
  const result=await assessNoticeRelevance(notice,{...source("sdream"),url:"https://www.sdream.or.kr/main"},fetcher);assert.equal(result.status,"IN_SCOPE");assert.deepEqual(result.supportTypes,["MONEY"]);assert.ok(result.supportEvidence.MONEY?.length);
});
