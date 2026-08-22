"use client";
import Link from "next/link";
import type { GrantViewModel } from "../../lib/domain/types.ts";
import { GrantCard } from "../components/ExplorerClient.tsx";
import { useSavedGrantIds } from "../components/saved-grants.tsx";

export function SavedList({grants}:{grants:GrantViewModel[]}){
  const{savedIds,ready,toggle}=useSavedGrantIds();const byId=new Map(grants.map(grant=>[grant.id,grant]));const saved=savedIds.map(id=>byId.get(id)).filter((grant):grant is GrantViewModel=>Boolean(grant));const unavailable=savedIds.length-saved.length;
  if(!ready)return <div className="empty-state"><h3>저장한 공고를 불러오는 중입니다.</h3></div>;
  return <>{unavailable>0&&<p className="saved-unavailable">공개가 종료되었거나 제외된 저장 공고 {unavailable}건은 안전하게 숨겼습니다.</p>}{saved.length?<div className="grant-list">{saved.map(grant=><GrantCard grant={grant} saved onSave={()=>toggle(grant.id)} key={grant.id}/>)}</div>:<div className="empty-state"><h3>저장한 공고가 없습니다.</h3><p>Explorer의 공고 카드나 상세 화면에서 ☆ 저장을 눌러 보관할 수 있습니다.</p><Link className="empty-link" href="/">공고 둘러보기</Link></div>}</>;
}
