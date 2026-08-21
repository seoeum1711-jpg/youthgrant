import { Verification, type Opportunity } from "./types.ts";

const DEADLINE_CONTEXT = /(신청\s*기간|접수\s*기간|신청\s*마감|접수\s*마감|제출\s*기한)/;
const NON_DEADLINE_CONTEXT = /(행사일|교육일|사업\s*기간|발표일|설명회)/;

export function mayVerifyDeadline(context:string):boolean {
  return DEADLINE_CONTEXT.test(context) && !NON_DEADLINE_CONTEXT.test(context);
}

export function verifiedDeadline(opportunity:Opportunity):Date|null {
  if ((opportunity.deadlineVerification!==Verification.VERIFIED&&opportunity.deadlineVerification!==Verification.MANUAL_CONFIRMED) || !opportunity.deadline) return null;
  const date = new Date(opportunity.deadline);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function eligibilityPresentation(status:Opportunity["eligibilityVerification"]) {
  if (status === Verification.VERIFIED || status === Verification.FROM_BODY || status === Verification.MANUAL_CONFIRMED) return { label:"청소년수련시설 신청 가능" as const, tone:"verified" as const };
  if (status === Verification.MANUAL_REJECTED) return { label:"신청 불가" as const, tone:"ineligible" as const };
  if (status === Verification.REVIEW_REQUIRED) return { label:"검토 필요" as const, tone:"review" as const };
  return { label:"신청자격 확인 필요" as const, tone:"unknown" as const };
}

export function safeValue(value:string|null|undefined):string { return value?.trim() ? value : "확인 필요"; }
