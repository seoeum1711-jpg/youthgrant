import assert from "node:assert/strict";
import test from "node:test";

const base=process.env.YOUTHGRANT_TEST_URL??"http://localhost:3000";

test("renders the D1-backed public explorer with YouthGrant metadata",async()=>{const response=await fetch(`${base}/`);assert.equal(response.status,200);const html=await response.text();assert.match(html,/YouthGrant/);assert.match(html,/검토할 가치가 있는 공고/);assert.match(html,/og\.png/);assert.doesNotMatch(html,/codex-preview|kywa-global-2026|react-loading-skeleton/)});
test("renders a live D1 detail when an Opportunity exists",async(t)=>{const explorer=await fetch(`${base}/`);const html=await explorer.text();const match=html.match(/href="(\/grants\/opp_[a-z0-9]+)"/);if(!match){t.skip("Local D1 has no public Opportunity yet");return;}const detail=await fetch(`${base}${match[1]}`);assert.equal(detail.status,200);const detailHtml=await detail.text();assert.match(detailHtml,/신청 가능 근거/);assert.match(detailHtml,/공식 공고 확인/)});
test("renders the D1 source monitor and AUTOMATION status",async()=>{const ops=await fetch(`${base}/ops/sources`);assert.equal(ops.status,200);const html=await ops.text();assert.match(html,/Source Monitor/);assert.match(html,/최근 AUTOMATION/);assert.match(html,/v3-web-1/)});
test("renders the saved grants route without exposing excluded records",async()=>{const response=await fetch(`${base}/saved`);assert.equal(response.status,200);const html=await response.text();assert.match(html,/관심 공고/);assert.match(html,/브라우저에 저장/);assert.doesNotMatch(html,/EXCLUDED/)});
