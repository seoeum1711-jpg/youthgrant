import assert from "node:assert/strict";
import test from "node:test";
import { classifyOpportunityRelevance } from "../lib/relevance/classifier.ts";

const goldenPositive=[
  {name:"KYWA 우수 청소년활동 프로그램 지원사업",title:"2026 우수 청소년활동 프로그램 지원사업",body:"신청대상은 청소년수련시설과 청소년 관련 비영리단체입니다. 선정된 기관은 청소년활동 프로그램을 운영하며 기관당 2,000만원의 사업비를 지원합니다. 사업계획서를 제출합니다."},
  {name:"국가보훈부 청소년 보훈 테마활동",title:"2026 청소년 보훈 테마활동 국고보조사업",body:"신청자격은 학교, 청소년시설 및 비영리단체입니다. 선정된 단체는 청소년 보훈 프로그램을 수행하고 국고보조금을 교부받습니다. 보조금 교부신청서를 제출합니다."},
  {name:"FRY 성장 네트워크",title:"2026 농어촌청소년 성장 네트워크 지원사업 공모",body:"신청자격은 농어촌지역 청소년 성장 지원 활동에 참여할 기관·단체 네트워크입니다. 선정된 단체는 청소년 성장 지원사업을 수행하며 사업비를 지원받고 사업계획서를 제출합니다."},
  {name:"Samsung Dream 배움터",title:"2026년 배움터 교육지원사업 공모",body:"신청대상은 아동·청소년 교육활동을 수행하는 비영리 기관과 단체입니다. 선정된 기관은 교육복지 프로그램을 운영하며 기관당 최대 2,500만원의 지원금을 지급받고 사업계획서를 제출합니다."},
  {name:"경기도청 비영리민간단체 공익활동",title:"2026 비영리민간단체 공익활동 지원사업",body:"신청자격은 경기도 소재 비영리민간단체입니다. 선정된 단체는 공익활동 사업을 수행하며 단체당 2,000만원의 보조금을 교부받고 사업계획서를 제출합니다."},
] as const;

const goldenReview=[{name:"MOGEF 청소년의 달",title:"2027년 청소년의 달 행사 주관기관 공모",body:"청소년의 달 행사를 수행할 주관기관을 선정합니다. 신청자격은 행사 운영 역량을 갖춘 기관·단체이며 자세한 내용은 공고문을 확인해 주십시오."}] as const;

const goldenNegative=[
  {name:"캠프 참가자",title:"청소년 캠프 참가자 모집",body:"청소년 개인 참가자 40명을 모집하며 참가자는 캠프 프로그램에 참여합니다."},
  {name:"우수사례 공모전",title:"청소년자원봉사 우수사례 공모전",body:"청소년과 지도자가 봉사 우수사례를 제출하며 수상작에는 상금과 기관장상을 시상합니다."},
  {name:"종사자 직무연수",title:"청소년시설 종사자 직무연수",body:"청소년시설 종사자와 교육 참가자를 모집하여 무료 직무연수를 제공합니다."},
  {name:"사진 영상 공모전",title:"청소년 대상 사진·영상 공모전",body:"청소년 개인이 사진과 영상을 출품하며 우수 작품에는 상금을 시상합니다."},
  {name:"개인 장학생",title:"삼성꿈장학재단 개인 장학생 모집",body:"신청대상은 중·고등학생 청소년 개인이며 선정된 장학생 개인에게 장학금을 지급합니다."},
] as const;

test("Golden Positive recall keeps five institution-delivery grants IN_SCOPE",()=>{for(const fixture of goldenPositive)assert.equal(classifyOpportunityRelevance(fixture).status,"IN_SCOPE",fixture.name)});
test("Golden Review keeps unsupported MOGEF funding safely unresolved",()=>{for(const fixture of goldenReview)assert.equal(classifyOpportunityRelevance(fixture).status,"RELEVANCE_REVIEW",fixture.name)});
test("Golden Negative recall excludes five participation, contest, training and individual scholarship cases",()=>{for(const fixture of goldenNegative)assert.equal(classifyOpportunityRelevance(fixture).status,"OUT_OF_SCOPE",fixture.name)});
