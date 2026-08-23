---
name: grant-source-collector
description: >
  YouthGrant에서 공공기관 WEB, RSS, API Source를 새로 추가하거나 기존 Collector를 수정할 때 사용한다.
  최대 수집량보다 데이터 신뢰성, 실패 감지, 중복 방지, 운영 가능성을 우선한다.
  Source 구현부터 실제 수집 검증, Ops 확인, 재실행 검증까지 동일한 절차로 수행한다.
---

# YouthGrant Grant Source Collector

## 1. 이 Skill을 언제 사용하는가

다음 작업에서 사용한다.

- 새로운 공공기관 공고 Source 추가
- 기존 WEB / RSS / API Collector 수정
- 사이트 구조 변경으로 Collector 복구
- Source URL 변경
- Parser 수정
- Source 수집 실패 원인 조사
- Source별 Attachment Discovery 확대
- 수집 결과가 갑자기 0건이 되었을 때 점검
- 기존 Source의 안정성 개선

단순 Public UI 수정, 검색/필터 UI 변경, Saved 기능 변경에는 사용하지 않는다.

---

# 2. 최우선 원칙

YouthGrant의 목표는 최대한 많은 페이지를 긁는 것이 아니다.

목표는:

1. 청소년수련시설 및 관련 기관이 신청할 수 있는 실제 공모·지원사업을 안정적으로 발견하고
2. 수집 실패를 정상적인 무결과와 구분하며
3. 확인되지 않은 데이터를 추정하지 않고
4. 중복을 최소화하고
5. 문제가 생겼을 때 운영자가 원인을 확인할 수 있게 하는 것

이다.

속도보다 신뢰성을 우선한다.

공고 수를 늘리기 위해 Relevance 기준이나 Verification 기준을 완화하지 않는다.

---

# 3. 현재 YouthGrant 환경

현재 프로젝트 구조를 기준으로 작업한다.

- TypeScript
- React
- vinext + Vite App Router
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Queues
- Drizzle ORM
- Wrangler
- GitHub
- Windows 개발 환경
- Public + Ops 구조

Supabase 또는 Vercel 기반 프로젝트로 재설계하지 않는다.

현재 Architecture를 유지한다.

---

# 4. Source를 추가하기 전에 먼저 확인할 것

새 Source 요청을 받았다고 바로 Collector부터 만들지 않는다.

먼저 해당 기관이 제공하는 공식 데이터 표면을 조사한다.

우선순위:

```text
공식 API
→ 공식 RSS
→ 안정적인 서버 렌더링 HTML
→ 일반 WEB 게시판
→ 동적 웹페이지
```

공식 API 또는 RSS가 충분히 제공되면 불필요한 WEB scraping을 먼저 선택하지 않는다.

---

# 5. 수집하지 않을 조건

다음 상황에서는 억지로 우회 구현하지 않는다.

- CAPTCHA
- 로그인 필수
- 지속적인 403 접근 차단
- 명시적 anti-bot
- 불안정한 비공개 endpoint
- 브라우저 세션에 과도하게 의존
- 공식적으로 더 적절한 API/RSS가 존재

이 경우:

```text
BLOCKED
PAUSED
NOT IMPLEMENTED
```

등 현재 Source 상태에 맞는 결과로 남기고 운영자에게 보고한다.

차단을 우회하는 자동화는 만들지 않는다.

---

# 6. Source Registry 원칙

각 Source는 최소 다음 정보를 명확히 가진다.

```text
id
name
method
region
url
implemented
enabled
health
```

의미:

## implemented

Collector 코드가 존재하는가.

## enabled

현재 자동수집에서 실행하는가.

다음 세 상태를 혼동하지 않는다.

```text
implemented=true, enabled=true
→ ACTIVE

implemented=true, enabled=false
→ PAUSED

implemented=false
→ NOT IMPLEMENTED
```

PAUSED Source의 코드를 삭제하지 않는다.

과거 source_runs 또는 raw data도 삭제하지 않는다.

---

# 7. Source 구현 전 결정할 정책

새 Collector를 작성하기 전에 최소 다음을 결정한다.

- Source method
- 공식 Source URL
- 목록 URL
- 상세 URL 구조
- source notice id 존재 여부
- parserVersion
- timeout
- retry 가능 오류
- attachment discovery 지원 여부
- 최대 수집 개수 또는 페이지 범위

