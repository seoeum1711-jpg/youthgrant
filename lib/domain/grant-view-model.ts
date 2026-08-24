import { eligibilityPresentation, safeValue, verifiedDeadline } from "./verification.ts";
import type { GrantViewModel, Opportunity } from "./types.ts";

const KST = "Asia/Seoul";
function formatDate(value:string) { const parts=new Intl.DateTimeFormat("ko-KR",{timeZone:KST,month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const month=parts.find(part=>part.type==="month")?.value??"";const day=parts.find(part=>part.type==="day")?.value??"";return `${month}.${day}`; }
function amount(value:number|null,text:string|null) { if(text?.trim()) return text; if(value===null) return "확인 필요"; return `${new Intl.NumberFormat("ko-KR").format(value)}원`; }

export const facilityTaxonomy=["청소년수련관","청소년문화의집","청소년수련원","청소년특화시설","청소년야영장","청소년 관련 기관·단체","기타","확인 필요"] as const;
export const categoryTaxonomy=["문화·예술","교육","진로","국제·교류","과학·디지털","환경","지역사회","복지·지원","기타","확인 필요"] as const;

export function normalizeEligibleRegion(value:string|null){return value==="경기"||value==="서울"||value==="전국"?value:"확인 필요";}
export function resolveEligibleRegion(opportunity:Opportunity){
  const stored=normalizeEligibleRegion(opportunity.eligibleRegion??null);if(stored!=="확인 필요")return stored;
  if(!["VERIFIED","FROM_BODY","MANUAL_CONFIRMED"].includes(opportunity.eligibilityVerification)||!opportunity.eligibilityEvidence)return "확인 필요";
  if(/전국\s*(?:소재|거주|지역|내|의)?/.test(opportunity.eligibilityEvidence))return "전국";
  if(/서울(?:시|특별시)?\s*(?:소재|거주|지역|내)/.test(opportunity.eligibilityEvidence))return "서울";
  if(/경기(?:도)?\s*(?:소재|거주|지역|내)/.test(opportunity.eligibilityEvidence))return "경기";
  return "확인 필요";
}
export function normalizeField(value:string|null){
  if(!value?.trim())return "확인 필요";
  if(/문화|예술/.test(value))return "문화·예술";
  if(/교육/.test(value))return "교육";
  if(/진로|창업/.test(value))return "진로";
  if(/국제|교류/.test(value))return "국제·교류";
  if(/과학|디지털|미디어|기술/.test(value))return "과학·디지털";
  if(/환경/.test(value))return "환경";
  if(/지역사회/.test(value))return "지역사회";
  if(/복지|지원|안전|보호/.test(value))return "복지·지원";
  if(/확인 필요/.test(value))return "확인 필요";
  return "기타";
}
export function normalizeFacilityTypes(values:string[]){
  const normalized=new Set<string>();
  for(const value of values){
    if(value==="청소년수련시설")facilityTaxonomy.slice(0,5).forEach(item=>normalized.add(item));
    else if(/청소년수련관/.test(value))normalized.add("청소년수련관");
    else if(/청소년문화의집/.test(value))normalized.add("청소년문화의집");
    else if(/청소년수련원/.test(value))normalized.add("청소년수련원");
    else if(/청소년특화시설/.test(value))normalized.add("청소년특화시설");
    else if(/청소년야영장/.test(value))normalized.add("청소년야영장");
    else if(/기관|단체|청소년시설|동아리/.test(value))normalized.add("청소년 관련 기관·단체");
    else if(/확인 필요/.test(value))normalized.add("확인 필요");
    else if(value.trim())normalized.add("기타");
  }
  return normalized.size?[...normalized]:["확인 필요"];
}

export function toGrantViewModel(opportunity:Opportunity, now=new Date()):GrantViewModel {
  const deadline=verifiedDeadline(opportunity);
  const eligibility=eligibilityPresentation(opportunity.eligibilityVerification);
  const facilityTypes=normalizeFacilityTypes(opportunity.facilityTypes);
  const eligibilityLabel=eligibility.tone==="verified"&&!facilityTypes.some(value=>/(수련관|문화의집|수련원|특화시설|야영장)/.test(value))?"신청 가능":eligibility.label;
  let status:GrantViewModel["status"]="일정 확인 필요"; let statusTone:GrantViewModel["statusTone"]="check"; let dDay:string|null=null;
  if(deadline){
    const diff=Math.ceil((deadline.getTime()-now.getTime())/86_400_000);
    if(opportunity.applicationStart && new Date(opportunity.applicationStart)>now){status="예정";statusTone="plan";}
    else if(diff<0){status="마감";statusTone="closed";}
    else if(diff<=14){status="마감임박";statusTone="soon";dDay=`D-${diff}`;}
    else{status="접수중";statusTone="open";dDay=`D-${diff}`;}
  }
  const dateLabel=deadline?formatDate(opportunity.deadline!):"확인 필요";
  return {
    id:opportunity.id,title:opportunity.title,organization:opportunity.organization,sourceName:opportunity.sourceName,sourceMethod:opportunity.sourceMethod,sourceUrl:opportunity.sourceUrl,
    region:opportunity.region,eligibleRegion:resolveEligibleRegion(opportunity),facilityTypes,field:normalizeField(opportunity.field),status,statusTone,dDay,dateLabel,
    applicationPeriod:deadline?`${opportunity.applicationStart?formatDate(opportunity.applicationStart):"접수 시작 확인 필요"} – ${dateLabel}`:"신청 마감 · 확인 필요",
    eligibilityLabel,eligibilityTone:eligibility.tone,
    evidenceText:opportunity.eligibilityEvidence??"자격조건을 자동으로 확정할 근거가 확인되지 않았습니다.",
    evidenceLocation:opportunity.eligibilityEvidenceLocation??"근거 위치 · 확인 필요",evidenceVerified:eligibility.tone==="verified",evidenceMatchRange:opportunity.eligibilityMatchRange??null,
    amountLabel:amount(opportunity.amountWon,opportunity.amountText),selfBurdenLabel:safeValue(opportunity.selfBurden),supportDetails:safeValue(opportunity.supportDetails),
    checks:[
      {label:"신청 마감일",state:deadline?"verified":"unknown",message:deadline?"날짜 확인 완료 · 신청기간 문맥에서 확인":"확인 필요 · 검증된 신청 마감 문맥 없음"},
      {label:"신청자격",state:eligibility.tone==="verified"?"verified":"unknown",message:eligibilityLabel},
      {label:"지원금",state:opportunity.amountWon!==null||!!opportunity.amountText?"verified":"unknown",message:opportunity.amountWon!==null||!!opportunity.amountText?"본문 기준":"확인 필요"},
      {label:"자부담",state:opportunity.selfBurden?"verified":"unknown",message:opportunity.selfBurden?"본문 기준":"확인 필요 · 첨부파일 확인 권장"},
    ],collectedAt:opportunity.collectedAt,
  };
}

export function toPublicGrantList(rows:Opportunity[],now=new Date()){return rows.filter(row=>row.reviewStatus==="PUBLISHED"||row.reviewStatus==="CONFIRMED").map(row=>toGrantViewModel(row,now));}
