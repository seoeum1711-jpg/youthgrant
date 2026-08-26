import type { GrantViewModel } from "./types.ts";
import { categoryTaxonomy, facilityTaxonomy } from "./grant-view-model.ts";
import { supportTypeLabel, supportTypeValues } from "./support-types.ts";
import type { ExternalResourceType } from "./types.ts";

export const explorerRegions=["전체","경기","서울","전국","확인 필요"] as const;
export const explorerStatuses=["접수중","마감임박","예정","일정 확인 필요"] as const;
export type ExplorerFilterState={search:string;region:string;facility:string[];category:string[];status:string[];support:ExternalResourceType[]};
export type ExplorerFilterChip={key:"search"|"region"|"facility"|"category"|"status"|"support";value:string;label:string};
export type ExplorerSort="deadline"|"recent";
export const emptyExplorerFilters:ExplorerFilterState={search:"",region:"전체",facility:[],category:[],status:[],support:[]};

export function parseExplorerQuery(search:string):ExplorerFilterState{const query=new URLSearchParams(search);const valid=(key:string,values:readonly string[])=>[...new Set(query.getAll(key).filter(value=>values.includes(value)))];const region=query.get("region")??"전체";const requestedSupport=new Set(query.getAll("support"));return{search:query.get("q")??"",region:explorerRegions.includes(region as typeof explorerRegions[number])?region:"전체",facility:valid("facility",facilityTaxonomy),category:valid("category",categoryTaxonomy),status:valid("status",explorerStatuses),support:supportTypeValues.filter(value=>requestedSupport.has(value))};}
export function serializeExplorerQuery(filters:ExplorerFilterState){const query=new URLSearchParams();if(filters.search.trim())query.set("q",filters.search.trim());if(filters.region!=="전체")query.set("region",filters.region);filters.facility.forEach(value=>query.append("facility",value));filters.category.forEach(value=>query.append("category",value));filters.status.forEach(value=>query.append("status",value));supportTypeValues.filter(value=>filters.support.includes(value)).forEach(value=>query.append("support",value));return query.toString();}
export function matchesExplorerRegion(grant:Pick<GrantViewModel,"eligibleRegion"|"region">,selectedRegion:string){const region=grant.eligibleRegion==="확인 필요"?grant.region:grant.eligibleRegion;return selectedRegion==="전체"||region===selectedRegion||(region==="전국"&&(selectedRegion==="서울"||selectedRegion==="경기"));}
export function matchesExplorerFilters(grant:GrantViewModel,state:ExplorerFilterState){const query=state.search.trim().toLocaleLowerCase("ko-KR");const searchMatch=!query||grant.title.toLocaleLowerCase("ko-KR").includes(query)||grant.organization.toLocaleLowerCase("ko-KR").includes(query);return searchMatch&&matchesExplorerRegion(grant,state.region)&&(!state.facility.length||state.facility.some(value=>grant.facilityTypes.includes(value)))&&(!state.category.length||state.category.includes(grant.field))&&(!state.status.length||state.status.includes(grant.status))&&(!state.support.length||state.support.some(value=>grant.supportTypes.includes(value)));}

export function explorerFilterChips(filters:ExplorerFilterState):ExplorerFilterChip[]{return[
  ...(filters.search?[{key:"search" as const,value:filters.search,label:`검색: ${filters.search}`}]:[]),
  ...(filters.region!=="전체"?[{key:"region" as const,value:filters.region,label:filters.region}]:[]),
  ...filters.facility.map(value=>({key:"facility" as const,value,label:value})),
  ...filters.category.map(value=>({key:"category" as const,value,label:value})),
  ...filters.status.map(value=>({key:"status" as const,value,label:value})),
  ...filters.support.map(value=>({key:"support" as const,value,label:supportTypeLabel(value)})),
];}
export function removeExplorerFilterChip(filters:ExplorerFilterState,chip:ExplorerFilterChip):ExplorerFilterState{if(chip.key==="search")return{...filters,search:""};if(chip.key==="region")return{...filters,region:"전체"};return{...filters,[chip.key]:filters[chip.key].filter(value=>value!==chip.value)};}

export function sortExplorerGrants(grants:GrantViewModel[],sort:ExplorerSort){
  if(sort==="deadline")return grants;
  return grants.map((grant,index)=>({grant,index})).sort((left,right)=>{
    const leftTime=Date.parse(left.grant.collectedAt);const rightTime=Date.parse(right.grant.collectedAt);
    const recent=(Number.isFinite(rightTime)?rightTime:Number.NEGATIVE_INFINITY)-(Number.isFinite(leftTime)?leftTime:Number.NEGATIVE_INFINITY);
    return recent||left.index-right.index;
  }).map(item=>item.grant);
}

export function explorerEmptyState(activeSourceCount:number){return{heading:"현재 공개할 지원사업 공고가 없습니다.",body:`현재 ${activeSourceCount}개 공식 출처를 확인하고 있습니다. 청소년시설이 신청해 실제로 활용할 수 있는 지원 내용과 신청 근거가 확인된 공고만 공개합니다. 새 공고가 확인되면 자동으로 반영합니다.`};}
export function hasPublicExplorerControls(grantCount:number){return grantCount>0;}