모든 Source에 동일한 사이트별 속도 설정을 강제하지 않는다.

실제 근거가 없는 요청 간격이나 병렬 수치를 임의로 복사하지 않는다.

---

# 8. HTTP 요청 기본 정책

YouthGrant 외부 Source 요청은 무한정 기다리지 않는다.

현재 기본 hard timeout:

```text
20 seconds
```

공통 Fetch Policy를 우선 사용한다.

Collector마다 timeout / retry 코드를 중복 작성하지 않는다.

---

# 9. Retry 정책

자동 Retry 후보:

```text
network transient error
timeout
HTTP 408
HTTP 429
HTTP 500
HTTP 502
HTTP 503
HTTP 504
```

현재 기본:

```text
initial request
+ maximum 2 retries
= maximum 3 attempts
```

무한 retry 금지.

---

# 10. Retry하지 않는 오류

다음은 기본적으로 자동 반복하지 않는다.

```text
400
401
404
대부분의 기타 4xx
```

403은 자동 우회하지 않는다.

```text
403
→ ACCESS_BLOCKED
→ retry 없음
```

CAPTCHA 또는 로그인벽을 발견해도 browser automation으로 자동 우회하지 않는다.

---

# 11. Backoff

Retry에는 bounded backoff를 사용한다.

현재 기본:

```text
첫 번째 retry → 약 1초
두 번째 retry → 약 2초
```

필요 이상으로 길게 기다리지 않는다.

`Retry-After`가 존재하고 합리적인 값이면 우선 존중한다.

현재 최대 backoff 범위를 초과하는 값을 그대로 기다리지 않는다.

---

# 12. Source 결과 분류

다음 세 상태를 반드시 구분한다.

## SUCCESS_WITH_ITEMS

요청과 파싱이 정상이며 공고가 1개 이상 존재.

## SUCCESS_NO_ITEMS

요청과 파싱은 정상이나 현재 조건에 맞는 공고가 없음.

## FAILED

HTTP, network, timeout, parser 등으로 정상 수집 완료하지 못함.

0건이라는 이유만으로 FAILED 처리하지 않는다.

FAILED인데 0건 성공으로 기록하지도 않는다.

---

# 13. Error Classification

가능하면 기존 Source Run의 다음 데이터를 활용한다.

```text
result
http_status
parser_version
error_code
error_message
```

최소 다음 유형을 식별할 수 있어야 한다.

```text
FETCH_TIMEOUT
RATE_LIMITED
ACCESS_BLOCKED
HTTP_CLIENT_ERROR
HTTP_SERVER_ERROR
NETWORK_ERROR
PARSER_ERROR
COLLECTOR_ERROR
```

새 오류 체계를 만들기 위해 과도한 DB 구조 변경을 하지 않는다.

---

# 14. Parser 원칙

공고 페이지 전체를 무차별적으로 Opportunity로 만들지 않는다.

Source 특성에 맞는 후보만 추출한다.

최소 보존:

```text
source id
source notice id
title
original URL
published date
raw text
collected time
parser version
dedupe key
```

Parser가 HTML 구조 변화 때문에 0건을 반환할 수 있음을 항상 고려한다.

---

# 15. 0건 결과 해석

`SUCCESS_NO_ITEMS`는 정상 상태일 수 있다.

공모사업은 계절성이 있으므로:

```text
0건
≠ 즉시 Parser 장애
```

다만 다음이 반복되면 구조 변경을 의심할 수 있다.

- 기존에 꾸준히 결과가 있던 Source의 연속 0건
- HTTP 200인데 selector 결과가 계속 없음
- 목록 레이아웃이 변경됨
- source notice id 추출이 갑자기 전부 실패
- 평소 대비 비정상적 감소

현재 자동 Source Health 정책이 없다면 이를 자동 확정하지 말고 운영자 검토 대상으로 남긴다.

---

# 16. Dedupe 원칙

## Source 내부

가능한 경우 우선순위:

```text
source notice id
→ canonical URL
→ normalized title fallback
```

동일 Source에서 같은 공고를 반복 생성하지 않는다.

