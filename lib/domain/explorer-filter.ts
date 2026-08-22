import type { GrantViewModel } from "./types.ts";
import { categoryTaxonomy, facilityTaxonomy } from "./grant-view-model.ts";

export const explorerRegions=["전체","경기","서울","전국","확인 필요"] as const;
export const explorerStatuses=["접수중","마감임박","예정","일정 확인 필요"] as const;
export type ExplorerFilterState={search:string;region:string;facility:string[];category:string[];status:string[]};
export const emptyExplorerFilters:ExplorerFilterState={search:"",region:"전체",facility:[],category:[],status:[]};

export function parseExplorerQuery(search:string):ExplorerFilterState{const query=new URLSearchParams(search);const valid=(key:string,values:readonly string[])=>query.getAll(key).filter(value=>values.includes(value));const region=query.get("region")??"전체";return{search:query.get("q")??"",region:explorerRegions.includes(region as typeof explorerRegions[number])?region:"전체",facility:valid("facility",facilityTaxonomy),category:valid("category",categoryTaxonomy),status:valid("status",explorerStatuses)};}
export function serializeExplorerQuery(filters:ExplorerFilterState){const query=new URLSearchParams();if(filters.search.trim())query.set("q",filters.search.trim());if(filters.region!=="전체")query.set("region",filters.region);filters.facility.forEach(value=>query.append("facility",value));filters.category.forEach(value=>query.append("category",value));filters.status.forEach(value=>query.append("status",value));return query.toString();}
export function matchesExplorerFilters(grant:GrantViewModel,state:ExplorerFilterState){const query=state.search.trim().toLocaleLowerCase("ko-KR");const searchMatch=!query||grant.title.toLocaleLowerCase("ko-KR").includes(query)||grant.organization.toLocaleLowerCase("ko-KR").includes(query);const regionMatch=state.region==="전체"||grant.eligibleRegion===state.region||(state.region!=="전국"&&state.region!=="확인 필요"&&grant.eligibleRegion==="전국");return searchMatch&&regionMatch&&(!state.facility.length||state.facility.some(value=>grant.facilityTypes.includes(value)))&&(!state.category.length||state.category.includes(grant.field))&&(!state.status.length||state.status.includes(grant.status));}
