export type AttachmentFormat="PDF"|"HWPX"|"HWP"|"ZIP"|"JPG"|"PNG"|"UNSUPPORTED";
export type DocumentRole="PRIMARY"|"SUPPORTING"|"FORM"|"MEDIA"|"UNKNOWN";
export type AttachmentParseStatus="PENDING"|"PARSED"|"OCR_REQUIRED"|"PARSE_FAILED"|"UNSUPPORTED"|"HWP_PARSER_BLOCKED"|"QUEUE_BLOCKED";

export type DiscoveredAttachment={
  url:string;
  filename:string;
  extension:string|null;
  mimeType:string|null;
  role:DocumentRole;
  priority:number;
};

export type AttachmentQueueMessage={
  attachmentId:string;
  rawNoticeId:string;
  sourceId:string;
  url:string;
};

export type ExtractedBlock={location:string;text:string};
export type ExtractionArtifact={version:"attachment-v1";attachmentId:string;filename:string;format:AttachmentFormat;role:DocumentRole;blocks:ExtractedBlock[];metadata:Record<string,string|number|boolean|null>};

export type AttachmentEvidence={
  field:"deadline"|"eligibility"|"amount"|"self_burden";
  value:string|string[]|number;
  evidenceText:string;
  attachmentId:string;
  filename:string;
  originalUrl:string;
  location:string;
  sourceType:"ATTACHMENT";
};

export type AttachmentProcessResult={status:AttachmentParseStatus;format:AttachmentFormat;parseMethod:string;artifact:ExtractionArtifact|null;children?:{filename:string;bytes:Uint8Array}[];errorCode?:string;errorMessage?:string};
