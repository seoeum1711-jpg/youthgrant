declare module "cloudflare:workers" {
  import type { YouthGrantEnv } from "./lib/cloudflare";
  export const env: YouthGrantEnv;
}

type Fetcher = { fetch(request:Request):Promise<Response> };
