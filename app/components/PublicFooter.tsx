export function PublicFooter(){
  return <footer className="public-footer">
    <div className="public-footer-inner">
      <div className="public-footer-main">
        <section className="footer-brand" aria-label="YouthGrant 소개">
          <h2>YouthGrant</h2>
          <p>청소년수련시설을 위한 공모·지원사업 탐색 서비스</p>
        </section>
        <div className="footer-utility">
          <p className="footer-operator">운영·제작 청록</p>
          <span className="footer-divider" aria-hidden="true">|</span>
          <a className="footer-contact" href="mailto:youthgreen94@gmail.com?subject=%5BYouthGrant%20문의%20및%20오류제보%5D">문의 및 오류제보</a>
        </div>
      </div>
      <p className="footer-copyright">© 2026 YouthGrant. All rights reserved.</p>
    </div>
  </footer>;
}
