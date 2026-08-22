import { RelevanceStatus, type RelevanceStatus as RelevanceStatusValue } from "../domain/types.ts";

export type RelevanceInput={title:string;body?:string|null;attachmentText?:string[]};
export type RelevanceDecision={status:RelevanceStatusValue;reason:string;signals:string[]};

const FINANCIAL=[
  /사업비(?:를|는|로|의)?\s*(?:지원|보조|교부)/,
  /(?:지원금|보조금|지원액)(?:을|를|은|는|으로)?\s*(?:지원|지급|교부)?/,
  /(?:기관|시설|단체|개소)\s*(?:당|별)\s*(?:최대\s*)?[0-9,]+\s*(?:만|천만|억)?\s*원/,
  /지원\s*규모[^\n.]{0,100}(?:원|만원|억원)/,
  /자부담(?:금|률|비율)?[^\n.]{0,80}(?:없음|[0-9]+\s*%|원)/,
] as const;
const EXECUTION=[
  /선정(?:된|될)?\s*(?:기관|시설|단체|개소)[^\n.]{0,100}(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)/,
  /(?:운영|수행)\s*기관[^\n.]{0,100}(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)/,
  /(?:사업|프로그램|프로젝트)\s*(?:수행|운영|추진)[^\n.]{0,100}(?:기관|시설|단체)/,
  /(?:사업계획서|지원신청서|보조금\s*교부신청서)/,
] as const;
const ORGANIZATION_APPLICANT=[
  /(?:신청|지원|모집)\s*(?:대상|자격)[^\n.]{0,120}(?:기관|시설|단체|법인)/,
  /(?:기관|시설|단체|법인)[^\n.]{0,100}(?:신청|지원할 수|공모에 참여)/,
] as const;
const OUT_SIGNALS:[RegExp,string][]=[
  [/(?:참가자|참가\s*청소년|참여자|교육생|수강생)\s*(?:을\s*)?모집/,"개인·참가자 모집"],
  [/(?:교육|연수|워크숍)[^\n.]{0,80}(?:참가|참여)\s*(?:기관|시설|신청)/,"교육·연수 참여 모집"],
  [/(?:캠프|수련활동|힐링\s*프로그램)[^\n.]{0,100}(?:참가|참여|예약|모집)/,"캠프·수련·힐링 프로그램 참여"],
  [/(?:공모전|작품\s*모집|우수\s*사례|사례\s*공모|수기\s*공모)/,"공모전·작품·사례 모집"],
  [/(?:설문\s*조사|현황\s*조사|수요\s*조사)/,"설문·수요·현황 조사"],
  [/(?:참여|홍보)\s*협조\s*(?:요청|공문)/,"참여·홍보 협조 요청"],
  [/(?:직원|인턴|운영요원|위원|컨설턴트)[^\n.]{0,50}(?:채용|모집)|(?:채용|위원\s*모집)/,"채용·인력·위원 모집"],
  [/(?:상담|컨설팅)[^\n.]{0,80}(?:참여|신청|지원)/,"상담·컨설팅 서비스 참여"],
  [/협력\s*(?:기업|기관)[^\n.]{0,80}모집/,"협력기업·기관 모집"],
] ;

function clean(value:string|null|undefined){return(value??"").replace(/\s+/g," ").trim();}
function firstMatch(text:string,patterns:readonly RegExp[]){for(const pattern of patterns){const match=text.match(pattern);if(match)return clean(match[0]).slice(0,140);}return null;}
function bodyIsMaterial(title:string,body:string){const withoutTitle=clean(body.replace(title,""));return withoutTitle.length>=20;}

export function classifyOpportunityRelevance(input:RelevanceInput):RelevanceDecision{
  const title=clean(input.title);const body=clean(input.body);const attachments=clean(input.attachmentText?.join(" "));const evidence=clean(`${body} ${attachments}`);const material=bodyIsMaterial(title,body)||attachments.length>=30;const combined=clean(`${title} ${evidence}`);
  const financial=firstMatch(combined,FINANCIAL);const execution=firstMatch(combined,EXECUTION);const applicant=firstMatch(combined,ORGANIZATION_APPLICANT);
  if(financial&&(execution||applicant)){
    const signals=[financial,execution,applicant].filter((value):value is string=>Boolean(value));
    return{status:RelevanceStatus.IN_SCOPE,reason:`재정지원과 기관의 사업수행 구조 확인: ${signals.join(" / ")}`.slice(0,500),signals};
  }
  if(!material)return{status:RelevanceStatus.RELEVANCE_REVIEW,reason:"상세 본문 또는 첨부 근거가 충분하지 않아 공모사업 해당 여부를 자동 확정할 수 없음",signals:[]};
  for(const [pattern,label] of OUT_SIGNALS){const match=combined.match(pattern);if(match&&!financial)return{status:RelevanceStatus.OUT_OF_SCOPE,reason:`재정지원형 수행사업이 아니라 ${label}으로 확인: ${clean(match[0])}`.slice(0,500),signals:[clean(match[0])]};}
  const partial=[financial,execution,applicant].filter((value):value is string=>Boolean(value));
  if(partial.length)return{status:RelevanceStatus.RELEVANCE_REVIEW,reason:`지원사업 신호가 일부만 확인됨: ${partial.join(" / ")}`.slice(0,500),signals:partial};
  return{status:RelevanceStatus.RELEVANCE_REVIEW,reason:"기관 신청형 재정지원과 사업수행 구조를 함께 확인하지 못함",signals:[]};
}
