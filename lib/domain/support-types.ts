import { ExternalResourceType, type ExternalResourceType as ExternalResourceTypeValue } from "./types.ts";

const canonicalSupportTypes=new Set<string>(Object.values(ExternalResourceType));

export const supportTypeLabels:Record<ExternalResourceTypeValue,string>={
  MONEY:"사업비",
  STAFF:"강사·인력",
  MATERIAL:"물품·교구",
  PROGRAM:"프로그램 제공",
  PROFESSIONAL_SERVICE:"전문서비스",
};

export function normalizeSupportTypes(value:unknown):ExternalResourceTypeValue[]{
  if(!Array.isArray(value))return[];
  return [...new Set(value.filter((item):item is ExternalResourceTypeValue=>typeof item==="string"&&canonicalSupportTypes.has(item)))];
}

export function parseSupportTypesJson(value:string|null|undefined):ExternalResourceTypeValue[]{
  try{return normalizeSupportTypes(JSON.parse(value??"[]"));}catch{return[];}
}

export function supportTypeLabel(type:ExternalResourceTypeValue){return supportTypeLabels[type];}
