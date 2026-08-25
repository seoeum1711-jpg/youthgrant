"use client";
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- the native dialog handles pointer input only on its backdrop; Escape and close buttons remain available. */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const CONTACT_EMAIL="youthgreen94@gmail.com";

export function PublicFooter(){
  const [open,setOpen]=useState(false);const [copyState,setCopyState]=useState<"idle"|"copied"|"failed">("idle");const triggerRef=useRef<HTMLButtonElement>(null);const closeRef=useRef<HTMLButtonElement>(null);
  const close=useCallback(()=>{setOpen(false);setCopyState("idle");requestAnimationFrame(()=>triggerRef.current?.focus());},[]);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";closeRef.current?.focus();const keydown=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};document.addEventListener("keydown",keydown);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",keydown);};},[open,close]);
  async function copyEmail(){try{await navigator.clipboard.writeText(CONTACT_EMAIL);setCopyState("copied");}catch{try{const input=document.createElement("textarea");input.value=CONTACT_EMAIL;input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();const copied=document.execCommand("copy");input.remove();setCopyState(copied?"copied":"failed");}catch{setCopyState("failed");}}}
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
          <button ref={triggerRef} className="footer-contact" type="button" onClick={()=>setOpen(true)}>문의 및 오류제보</button>
        </div>
      </div>
      <div className="footer-note"><p>YouthGrant는 지원정보 탐색을 돕기 위한 서비스입니다. 최종 신청 자격·일정·조건은 주관기관의 공식 공고를 확인해 주세요.</p><Link href="/#principles">데이터 원칙</Link></div>
      <p className="footer-copyright">© 2026 YouthGrant. All rights reserved.</p>
    </div>
    {open?<dialog open className="contact-modal-overlay" aria-modal="true" aria-labelledby="contact-modal-title" onClick={event=>{if(event.target===event.currentTarget)close();}}><section className="contact-modal"><button ref={closeRef} className="contact-modal-x" type="button" onClick={close} aria-label="문의 창 닫기">×</button><h2 id="contact-modal-title">문의 및 오류제보</h2><p>문의사항이나 정보 오류는 이메일로 알려주세요.</p><strong className="contact-modal-email">{CONTACT_EMAIL}</strong><div className="contact-modal-actions"><button type="button" onClick={copyEmail}>이메일 주소 복사</button><a href="mailto:youthgreen94@gmail.com?subject=%5BYouthGrant%20문의%20및%20오류제보%5D">이메일 보내기</a><button type="button" className="contact-modal-close" onClick={close}>닫기</button></div><p className={`contact-copy-status ${copyState}`} aria-live="polite">{copyState==="copied"?"이메일 주소를 복사했습니다.":copyState==="failed"?"복사하지 못했습니다. 이메일 주소를 직접 복사해 주세요.":""}</p></section></dialog>:null}
  </footer>;
}
