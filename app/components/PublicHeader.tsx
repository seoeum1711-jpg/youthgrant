import Link from "next/link";
import { getLatestCrawlRun } from "../../lib/data/d1-repository.ts";

function kst(value:string){return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(value));}
export async function PublicHeader(){const run=await getLatestCrawlRun();return <header className="gnb"><div className="gnb-inner"><Link className="brand" href="/" aria-label="YouthGrant 홈"><span className="brand-mark" aria-hidden="true"/>YouthGrant</Link><nav aria-label="주요 메뉴"><Link className="current" href="/">공모 탐색</Link><Link href="/saved">관심 공고</Link><Link href="/#principles">데이터 원칙</Link><Link href="/ops/review">운영 현황</Link></nav><p className="updated"><span/>{run?`${kst(run.startedAt)} 갱신`:"수집 실행 전"}</p></div></header>}
