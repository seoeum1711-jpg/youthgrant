import { RelevanceStatus, ReviewStatus, Verification, type RelevanceStatus as RelevanceStatusValue, type ReviewStatus as ReviewStatusValue, type Verification as VerificationValue } from "./types.ts";

export type DuplicateCandidateRecord = {
  id:string;
  title:string;
  organization:string;
  sourceId:string;
  sourceName:string;
  sourceUrl:string;
  publishedAt:string|null;
  collectedAt:string;
  deadline:string|null;
  deadlineVerification:VerificationValue;
  eligibilityVerification:VerificationValue;
  relevanceStatus:RelevanceStatusValue;
  reviewStatus:ReviewStatusValue;
};

export type DuplicateCandidate = {
  left:DuplicateCandidateRecord;
  right:DuplicateCandidateRecord;
  normalizedTitle:string;
  matchLevel:"STRONG"|"POSSIBLE";
  reason:string;
};

export type PublicDataQualitySummary = {
  publicTotal:number;
  reviewNeeded:number;
  deadlineVerified:number;
  deadlineUnknown:number;
  eligibilityVerified:number;
  eligibilityUnknown:number;
  duplicateCandidatePairs:number;
};

const MAX_COMPARISON_RECORDS=200;
const COMMON_WORDS=new Set(["공모","모집","사업","지원","청소년","프로그램","활동","운영","안내"]);
const REGION_PATTERN=/(전국|서울(?:특별시)?|경기(?:도)?|부산(?:광역시)?|대구(?:광역시)?|인천(?:광역시)?|광주(?:광역시)?|대전(?:광역시)?|울산(?:광역시)?|세종(?:특별자치시)?|강원(?:특별자치도|도)?|충청북도|충북|충청남도|충남|전북(?:특별자치도)?|전라북도|전라남도|전남|경상북도|경북|경상남도|경남|제주(?:특별자치도|도)?)/g;

function sorted(values:Iterable<string>){return [...new Set(values)].sort();}
function equal(valuesA:string[],valuesB:string[]){return valuesA.length===valuesB.length&&valuesA.every((value,index)=>value===valuesB[index]);}
function words(value:string){return value.split(" ").filter(Boolean);}

export function normalizeCrossSourceTitle(value:string){
  return value.normalize("NFKC").toLowerCase()
    .replace(/^\s*(?:\[(?:공고|모집|재공고|공지)\]\s*)+/u,"")
    .replace(/^\s*(?:공지사항|알림마당|게시판)\s*[:|>-]?\s*/u,"")
    .replace(/(20\d{2})\s*년/gu,"$1")
    .replace(/[\p{P}\p{S}]+/gu," ")
    .replace(/(^|\s)(?:모집\s*공고|공고)(?=\s|$)/gu," ")
    .replace(/\s+/g," ")
    .trim();
}

function markers(title:string){
  const normalized=title.normalize("NFKC").toLowerCase();
  const years=sorted(normalized.match(/20\d{2}/g)??[]);
  const rounds=sorted([
    ...(normalized.match(/\d+\s*차/g)??[]).map(value=>value.replace(/\s/g,"")),
    ...(normalized.match(/(?:추가\s*모집|재\s*공고|재\s*모집)/g)??[]).map(value=>value.replace(/\s/g,"")),
  ]);
  const regions=sorted((normalized.match(REGION_PATTERN)??[]).map(value=>value
    .replace(/특별자치도|특별자치시|특별시|광역시|도$/u,"")
    .replace("충청북","충북").replace("충청남","충남").replace("전라북","전북").replace("전라남","전남").replace("경상북","경북").replace("경상남","경남")));
  const numbers=sorted((normalized.match(/\d+/g)??[]).filter(value=>!years.includes(value)));
  return{years,rounds,regions,numbers};
}

function tokenSimilarity(left:string,right:string){
  const leftTokens=new Set(words(left));const rightTokens=new Set(words(right));
  const intersection=[...leftTokens].filter(token=>rightTokens.has(token));
  return{score:(2*intersection.length)/(leftTokens.size+rightTokens.size),intersection,distinctive:intersection.filter(token=>!COMMON_WORDS.has(token)&&!/^\d+$/.test(token))};
}

