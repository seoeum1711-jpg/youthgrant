import type { RawNotice } from "./contracts.ts";

function normalize(value:string){return value.normalize("NFKC").toLowerCase().replace(/https?:\/\/(www\.)?/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim();}
export function makeDedupeKey(sourceId:string,title:string,url:string){const canonical=normalize(url.split(/[?#]/)[0]);return `${sourceId}:${canonical||normalize(title)}`;}
export function dedupeNotices(notices:RawNotice[]){const seen=new Set<string>();return notices.filter(notice=>{if(seen.has(notice.dedupeKey))return false;seen.add(notice.dedupeKey);return true;});}
