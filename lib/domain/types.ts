export const Verification = {
  VERIFIED: "VERIFIED",
  FROM_BODY: "FROM_BODY",
  NEEDS_ATTACHMENT: "NEEDS_ATTACHMENT",
  NEEDS_ADMIN: "NEEDS_ADMIN",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
  MANUAL_CONFIRMED: "MANUAL_CONFIRMED",
  MANUAL_REJECTED: "MANUAL_REJECTED",
  UNKNOWN: "UNKNOWN",
} as const;
export type Verification = (typeof Verification)[keyof typeof Verification];

export const ReviewStatus = { PUBLISHED:"PUBLISHED", PENDING:"PENDING", REVIEW_REQUIRED:"REVIEW_REQUIRED", CONFIRMED:"CONFIRMED", DEFERRED:"DEFERRED", EXCLUDED:"EXCLUDED" } as const;
export type ReviewStatus = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const RelevanceStatus = { IN_SCOPE:"IN_SCOPE", OUT_OF_SCOPE:"OUT_OF_SCOPE", RELEVANCE_REVIEW:"RELEVANCE_REVIEW" } as const;
export type RelevanceStatus = (typeof RelevanceStatus)[keyof typeof RelevanceStatus];

export const ExternalResourceType = { MONEY:"MONEY", STAFF:"STAFF", MATERIAL:"MATERIAL", PROGRAM:"PROGRAM", PROFESSIONAL_SERVICE:"PROFESSIONAL_SERVICE" } as const;
export type ExternalResourceType = (typeof ExternalResourceType)[keyof typeof ExternalResourceType];

export type Opportunity = {
  id:string;
  dedupeKey:string;
  title:string;
  organization:string;
  sourceId:string;
  sourceName:string;
  sourceMethod:"WEB"|"RSS"|"API"|"OPEN_DATA";
  sourceUrl:string;
  region:"경기"|"서울"|"전국";
  eligibleRegion?:string|null;
  facilityTypes:string[];
  field:string|null;
  applicationStart:string|null;
  deadline:string|null;
  deadlineVerification:Verification;
  deadlineEvidence:string|null;
  deadlineEvidenceLocation:string|null;
  eligibilityVerification:Verification;
  eligibilityEvidence:string|null;
  eligibilityEvidenceLocation:string|null;
  eligibilityMatchRange?:{start:number;end:number}|null;
  amountWon:number|null;
  amountText:string|null;
  selfBurden:string|null;
  supportDetails:string|null;
  reviewStatus:ReviewStatus;
  collectedAt:string;
};

export type GrantViewModel = {
  id:string; title:string; organization:string; sourceName:string; sourceMethod:string; sourceUrl:string;
  region:string; eligibleRegion:string; facilityTypes:string[]; field:string;
  status:"접수중"|"마감임박"|"예정"|"일정 확인 필요"|"마감";
  statusTone:"open"|"soon"|"plan"|"check"|"closed";
  dDay:string|null; dateLabel:string; applicationPeriod:string;
  eligibilityLabel:"청소년수련시설 신청 가능"|"신청 가능"|"신청 불가"|"신청자격 확인 필요"|"검토 필요";
  eligibilityTone:"verified"|"ineligible"|"unknown"|"review";
  evidenceText:string; evidenceLocation:string; evidenceVerified:boolean; evidenceMatchRange:{start:number;end:number}|null;
  amountLabel:string; selfBurdenLabel:string; supportDetails:string;
  checks:{label:string;state:"verified"|"unknown";message:string}[];
  collectedAt:string;
};