function comparison(left:DuplicateCandidateRecord,right:DuplicateCandidateRecord):Omit<DuplicateCandidate,"left"|"right">|null{
  const leftTitle=normalizeCrossSourceTitle(left.title);const rightTitle=normalizeCrossSourceTitle(right.title);
  if(!leftTitle||!rightTitle)return null;
  const leftMarkers=markers(left.title);const rightMarkers=markers(right.title);
  if(!equal(leftMarkers.years,rightMarkers.years)||!equal(leftMarkers.rounds,rightMarkers.rounds)||!equal(leftMarkers.numbers,rightMarkers.numbers))return null;
  if(leftMarkers.regions.length&&rightMarkers.regions.length&&!equal(leftMarkers.regions,rightMarkers.regions))return null;
  if(leftTitle===rightTitle)return{normalizedTitle:leftTitle,matchLevel:"STRONG",reason:"정규화 제목 동일 · 연도·차수 일치"};
  const similarity=tokenSimilarity(leftTitle,rightTitle);
  const enoughMeaning=similarity.distinctive.length>=2||similarity.intersection.length>=5;
  if(!enoughMeaning)return null;
  const contains=leftTitle.includes(rightTitle)||rightTitle.includes(leftTitle);
  if(similarity.score>=0.9||(contains&&similarity.score>=0.86))return{normalizedTitle:`${leftTitle} ↔ ${rightTitle}`,matchLevel:"STRONG",reason:`제목 token ${Math.round(similarity.score*100)}% 일치 + 연도·차수 일치`};
  if(similarity.score>=0.8)return{normalizedTitle:`${leftTitle} ↔ ${rightTitle}`,matchLevel:"POSSIBLE",reason:`제목 token ${Math.round(similarity.score*100)}% 일치 · 운영자 원문 비교 필요`};
  return null;
}

export function findCrossSourceDuplicateCandidates(records:DuplicateCandidateRecord[]){
  const eligible=records.filter(record=>record.relevanceStatus===RelevanceStatus.IN_SCOPE&&record.reviewStatus!==ReviewStatus.EXCLUDED).slice(0,MAX_COMPARISON_RECORDS);
  const candidates:DuplicateCandidate[]=[];
  for(let leftIndex=0;leftIndex<eligible.length;leftIndex++)for(let rightIndex=leftIndex+1;rightIndex<eligible.length;rightIndex++){
    const left=eligible[leftIndex];const right=eligible[rightIndex];
    if(left.sourceId===right.sourceId||left.id===right.id)continue;
    const match=comparison(left,right);if(match)candidates.push({left,right,...match});
  }
  return candidates.sort((left,right)=>left.matchLevel===right.matchLevel?left.left.title.localeCompare(right.left.title,"ko"):left.matchLevel==="STRONG"?-1:1);
}

export function summarizePublicDataQuality(records:DuplicateCandidateRecord[],duplicateCandidatePairs:number):PublicDataQualitySummary{
  const publicRecords=records.filter(record=>record.relevanceStatus===RelevanceStatus.IN_SCOPE&&record.reviewStatus!==ReviewStatus.PENDING&&record.reviewStatus!==ReviewStatus.EXCLUDED);
  const deadlineVerified=publicRecords.filter(record=>record.deadline!==null&&(record.deadlineVerification===Verification.VERIFIED||record.deadlineVerification===Verification.MANUAL_CONFIRMED)).length;
  const eligibilityVerified=publicRecords.filter(record=>record.eligibilityVerification===Verification.VERIFIED||record.eligibilityVerification===Verification.FROM_BODY||record.eligibilityVerification===Verification.MANUAL_CONFIRMED).length;
  return{publicTotal:publicRecords.length,reviewNeeded:publicRecords.filter(record=>record.reviewStatus===ReviewStatus.REVIEW_REQUIRED||record.reviewStatus===ReviewStatus.DEFERRED).length,deadlineVerified,deadlineUnknown:publicRecords.length-deadlineVerified,eligibilityVerified,eligibilityUnknown:publicRecords.length-eligibilityVerified,duplicateCandidatePairs};
}
