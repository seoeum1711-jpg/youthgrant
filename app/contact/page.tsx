import { PublicFooter } from "../components/PublicFooter.tsx";
import { PublicHeader } from "../components/PublicHeader.tsx";
import { ContactForm } from "./ContactForm.tsx";

export default function ContactPage(){return <><PublicHeader/><section className="contact-hero"><div><p className="eyebrow">CONTACT YOUTHGRANT</p><h1>문의 및 오류제보</h1><p>서비스 이용 문의나 공고 데이터 오류를 알려주세요.</p></div></section><main className="contact-main"><div className="contact-card"><ContactForm/><p className="contact-note">입력하신 이메일은 문의 답변을 위해서만 사용합니다.</p></div></main><PublicFooter/></>}
