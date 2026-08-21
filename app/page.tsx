import { ExplorerClient } from "./components/ExplorerClient";
import { PublicHeader } from "./components/PublicHeader";
import { countManagedSources, listPublicOpportunities } from "../lib/data/d1-repository.ts";
import { toPublicGrantList } from "../lib/domain/grant-view-model.ts";

export const dynamic="force-dynamic";

export default async function Home(){
  const [opportunities,sourceCount]=await Promise.all([listPublicOpportunities(),countManagedSources()]);
  const grants=toPublicGrantList(opportunities,new Date());
  const verified=grants.filter(g=>g.eligibilityTone==="verified").length;const urgent=grants.filter(g=>g.status==="마감임박").length;
  return <><PublicHeader/><section className="hero"><div className="hero-inner"><p className="eyebrow">YOUTH FACILITY GRANT FINDER</p><h1>공고를 모으지 않습니다.<br/><em>검토할 가치가 있는 공고</em>를<br/>근거와 함께 찾아냅니다.</h1><p className="hero-copy">지역과 시설유형만 고르면 됩니다. 확인되지 않은 값은 추측하지 않고 ‘확인 필요’로 그대로 보여드립니다.</p><div className="kpis" aria-label="공모 현황"><div className="kpi highlight"><strong>{verified}</strong><span>신청 가능 확인</span></div><div className="kpi"><strong>{urgent}</strong><span>마감 임박</span></div><div className="kpi"><strong>{grants.length}</strong><span>검토할 공고</span></div><div className="kpi"><strong>{sourceCount}</strong><span>관리 출처</span></div></div></div></section><ExplorerClient grants={grants}/><section className="principles" id="principles"><p className="eyebrow">DATA PRINCIPLE</p><h2>확인되지 않은 값은 추측해 채우지 않습니다.</h2><p>신청기간 문맥에서 검증된 날짜만 D-Day로 만들고, 자격 근거가 불충분하면 관리자 검토 대상으로 남깁니다.</p></section></>;
}
