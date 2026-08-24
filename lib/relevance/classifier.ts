import { ExternalResourceType, RelevanceStatus, type ExternalResourceType as ExternalResourceTypeValue, type RelevanceStatus as RelevanceStatusValue } from "../domain/types.ts";

export type RelevanceInput={title:string;body?:string|null;attachmentText?:string[]};
export type RelevanceDecision={status:RelevanceStatusValue;reason:string;signals:string[];supportTypes:ExternalResourceTypeValue[];supportEvidence:Partial<Record<ExternalResourceTypeValue,string[]>>};

const FINANCIAL=[
  /사업비(?:를|는|로|의)?\s*(?:지원|보조|교부)/,
  /사업\s*수행비(?:를|는|로|의)?\s*(?:지원|지급|교부)/,
  /예산(?:을|를|은|는)?\s*지원/,
  /(?:지원금|보조금|지원액)(?:을|를|은|는|으로)?\s*(?:지원|지급|교부)?/,
  /(?:기관|시설|단체|개소)\s*(?:당|별)\s*(?:최대\s*)?[0-9,]+\s*(?:만|천만|억)?\s*원/,
  /지원\s*규모[^\n.]{0,100}(?:원|만원|억원)/,
  /자부담(?:금|률|비율)?[^\n.]{0,80}(?:없음|[0-9]+\s*%|원)/,
] as const;
const EXECUTION=[
  /선정(?:된|될)?\s*(?:기관|시설|단체|개소)[^\n.]{0,100}(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)/,
  /(?:운영|수행)\s*기관[^\n.]{0,100}(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)/,
  /(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)[^\n.]{0,100}(?:기관|시설|단체)/,
  /(?:사업계획서|지원신청서|보조금\s*교부신청서)/,
] as const;
const ORGANIZATION_APPLICANT=[
  /(?:신청|지원|모집)\s*(?:대상|자격|주체)[^\n.]{0,120}(?:청소년수련관|청소년문화의집|청소년수련원|청소년특화시설|청소년(?:\s*관련)?기관|청소년쉼터|비영리(?:기관|법인|단체)|학교|기관|시설|단체|법인|센터)/,
  /(?:청소년수련관|청소년문화의집|청소년수련원|청소년특화시설|청소년(?:\s*관련)?기관|청소년쉼터|비영리(?:기관|법인|단체)|학교|기관|시설|단체|법인|센터)[^\n.]{0,100}(?:신청|지원할 수|공모에 참여)/,
] as const;
const PERSONAL_APPLICANT=/(?:신청|모집|참가|참여)\s*(?:대상|자격|주체)?[^\n.]{0,80}(?:개인|청소년\s*개인|참가자|교육생|종사자|시민|동아리|학생|지도자)|(?:개인|청소년\s*개인|참가자|교육생|종사자|시민|동아리|학생|지도자)[^\n.]{0,60}(?:신청|모집|참가|참여)/;
const PARTICIPANT_GROUP_APPLICANT=/(?:신청|모집|지원)\s*(?:대상|자격|주체)?\s*[:：]?\s*[^\n.!?]{0,80}(?:학생회|(?:학생|대학|청소년)\s*동아리|개인(?:들로)?\s*구성(?:된)?\s*팀|참가팀|활동팀)|(?:학생회|(?:학생|대학|청소년)\s*동아리|개인(?:들로)?\s*구성(?:된)?\s*팀|참가팀|활동팀)[^\n.!?]{0,60}(?:신청|모집|지원)/;
const INSTITUTIONAL_APPLICANT=/(?:신청|모집|지원)\s*(?:대상|자격|주체)?\s*[:：]?\s*[^\n.!?]{0,100}(?:청소년수련관|청소년문화의집|청소년수련원|청소년특화시설|청소년(?:수련)?시설|청소년(?:\s*관련)?기관|청소년쉼터|비영리(?:기관|법인|단체)|복지기관|법인)/;
const PRIZE_CONTEST=/(?:공모전|작품\s*모집|우수\s*사례|사례\s*공모|수기\s*공모)[^\n.]{0,180}(?:시상금|상금|부상)|(?:시상금|상금|부상)[^\n.]{0,180}(?:공모전|작품|사례|수기)/;
const STRONG_OUT_SIGNALS:[RegExp,string][]=[
  [/(?:참가자|참가\s*청소년|참여자|교육생|수강생)\s*(?:을\s*)?모집/,"개인·참가자 모집"],
  [/(?:참가|참여)\s*동아리[^\n.]{0,60}모집|동아리[^\n.]{0,60}(?:참가|참여)\s*모집/,"참가 동아리 모집"],
  [/(?:종사자|지도자|직원|실무자|개인)[^\n.]{0,100}(?:교육|연수|워크숍)[^\n.]{0,80}(?:참가|참여|모집|신청)|(?:교육|연수|워크숍)[^\n.]{0,80}(?:종사자|지도자|직원|실무자|개인)[^\n.]{0,60}(?:참가|모집|신청)/,"종사자·지도자 개인 교육"],
  [/(?:행사|축제|박람회)[^\n.]{0,80}(?:참가|참여|신청)/,"행사 참가 모집"],
  [/(?:캠프|수련활동|힐링\s*프로그램)[^\n.]{0,100}(?:참가|참여|예약|모집)/,"캠프·수련·힐링 프로그램 참여"],
  [/(?:공모전|작품\s*모집|우수\s*사례|사례\s*공모|수기\s*공모)/,"공모전·작품·사례 모집"],
  [/(?:참여|홍보)\s*협조\s*(?:요청|공문)/,"참여·홍보 협조 요청"],
  [/(?:직원|인턴|운영요원|위원|컨설턴트)[^\n.]{0,50}(?:채용|모집)|(?:채용|위원\s*모집)/,"채용·인력·위원 모집"],
  [/(?:사전\s*예약|예약\s*신청|상시\s*예약|시설\s*이용\s*신청)/,"일반 시설·프로그램 예약"],
  [/(?:정책|제도|지침)[^\n.]{0,80}(?:안내|홍보)(?![^\n.]{0,80}(?:모집|신청|공모))/,"단순 정책·제도 안내"],
  [/협력\s*(?:기업|기관)[^\n.]{0,80}모집/,"협력기업·기관 모집"],
] ;
const CONTEXTUAL_OUT_SIGNALS:[RegExp,string,ExternalResourceTypeValue?][]=[
  [/(?:설문\s*조사|현황\s*조사|수요\s*조사)/,"설문·수요·현황 조사",ExternalResourceType.MATERIAL],
  [/(?:상담|컨설팅|시설\s*점검)[^\n.]{0,80}(?:참여|신청|지원)/,"상담·컨설팅 서비스 참여",ExternalResourceType.PROFESSIONAL_SERVICE],
  [/참여\s*(?:기관|시설)[^\n.]{0,60}모집|(?:기관|시설)[^\n.]{0,60}프로그램\s*참여/,"기관·시설의 프로그램 참여 모집",ExternalResourceType.PROGRAM],
  [/(?:교육|연수|워크숍)[^\n.]{0,80}(?:참가|참여)\s*(?:기관|시설|신청)/,"교육·연수 참여 모집",ExternalResourceType.STAFF],
];
const STAFF=[
  /(?:전문\s*)?(?:강사|멘토|상담사|전문가|지도자|운영인력)[^\n.]{0,100}(?:파견|방문|배치|지원|제공)/,
  /(?:파견|방문|배치|지원|제공)[^\n.]{0,100}(?:전문\s*)?(?:강사|멘토|상담사|전문가|지도자|운영인력)/,
] as const;
const MATERIAL=[
  /(?:교구|장비|키트|교육\s*자료|안전\s*물품|물품|멀티탭|자동심장충격기|AED|패드|배터리|매뉴얼|구독권|프로그램\s*재료|간식\s*쿠폰)[^\n.!?]{0,40}(?:제공|보급|지원|배정|지급|배송)/i,
  /(?:제공|보급|지원|배정|지급|배송)[^\n.!?]{0,40}(?:교구|장비|키트|교육\s*자료|안전\s*물품|물품|멀티탭|자동심장충격기|AED|패드|배터리|매뉴얼|구독권|프로그램\s*재료|간식\s*쿠폰)/i,
] as const;
const MATERIAL_INSTITUTION_USE=[
  /(?:선정|신청|지원|수요\s*조사\s*응답)?\s*(?:기관|시설|학교|센터|쉼터)[^\n.!?]{0,100}(?:교구|장비|키트|교육\s*자료|안전\s*물품|물품|멀티탭|자동심장충격기|AED|패드|배터리|매뉴얼|구독권|프로그램\s*재료)[^\n.!?]{0,40}(?:제공|보급|지원|배정|지급|배송)/i,
  /(?:교구|장비|키트|교육\s*자료|안전\s*물품|물품|멀티탭|자동심장충격기|AED|패드|배터리|매뉴얼|구독권|프로그램\s*재료)[^\n.!?]{0,80}(?:기관|시설|학교|센터|쉼터)(?:에|에게|의\s*프로그램)[^\n.!?]{0,40}(?:제공|보급|지원|배정|지급|배송|활용|운영)/i,
] as const;
const PROGRAM=[
  /(?:완성된|우수|맞춤형|방문형|보급형|디지털\s*시민성\s*기반|지역형)?\s*(?:교육\s*)?프로그램[^\n.]{0,120}(?:무상\s*)?(?:보급|제공|도입|방문\s*운영|운영\s*지원)/,
  /(?:무상\s*)?(?:보급|제공|도입|방문\s*운영|운영\s*지원)[^\n.]{0,120}(?:완성된|우수|맞춤형|방문형|보급형)?\s*(?:교육\s*)?프로그램/,
] as const;
const PROFESSIONAL_SERVICE=[
  /(?:전문\s*)?(?:컨설턴트|변호사|노무사|회계사|전문가)[^\n.]{0,120}(?:시설을?\s*)?(?:직접\s*)?(?:방문|파견|배정)[^\n.]{0,120}(?:안전\s*)?(?:컨설팅|법률\s*상담|노무\s*상담|회계\s*상담|시설\s*점검|품질\s*컨설팅)/,
  /(?:안전\s*컨설팅|법률\s*상담|노무\s*상담|회계\s*상담|시설\s*점검|품질\s*컨설팅)[^\n.]{0,120}(?:전문\s*)?(?:컨설턴트|변호사|노무사|회계사|전문가)[^\n.]{0,80}(?:방문|파견|배정|제공)/,
] as const;
const INSTITUTION_USE=/(?:기관|시설|학교|센터|쉼터)(?:을|를)?\s*(?:직접\s*)?방문|(?:기관|시설|학교|센터|쉼터)[^\n.]{0,80}(?:이용\s*청소년|소속\s*청소년|청소년\s*대상|프로그램(?:을|의)?\s*(?:도입|운영|활용)|현장\s*운영)|(?:선정|신청|지원)\s*(?:기관|시설|학교|센터|쉼터)[^\n.]{0,100}(?:청소년|프로그램|활동|운영|제공)/;

