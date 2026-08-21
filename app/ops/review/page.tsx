import Link from "next/link";
import { fixtureReviews } from "../../../lib/data/fixtures.ts";
export const metadata={title:"검토대기 · Ops"};
export default function ReviewQueue(){return <main className="ops-main"><div className="ops-title"><h1>검토대기 공고 <strong>{fixtureReviews.length}</strong>건</h1><p>자동 추출 결과 중 확정할 수 없는 항목입니다. 확정 전까지 사용자 화면에는 ‘확인 필요’로 노출됩니다.</p></div><div className="review-list">{fixtureReviews.map(item=><article className="review-row" key={item.id}><div><h2>{item.title}</h2><p>{item.source}</p></div><div><span className={`review-flag ${item.tone}`}>{item.flag}</span><p>{item.reason}</p></div><pre>{item.raw}</pre><div className="review-actions"><a href={item.url} target="_blank" rel="noopener noreferrer">원문 확인 ↗</a>{fixtureOpLink(item.id)}</div></article>)}</div></main>}
function fixtureOpLink(id:string){return id==="attachment-only"?null:<Link href={`/grants/${id}`}>Public 표시 확인</Link>}
