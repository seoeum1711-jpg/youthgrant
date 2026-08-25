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
  return <><PublicHeader/><section className="hero"><div className="hero-inner"><p className="eyebrow">YOUTH FACILITY GRANT FINDER</p><h1>청소년 현장에서 활용할<br/><em>지원기회</em>를 한눈에.</h1><p className="hero-copy">청소년시설과 관련 기관이 신청해 활용할 수 있는 사업비·인력·물품·프로그램·전문서비스 등의 공식 지원기회를 확인합니다.</p><div className="kpis" aria-label="공모 현황"><div className="kpi highlight"><strong>{verified}</strong><span>신청대상 확인</span></div><div className="kpi"><strong>{urgent}</strong><span>마감 임박</span></div><div className="kpi"><strong>{grants.length}</strong><span>공개 공고</span></div><div className="kpi"><strong>{sourceCount}</strong><span>수집 중 출처</span></div></div></div></section><ExplorerClient grants={grants} activeSourceCount={sourceCount}/><PublicFooter/></>;
}
