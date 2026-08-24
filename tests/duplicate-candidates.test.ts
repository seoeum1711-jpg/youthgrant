import assert from "node:assert/strict";
import test from "node:test";
import { findCrossSourceDuplicateCandidates, normalizeCrossSourceTitle, summarizePublicDataQuality, type DuplicateCandidateRecord } from "../lib/domain/duplicate-candidates.ts";
import { RelevanceStatus, ReviewStatus, Verification } from "../lib/domain/types.ts";

function record(overrides:Partial<DuplicateCandidateRecord>={}):DuplicateCandidateRecord{return{id:"a",title:"2026 청소년 문화예술 창작 지원사업",organization:"기관",sourceId:"source-a",sourceName:"Source A",sourceUrl:"https://example.com/a",publishedAt:"2026-08-01T00:00:00+09:00",collectedAt:"2026-08-02T00:00:00+09:00",deadline:"2026-09-01T18:00:00+09:00",deadlineVerification:Verification.VERIFIED,eligibilityVerification:Verification.VERIFIED,relevanceStatus:RelevanceStatus.IN_SCOPE,reviewStatus:ReviewStatus.PUBLISHED,...overrides};}
function pair(left:Partial<DuplicateCandidateRecord>,right:Partial<DuplicateCandidateRecord>){return findCrossSourceDuplicateCandidates([record(left),record({id:"b",sourceId:"source-b",sourceName:"Source B",sourceUrl:"https://example.com/b",...right})]);}

test("same source and identical title is not a cross-source candidate",()=>{assert.equal(pair({}, {sourceId:"source-a"}).length,0)});
test("different sources with identical normalized titles are STRONG",()=>{const result=pair({},{});assert.equal(result.length,1);assert.equal(result[0].matchLevel,"STRONG")});
test("board prefixes and a 모집공고 suffix normalize to the same title",()=>{const result=pair({title:"[공고] 2026 청소년 지원사업"},{title:"2026 청소년 지원사업 모집공고"});assert.equal(result[0]?.matchLevel,"STRONG");assert.equal(normalizeCrossSourceTitle(result[0].left.title),"2026 청소년 지원사업")});
test("different years are not candidates",()=>{assert.equal(pair({title:"2025 청소년 문화예술 창작 지원사업"},{title:"2026 청소년 문화예술 창작 지원사업"}).length,0)});
test("different recruitment rounds are never STRONG candidates",()=>{assert.notEqual(pair({title:"2026 청소년 문화예술 창작 지원사업 1차 모집"},{title:"2026 청소년 문화예술 창작 지원사업 2차 모집"})[0]?.matchLevel,"STRONG")});
test("clearly different regions are not candidates",()=>{assert.equal(pair({title:"2026 서울 청소년 문화예술 창작 지원사업"},{title:"2026 경기 청소년 문화예술 창작 지원사업"}).length,0)});
test("titles sharing only common words are not candidates",()=>{assert.equal(pair({title:"2026 청소년 프로그램 지원사업"},{title:"2026 청소년 활동 지원사업"}).length,0)});
test("a regional association repost fixture is detected",()=>{const result=pair({title:"[공고] 2026 경기 리본 프로젝트 운영기관 지원사업"},{title:"2026 경기 리본 프로젝트 운영기관 지원사업 모집공고"});assert.equal(result[0]?.matchLevel,"STRONG")});
test("near-identical titles can be POSSIBLE without automatic merge",()=>{const result=pair({title:"2026 청소년 문화예술 창작 지원사업"},{title:"2026 청소년 문화예술 창작 지역 거점 지원사업"});assert.equal(result[0]?.matchLevel,"POSSIBLE")});
test("EXCLUDED and OUT_OF_SCOPE records are omitted",()=>{assert.equal(pair({reviewStatus:ReviewStatus.EXCLUDED},{}) .length,0);assert.equal(pair({relevanceStatus:RelevanceStatus.OUT_OF_SCOPE},{}) .length,0)});
test("every candidate includes an operator-readable reason",()=>{assert.match(pair({}, {})[0].reason,/정규화 제목 동일/)});
test("quality summary counts verified and unknown fields plus public duplicate pairs",()=>{const rows=[record(),record({id:"b",sourceId:"source-b",reviewStatus:ReviewStatus.REVIEW_REQUIRED,deadline:null,deadlineVerification:Verification.UNKNOWN,eligibilityVerification:Verification.REVIEW_REQUIRED}),record({id:"c",reviewStatus:ReviewStatus.PENDING}),record({id:"d",reviewStatus:ReviewStatus.EXCLUDED})];assert.deepEqual(summarizePublicDataQuality(rows,1),{publicTotal:2,reviewNeeded:1,deadlineVerified:1,deadlineUnknown:1,eligibilityVerified:1,eligibilityUnknown:1,duplicateCandidatePairs:1})});
