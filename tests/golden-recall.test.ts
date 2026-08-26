import assert from "node:assert/strict";
import test from "node:test";
import { classifyOpportunityRelevance } from "../lib/relevance/classifier.ts";
import type { ExternalResourceType } from "../lib/domain/types.ts";

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

const externalResourcePositive:{id:string;title:string;body:string;types:ExternalResourceType[]}[]=[
  {id:"G01",title:"2026 우수 청소년활동 프로그램 지원사업",body:"신청대상은 청소년수련시설입니다. 선정된 기관은 청소년활동 프로그램을 운영하며 기관당 2,000만원의 사업비를 지원받고 사업계획서를 제출합니다.",types:["MONEY"]},
  {id:"G02",title:"2026 보훈 테마활동 사업",body:"신청자격은 학교, 청소년시설 및 비영리단체입니다. 선정된 단체는 보훈 프로그램을 수행하고 국고보조금을 교부받으며 보조금 교부신청서를 제출합니다.",types:["MONEY"]},
  {id:"G03",title:"2026 삼성꿈장학재단 배움터 교육지원사업",body:"신청대상은 아동청소년 교육활동을 수행하는 비영리 기관과 단체입니다. 선정된 기관은 교육 프로그램을 운영하며 기관당 최대 2,500만원의 지원금을 지급받고 사업계획서를 제출합니다.",types:["MONEY"]},
  {id:"G04",title:"2026 농어촌청소년 성장 네트워크 지원사업",body:"신청자격은 농어촌지역 청소년 관련 기관과 단체입니다. 선정된 단체는 성장지원 사업을 수행하며 사업비를 지원받고 사업계획서를 제출합니다.",types:["MONEY"]},
  {id:"G05",title:"2026 찾아가는 청소년활동 안전교육",body:"신청대상은 전국 청소년시설입니다. 선정 시설을 전문 강사가 방문하여 시설 이용 청소년에게 안전교육을 제공합니다.",types:["STAFF"]},
  {id:"G06",title:"2026 디지털 성평등 시민성 함양 교육",body:"신청대상은 청소년시설입니다. 선정 시설에 전문 강사를 파견해 시설 이용 청소년에게 디지털 시민성 교육프로그램을 제공합니다.",types:["STAFF","PROGRAM"]},
  {id:"G07",title:"청주시 교우관계 회복 집단상담",body:"신청대상은 학교 및 청소년기관입니다. 선정 기관에 전문 상담사를 파견하여 기관 소속 청소년에게 집단상담 프로그램을 제공합니다.",types:["STAFF","PROGRAM"]},
  {id:"G08",title:"청주시 슬기로운 디지털생활 교실",body:"신청대상은 학교와 청소년시설입니다. 전문 강사가 선정 시설을 방문해 시설 이용 청소년에게 디지털생활 교육프로그램을 제공합니다.",types:["STAFF","PROGRAM"]},
  {id:"G09",title:"청소년시설 찾아가는 안전교육",body:"신청대상은 청소년수련시설입니다. 전문 강사가 시설을 방문하여 시설 이용 청소년에게 안전교육을 하고 안전물품과 교육자료를 제공합니다.",types:["STAFF","MATERIAL"]},
  {id:"G10",title:"2025 찾아가는 청소년활동 안전교육",body:"신청대상은 전국 청소년시설입니다. 선정 시설을 안전 전문강사가 방문하여 시설 이용 청소년 대상 교육을 제공합니다.",types:["STAFF"]},
  {id:"G11",title:"청소년수련시설 응급처치 안전인프라 구축",body:"신청대상은 전국 청소년수련시설입니다. 선정 시설에 자동심장충격기, 패드, 배터리와 안전표지를 보급합니다.",types:["MATERIAL"]},
  {id:"G12",title:"안전드림 안전물품 지원 수요조사",body:"신청대상은 전국 청소년수련시설입니다. 수요조사 응답 시설 중 선정 시설에 안전 멀티탭과 포스터 등 안전물품을 배정하여 보급합니다.",types:["MATERIAL"]},
  {id:"G13",title:"2026 우수프로그램 보급활동",body:"신청대상은 청소년수련시설 및 청소년단체입니다. 선정 기관은 검증된 우수 프로그램을 무상 도입하여 기관 프로그램을 운영하고 현장 코칭을 지원받습니다.",types:["PROGRAM"]},
  {id:"G14",title:"2026 국립청소년시설 1:1 맞춤형 프로그램 보급",body:"신청대상은 청소년시설입니다. 선정 시설에 맞춤형 프로그램을 제공하고 전문 컨설턴트가 시설을 방문하여 프로그램 품질 컨설팅을 제공합니다.",types:["PROGRAM","PROFESSIONAL_SERVICE"]},
  {id:"G15",title:"2026 디지털 시민성 기반 PBL 모델 운영기관",body:"신청대상은 청소년시설입니다. 선정 기관의 현장 운영을 위해 디지털 시민성 PBL 프로그램을 제공하고 매뉴얼과 프로그램 재료를 보급합니다.",types:["PROGRAM","MATERIAL"]},
  {id:"G16",title:"지역형 PBL 모델 운영기관",body:"신청대상은 청소년 관련 기관입니다. 선정 기관이 프로그램을 도입하여 청소년 대상 현장 운영을 할 수 있도록 완성된 지역형 PBL 프로그램을 제공합니다.",types:["PROGRAM"]},
  {id:"G17",title:"2026 청소년활동 안전컨설팅",body:"신청대상은 청소년수련시설입니다. 전문 컨설턴트가 시설을 직접 방문하여 안전컨설팅을 제공합니다.",types:["PROFESSIONAL_SERVICE"]},
  {id:"G18",title:"2026 제3차 청소년활동 안전컨설팅",body:"신청대상은 청소년활동시설입니다. 선정 시설에 전문 컨설턴트를 파견하여 안전컨설팅을 제공합니다.",types:["PROFESSIONAL_SERVICE"]},
  {id:"G19",title:"안전보건관리체계 구축 점검 컨설팅",body:"신청대상은 청소년시설입니다. 전문가가 시설을 방문하여 시설 점검과 안전 컨설팅을 제공합니다.",types:["PROFESSIONAL_SERVICE"]},
  {id:"G20",title:"2026 청소년활동 안전법률상담",body:"청소년시설이 신청할 수 있습니다. 전문 변호사가 시설을 방문하여 법률상담을 제공합니다.",types:["PROFESSIONAL_SERVICE"]},
];

