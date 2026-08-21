import assert from "node:assert/strict";
import test from "node:test";

const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);const {default:worker}=await import(workerUrl.href);
async function render(path){return worker.fetch(new Request(`http://localhost${path}`,{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}})}

test("renders the public explorer with YouthGrant metadata",async()=>{const response=await render("/");assert.equal(response.status,200);const html=await response.text();assert.match(html,/YouthGrant/);assert.match(html,/검토할 가치가 있는 공고/);assert.match(html,/og\.png/);assert.doesNotMatch(html,/codex-preview|Your site is taking shape|react-loading-skeleton/)});
test("renders representative detail and ops routes",async()=>{const detail=await render("/grants/kywa-global-2026");assert.equal(detail.status,200);const detailHtml=await detail.text();assert.match(detailHtml,/신청 가능 근거/);assert.match(detailHtml,/공식 공고 확인/);const ops=await render("/ops/sources");assert.equal(ops.status,200);const opsHtml=await ops.text();assert.match(opsHtml,/Source Monitor/);assert.match(opsHtml,/한국청소년활동진흥원/)});
