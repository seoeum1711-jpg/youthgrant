# YouthGrant Public Beta

YouthGrant는 청소년시설 실무자가 검토할 가치가 있는 공모사업을 신청 가능 근거와 데이터 확인 상태로 찾는 서비스입니다. 이 저장소가 신규 코드베이스의 Source of Truth이며, 기존 Prototype 코드는 이관하지 않습니다.

## 기술 선택

- TypeScript + React App Router
- vinext + Vite의 Cloudflare Worker 호환 ESM 빌드
- Cloudflare D1 + Drizzle ORM
- Tailwind CSS 4는 빌드 파이프라인에만 사용하고, 최종 UI는 YouthGrant Ink & Teal 토큰으로 직접 구성
- Node test runner로 검증 정책·ViewModel·Collector 격리·dedupe 테스트

vinext는 Next 스타일의 route 구성을 유지하면서 Cloudflare Worker와 Sites 배포에 맞는 산출물을 만들 수 있어 선택했습니다. D1은 공고·수집 실행·근거·검토 상태처럼 관계형 조회가 필요한 영속 데이터에 사용합니다.

## 화면

- `/` — Public Grant Explorer와 필터
- `/grants/:id` — 신청 가능 근거 중심 Grant Detail
- `/ops/review` — 검토대기
- `/ops/sources` — 17개 Source Monitor

## 로컬 실행

```bash
npm ci
npm run dev
```

검증:

```bash
npm run typecheck
npm run lint
npm run unit
npm run build
```

## 데이터 정책

- 신청기간·접수기간·신청/접수 마감·제출 기한 문맥에서 검증된 날짜만 D-Day에 사용합니다.
- 행사일·교육일·사업기간·발표일·설명회 날짜는 deadline으로 추정하지 않습니다.
- 신청자격 문맥의 직접 근거가 없거나 허용/제한 조건이 충돌하면 신청 가능으로 노출하지 않습니다.
- 공고 원문과 Opportunity를 분리하고 `dedupe_key`로 반복 수집을 방지합니다.
- AI 없이도 수집, 검증 상태, 목록, 상세, Ops가 동작합니다.

## Collector v3 Beta

Registry에는 기존 17개 Source ID가 모두 있습니다. Beta 구현 대상은 `gfgf`, `gggov`, `mpva` 3개 공식 게시판입니다. 세 수집기는 동일한 `Collector → RawNotice[]` 계약을 따르고, 병렬 실행에서 Source별 실패가 격리됩니다. 미구현 Source는 Monitor에서 성공으로 표시하지 않습니다.

## 보안

실제 자격증명, API 키, DB dump, `.env.local`, 운영 백업을 커밋하지 않습니다. 공개 환경의 canonical origin만 `SITE_ORIGIN`으로 관리합니다.