const externalResourceNegative=[
  {id:"N01",title:"청소년 안전홍보단 모집",body:"청소년 개인과 동아리 팀이 신청하여 홍보 활동에 참여하며 선발된 팀에는 활동비를 지원합니다."},
  {id:"N02",title:"청소년자원봉사활동 우수사례 공모전",body:"청소년과 지도자가 기존 활동 사례를 제출하고 우수작에는 상금과 기관장상을 시상합니다."},
  {id:"N03",title:"온라인 청소년 정책제안 공모전",body:"청소년 개인과 동아리가 정책 아이디어를 제안하며 우수 제안에 상금을 시상합니다."},
  {id:"N04",title:"청소년지도사 아이디어 공모전",body:"청소년지도사 개인과 팀이 아이디어를 제출하고 우수작에 상금을 지급합니다."},
  {id:"N05",title:"디지털 시민성 전문 지도자 양성교육 참가자 모집",body:"청소년시설 종사자와 지도자 개인이 무료 전문교육과 연수에 참가 신청합니다."},
  {id:"N06",title:"국립청소년시설 학교단체 수련활동 사전예약",body:"학교단체가 일반 수련활동 서비스 이용을 위해 사전예약을 신청하고 참가비를 납부합니다."},
  {id:"N07",title:"Love Myself 프로그램 참가자 모집",body:"청소년 개인 참가자를 모집하여 무료 프로그램에 참여하게 합니다."},
  {id:"N08",title:"국제청소년성취포상제 탐험활동 참가자 모집",body:"청소년 개인 참가자가 탐험활동에 참여하도록 모집합니다."},
  {id:"N09",title:"국가간 지도자교류 참가자 모집",body:"청소년지도자 개인 참가자를 모집하여 해외 교류행사에 참여하게 합니다."},
  {id:"N10",title:"청소년시설 직원 채용공고",body:"청소년시설에서 근무할 직원을 채용하며 지원서와 이력서를 접수합니다."},
] as const;

const institutionalResourceBundle={
  id:"KYWA-36701",
  title:"2026년 우수 청소년활동 프로그램 지원사업 보급활동(실전형) 참여기관 추가 모집",
  body:"지원내용 ① 프로그램 운영 매뉴얼 무상 제공 ② 프로그램 개발자 1:1 맞춤형 컨설팅(2회) ③ 사업운영비 100,000원(네이버페이 포인트) 지원. 대 상: 청소년수련시설 및 단체 등 청소년관련기관. 제출서류는 보급활동 프로그램 신청서입니다.",
  types:["MONEY","PROGRAM","PROFESSIONAL_SERVICE"] satisfies ExternalResourceType[],
};

test("External Resource Golden Positive recall classifies all evidence-backed institution resources",()=>{
  for(const fixture of externalResourcePositive){const result=classifyOpportunityRelevance(fixture);assert.equal(result.status,"IN_SCOPE",fixture.id);for(const type of fixture.types){assert.ok(result.supportTypes.includes(type),`${fixture.id}:${type}`);assert.ok(result.supportEvidence[type]?.length,`${fixture.id}:${type}:evidence`);}}
});

test("External Resource Golden Negative guard keeps all ten cases OUT_OF_SCOPE",()=>{for(const fixture of externalResourceNegative)assert.equal(classifyOpportunityRelevance(fixture).status,"OUT_OF_SCOPE",fixture.id)});

test("Institutional Resource Bundle Golden recognizes KYWA 36701 without adding MATERIAL",()=>{
  const result=classifyOpportunityRelevance(institutionalResourceBundle);
  assert.equal(result.status,"IN_SCOPE");
  assert.deepEqual(result.supportTypes,institutionalResourceBundle.types);
  for(const type of institutionalResourceBundle.types)assert.ok(result.supportEvidence[type]?.length,`${institutionalResourceBundle.id}:${type}`);
});
