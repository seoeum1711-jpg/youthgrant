import assert from "node:assert/strict";
import test from "node:test";
import { dedupeNotices, makeDedupeKey } from "../lib/collectors/dedupe.ts";
import { runCollection } from "../lib/collectors/run.ts";
import type { Collector, RawNotice, SourceDefinition } from "../lib/collectors/contracts.ts";

const source=(id:string):SourceDefinition=>({id,name:id,method:"WEB",region:"전국",url:`https://example.com/${id}`,implemented:true,health:"GREEN"});
const notice=(id:string):RawNotice=>({sourceId:id,sourceNoticeId:null,title:"청소년 지원사업 공모",url:`https://example.com/${id}/1`,publishedAt:null,rawText:"raw",collectedAt:new Date(0).toISOString(),dedupeKey:makeDedupeKey(id,"청소년 지원사업 공모",`https://example.com/${id}/1`)});
test("one source failure does not stop successful collectors",async()=>{const collectors:Collector[]=[{source:source("a"),collect:async()=>[notice("a")]},{source:source("b"),collect:async()=>{throw new Error("isolated failure")}},{source:source("c"),collect:async()=>[notice("c")]}];const result=await runCollection(collectors);assert.equal(result.status,"PARTIAL");assert.equal(result.sourceRuns.length,3);assert.equal(result.sourceRuns.filter(x=>x.status==="SUCCESS").length,2);assert.equal(result.sourceRuns.find(x=>x.sourceId==="b")?.error,"isolated failure")});
test("dedupe keeps one raw notice for repeated collection",()=>{const one=notice("a");const duplicate={...one};assert.equal(dedupeNotices([one,duplicate]).length,1)});
test("dedupe preserves notice identity in query parameters and ignores tracking",()=>{const first=makeDedupeKey("a","공고","https://example.com/view?id=1&utm_source=test");const same=makeDedupeKey("a","공고","https://example.com/view?utm_source=other&id=1");const second=makeDedupeKey("a","공고","https://example.com/view?id=2");assert.equal(first,same);assert.notEqual(first,second)});
