import { ExplorerClient } from "./components/ExplorerClient";
import { PublicFooter } from "./components/PublicFooter";
import { PublicHeader } from "./components/PublicHeader";
import { listPublicOpportunities } from "../lib/data/d1-repository.ts";
import { countActiveSources } from "../lib/collectors/registry.ts";
import { toPublicGrantList } from "../lib/domain/grant-view-model.ts";

export const dynamic="force-dynamic";

export default async function Home(){
  const opportunities=await listPublicOpportunities();const sourceCount=countActiveSources();
  const grants=toPublicGrantList(opportunities,new Date());
  const verified=grants.filter(g=>g.eligibilityTone==="verified").length;const urgent=grants.filter(g=>g.status==="마감임박").length;
  return <><PublicHeader/><section className="hero"><div className="hero-inner"><p className="eyebrow">YOUTH FACILITY GRANT FINDER</p><h1>청소년수련시설을 위한<br/><em>지원사업 공고</em>를 한눈에.</h1><p className="hero-copy">청소년수련시설과 관련 기관이 신청할 수 있는 공모·지원사업을 수집하고, 신청 대상·지원 규모·접수 일정 등 필요한 정보를 검토해 제공합니다.<br/><br/>확인되지 않은 정보는 임의로 추정하지 않으며, 최종 신청 조건은 공식 공고를 통해 확인할 수 있습니다.</p><div className="kpis" aria-label="공모 현황"><div className="kpi highlight"><strong>{verified}</strong><span>신청 가능 확인</span></div><div className="kpi"><strong>{urgent}</strong><span>마감 임박</span></div><div className="kpi"><strong>{grants.length}</strong><span>공개 공고</span></div><div className="kpi"><strong>{sourceCount}</strong><span>수집 중 출처</span></div></div></div></section><ExplorerClient grants={grants} activeSourceCount={sourceCount}/><section className="principles" id="principles"><p className="eyebrow">DATA PRINCIPLE</p><h2>확인 가능한 정보만 제공합니다.</h2><p>YouthGrant는 공식 공고와 첨부자료에서 확인된 정보를 기준으로 데이터를 구성합니다.<br/><br/>신청기간으로 확인된 날짜만 접수 일정과 D-Day에 반영하며, 신청자격·지원대상 등 판단 근거가 충분하지 않은 정보는 임의로 확정하지 않습니다.<br/><br/>자동으로 확인하기 어려운 항목은 별도 검토 대상으로 관리합니다.<br/><br/>현재 베타 서비스로 일부 공식 기관의 공고를 수집하고 있으며, 모든 지원사업의 포함을 보장하지 않습니다. 신청 전 세부 조건과 변경사항은 반드시 해당 기관의 공식 공고를 확인해 주세요.</p></section><PublicFooter/></>;
}
