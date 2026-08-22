const email="youthgreen94@gmail.com";
const contactHref=`mailto:${email}?subject=${encodeURIComponent("[YouthGrant 문의 및 오류제보]")}`;

export function PublicFooter(){
  return <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="public-footer-main">
        <section className="footer-brand" aria-label="YouthGrant 소개">
          <h2>YouthGrant</h2>
          <p>청소년수련시설을 위한 공모·지원사업 탐색 서비스</p>
        </section>
        <div className="footer-utility">
          <nav className="footer-links" aria-label="Footer 메뉴"><a href="/">공고 탐색</a><span aria-hidden="true">·</span><a href="/saved">관심 공고</a></nav>
          <a className="footer-contact" href={contactHref}>문의 및 오류제보</a>
          <p className="footer-operator">운영·제작 청록</p>
        </div>
      </div>
      <div className="footer-notice">
        <p>YouthGrant는 공식 공고와 첨부자료에서 확인된 정보를 기준으로 데이터를 제공합니다.</p>
        <p>서비스의 정보는 공식 공고를 대체하지 않으며, 신청 전 반드시 해당 기관의 공식 공고를 확인해 주세요.</p>
      </div>
      <p className="footer-copyright">© 2026 YouthGrant. All rights reserved.</p>
    </div>
  </footer>;
}
