"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Opportunity } from "../../../../lib/domain/types.ts";

function localDateTime(value:string|null){if(!value)return"";const parts=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));return parts.replace(" ","T");}
function defaultEligibility(value:Opportunity["eligibilityVerification"]){if(["VERIFIED","FROM_BODY","MANUAL_CONFIRMED"].includes(value))return"ELIGIBLE";if(value==="MANUAL_REJECTED")return"INELIGIBLE";return"UNKNOWN";}

export function ReviewEditor({opportunity,rawText}:{opportunity:Opportunity;rawText:string}){
  const router=useRouter();const [saving,setSaving]=useState(false);const [message,setMessage]=useState("");
  const canReverify=opportunity.reviewStatus==="PENDING"||opportunity.reviewStatus==="REVIEW_REQUIRED";
  const [reverifying,setReverifying]=useState(false);const [reverifyMessage,setReverifyMessage]=useState("");const [reverified,setReverified]=useState<{reviewStatus:string;deadline:string|null;deadlineVerification:string;eligibilityVerification:string;facilityTypes:string[];processed:number;failed:number}|null>(null);
  const [reviewStatus,setReviewStatus]=useState<string>(["CONFIRMED","DEFERRED","EXCLUDED"].includes(opportunity.reviewStatus)?opportunity.reviewStatus:"CONFIRMED");
  const [deadlineDecision,setDeadlineDecision]=useState(opportunity.deadline?"CONFIRMED":"UNKNOWN");const [deadline,setDeadline]=useState(localDateTime(opportunity.deadline));
  const [eligibilityDecision,setEligibilityDecision]=useState(defaultEligibility(opportunity.eligibilityVerification));const [facilities,setFacilities]=useState(opportunity.facilityTypes.join(", "));const [eligibilityNote,setEligibilityNote]=useState("");
  const [amountDecision,setAmountDecision]=useState(opportunity.amountWon!==null||opportunity.amountText?"CONFIRMED":"UNKNOWN");const [amountWon,setAmountWon]=useState(opportunity.amountWon?.toString()??"");const [amountText,setAmountText]=useState(opportunity.amountText??"");
  const initialBurden=opportunity.selfBurden==="없음"?"NONE":opportunity.selfBurden?"PRESENT":"UNKNOWN";const [burdenDecision,setBurdenDecision]=useState(initialBurden);const [burdenValue,setBurdenValue]=useState(opportunity.selfBurden&&opportunity.selfBurden!=="없음"?opportunity.selfBurden:"");

  async function submit(event:FormEvent){
    event.preventDefault();setSaving(true);setMessage("");
    try{
      const response=await fetch(`/api/ops/review/${encodeURIComponent(opportunity.id)}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({reviewStatus,deadline:{decision:deadlineDecision,value:deadlineDecision==="CONFIRMED"?`${deadline}:00+09:00`:null},eligibility:{decision:eligibilityDecision,facilityTypes:facilities.split(",").map(value=>value.trim()).filter(Boolean),note:eligibilityNote||null},amount:{decision:amountDecision,won:amountWon?Number(amountWon):null,text:amountText||null},selfBurden:{decision:burdenDecision,value:burdenValue||null}})});
      const result=await response.json() as {error?:string};if(!response.ok)throw new Error(result.error??"저장하지 못했습니다.");setMessage("검토 결과를 저장했습니다.");router.refresh();
    }catch(error){setMessage(error instanceof Error?error.message:"저장하지 못했습니다.");}finally{setSaving(false);}
  }

  async function reverify(){
    setReverifying(true);setReverifyMessage("");
    try{
      const response=await fetch(`/api/ops/review/${encodeURIComponent(opportunity.id)}/reverify`,{method:"POST"});const result=await response.json() as {error?:string;reviewStatus?:string;deadline?:string|null;deadlineVerification?:string;eligibilityVerification?:string;facilityTypes?:string[];processed?:number;failed?:number};if(!response.ok)throw new Error(result.error??"자동 재검증에 실패했습니다.");
      const completed={reviewStatus:result.reviewStatus??opportunity.reviewStatus,deadline:result.deadline??null,deadlineVerification:result.deadlineVerification??opportunity.deadlineVerification,eligibilityVerification:result.eligibilityVerification??opportunity.eligibilityVerification,facilityTypes:result.facilityTypes??opportunity.facilityTypes,processed:result.processed??0,failed:result.failed??0};setReverified(completed);if(completed.deadline)setDeadline(localDateTime(completed.deadline));if(completed.facilityTypes.length)setFacilities(completed.facilityTypes.join(", "));setEligibilityDecision(defaultEligibility(completed.eligibilityVerification as Opportunity["eligibilityVerification"]));setReverifyMessage(`재검증 완료 · ${completed.reviewStatus}`);if(completed.reviewStatus!=="PUBLISHED")router.refresh();
    }catch(error){setReverifyMessage(error instanceof Error?error.message:"자동 재검증에 실패했습니다.");}finally{setReverifying(false);}
  }

  return <form className="review-editor" onSubmit={submit}>
    <section className="review-source"><div><h2>{opportunity.title}</h2><p>{opportunity.organization} · {opportunity.sourceMethod}</p></div><a href={opportunity.sourceUrl} target="_blank" rel="noopener noreferrer">공식 원문 확인 ↗</a><pre>{rawText}</pre></section>
    <section className="review-reverify"><div><h3>자동 재검증</h3><p>공식 원문·첨부를 현재 검증 규칙으로 다시 확인합니다.</p>{reverified?<p>마감 {reverified.deadline??"확인 필요"} · 마감 검증 {reverified.deadlineVerification} · 자격 검증 {reverified.eligibilityVerification} · 상태 {reverified.reviewStatus} · 처리 {reverified.processed}건{reverified.failed?` · 실패 ${reverified.failed}건`:""}</p>:null}</div><button type="button" onClick={reverify} disabled={!canReverify||reverifying||reverified?.reviewStatus==="PUBLISHED"}>{reverifying?"재검증 중...":"자동 재검증"}</button><span role="status">{reverifyMessage}</span></section>
    <div className="review-fields">
      <fieldset><legend>신청 마감일</legend><p>자동 근거: {opportunity.deadlineEvidence??"없음"}</p><select value={deadlineDecision} onChange={event=>setDeadlineDecision(event.target.value)}><option value="CONFIRMED">날짜 확정</option><option value="UNKNOWN">확인 불가</option></select><input aria-label="신청 마감일" type="datetime-local" value={deadline} onChange={event=>setDeadline(event.target.value)} disabled={deadlineDecision!=="CONFIRMED"}/></fieldset>
      <fieldset><legend>신청 자격</legend><p>자동 근거: {opportunity.eligibilityEvidence??"없음"}</p><select value={eligibilityDecision} onChange={event=>setEligibilityDecision(event.target.value)}><option value="ELIGIBLE">신청 가능 확정</option><option value="INELIGIBLE">신청 불가 확정</option><option value="UNKNOWN">확인 불가</option></select><input aria-label="시설유형" value={facilities} onChange={event=>setFacilities(event.target.value)} placeholder="청소년문화의집, 청소년수련관"/><textarea aria-label="신청 자격 수동 근거" value={eligibilityNote} onChange={event=>setEligibilityNote(event.target.value)} placeholder="원문에서 확인한 신청 자격 근거" disabled={eligibilityDecision==="UNKNOWN"} style={{minHeight:72,padding:"8px 10px",resize:"vertical",border:"1px solid #2C4340",borderRadius:5,background:"#0A1211",color:"#fff"}}/></fieldset>
      <fieldset><legend>지원금</legend><select value={amountDecision} onChange={event=>setAmountDecision(event.target.value)}><option value="CONFIRMED">값 확정</option><option value="UNKNOWN">확인 불가</option></select><input aria-label="지원금 원 단위" type="number" min="0" value={amountWon} onChange={event=>setAmountWon(event.target.value)} placeholder="원 단위" disabled={amountDecision!=="CONFIRMED"}/><input aria-label="지원금 표시 문구" value={amountText} onChange={event=>setAmountText(event.target.value)} placeholder="예: 기관당 최대 2,000만원" disabled={amountDecision!=="CONFIRMED"}/></fieldset>
      <fieldset><legend>자부담</legend><select value={burdenDecision} onChange={event=>setBurdenDecision(event.target.value)}><option value="NONE">없음</option><option value="PRESENT">있음</option><option value="UNKNOWN">확인 불가</option></select><input aria-label="자부담 값 또는 비율" value={burdenValue} onChange={event=>setBurdenValue(event.target.value)} placeholder="예: 총사업비의 10%" disabled={burdenDecision!=="PRESENT"}/></fieldset>
    </div>
    <footer className="review-submit"><label>검토 상태<select value={reviewStatus} onChange={event=>setReviewStatus(event.target.value)}><option value="CONFIRMED">CONFIRMED · 확정</option><option value="DEFERRED">DEFERRED · 보류</option><option value="EXCLUDED">EXCLUDED · 제외</option></select></label><button type="submit" disabled={saving}>{saving?"저장 중…":"검토 결과 저장"}</button><span role="status">{message}</span></footer>
  </form>;
}
