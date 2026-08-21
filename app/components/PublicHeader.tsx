import Link from "next/link";

export function PublicHeader(){return <header className="gnb"><div className="gnb-inner"><Link className="brand" href="/" aria-label="YouthGrant 홈"><span className="brand-mark" aria-hidden="true"/>YouthGrant</Link><nav aria-label="주요 메뉴"><Link className="current" href="/">공모 탐색</Link><Link href="/#principles">데이터 원칙</Link><Link href="/ops/review">운영 현황</Link></nav><p className="updated"><span/>오늘 08:40 갱신</p></div></header>}
