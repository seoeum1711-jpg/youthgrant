import Link from "next/link";
import { listReviewQueue } from "../../../lib/data/d1-repository.ts";

export const metadata={title:"검토대기 · Ops"};
export const dynamic="force-dynamic";

export default async function ReviewQueue(){
  const reviews=await listReviewQueue();
  return <main className="ops-main"><div className="ops-title"><h1>검토대기 공고 <strong>{reviews.length}</strong>건</h1><p>실제 D1에 저장된 자동 추출 결과 중 확정할 수 없는 항목입니다. 확정 전까지 사용자 화면에는 ‘확인 필요’로 노출됩니다.</p></div>{reviews.length?<div className="review-list">{reviews.map(item=><article className="review-row" key={item.id}><div><h2>{item.title}</h2><p>{item.sourceName} · {item.sourceId}</p></div><div><span className={`review-flag ${item.tone}`}>{item.flag}</span><p>{item.reason}</p></div><pre>{item.raw}</pre><div className="review-actions"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a><Link href={`/grants/${item.id}`}>Public 표시 확인</Link></div></article>)}</div>:<div className="ops-empty"><h2>현재 검토대기 공고가 없습니다.</h2><p>Collector가 실행되면 검증이 필요한 공고가 여기에 표시됩니다.</p></div>}</main>;
}
