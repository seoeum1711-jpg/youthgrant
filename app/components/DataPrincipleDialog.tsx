"use client";
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- the native dialog handles pointer input only on its backdrop; Escape and close buttons remain available. */

import { useCallback, useEffect, useId, useRef, useState } from "react";

export function DataPrincipleDialog({triggerLabel="데이터 원칙",triggerClassName}:{triggerLabel?:string;triggerClassName?:string}){
  const [open,setOpen]=useState(false);const triggerRef=useRef<HTMLButtonElement>(null);const closeRef=useRef<HTMLButtonElement>(null);const titleId=useId();
  const close=useCallback(()=>{setOpen(false);requestAnimationFrame(()=>triggerRef.current?.focus());},[]);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";closeRef.current?.focus();const keydown=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};document.addEventListener("keydown",keydown);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",keydown);};},[open,close]);
  return <>
    <button ref={triggerRef} className={triggerClassName} type="button" onClick={()=>setOpen(true)}>{triggerLabel}</button>
    {open?<dialog open className="contact-modal-overlay data-principle-dialog-overlay" aria-modal="true" aria-labelledby={titleId} onClick={event=>{if(event.target===event.currentTarget)close();}}>
      <section className="contact-modal data-principle-dialog">
        <button ref={closeRef} className="contact-modal-x" type="button" onClick={close} aria-label="데이터 원칙 창 닫기">×</button>
        <h2 id={titleId}>데이터 원칙</h2>
        <h3>확인 가능한 정보만 제공합니다.</h3>
        <div className="data-principle-dialog-body">
          <p>YouthGrant는 공식 공고와 첨부자료에서 확인된 정보를 기준으로 데이터를 구성합니다.</p>
          <p>신청기간으로 확인된 날짜만 접수 일정과 D-Day에 반영하며, 신청자격·지원대상 등 판단 근거가 충분하지 않은 정보는 임의로 확정하지 않습니다.</p>
          <p>자동으로 확인하기 어려운 항목은 별도 검토 대상으로 관리합니다.</p>
          <p>현재 베타 서비스로 일부 공식 기관의 공고를 수집하고 있으며, 모든 지원사업의 포함을 보장하지 않습니다. 신청 전 세부 조건과 변경사항은 반드시 해당 기관의 공식 공고를 확인해 주세요.</p>
        </div>
        <div className="contact-modal-actions data-principle-dialog-actions"><button type="button" className="contact-modal-close" onClick={close}>닫기</button></div>
      </section>
    </dialog>:null}
  </>;
}
