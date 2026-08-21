import { eligibilityPresentation, safeValue, verifiedDeadline } from "./verification.ts";
import type { GrantViewModel, Opportunity } from "./types.ts";

const KST = "Asia/Seoul";
function formatDate(value:string) { const parts=new Intl.DateTimeFormat("ko-KR",{timeZone:KST,month:"2-digit",day:"2-digit"}).formatToParts(new Date(value));const month=parts.find(part=>part.type==="month")?.value??"";const day=parts.find(part=>part.type==="day")?.value??"";return `${month}.${day}`; }
function amount(value:number|null,text:string|null) { if(text?.trim()) return text; if(value===null) return "확인 필요"; return `${new Intl.NumberFormat("ko-KR").format(value)}원`; }

export function toGrantViewModel(opportunity:Opportunity, now=new Date()):GrantViewModel {
  const deadline=verifiedDeadline(opportunity);
  const eligibility=eligibilityPresentation(opportunity.eligibilityVerification);
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
    region:opportunity.region,facilityTypes:opportunity.facilityTypes,field:opportunity.field??"분야 확인 필요",status,statusTone,dDay,dateLabel,
    applicationPeriod:deadline?`${opportunity.applicationStart?formatDate(opportunity.applicationStart):"접수 시작 확인 필요"} – ${dateLabel}`:"신청 마감 · 확인 필요",
    eligibilityLabel:eligibility.label,eligibilityTone:eligibility.tone,
    evidenceText:opportunity.eligibilityEvidence??"자격조건을 자동으로 확정할 근거가 확인되지 않았습니다.",
    evidenceLocation:opportunity.eligibilityEvidenceLocation??"근거 위치 · 확인 필요",evidenceVerified:eligibility.tone==="verified",evidenceMatchRange:opportunity.eligibilityMatchRange??null,
    amountLabel:amount(opportunity.amountWon,opportunity.amountText),selfBurdenLabel:safeValue(opportunity.selfBurden),supportDetails:safeValue(opportunity.supportDetails),
    checks:[
      {label:"신청 마감일",state:deadline?"verified":"unknown",message:deadline?"날짜 확인 완료 · 신청기간 문맥에서 확인":"확인 필요 · 검증된 신청 마감 문맥 없음"},
      {label:"신청자격",state:eligibility.tone==="verified"?"verified":"unknown",message:eligibility.label},
      {label:"지원금",state:opportunity.amountWon!==null||!!opportunity.amountText?"verified":"unknown",message:opportunity.amountWon!==null||!!opportunity.amountText?"본문 기준":"확인 필요"},
      {label:"자부담",state:opportunity.selfBurden?"verified":"unknown",message:opportunity.selfBurden?"본문 기준":"확인 필요 · 첨부파일 확인 권장"},
    ],collectedAt:opportunity.collectedAt,
  };
}

export function toPublicGrantList(rows:Opportunity[],now=new Date()){return rows.filter(row=>row.reviewStatus!=="PENDING").map(row=>toGrantViewModel(row,now));}