재수집 시 신규 Opportunity 대신 기존 Raw Notice / Opportunity가 정상적으로 matched 또는 updated 되는지 확인한다.

---

# 17. Cross-source Dedupe

다른 Source에서 동일 사업이 게시될 수 있다.

하지만 단순 제목 유사도만으로 자동 merge하지 않는다.

잘못된 merge는 중복 노출보다 위험하다.

향후 후보 탐지에 사용할 수 있는 정보:

```text
normalized title
organization
official notice number
deadline
published date
canonical URL
```

현재 자동 fuzzy merge 정책이 확정되지 않았다면 구현하지 않는다.

실제 Beta 중복 사례를 먼저 수집한다.

---

# 18. Relevance Gate

Collector는 많은 후보를 찾는 역할이고,
Public 여부는 Relevance Gate가 판단한다.

다음 원칙을 유지한다.

YouthGrant IN_SCOPE의 기본 개념:

> 기관·시설·단체가 신청 주체가 되어
> 사업 또는 프로그램을 수행하고
> 그 수행에 대한 재정적 지원을 받는 공고

단순:

- 참가자 모집
- 교육 참여
- 캠프
- 행사
- 공모전
- 우수사례
- 이야기 제출
- 협조 요청
- 채용
- 위원 모집

등을 공모·지원사업으로 확정하지 않는다.

Collector Source를 추가했다는 이유로 Relevance 기준을 느슨하게 하지 않는다.

---

# 19. 확인되지 않은 정보

YouthGrant 데이터 원칙:

```text
unknown
→ 확인 필요
```

다음 행위를 하지 않는다.

- 행사일을 신청 마감일로 추정
- 사업기간을 접수기간으로 사용
- 게시일을 신청 시작일로 추정
- 시설명이 등장했다는 이유만으로 신청 가능 판단
- 지원 관련 단어가 있다는 이유만으로 재정지원 확정
- Source 지역을 eligible region으로 자동 사용

근거가 없으면 그대로 미확정 상태로 둔다.

---

# 20. Attachment Discovery

Source 구현 시 반드시 현재 Attachment Discovery 지원 여부를 확인한다.

상태:

```text
PENDING
COMPLETE
UNSUPPORTED
FAILED
```

## PENDING

아직 탐색하지 않음.

## COMPLETE

지원되는 상세 페이지에서 실제 Attachment Discovery를 수행하고 정상 종료.

첨부 0건이어도 가능.

## UNSUPPORTED

현재 해당 Source/detail 구조를 YouthGrant가 지원하지 않음.

## FAILED

지원 대상이지만 Fetch 또는 분석에 실패.

절대:

```text
UNSUPPORTED
→ []
→ COMPLETE
```

로 기록하지 않는다.

---

# 21. Attachment 확대 작업

새 Source에서 Attachment가 중요하다면 상세페이지 구조를 조사한다.

확인 대상:

```text
PDF
HWPX
HWP
ZIP
이미지
다운로드 endpoint
attachment id
content-disposition
```

현재 YouthGrant가 지원하지 않는 형식을 억지로 자동 확정하지 않는다.

HWP parser 또는 OCR이 실제 환경에서 지원되지 않으면 해당 상태를 그대로 기록한다.

---

# 22. Attachment Evidence

Attachment 분석은 본문보다 더 강한 근거가 될 수 있지만,
충돌을 무시하지 않는다.

본문과 Attachment가 충돌하면 자동으로 한쪽을 선택하지 않는다.

```text
BODY vs ATTACHMENT conflict
→ REVIEW_REQUIRED
```

기존 Verification 정책을 유지한다.

---

# 23. Collector 실행 구조

현재 Source 수집은 순차 실행을 기본으로 한다.

새 Source 추가를 이유로 임의로:

```text
Promise.all
Promise.allSettled
high concurrency
```

로 바꾸지 않는다.

실제 실행시간 병목이 확인되기 전까지 안정성을 우선한다.

---

# 24. Rate Limit

현재 YouthGrant는 모든 Source를 동일한 속도로 병렬 수집하는 구조가 아니다.

따라서 새 Source 하나 때문에 전체 rate limiter architecture를 만들지 않는다.

실제 429/403 또는 운영 문제가 확인되면 해당 Source 특성을 근거로 확장한다.

