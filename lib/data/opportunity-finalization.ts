import type { D1DatabaseLike } from "../cloudflare.ts";
import { DeadlineMode, ReviewStatus, Verification } from "../domain/types.ts";
import { notifyOwnerOfFinalizedOpportunity, type TelegramNotificationConfig, type TelegramNotificationDependencies } from "../notifications/telegram.ts";

type FinalizationRow={id:string;title:string;organization:string;deadline:string|null;deadline_mode:string;deadline_verification:string;deadline_evidence:string|null;eligibility_verification:string;eligible_region:string|null;amount_evidence:string|null;self_burden_evidence:string|null;review_status:string;attachment_discovery_status:string;pending_attachments:number};
export type OpportunityFinalizationOptions={notifyNewOpportunity?:boolean;telegram?:TelegramNotificationConfig;telegramDependencies?:TelegramNotificationDependencies};

function verifiedDeadline(row:Pick<FinalizationRow,"deadline"|"deadline_mode"|"deadline_verification">){return(row.deadline_verification===Verification.VERIFIED||row.deadline_verification===Verification.MANUAL_CONFIRMED)&&(row.deadline_mode===DeadlineMode.OPEN_ENDED||(row.deadline_mode===DeadlineMode.FIXED_DATE&&Boolean(row.deadline)));}
function verifiedEligibility(value:string){return value===Verification.VERIFIED||value===Verification.FROM_BODY||value===Verification.MANUAL_CONFIRMED;}
export function finalReviewStatus(input:Pick<FinalizationRow,"deadline"|"deadline_mode"|"deadline_verification"|"eligibility_verification"|"amount_evidence"|"self_burden_evidence">){const conflict=/\[ATTACHMENT CONFLICT\]/.test(`${input.amount_evidence??""} ${input.self_burden_evidence??""}`);return verifiedDeadline(input)&&verifiedEligibility(input.eligibility_verification)&&!conflict?ReviewStatus.PUBLISHED:ReviewStatus.REVIEW_REQUIRED;}
function reviewReason(row:FinalizationRow){const reasons:string[]=[];if(!verifiedEligibility(row.eligibility_verification))reasons.push("신청 가능 기관·시설 자격 근거 확인 필요");if(!verifiedDeadline(row))reasons.push("신청기간·마감일 근거 확인 필요");if(/\[ATTACHMENT CONFLICT\]/.test(`${row.amount_evidence??""} ${row.self_burden_evidence??""}`))reasons.push("재정지원 관련 근거 충돌");return reasons.join(" · ")||"핵심 데이터 근거 확인 필요";}
function changes(result:{meta?:{changes?:number}}){return result.meta?.changes??0;}

export async function finalizeOpportunityVerification(db:D1DatabaseLike,rawNoticeId:string,options:OpportunityFinalizationOptions={}){
  const row=await db.prepare(`SELECT o.id,o.title,o.organization,o.deadline,o.deadline_mode,o.deadline_verification,o.deadline_evidence,o.eligibility_verification,o.eligible_region,o.amount_evidence,o.self_burden_evidence,o.review_status,rn.attachment_discovery_status,COALESCE(SUM(CASE WHEN a.id IS NOT NULL AND a.parse_status='PENDING' THEN 1 ELSE 0 END),0) AS pending_attachments FROM opportunities o JOIN opportunity_sources os ON os.opportunity_id=o.id JOIN raw_notices rn ON rn.id=os.raw_notice_id LEFT JOIN attachments a ON a.raw_notice_id=rn.id WHERE rn.id=? GROUP BY o.id,rn.attachment_discovery_status LIMIT 1`).bind(rawNoticeId).first<FinalizationRow>();
  if(!row||row.review_status!==ReviewStatus.PENDING||row.attachment_discovery_status==="PENDING"||Number(row.pending_attachments)>0)return{status:row?.review_status??null,transitioned:false};
  const next=finalReviewStatus(row);const updated=await db.prepare("UPDATE opportunities SET review_status=?,updated_at=? WHERE id=? AND review_status='PENDING'").bind(next,new Date().toISOString(),row.id).run();const transitioned=changes(updated)>0;
  if(transitioned&&options.notifyNewOpportunity&&options.telegram)await notifyOwnerOfFinalizedOpportunity({opportunityCreated:true,opportunityId:row.id,reviewStatus:next,title:row.title,organization:row.organization,deadline:row.deadline,deadlineMode:row.deadline_mode,deadlineEvidence:row.deadline_evidence,eligibleRegion:row.eligible_region,reviewReason:reviewReason(row)},options.telegram,options.telegramDependencies);
  return{status:next,transitioned};
}
