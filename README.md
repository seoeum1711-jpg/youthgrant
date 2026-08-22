# YouthGrant Public Beta

YouthGrant는 청소년시설 실무자가 검토할 가치가 있는 공모사업을 신청 가능 근거와 데이터 확인 상태로 찾는 서비스입니다. 이 GitHub 저장소가 Source of Truth이며, ChatGPT Sites는 최종 운영 경로로 사용하지 않습니다.

## 독립 운영 구조

```text
Cloudflare Cron Trigger
  → Collector v3 (gfgf, gggov, mpva)
  → crawl_runs / source_runs / raw_notices
  → Attachment Discovery → D1 Registry → Cloudflare Queue
  → direct download → in-memory PDF/HWPX/ZIP processor → field evidence
  → conservative classifier / dedupe / verification
  → opportunities / opportunity_sources
  → D1 repository
  → GrantViewModel
  → Public Explorer / Detail / protected Ops
```

일반 Cloudflare Worker가 `fetch()`와 `scheduled()`를 함께 제공합니다. Public과 Ops 화면은 모두 D1 repository를 사용하며 production에서 fixture fallback을 사용하지 않습니다. 테스트용 fixture만 `lib/data/fixtures.ts`에 격리되어 있고 unit test 이외의 import가 없습니다.

## 기술 스택

- TypeScript + React App Router
- vinext + Vite + Cloudflare Vite plugin
- Cloudflare Workers + D1 + Queues + Cron Trigger
- Drizzle schema와 비파괴 SQL migration
- Node test runner와 GitHub Actions

`wrangler.jsonc`가 Worker entrypoint, static assets, `DB` binding, preview/production 환경, Cron을 명시합니다. D1 resource ID는 저장소에 고정하지 않고 Wrangler automatic provisioning으로 별도 Beta DB를 생성하도록 둡니다.

## 화면과 데이터

- `/` — 실제 D1 Opportunity 기반 Public Explorer
- `/grants/:id` — D1 Detail → verification policy → GrantViewModel
- `/ops/review` — D1의 `PENDING` / `REVIEW_REQUIRED`
- `/ops/sources` — 17개 Source와 최신 source run, 최근 AUTOMATION run
- `POST /api/ops/collect` — 보호된 MANUAL 실행
- `/api/health` — 공개 상태 확인

Collector가 발견한 모든 후보는 `raw_notices`에 저장하지만, 청소년·모집/공모·시설/기관/단체/동아리/활동 문맥을 함께 만족한 보수적 후보만 Opportunity로 만듭니다. 신청 마감과 자격 근거를 확인할 수 없으면 `UNKNOWN` / `REVIEW_REQUIRED`로 저장하고 값을 추측하지 않습니다.

## 로컬 실행

```bash
npm ci
npm run db:migrate:local
npm run dev
```

수동 수집은 development 환경에서 별도 token 없이 테스트할 수 있습니다.

```bash
curl -X POST http://localhost:3000/api/ops/collect
curl http://localhost:3000/cdn-cgi/handler/scheduled
```

로컬에서도 Ops token 동작을 확인하려면 `.dev.vars.example`을 `.dev.vars`로 복사하고 실제 로컬 전용 값을 설정합니다.

## Cloudflare 배포

필수 Cloudflare 권한을 가진 뒤 다음 환경값을 로컬 shell 또는 GitHub Environment secret으로 설정합니다.

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `OPS_ACCESS_TOKEN`

Preview와 production은 서로 다른 Worker 및 D1 이름을 사용합니다.

Attachment Engine은 Queue consumer가 공식 attachment URL에서 파일을 직접 내려받아 메모리에서 처리합니다. 원본 binary와 전체 추출 문서는 저장하지 않으며, 검색 가능한 상태와 핵심 field evidence만 D1에 저장합니다.

```bash
npx wrangler queues create youthgrant-attachments-preview
npx wrangler queues create youthgrant-attachments
```

`wrangler.jsonc`의 `ATTACHMENT_QUEUE` binding은 preview/production Queue를 각각 연결합니다. Queue message에는 attachment 식별자와 URL만 포함되며 파일 bytes는 포함하지 않습니다. R2 binding은 사용하지 않습니다.

```bash
npm run deploy:preview
npm run deploy:production
```

