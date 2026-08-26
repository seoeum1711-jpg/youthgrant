import type { D1DatabaseLike } from "../cloudflare.ts";
import { DeadlineMode, ReviewStatus, Verification } from "../domain/types.ts";

const REVIEW_STATUSES=[ReviewStatus.CONFIRMED,ReviewStatus.DEFERRED,ReviewStatus.EXCLUDED] as const;
const DEADLINE_DECISIONS=["CONFIRMED","UNKNOWN"] as const;
const ELIGIBILITY_DECISIONS=["ELIGIBLE","INELIGIBLE","UNKNOWN"] as const;
const VALUE_DECISIONS=["CONFIRMED","UNKNOWN"] as const;
const BURDEN_DECISIONS=["NONE","PRESENT","UNKNOWN"] as const;

export type ReviewMutation={
  reviewStatus:typeof REVIEW_STATUSES[number];
  deadline:{decision:typeof DEADLINE_DECISIONS[number];value?:string|null};
  eligibility:{decision:typeof ELIGIBILITY_DECISIONS[number];facilityTypes?:string[];note?:string|null};
  amount:{decision:typeof VALUE_DECISIONS[number];won?:number|null;text?:string|null};
  selfBurden:{decision:typeof BURDEN_DECISIONS[number];value?:string|null};
};

function member<T extends readonly string[]>(values:T,value:unknown):value is T[number]{return typeof value==="string"&&values.includes(value as T[number]);}
function clean(value:unknown,max=500){return typeof value==="string"&&value.trim()?value.trim().slice(0,max):null;}
function audit(location:string|null,now:string){return `${location?.replace(/\n운영자\(operator\) 수동 확인 · [\s\S]*$/,"").trim()??"근거 위치 확인 필요"}\n운영자(operator) 수동 확인 · ${now}`;}
function manualEvidence(existing:string|null,note:string){const automatic=existing?.replace(/\n?\[운영자 확인\][\s\S]*$/,"").trim();return `${automatic?`${automatic}\n`:""}[운영자 확인] ${note}`;}

export function parseReviewMutation(value:unknown):ReviewMutation{
  if(!value||typeof value!=="object")throw new Error("검토 입력이 올바르지 않습니다.");
  const input=value as Record<string,unknown>;const deadline=input.deadline as Record<string,unknown>|undefined;const eligibility=input.eligibility as Record<string,unknown>|undefined;const amount=input.amount as Record<string,unknown>|undefined;const burden=input.selfBurden as Record<string,unknown>|undefined;
  if(!member(REVIEW_STATUSES,input.reviewStatus)||!deadline||!member(DEADLINE_DECISIONS,deadline.decision)||!eligibility||!member(ELIGIBILITY_DECISIONS,eligibility.decision)||!amount||!member(VALUE_DECISIONS,amount.decision)||!burden||!member(BURDEN_DECISIONS,burden.decision))throw new Error("검토 선택값이 올바르지 않습니다.");
  const deadlineValue=clean(deadline.value,64);if(deadline.decision==="CONFIRMED"&&(!deadlineValue||Number.isNaN(Date.parse(deadlineValue))))throw new Error("확정할 신청 마감일을 입력하세요.");
  const facilityTypes=Array.isArray(eligibility.facilityTypes)?eligibility.facilityTypes.map(item=>clean(item,80)).filter((item):item is string=>Boolean(item)).slice(0,12):[];const eligibilityNote=clean(eligibility.note,500);if(eligibility.decision!=="UNKNOWN"&&!eligibilityNote)throw new Error("수동 확인한 신청 자격 근거를 입력하세요.");
  const won=typeof amount.won==="number"&&Number.isFinite(amount.won)&&amount.won>=0?Math.round(amount.won):null;const amountText=clean(amount.text,120);if(amount.decision==="CONFIRMED"&&won===null&&!amountText)throw new Error("확정할 지원금 값을 입력하세요.");
  const burdenValue=clean(burden.value,120);if(burden.decision==="PRESENT"&&!burdenValue)throw new Error("자부담 값 또는 비율을 입력하세요.");
  return{reviewStatus:input.reviewStatus,deadline:{decision:deadline.decision,value:deadlineValue},eligibility:{decision:eligibility.decision,facilityTypes,note:eligibilityNote},amount:{decision:amount.decision,won,text:amountText},selfBurden:{decision:burden.decision,value:burdenValue}};
}

export async function applyOpportunityReview(db:D1DatabaseLike,id:string,input:ReviewMutation){
  const current=await db.prepare("SELECT id,deadline_evidence,deadline_evidence_location,eligibility_evidence,eligibility_evidence_location FROM opportunities WHERE id=? AND review_status IN ('REVIEW_REQUIRED','DEFERRED')").bind(id).first<{id:string;deadline_evidence:string|null;deadline_evidence_location:string|null;eligibility_evidence:string|null;eligibility_evidence_location:string|null}>();if(!current)return false;
  const now=new Date().toISOString();const deadline=input.deadline.decision==="CONFIRMED"?input.deadline.value:null;const deadlineVerification=input.deadline.decision==="CONFIRMED"?Verification.MANUAL_CONFIRMED:Verification.UNKNOWN;
  const deadlineMode=input.deadline.decision==="CONFIRMED"?DeadlineMode.FIXED_DATE:DeadlineMode.UNKNOWN;
  const eligibilityVerification=input.eligibility.decision==="ELIGIBLE"?Verification.MANUAL_CONFIRMED:input.eligibility.decision==="INELIGIBLE"?Verification.MANUAL_REJECTED:Verification.UNKNOWN;
  const facilities=input.eligibility.facilityTypes?.length?input.eligibility.facilityTypes:["기타 / 확인 필요"];
  const amountWon=input.amount.decision==="CONFIRMED"?input.amount.won??null:null;const amountText=input.amount.decision==="CONFIRMED"?input.amount.text??null:null;
  const selfBurden=input.selfBurden.decision==="NONE"?"없음":input.selfBurden.decision==="PRESENT"?input.selfBurden.value??null:null;
  const deadlineEvidence=input.deadline.decision==="CONFIRMED"?manualEvidence(current.deadline_evidence,`신청 마감 ${input.deadline.value}`):current.deadline_evidence;const eligibilityEvidence=input.eligibility.decision!=="UNKNOWN"?manualEvidence(current.eligibility_evidence,input.eligibility.note!):current.eligibility_evidence;
  await db.prepare(`UPDATE opportunities SET deadline=?,deadline_mode=?,deadline_verification=?,deadline_evidence=?,deadline_evidence_location=?,eligibility_verification=?,eligibility_evidence=?,eligibility_evidence_location=?,facility_types_json=?,amount_won=?,amount_text=?,self_burden=?,review_status=?,updated_at=? WHERE id=?`)
    .bind(deadline,deadlineMode,deadlineVerification,deadlineEvidence,audit(current.deadline_evidence_location,now),eligibilityVerification,eligibilityEvidence,audit(current.eligibility_evidence_location,now),JSON.stringify(facilities),amountWon,amountText,selfBurden,input.reviewStatus,now,id).run();return true;
}
