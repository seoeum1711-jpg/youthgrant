import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicHeader } from "../../components/PublicHeader";
import { PublicFooter } from "../../components/PublicFooter";
import { getOpportunity } from "../../../lib/data/d1-repository.ts";
import { grantStatusLabel, toGrantViewModel } from "../../../lib/domain/grant-view-model.ts";
import { SavedGrantButton } from "../../components/saved-grants.tsx";
import { supportTypeLabelList } from "../../../lib/domain/support-types.ts";
import { DeadlineMode } from "../../../lib/domain/types.ts";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;const row=await getOpportunity(id);if(!row)return{};
  return{title:row.title,description:`${row.organization}의 공고를 신청 가능 근거와 데이터 확인 상태로 검토합니다.`,openGraph:{title:row.title,description:`${row.organization} · YouthGrant 데이터 검증 상태`,images:[]},twitter:{card:"summary",title:row.title,description:`${row.organization} · YouthGrant 데이터 검증 상태`,images:[]}};
}

export default async function GrantDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const row=await getOpportunity(id);if(!row)notFound();
  const grant=toGrantViewModel(row,new Date());
  const openEnded=grant.deadlineMode===DeadlineMode.OPEN_ENDED;const statusLabel=grantStatusLabel(grant);
  const deadlineSummary=grant.dDay?`${grant.dateLabel} (${grant.dDay})`:grant.status==="마감"?`${grant.dateLabel} (마감)`:openEnded?grant.dateLabel:"일정 확인 필요";
  return <>
    <PublicHeader/>
    <div className="detail-hero"><div className="detail-hero-inner">
      <p className="breadcrumbs"><Link href="/">공모 탐색</Link> <span>›</span> {grant.eligibleRegion} <span>›</span> {grant.field}</p>
      <div className="card-top"><span className={`status ${grant.statusTone}`}>{statusLabel}{grant.dDay?` · ${grant.dDay}`:""}</span><span className="tag dark-tag">{grant.region}</span><span className={`tag eligibility ${grant.eligibilityTone!=="verified"?"needs-review":""}`}>{grant.eligibilityLabel}</span></div>
      <h1>{grant.title}</h1><p>{grant.organization} · 출처 {grant.sourceName} ({grant.sourceMethod})</p>
    </div></div>
    <div className="detail-layout">
      <main className="detail-main">
        <DetailSection title="신청 가능 근거"><div className={`evidence-block ${grant.evidenceVerified?"":"unverified"}`}><blockquote>“<EvidenceText text={grant.evidenceText} range={grant.evidenceMatchRange}/>”</blockquote><p>{grant.evidenceLocation}</p></div></DetailSection>
        <DetailSection title="신청정보"><DefinitionList rows={[["신청대상",grant.eligibilityLabel],["시설유형",grant.facilityTypes.join(", ")],["신청기간",grant.applicationPeriod],["접수 상태",`${statusLabel}${grant.dDay?` · ${grant.dDay}`:""}`]]}/></DetailSection>
        <DetailSection title="지원정보"><DefinitionList rows={[...(grant.supportTypes.length?[["지원형태",supportTypeLabelList(grant.supportTypes).join(" · ")]]:[]),["지원금",grant.amountLabel],["자부담",grant.selfBurdenLabel],["주요 지원내용",grant.supportDetails]]}/></DetailSection>
        <DetailSection title="기본정보"><DefinitionList rows={[["사업명",grant.title],["주관기관",grant.organization],["지원 가능 지역",grant.eligibleRegion],["게시 기관 지역",grant.region],["사업 분야",grant.field]]}/></DetailSection>
        <DetailSection title="데이터 확인 상태"><div className="verification-list">{grant.checks.map(check=><div className="verification-row" key={check.label}><span className="check-label">{check.label}</span><i className={check.state}/><span className={check.state==="unknown"?"unknown-text":""}>{check.message}</span></div>)}</div><p className="policy-note">확인되지 않은 값은 추측해 채우지 않습니다. 최종 조건은 공식 공고에서 확인해 주세요.</p></DetailSection>
      </main>
      <aside className="detail-aside"><div className="cta-card"><a className="primary-cta" href={grant.sourceUrl} target="_blank" rel="noopener noreferrer">공식 공고 확인 ↗</a><SavedGrantButton grantId={grant.id} className="detail-save"/><p>{grant.sourceName} 공식 누리집으로 이동합니다.<br/>YouthGrant는 원문을 대체하지 않습니다.</p><div className="aside-summary"><Summary label="지원금" value={grant.amountLabel}/><Summary label="자부담" value={grant.selfBurdenLabel}/><Summary label="신청 마감" value={deadlineSummary}/><Summary label="수집 방식" value={grant.sourceMethod}/><Summary label="최종 수집" value={formatKst(grant.collectedAt)}/></div></div></aside>
    </div>
    <div className="mobile-cta"><SavedGrantButton grantId={grant.id}/><a href={grant.sourceUrl} target="_blank" rel="noopener noreferrer">공식 공고 확인 ↗</a></div>
    <PublicFooter/>
  </>;
}

function formatKst(value:string){return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));}
function DetailSection({title,children}:{title:string;children:React.ReactNode}){return <section className="detail-section"><h2>{title}</h2>{children}</section>}
function EvidenceText({text,range}:{text:string;range:{start:number;end:number}|null}){if(!range)return text;return <>{text.slice(0,range.start)}<mark>{text.slice(range.start,range.end)}</mark>{text.slice(range.end)}</>}
function DefinitionList({rows}:{rows:string[][]}){return <dl className="definition-list">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd className={value.includes("확인 필요")?"unknown-text":""}>{value}</dd></div>)}</dl>}
function Summary({label,value}:{label:string;value:string}){return <div><span>{label}</span><strong className={value.includes("확인 필요")?"warn":""}>{value}</strong></div>}
