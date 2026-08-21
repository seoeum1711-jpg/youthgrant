import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewMutation } from "../lib/data/review-mutation.ts";

const valid={reviewStatus:"CONFIRMED",deadline:{decision:"CONFIRMED",value:"2026-09-18T18:00:00+09:00"},eligibility:{decision:"ELIGIBLE",facilityTypes:["청소년문화의집"],note:"원문에서 신청 가능 확인"},amount:{decision:"CONFIRMED",won:20000000,text:"기관당 최대 2,000만원"},selfBurden:{decision:"NONE"}};
test("manual review input preserves explicit operator decisions",()=>{const parsed=parseReviewMutation(valid);assert.equal(parsed.reviewStatus,"CONFIRMED");assert.equal(parsed.deadline.value,valid.deadline.value);assert.deepEqual(parsed.eligibility.facilityTypes,["청소년문화의집"]);assert.equal(parsed.selfBurden.decision,"NONE")});
test("manual review rejects an unconfirmed deadline value",()=>{assert.throws(()=>parseReviewMutation({...valid,deadline:{decision:"CONFIRMED",value:""}}),/신청 마감일/)});