추측 기반의 속도 최적화를 하지 않는다.

---

# 25. 브라우저보다 HTTP를 우선하는 조건

서버 렌더링 HTML, RSS, API로 데이터를 안정적으로 읽을 수 있으면 일반 HTTP 요청을 우선한다.

Browser automation은 다음 이유만으로 추가하지 않는다.

```text
HTTP Collector 구현이 귀찮다
selector가 조금 복잡하다
```

브라우저가 반드시 필요한 구조인지 먼저 증명한다.

---

# 26. 새 Source 구현 순서

새 Source 추가 시 아래 순서를 따른다.

## Step 1 — 조사

확인:

```text
기관
공고 게시판
API
RSS
HTML 구조
상세 URL
attachment 구조
실제 최근 공고
```

---

## Step 2 — Source Definition

Registry에 Source를 등록한다.

초기에는 실제 Collector가 준비되지 않았다면:

```text
implemented=false
enabled=false
```

로 둔다.

---

## Step 3 — Collector

가장 단순한 공식 데이터 경로를 사용해 Collector를 구현한다.

기존 공통:

```text
Fetch Policy
Dedupe
Source Run
Relevance
Attachment
```

구조를 재사용한다.

---

## Step 4 — Known Notice 검증

가능하면 실제 공식 게시판에 존재하는 최근 공고 최소 1건을 기준으로 확인한다.

검증:

```text
title
URL
published date
source notice id
raw text
```

수집 결과와 원문을 비교한다.

---

## Step 5 — Relevance 검증

해당 Known Notice가 YouthGrant 목적에 맞는지 확인한다.

자동으로 Public에 노출시키기 위해 Gate를 우회하지 않는다.

---

## Step 6 — Attachment

해당 Source의 Attachment Discovery:

```text
COMPLETE
UNSUPPORTED
FAILED
```

상태가 실제 구조와 일치하는지 확인한다.

---

## Step 7 — 1차 실행

기록:

```text
found
new
updated
matched
analyzed
result
HTTP
parserVersion
error
```

---

## Step 8 — 2차 실행

같은 Source를 다시 실행한다.

확인:

```text
불필요한 NEW 생성 없음
duplicate 없음
기존 Notice matched/update
```

2차 실행에서 동일한 Opportunity가 반복 생성되면 완료로 간주하지 않는다.

---

## Step 9 — Ops 확인

`/ops/sources`에서 확인한다.

- ACTIVE 상태
- 최근 실행
- found / new
- result
- HTTP
- parserVersion
- error
- Attachment 상태

운영자가 문제를 알아볼 수 있어야 한다.

---

# 27. Source를 ACTIVE로 전환하는 조건

다음 조건을 만족한 뒤 활성화한다.

```text
Collector implementation 완료
Known Notice 검증
1차 실행 정상
2차 실행 중복 없음
Ops에서 결과 확인 가능
failure behavior 확인
```

단순히 코드가 빌드된다는 이유만으로 ACTIVE 처리하지 않는다.

---

# 28. 실패 시 보고

다음 중 하나가 발생하면 숨기지 않는다.

```text
API key 필요
403
429 반복
CAPTCHA
HTML 구조 불안정
attachment unsupported
encoding 문제
known notice 미수집
unexpected 0
```

작업 결과는:

```text
READY
PARTIAL
BLOCKED
```

중 하나로 명확히 보고한다.

---

# 29. Stop Condition

다음 상황에서는 시간을 무한히 쓰지 않는다.

- 접근 자체가 구조적으로 차단됨
- 비공개 API 의존
- CAPTCHA 지속
- JS 세션 없이는 불가능하며 유지가 불안정
- 공식 Source 변경 가능성이 매우 높음
- 의미 있는 지원사업 밀도가 지나치게 낮음

이 경우 우회책을 계속 만들기보다 PAUSED/BLOCKED 판단을 제안한다.

---

# 30. 테스트 원칙

새 Source 또는 Collector 수정 시 변경 범위 테스트를 작성한다.

최소 고려:

```text
normal response
no items
HTTP failure
timeout
retry
parser behavior
dedupe
```

실제 외부 사이트를 unit test의 필수 dependency로 만들지 않는다.