function clean(value:string|null|undefined){return(value??"").replace(/\s+/g," ").trim();}
function firstMatch(text:string,patterns:readonly RegExp[]){for(const pattern of patterns){const match=text.match(pattern);if(match)return clean(match[0]).slice(0,140);}return null;}
function bodyIsMaterial(title:string,body:string){const withoutTitle=clean(body.replace(title,""));return withoutTitle.length>=20;}
function emptyEvidence():Partial<Record<ExternalResourceTypeValue,string[]>>{return{};}
function decision(status:RelevanceStatusValue,reason:string,signals:string[],supportEvidence:Partial<Record<ExternalResourceTypeValue,string[]>>=emptyEvidence()):RelevanceDecision{return{status,reason:reason.slice(0,500),signals,supportTypes:Object.keys(supportEvidence) as ExternalResourceTypeValue[],supportEvidence};}
function addEvidence(target:Partial<Record<ExternalResourceTypeValue,string[]>>,type:ExternalResourceTypeValue,...values:(string|null)[]){const evidence=values.filter((value):value is string=>Boolean(value));if(evidence.length)target[type]=[...new Set(evidence)];}

export function classifyOpportunityRelevance(input:RelevanceInput):RelevanceDecision{
  const title=clean(input.title);const body=clean(input.body);const attachments=clean(input.attachmentText?.join(" "));const evidence=clean(`${body} ${attachments}`);const material=bodyIsMaterial(title,body)||attachments.length>=30;const combined=clean(`${title} ${evidence}`);
  const financial=firstMatch(combined,FINANCIAL);const execution=firstMatch(combined,EXECUTION);const applicant=firstMatch(combined,ORGANIZATION_APPLICANT);const personal=combined.match(PERSONAL_APPLICANT)?.[0]??null;const participantGroup=clean(combined.match(PARTICIPANT_GROUP_APPLICANT)?.[0]);const institutionalApplicant=clean(combined.match(INSTITUTIONAL_APPLICANT)?.[0]);
  if(!material)return decision(RelevanceStatus.RELEVANCE_REVIEW,"상세 본문 또는 첨부 근거가 충분하지 않아 공모사업 해당 여부를 자동 확정할 수 없음",[]);
  if(PRIZE_CONTEST.test(combined))return decision(RelevanceStatus.OUT_OF_SCOPE,"외부자원 지원사업이 아니라 시상금·상금 중심 공모전으로 확인",["시상금·상금 중심 공모전"]);
  if(participantGroup&&!institutionalApplicant&&!execution)return decision(RelevanceStatus.OUT_OF_SCOPE,`기관 사업수행 주체가 아니라 학생회·동아리·참가팀 신청으로 확인: ${participantGroup}`,[participantGroup]);
  if(personal&&!applicant)return decision(RelevanceStatus.OUT_OF_SCOPE,`기관 활용형 지원이 아니라 개인·동아리 참여 모집으로 확인: ${clean(personal)}`,[clean(personal)]);
  for(const [pattern,label] of STRONG_OUT_SIGNALS){const match=combined.match(pattern);if(match)return decision(RelevanceStatus.OUT_OF_SCOPE,`기관 외부자원 지원이 아니라 ${label}으로 확인: ${clean(match[0])}`,[clean(match[0])]);}
  const supportEvidence=emptyEvidence();const staff=firstMatch(combined,STAFF);const suppliedMaterial=firstMatch(combined,MATERIAL);const materialInstitutionUse=firstMatch(combined,MATERIAL_INSTITUTION_USE);const suppliedProgram=firstMatch(combined,PROGRAM);const professionalService=firstMatch(combined,PROFESSIONAL_SERVICE);const institutionUse=clean(combined.match(INSTITUTION_USE)?.[0]);
  if(financial&&execution)addEvidence(supportEvidence,ExternalResourceType.MONEY,financial,execution);
  if(staff&&institutionUse)addEvidence(supportEvidence,ExternalResourceType.STAFF,staff,institutionUse);
  if(suppliedMaterial&&materialInstitutionUse)addEvidence(supportEvidence,ExternalResourceType.MATERIAL,suppliedMaterial,materialInstitutionUse);
  if(suppliedProgram&&institutionUse)addEvidence(supportEvidence,ExternalResourceType.PROGRAM,suppliedProgram,institutionUse);
  if(professionalService)addEvidence(supportEvidence,ExternalResourceType.PROFESSIONAL_SERVICE,professionalService);
  const supportTypes=Object.keys(supportEvidence) as ExternalResourceTypeValue[];
  if(applicant&&supportTypes.length){const signals=[applicant,...supportTypes.flatMap(type=>supportEvidence[type]??[])];return decision(RelevanceStatus.IN_SCOPE,`기관 신청·활용형 외부자원 제공 확인 (${supportTypes.join(", ")}): ${signals.join(" / ")}`,signals,supportEvidence);}
  for(const [pattern,label,exception] of CONTEXTUAL_OUT_SIGNALS){const match=combined.match(pattern);if(match&&(!exception||!supportTypes.includes(exception)))return decision(RelevanceStatus.OUT_OF_SCOPE,`기관 외부자원 제공 근거 없이 ${label}으로 확인: ${clean(match[0])}`,[clean(match[0])],supportEvidence);}
  const partial=[financial,execution,applicant].filter((value):value is string=>Boolean(value));
  if(partial.length||supportTypes.length){const signals=[...partial,...supportTypes.flatMap(type=>supportEvidence[type]??[])];return decision(RelevanceStatus.RELEVANCE_REVIEW,`기관 신청 또는 외부자원 신호가 일부만 확인됨: ${signals.join(" / ")}`,signals,supportEvidence);}
  return decision(RelevanceStatus.RELEVANCE_REVIEW,"기관 신청성과 실제 외부자원 제공·활용 구조를 함께 확인하지 못함",[]);
}
