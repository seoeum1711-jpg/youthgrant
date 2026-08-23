import assert from "node:assert/strict";
import test from "node:test";
import { ContactDeliveryError, ContactValidationError, escapeContactHtml, parseContactSubmission, sendContactEmail } from "../lib/contact.ts";

const valid=JSON.stringify({type:"GENERAL",subject:"이용 문의",content:"문의 내용입니다.",email:"USER@example.com",website:""});

test("contact payload validates required fields and normalizes email",()=>{const parsed=parseContactSubmission(valid);assert.equal(parsed.spam,false);if(!parsed.spam)assert.equal(parsed.submission.email,"user@example.com");assert.throws(()=>parseContactSubmission(JSON.stringify({type:"GENERAL",subject:"",content:"내용",email:"bad"})),ContactValidationError);assert.throws(()=>parseContactSubmission(JSON.stringify({type:"GENERAL",subject:"제목",content:"x".repeat(5001),email:"user@example.com"})),ContactValidationError)});
test("contact honeypot is accepted without delivery data",()=>{assert.deepEqual(parseContactSubmission(JSON.stringify({website:"https://spam.example"})),{spam:true})});
test("contact HTML escapes scripts and attributes",()=>{assert.equal(escapeContactHtml('<script>alert("x")</script>'),"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;")});
test("Resend request uses safe content, reply address and operator recipient",async()=>{let request:RequestInit|undefined;await sendContactEmail({type:"ERROR",subject:"<오류>",content:"<script>bad</script>\n상세",email:"reply@example.com"},{RESEND_API_KEY:"test-key",CONTACT_FROM_EMAIL:"YouthGrant <contact@example.com>"},async(_url,init)=>{request=init;return new Response(JSON.stringify({id:"mail-1"}),{status:200})});const body=JSON.parse(String(request?.body));assert.equal(body.to[0],"youthgreen94@gmail.com");assert.equal(body.reply_to,"reply@example.com");assert.equal(body.subject,"[YouthGrant 오류제보] <오류>");assert.ok(body.html.includes("&lt;script&gt;bad&lt;/script&gt;"));assert.ok(!body.html.includes("<script>"))});
test("email delivery fails closed when provider settings are missing",async()=>{await assert.rejects(()=>sendContactEmail({type:"GENERAL",subject:"문의",content:"내용",email:"reply@example.com"},{}),ContactDeliveryError)});
