export type SourceMethod="WEB"|"RSS"|"API"|"OPEN_DATA";
export type SourceHealth="GREEN"|"YELLOW"|"RED";
export type SourceDefinition={id:string;name:string;method:SourceMethod;region:"경기"|"서울"|"전국";url:string;implemented:boolean;enabled:boolean;health:SourceHealth};
export type RawNotice={sourceId:string;sourceNoticeId:string|null;title:string;url:string;publishedAt:string|null;rawText:string;collectedAt:string;dedupeKey:string};
export type Collector={source:SourceDefinition;parserVersion?:string;lastHttpStatus?:number|null;collect(signal?:AbortSignal):Promise<RawNotice[]>};
export type SourceRunOutcome="SUCCESS_WITH_ITEMS"|"SUCCESS_NO_ITEMS"|"FAILED";
export type SourceRunResult={sourceId:string;status:"SUCCESS"|"FAILED"|"NOT_IMPLEMENTED";result:SourceRunOutcome;startedAt:string;finishedAt:string;found:number;inserted:number;updated:number;matched:number;analyzed:number;httpStatus:number|null;parserVersion:string;errorCode:string|null;error:string|null;notices:RawNotice[]};
export type CrawlRunResult={id?:string;trigger?:"MANUAL"|"AUTOMATION";startedAt:string;finishedAt:string;status:"SUCCESS"|"PARTIAL"|"FAILED";sourceRuns:SourceRunResult[]};
