"use client";

import { useState, type FormEvent } from "react";

const SUCCESS="문의가 접수되었습니다. 확인 후 입력하신 이메일로 답변드리겠습니다.";
const FAILURE="문의 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.";

export function ContactForm(){
  const [status,setStatus]=useState<"idle"|"sending"|"success"|"error">("idle");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setStatus("sending");const form=event.currentTarget;const data=new FormData(form);
    try{
      const response=await fetch("/api/contact",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:data.get("type"),subject:data.get("subject"),content:data.get("content"),email:data.get("email"),website:data.get("website")})});
      if(!response.ok)throw new Error("Contact request failed");form.reset();setStatus("success");
    }catch{setStatus("error");}
  }
  return <form className="contact-form" onSubmit={submit}>
    <label>문의유형<select name="type" defaultValue="GENERAL" required><option value="GENERAL">일반문의</option><option value="ERROR">오류제보</option></select></label>
    <label>제목<input name="subject" type="text" required maxLength={120} autoComplete="off"/></label>
    <label>내용<textarea name="content" required maxLength={5000} rows={8}/></label>
    <label>회신받을 이메일<input name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email"/></label>
    <label className="contact-honeypot" aria-hidden="true">웹사이트<input name="website" type="text" tabIndex={-1} autoComplete="off"/></label>
    <button type="submit" disabled={status==="sending"}>{status==="sending"?"전송 중…":"전송하기"}</button>
    <p className={`contact-status ${status}`} aria-live="polite">{status==="success"?SUCCESS:status==="error"?FAILURE:""}</p>
  </form>;
}
