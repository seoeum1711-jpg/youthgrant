"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { GrantViewModel } from "../../lib/domain/types.ts";

const regions=["전체","경기","서울","전국"];
const facilities=["청소년수련관","청소년문화의집","청소년수련원","청소년특화시설","관련 기관·단체","기타 / 확인 필요"];
const statuses=["접수중","마감임박","예정","일정 확인 필요"];

export function ExplorerClient({grants}:{grants:GrantViewModel[]}){
  const [region,setRegion]=useState("전체");const [facility,setFacility]=useState<string[]>([]);const [status,setStatus]=useState<string[]>([]);const [sheet,setSheet]=useState(false);
  useEffect(()=>{const q=new URLSearchParams();if(region!=="전체")q.set("region",region);facility.forEach(v=>q.append("facility",v));status.forEach(v=>q.append("status",v));history.replaceState(null,"",q.size?`/?${q}`:"/");},[region,facility,status]);
  const visible=useMemo(()=>grants.filter(g=>(region==="전체"||g.region===region)&&(!facility.length||facility.some(f=>g.facilityTypes.includes(f)))&&(!status.length||status.includes(g.status))),[grants,region,facility,status]);
  const toggle=(value:string,setter:Dispatch<SetStateAction<string[]>>)=>setter(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
  const reset=()=>{setRegion("전체");setFacility([]);setStatus([])};
  const count=(kind:"region"|"facility"|"status",value:string)=>grants.filter(g=>kind==="region"?(value==="전체"||g.region===value):kind==="facility"?g.facilityTypes.includes(value):g.status===value).length;
  const chips=[...(region!=="전체"?[region]:[]),...facility,...status];
  return <>
    <div className="mobile-filterbar"><button onClick={()=>setSheet(true)}>필터 {chips.length?`${chips.length}개 적용`:"선택"} ▾</button><span>검토할 공고 <b>{visible.length}</b>건</span></div>
    <div className="explorer-shell">
      <aside className="filters" aria-label="공고 필터">
        <fieldset className="filter-group"><legend>지역</legend>{regions.map(v=><label className={region===v?"selected":""} key={v}><input type="radio" name="region" checked={region===v} onChange={()=>setRegion(v)}/><span>{v}</span><small>{count("region",v)}</small></label>)}</fieldset>
        <CheckGroup title="시설유형" values={facilities} selected={facility} onToggle={v=>toggle(v,setFacility)} count={v=>count("facility",v)}/>
        <CheckGroup title="접수 상태" values={statuses} selected={status} onToggle={v=>toggle(v,setStatus)} count={v=>count("status",v)}/>
        <button className="reset" type="button" onClick={reset}>필터 초기화</button>
      </aside>
      <main className="results" id="grants">
        <div className="result-bar"><h2 aria-live="polite">검토할 만한 공고 <strong>{visible.length}</strong>건</h2><div className="sort" aria-label="정렬"><button className="active">마감 임박순</button><button>최신순</button></div></div>
        <div className="selected-chips" aria-label="선택된 필터">{chips.length?chips.map(c=><button key={c} onClick={()=>{if(c===region)setRegion("전체");else if(facility.includes(c))toggle(c,setFacility);else toggle(c,setStatus)}}>{c}<b>×</b></button>):<span>전체</span>}</div>
        {visible.length?<div className="grant-list">{visible.map(grant=><GrantCard grant={grant} key={grant.id}/>)}</div>:<div className="empty-state"><h3>선택하신 조건에 맞는 공고가 없습니다.</h3><p>필터를 초기화하면 검토 가능한 공고 {grants.length}건을 볼 수 있습니다.</p><button onClick={reset}>전체 공고 보기</button></div>}
      </main>
    </div>
    {sheet&&<div className="sheet-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSheet(false)}}><section className="filter-sheet" role="dialog" aria-modal="true" aria-label="모바일 공고 필터"><div className="sheet-handle"/><div className="sheet-head"><h2>공고 필터</h2><button aria-label="필터 닫기" onClick={()=>setSheet(false)}>×</button></div><fieldset className="filter-group"><legend>지역</legend>{regions.map(v=><label key={v}><input type="radio" checked={region===v} onChange={()=>setRegion(v)}/>{v}<small>{count("region",v)}</small></label>)}</fieldset><CheckGroup title="시설유형" values={facilities} selected={facility} onToggle={v=>toggle(v,setFacility)} count={v=>count("facility",v)}/><CheckGroup title="접수 상태" values={statuses} selected={status} onToggle={v=>toggle(v,setStatus)} count={v=>count("status",v)}/><button className="sheet-apply" onClick={()=>setSheet(false)}>공고 {visible.length}건 보기</button></section></div>}
  </>;
}

function CheckGroup({title,values,selected,onToggle,count}:{title:string;values:string[];selected:string[];onToggle:(v:string)=>void;count:(v:string)=>number}){return <fieldset className="filter-group"><legend>{title}</legend>{values.map(v=><label className={selected.includes(v)?"selected":""} key={v}><input type="checkbox" checked={selected.includes(v)} onChange={()=>onToggle(v)}/><span>{v}</span><small>{count(v)}</small></label>)}</fieldset>}

function GrantCard({grant}:{grant:GrantViewModel}){const unknown=grant.statusTone==="check"||grant.eligibilityTone!=="verified";return <article className={`grant-card ${unknown?"unknown":""}`}><Link className="card-main-link" href={`/grants/${grant.id}`} aria-label={`${grant.title} 상세 보기`}><span/></Link><div className="card-top"><span className={`status ${grant.statusTone}`}>{grant.status}</span><span className="tag">{grant.region}</span><span className="tag">{grant.field}</span><span className={`tag eligibility ${grant.eligibilityTone!=="verified"?"needs-review":""}`}>{grant.eligibilityLabel}</span><strong className={`dday ${!grant.dDay?"unknown-value":""}`}>{grant.dDay??"D-Day 미산출"}</strong></div><div className="card-body"><div className="card-copy"><h3>{grant.title}</h3><p className="organization">{grant.organization} · 출처 {grant.sourceName}</p><p className={`evidence ${unknown?"evidence-unknown":""}`}><strong>{grant.evidenceText}</strong></p></div><div className="summary-panel"><Summary label="지원금" value={grant.amountLabel}/><Summary label="자부담" value={grant.selfBurdenLabel}/><Summary label="신청 마감" value={grant.dateLabel}/><Link className="source-link" href={grant.sourceUrl} target="_blank" rel="noopener noreferrer">공식 공고 확인 ↗</Link></div></div></article>}
function Summary({label,value}:{label:string;value:string}){return <div className="summary-row"><span>{label}</span><strong className={value.includes("확인 필요")?"unknown-value":""}>{value}</strong></div>}
