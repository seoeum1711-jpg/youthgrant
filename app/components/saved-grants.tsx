"use client";

import { useCallback, useEffect, useState } from "react";
import { parseSavedGrantIds, toggleSavedGrantId } from "../../lib/domain/saved-grants.ts";

const STORAGE_KEY="youthgrant:saved-grants:v1";
const CHANGE_EVENT="youthgrant:saved-grants-change";

function readSavedGrantIds(){return parseSavedGrantIds(localStorage.getItem(STORAGE_KEY));}

function writeSavedGrantIds(ids:string[]){
  localStorage.setItem(STORAGE_KEY,JSON.stringify([...new Set(ids)]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useSavedGrantIds(){
  const [savedIds,setSavedIds]=useState<string[]>([]);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    const sync=()=>setSavedIds(readSavedGrantIds());
    const timeout=window.setTimeout(()=>{sync();setReady(true);},0);
    window.addEventListener("storage",sync);window.addEventListener(CHANGE_EVENT,sync);
    return()=>{window.clearTimeout(timeout);window.removeEventListener("storage",sync);window.removeEventListener(CHANGE_EVENT,sync);};
  },[]);
  const toggle=useCallback((id:string)=>writeSavedGrantIds(toggleSavedGrantId(readSavedGrantIds(),id)),[]);
  const remove=useCallback((id:string)=>writeSavedGrantIds(readSavedGrantIds().filter(value=>value!==id)),[]);
  return{savedIds,ready,toggle,remove};
}

export function SavedGrantButton({grantId,className=""}:{grantId:string;className?:string}){
  const{savedIds,toggle}=useSavedGrantIds();const saved=savedIds.includes(grantId);
  return <button type="button" className={`save-button ${saved?"saved":""} ${className}`.trim()} aria-pressed={saved} onClick={()=>toggle(grantId)}>{saved?"★ 저장됨":"☆ 저장"}</button>;
}
