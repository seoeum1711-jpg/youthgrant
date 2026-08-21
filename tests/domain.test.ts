import assert from "node:assert/strict";
import test from "node:test";
import { fixtureOpportunities } from "../lib/data/fixtures.ts";
import { toGrantViewModel, toPublicGrantList } from "../lib/domain/grant-view-model.ts";
import { eligibilityPresentation, mayVerifyDeadline, safeValue } from "../lib/domain/verification.ts";
import { Verification } from "../lib/domain/types.ts";

test("deadline context rejects event dates and accepts application deadlines",()=>{assert.equal(mayVerifyDeadline("행사일 2026.09.30"),false);assert.equal(mayVerifyDeadline("신청 마감 2026.09.30"),true);assert.equal(mayVerifyDeadline("사업기간 2026.09.01~09.30"),false)});
test("unverified date never creates status or D-Day",()=>{const row=fixtureOpportunities.find(x=>x.id==="community-safety-2026")!;const view=toGrantViewModel(row,new Date("2026-08-21T09:00:00+09:00"));assert.equal(view.status,"일정 확인 필요");assert.equal(view.dDay,null);assert.equal(view.dateLabel,"확인 필요")});
test("review required eligibility is not presented as eligible",()=>{assert.deepEqual(eligibilityPresentation(Verification.REVIEW_REQUIRED),{label:"검토 필요",tone:"review"})});
test("missing values remain explicit and are never fabricated",()=>{assert.equal(safeValue(null),"확인 필요");assert.equal(safeValue(""),"확인 필요")});
test("verified raw opportunity becomes a safe public view model",()=>{const row=fixtureOpportunities.find(x=>x.id==="kywa-global-2026")!;const view=toGrantViewModel(row,new Date("2026-08-21T09:00:00+09:00"));assert.equal(view.status,"마감임박");assert.equal(view.dDay,"D-9");assert.equal(view.eligibilityLabel,"청소년수련시설 신청 가능");assert.equal(view.selfBurdenLabel,"확인 필요")});
test("manual verification is presented while excluded opportunities stay out of Public",()=>{const row=fixtureOpportunities[0];const manual={...row,deadlineVerification:Verification.MANUAL_CONFIRMED,eligibilityVerification:Verification.MANUAL_CONFIRMED,reviewStatus:"CONFIRMED" as const};const view=toGrantViewModel(manual,new Date("2026-08-21T09:00:00+09:00"));assert.equal(view.eligibilityLabel,"청소년수련시설 신청 가능");assert.notEqual(view.dateLabel,"확인 필요");assert.equal(toPublicGrantList([{...manual,reviewStatus:"EXCLUDED" as const}]).length,0)});
