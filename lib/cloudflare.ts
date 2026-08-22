export type D1ResultLike = {
  success?: boolean;
  meta?: { changes?: number };
};

export type D1PreparedStatementLike = {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<D1ResultLike>;
};

export type D1DatabaseLike = {
  prepare(query: string): D1PreparedStatementLike;
  batch<T = D1ResultLike>(statements: D1PreparedStatementLike[]): Promise<T[]>;
};

export type QueueLike<T> = {
  send(message: T): Promise<void>;
};

export type YouthGrantEnv = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1DatabaseLike;
  ATTACHMENT_QUEUE?: QueueLike<import("./attachments/contracts.ts").AttachmentQueueMessage>;
  ENVIRONMENT?: "development" | "preview" | "production";
  SITE_ORIGIN?: string;
  OPS_ACCESS_TOKEN?: string;
  SEOUL_OPEN_API_KEY?: string;
};