Fetcher fixture/injection을 우선한다.

---

# 31. Production 검증

가능한 경우 배포 후 실제 운영 Source를 확인한다.

무리하게 반복 수집하지 않는다.

최소 확인:

```text
Public 200
Ops auth 유지
Source Run 생성
result 정상
Seoul API 등 PAUSED Source 미실행
중복 없음
Attachment 상태 정상
```

Secret을 읽거나 노출해서 테스트하지 않는다.

---

# 32. Public 보호 원칙

Source 추가 작업은 Public UI redesign 작업이 아니다.

다음 영역은 별도 요청이 없으면 건드리지 않는다.

```text
Hero
Header
Footer
Search UI
Filter UI
Saved UI
Grant Card
Mobile layout
DATA PRINCIPLE
```

Source 작업 때문에 사용자 경험을 불필요하게 변경하지 않는다.

---

# 33. Ops Auth 보호

현재 Ops authentication 구조를 Source 추가 때문에 변경하지 않는다.

새 인증 시스템을 함께 만들지 않는다.

---

# 34. Git 원칙

작업 완료 후:

```text
typecheck
lint
관련 unit tests
build
```

를 확인한다.

성공 후 commit/push한다.

한 Source 추가 작업에 무관한 refactor를 섞지 않는다.

대규모 formatting diff도 만들지 않는다.

---

# 35. 완료 보고 형식

새 Source 작업을 끝낼 때 아래 형식으로 보고한다.

## A. Result

```text
READY / PARTIAL / BLOCKED
```

## B. Source

```text
id:
name:
method:
region:
implemented:
enabled:
parserVersion:
```

## C. HTTP

```text
timeout:
retry:
backoff:
last HTTP:
failure behavior:
```

## D. Collection

```text
1차 found:
1차 new:
1차 updated:
1차 matched:

2차 found:
2차 new:
2차 updated:
2차 matched:
```

## E. Known Notice

```text
official notice:
collected:
title match:
URL match:
relevance:
```

## F. Attachment

```text
support:
status:
discovered:
parse:
```

## G. Ops

```text
Source Monitor:
result:
error visibility:
```

## H. Tests

```text
typecheck:
lint:
unit:
build:
```

## I. Git

```text
commit:
push:
working tree:
```

---

# 36. 완료 정의

Source Collector 작업은 다음을 만족해야 완료다.

1. 공식 Source를 사용한다.
2. 외부 요청은 timeout 정책을 따른다.
3. transient failure는 bounded retry만 사용한다.
4. 차단을 우회하지 않는다.
5. 정상 0건과 실패를 구분한다.
6. 동일 Source의 공고를 중복 생성하지 않는다.
7. Relevance Gate를 우회하지 않는다.
8. 확인되지 않은 데이터를 추정하지 않는다.
9. Attachment 지원 여부를 정확히 기록한다.
10. 실제 Known Notice로 Collector 결과를 검증한다.
11. 재실행 시 idempotency를 확인한다.
12. Ops에서 운영자가 상태와 실패 원인을 확인할 수 있다.
13. Public Beta 기존 기능에 회귀가 없다.

---

# 37. 이 Skill이 하지 않는 일

이 Skill을 사용한다고 해서 자동으로 다음을 수행하지 않는다.

- 모든 Source 추가
- Cross-source fuzzy merge
- Source 병렬화
- CAPTCHA 우회
- 로그인 자동화
- DOM parser 전면 교체
- 자동 Source Health engine 구축
- 알림 시스템 구축
- Public UI redesign
- Account/Auth 추가
- Saved 동기화
- Relevance 기준 완화

각 작업은 실제 운영 필요가 확인될 때 별도로 판단한다.

---

# 38. 핵심 판단 기준

새로운 자동화나 기술을 추가하기 전에 항상 묻는다.

> 이 변경이 YouthGrant 사용자가 실제 지원기회를 더 정확하게 발견하게 하는가?

또는

> 이 변경이 운영자가 수집 실패를 더 빨리 발견하고 복구하게 하는가?

둘 다 아니라면 지금은 하지 않는다.

YouthGrant는 크롤러 프로젝트가 아니다.

**신뢰할 수 있는 청소년시설 공모·지원사업 탐색 서비스가 최종 제품이다.**