첫 배포는 D1 binding을 자동 provision하고, migration을 적용한 뒤 최종 Worker를 다시 배포합니다. 운영 전에는 반드시 Ops secret도 설정합니다.

```bash
npx wrangler secret put OPS_ACCESS_TOKEN --env production
```

GitHub에서는 `Deploy Cloudflare Worker` workflow를 수동 실행합니다. Workflow가 bootstrap deploy, 비파괴 D1 migration, Ops secret 설정, 최종 deploy를 순서대로 수행합니다.

## Cron과 시간대

Cron 표현식은 `0 */6 * * *`이며 Cloudflare 규칙에 따라 UTC로 평가됩니다. 실행 시각은 UTC 00:00/06:00/12:00/18:00, Asia/Seoul 기준 09:00/15:00/21:00/다음 날 03:00입니다.

- DB timestamp: UTC ISO 8601 문자열
- UI 표시: `Asia/Seoul`로 변환
- scheduled run trigger: `AUTOMATION`
- 수동 run trigger: `MANUAL`

## Ops 보안

`/ops`, `/ops/**`, `/api/ops/**`는 Worker entrypoint에서 서버 측으로 보호합니다.

- development이고 token이 없을 때만 로컬 접근 허용
- preview/production에서 token이 없으면 `503`으로 Ops 비활성화
- token이 설정되면 HTTP Basic password 또는 Bearer token 필요
- Public `/`와 `/grants/**`, `/api/health`는 인증 없이 접근

따라서 Ops secret 누락이 Public 공개를 위해 Ops를 노출시키는 방향으로 실패하지 않습니다.

## Attachment 처리 정책

- PDF: text layer를 페이지 단위로 추출하며 텍스트가 부족하면 `OCR_REQUIRED`
- HWPX: ZIP/XML package 검증 후 section·paragraph·table 텍스트 추출
- HWP: 검증된 Workers parser가 없으면 `HWP_PARSER_BLOCKED`
- ZIP: path traversal 방어, 최대 200 entries, 25 MiB unpacked, nested depth 1
- JPG/PNG: 원본·크기 metadata 보존 후 `OCR_REQUIRED`
- attachment 단일 파일 한도: 10 MiB
- FORM 문서는 자동 deadline/eligibility의 주 근거로 사용하지 않음
- BODY와 attachment evidence가 충돌하면 자동 선택하지 않고 `REVIEW_REQUIRED`

처리가 끝나면 다운로드한 bytes와 전체 추출 결과는 폐기합니다. D1에는 attachment URL·파일명·MIME·역할·상태·처리 시각·짧은 field evidence와 오류만 남깁니다. 재처리가 필요하면 공식 attachment URL을 다시 내려받습니다.

## D1 schema

유지하는 9개 테이블:

`sources`, `crawl_runs`, `source_runs`, `raw_notices`, `attachments`, `opportunities`, `opportunity_sources`, `collection_locks`, `saved_opportunities`

Beta 0.3 migration은 기존 9개 테이블을 유지하면서 attachment 상태·field evidence pointer·집계 column을 추가합니다. 후속 경량화 migration은 사용하지 않는 R2 pointer column만 제거합니다.

`collection_locks`는 원자적 upsert와 20분 만료를 사용합니다. active lock 획득 실패 시 수집을 시작하지 않으며, 정상·오류 종료 모두 holder 기준으로 해제합니다.

## 검증

```bash
npm run typecheck
npm run lint
npm run unit
npm run build
npm run rendered
```

Secret, DB dump, `.env.local`, `.dev.vars`, Wrangler local state, build artifact는 커밋하지 않습니다.

## ChatGPT Sites 의존성 감사

제거됨:

- `.openai/hosting.json`
- `@openai/sites-vite-plugin`
- `sites()` Vite plugin
- `chatgpt.site` metadata fallback

계속 사용하지만 Sites 전용이 아님:

- vinext의 Cloudflare Worker 호환 App Router
- `@cloudflare/vite-plugin`
- `cloudflare:workers` binding access
- D1 schema와 migration

기존 ChatGPT Site 배포 자체는 변경하거나 삭제하지 않았으며 이 저장소의 배포·데이터·Scheduler 경로에서 참조하지 않습니다.
