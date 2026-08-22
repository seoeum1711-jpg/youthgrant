import Link from "next/link";

const email="youthgreen94@gmail.com";
const inquiryHref=`mailto:${email}?subject=${encodeURIComponent("[YouthGrant 문의]")}`;
const errorReportHref=`mailto:${email}?subject=${encodeURIComponent("[YouthGrant 데이터 오류 제보]")}&body=${encodeURIComponent("오류가 확인된 공고명 또는 YouthGrant 주소를 함께 보내주시면 확인에 도움이 됩니다.")}`;

export function PublicFooter(){
  return <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="public-footer-grid">
        <section className="footer-brand" aria-label="YouthGrant 소개">
          <h2>YouthGrant</h2>
          <p>청소년수련시설을 위한 공모·지원사업 탐색 서비스</p>
        </section>
        <nav className="footer-column" aria-label="서비스 메뉴">
          <h3>서비스</h3>
          <Link href="/">공모 탐색</Link>
          <Link href="/saved">관심 공고</Link>
          <Link href="/#principles">데이터 원칙</Link>
        </nav>
        <section className="footer-column">
          <h3>운영</h3>
          <p>운영·제작 청록</p>
        </section>
        <section className="footer-column">
          <h3>문의</h3>
          <a href={inquiryHref}>문의</a>
          <a href={errorReportHref}>데이터 오류 제보</a>
        </section>
      </div>
      <div className="footer-notice">
        <p>YouthGrant는 공공기관 및 관련 기관이 공개한 정보를 수집·가공하여 제공합니다.</p>
        <p>서비스의 정보는 공식 공고를 대체하지 않으며, 신청 전 반드시 해당 기관의 공식 공고를 확인해 주세요.</p>
      </div>
      <p className="footer-copyright">© 2026 YouthGrant. All rights reserved.</p>
    </div>
  </footer>;
}
