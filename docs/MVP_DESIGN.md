# Re:Start Quest MVP 설계

## 0. 설계 기준선과 출처

이 문서는 TASK-002의 명시적 제품 요청과 `origin/main`의 기준선 commit
`1ee04def44b7c0c63d6f758b4fa8f9bf7297654b`만을 출발점으로 삼는다. 제품 선택의
근거는 `docs/PROJECT_BRIEF.md`, 구현자가 따라야 할 제품·도메인·API·화면 계약은
이 문서가 정본이다.

PR #99, branch `agentflow/task-002-dag-ea40380f33-06-release-stack-backend-infra`,
head `6404e5bda5fb7f3e205d4c9769ef7262398267dc`와 그 밖의 과거 worker ref는 비교
자료일 뿐이다. 새 구현 패키지, 정본 통합 head, 제품 PASS, publish 또는 merge의
출처로 가져오지 않는다. 아래 모든 패키지는 `sourceImport` 없이 main 계보에서 새로
구현하며, 승인되지 않은 worker SHA를 ancestry에 포함한 통합 결과는 폐기한다.

## 1. 제품 결정

### 사용자와 문제

Re:Start Quest는 취업 준비가 중단된 사용자가 죄책감이나 큰 계획 때문에 다시 시작하지 못할 때, 지금 실행 가능한 한 가지 행동으로 복귀하도록 돕는다. 정보 탐색량이나 계획의 완성도가 아니라 **작은 행동을 실제로 다시 시작했는지**를 제품 가치로 본다.

핵심 가설은 다음과 같다.

> 사용자가 현재 여력에 맞는 작은 행동을 받고, 실행하지 못한 이유에 따라 더 쉬운 행동으로 즉시 바꿀 수 있으면 중단 이후의 재진입 비용이 낮아진다.

### 핵심 사용자 흐름

```text
랜딩
-> 익명 세션 시작
-> 목표 영역, 에너지, 가용 시간 입력
-> 현재 행동 1개 확인
-> 완료: 기록과 다음 행동 확인
   또는
   어려움: 마찰 이유 선택 -> 더 쉬운 행동 확인
-> 새로고침 후 현재 행동과 최근 기록 복원
```

첫 진입의 단일 CTA는 `오늘의 작은 행동 만들기`다. 서비스는 가입이나 긴 진단을 먼저 요구하지 않는다.

### 비목표와 금지 범위

- 사용자의 실패를 점수, 연속 출석, 경고 문구로 압박하지 않는다.
- 정신건강 진단, 치료 조언, 취업 성공 보장을 제공하지 않는다.
- 자유 입력을 외부 LLM에 전송하거나 AI가 행동을 임의 생성하지 않는다.
- 채용 공고를 수집·추천하거나 외부 사이트를 스크래핑하지 않는다.
- 계정, OAuth, 이메일, 전화번호, 실명, 이력서 파일을 수집하지 않는다.
- 관리자 화면, 결제, 소셜 피드, 알림, 캘린더 연동을 MVP에 넣지 않는다.
- 클라우드 운영 계정과 실제 운영 배포는 구현 패키지에 포함하지 않는다.

## 2. MVP와 후순위

### MVP 포함

- 서버가 발급한 익명 쿠키 세션과 세션별 데이터 격리
- 목표 영역 3개, 에너지 3단계, 가용 시간 3단계 입력
- 버전 관리되는 결정적 행동 카탈로그에서 현재 행동 1개 선택
- 현재 행동 완료와 다음 행동 연결
- 마찰 이유 기록과 더 쉬운 행동으로의 재설계
- 완료 수, 재설계 수, 최근 5개 기록 표시
- 모바일 우선 반응형 UI, 키보드 접근, 오류·재시도 상태
- 재현 가능한 로컬 release stack과 핵심 흐름 E2E

### 후순위

- 로그인 후 여러 기기 동기화와 익명 기록 이전
- 사용자 정의 목표·행동과 카탈로그 운영 도구
- 알림, 캘린더, 주간 회고, 장기 추세
- 채용 공고·이력서·포트폴리오 도구 연동
- 실험 플랫폼, 제품 분석, 개인화 추천, 생성형 AI
- 다국어, 네이티브 앱, 실제 클라우드 배포 자동화

후순위 기능은 MVP 도메인 상태 전이를 깨지 않는 별도 계약으로 추가한다.

## 3. 도메인 계약

### 값과 상태

| 개념 | 결정 |
| --- | --- |
| `GoalType` | `JOB_SEARCH`, `RESUME`, `NETWORKING` 세 값만 허용한다. |
| `EnergyLevel` | `LOW`, `MEDIUM`, `HIGH`다. 낮을수록 더 짧고 준비가 적은 행동을 선택한다. |
| `AvailableMinutes` | `5`, `15`, `30`만 허용한다. |
| `FrictionReason` | `TOO_BIG`, `UNCLEAR`, `LOW_ENERGY`, `MISSING_MATERIAL`, `OTHER`다. `OTHER`도 자유 텍스트를 받지 않는다. |
| `QuestStatus` | `ACTIVE`, `COMPLETED`, `REFRAMED`다. 한 여정에는 `ACTIVE`가 최대 하나다. |
| `difficultyLevel` | `1..3`이며 `1`이 가장 쉽다. |
| `Journey.version` | 변경 명령마다 1 증가하는 낙관적 잠금 값이다. |

### 핵심 엔터티

- `ParticipantSession`: 임의의 256-bit 토큰으로 식별한다. 원문 토큰은 `HttpOnly` 쿠키에만 두고 DB에는 SHA-256 digest와 만료 시각만 저장한다.
- `Journey`: 익명 세션에 하나만 존재하며 목표, 현재 에너지, 가용 시간, 버전을 보유한다.
- `QuestAttempt`: 카탈로그 key의 한 번의 제안이다. 제목, 안내, 예상 시간, 난이도는 생성 당시 snapshot으로 보존한다.
- `CommandReceipt`: `commandId`와 응답을 저장해 네트워크 재시도에서 같은 변경을 두 번 적용하지 않는다.

### 불변조건과 전이

1. 한 세션은 다른 세션의 여정이나 시도에 접근할 수 없다.
2. 여정에는 활성 행동이 정확히 하나 존재한다. 최초 생성, 완료, 재설계는 모두 다음 활성 행동을 같은 트랜잭션에서 만든다.
3. 완료 명령은 현재 `ACTIVE` 행동을 `COMPLETED`로 바꾸고, 같은 목표에서 다음 행동을 만든다.
4. 재설계 명령은 현재 행동을 `REFRAMED`로 바꾸고 `parentAttemptId`로 연결한 새 행동을 만든다.
5. 재설계는 난이도 또는 예상 시간을 낮춰야 한다. 이미 최저 단계이면 2분 이하의 안전한 fallback 행동을 사용한다.
6. 같은 세션의 같은 `commandId`는 최초 응답을 재생한다. 다른 payload에 같은 ID를 쓰면 `409 COMMAND_ID_REUSED`다.
7. `expectedVersion`이 현재 값과 다르면 변경하지 않고 `409 STALE_JOURNEY`와 최신 snapshot을 반환한다.
8. 카탈로그 선택은 `(goalType, energyLevel, availableMinutes, 이전 행동, frictionReason)`으로 결정 가능해야 하며 외부 AI 호출이나 무작위 결과를 사용하지 않는다.

### 결정적 행동 카탈로그 예

| 목표 | 보통 행동 | 더 쉬운 행동 | 최저 fallback |
| --- | --- | --- | --- |
| 구직 | 조건에 맞는 공고 1개 저장 | 검색어 1개 적기 | 채용 사이트 탭 열기 |
| 이력서 | 경험 항목 문장 1개 고치기 | 경험 키워드 3개 적기 | 이력서 파일 위치 확인하기 |
| 네트워킹 | 지인 1명에게 안부 초안 쓰기 | 연락할 사람 이름 1명 적기 | 연락처 앱 열기 |

문구는 비난하지 않고 하나의 관찰 가능한 동사로 시작한다. `열심히 하기`, `준비하기`처럼 완료 여부가 모호한 행동은 카탈로그에 넣지 않는다.

## 4. HTTP API v1

모든 응답은 JSON이며 시간은 UTC ISO-8601, 식별자는 UUID다. 운영에서는 프런트와 API를 같은 origin으로 제공한다. 개발 CORS는 명시한 localhost origin만 허용하고 credential을 사용한다. 상태 변경 요청은 JSON content type과 허용된 `Origin`을 검증한다.

### 엔드포인트

| Method/Path | 요청 | 성공 | 주요 오류 |
| --- | --- | --- | --- |
| `POST /api/v1/session` | 없음 | `200` 기존 세션 또는 `201` 새 세션, `Set-Cookie` | `500` |
| `POST /api/v1/journey` | `goalType`, `energyLevel`, `availableMinutes`, `commandId` | `201` 여정 생성과 snapshot | `400 VALIDATION_ERROR`, `401 SESSION_REQUIRED`, `409 JOURNEY_ALREADY_EXISTS`, `409 COMMAND_ID_REUSED` |
| `GET /api/v1/journey` | 없음 | `200 JourneySnapshot` | `401 SESSION_REQUIRED`, `404 JOURNEY_NOT_FOUND` |
| `POST /api/v1/quests/{questId}/complete` | `commandId`, `expectedVersion` | `200 TransitionResult` | `401`, `404`, `409 STALE_JOURNEY`, `409 QUEST_NOT_ACTIVE` |
| `POST /api/v1/quests/{questId}/reframe` | `reason`, `commandId`, `expectedVersion` | `200 TransitionResult` | `400`, `401`, `404`, `409` |
| `GET /actuator/health` | 없음 | release stack health 용도의 최소 상태 | `503` |

`JourneySnapshot`의 정본 shape은 다음 필드다.

```json
{
  "journeyId": "uuid",
  "goalType": "JOB_SEARCH",
  "energyLevel": "LOW",
  "availableMinutes": 5,
  "version": 3,
  "currentQuest": {
    "id": "uuid",
    "catalogKey": "job-search-open-tab-v1",
    "title": "채용 사이트 탭 열기",
    "instruction": "사이트를 열면 오늘 행동은 끝입니다.",
    "estimatedMinutes": 2,
    "difficultyLevel": 1
  },
  "progress": {
    "completedCount": 1,
    "reframedCount": 1
  },
  "recentAttempts": []
}
```

`TransitionResult`는 `transition.type`, 직전 시도의 식별자, 갱신된 `snapshot`을 포함한다. 오류는 `{ "code", "message", "fieldErrors" }` 형태이며 사용자용 `message`에 stack trace나 내부 식별자를 넣지 않는다.

### 세션과 보존

- 쿠키 이름은 `rq_session`, path는 `/`, `HttpOnly`, `SameSite=Lax`다. 운영 HTTPS에서는 `Secure`를 강제한다.
- 만료는 마지막 활동 기준 30일이며 만료된 세션은 인증되지 않은 것처럼 처리한다.
- 브라우저 저장소에는 세션 토큰을 복제하지 않는다.
- MVP는 탈퇴 계정이 없으므로 만료된 서버 기록 정리와 브라우저의 쿠키 만료만 적용한다. 운영 전 개인정보·보존 정책 검토는 별도 승인 항목이다.

## 5. 화면과 상호작용

### 라우트

- `/`: 한 문장 가치 제안, 핵심 흐름 3단계, 단일 시작 CTA
- `/start`: 목표, 에너지, 가용 시간을 한 화면에서 선택하는 짧은 설정
- `/quest`: 현재 행동, 완료/어려움 행동, 재설계 sheet, 결과 feedback, 최근 기록

직접 URL 진입 시 앱은 먼저 세션과 여정을 복원한다. 여정이 없으면 `/start`로, 여정이 있으면 `/quest`로 보낸다. API 실패는 빈 화면이나 무한 spinner 대신 동일 화면에서 재시도 버튼을 제공한다.

### 정보 우선순위

1. 현재 행동의 제목
2. 완료 기준이 드러나는 한 문장 안내와 예상 시간
3. `완료했어요` primary action
4. `지금은 어려워요` secondary action
5. 완료 수와 최근 기록

재설계 sheet는 마찰 이유 다섯 개를 단일 선택으로 보여주고 `더 쉬운 행동 받기`를 실행한다. `실패`, `의지`, `연속 기록이 끊김` 같은 표현은 사용하지 않는다.

### 시각·반응형 기준

- 본문은 최대 720px 읽기 폭, 16px 이상, line-height 1.5 이상으로 유지한다.
- 360px에서 주요 버튼은 세로로 배치하고 최소 44px 터치 영역을 확보한다.
- 768px 이상에서도 핵심 행동 카드를 여러 카드 열로 쪼개지 않는다.
- 상태는 색만으로 구분하지 않고 아이콘 또는 텍스트를 함께 사용한다.
- focus indicator, label, heading 순서, `aria-live` 결과 알림을 제공한다.
- `prefers-reduced-motion`에서는 완료 feedback의 이동 효과를 제거한다.
- 검증 viewport는 `360x800`, `768x1024`, `1280x800`이다.

### 로딩·오류·중복 입력

- 변경 요청 동안 해당 버튼만 disabled하고 진행 문구를 표시한다.
- 브라우저 재시도는 같은 `commandId`를 사용한다. 사용자가 새 행동을 명시적으로 다시 누를 때만 새 ID를 만든다.
- `STALE_JOURNEY`는 서버가 준 최신 snapshot으로 교체하고 `다른 요청이 먼저 반영되어 최신 상태를 불러왔어요.`라고 알린다.
- 세션 만료는 시작 화면으로 보내기 전에 `세션이 만료되어 새로 시작합니다.`라고 설명한다.

## 6. 구현 기준과 slice backlog

기술 기준은 Java 21 + Spring Boot 3 + Gradle, PostgreSQL + Flyway, React + TypeScript + Vite다. 테스트는 backend 단위/DB 통합, frontend component, Playwright E2E로 분리한다. 실제 버전은 `mvp-backend-core`와 `mvp-frontend-shell`이 각 생태계에서 서로 호환되는 안정 버전을 선택해 wrapper 또는 lockfile과 함께 고정한다.

### Slice 1: 계약을 실행하는 독립 제품 절반

- 목적: 정본 API 계약을 구현하는 backend와 접근 가능한 frontend shell을 서로 독립적으로 만든다.
- 사용자 흐름: API에서는 세션 생성부터 완료·재설계까지 검증하고, 브라우저에서는 세 라우트와 빈·로딩·오류 boundary에 진입한다.
- backend: 앱, migration, 익명 세션, 여정·행동 전이, idempotency, stale-version, health를 하나의 소유 패키지에서 구현한다.
- frontend: 토큰·타이포·버튼·layout과 라우팅 shell만 만들고 backend 파일을 수정하지 않는다.
- QA: backend의 양성·음성·실패·DB 통합 테스트와 frontend shell의 component/lint/build 및 세 viewport를 source head별로 분리해 확인한다.
- 제외: 실제 API client/store 연결, 완성된 사용자 여정, release container.
- 다음 진입 조건: `mvp-backend-core`와 `mvp-frontend-shell`의 독립 검증 통과.

### Slice 2: 브라우저 재진입 루프

- 목적: 완료와 어려움 두 경로를 request lifecycle과 함께 브라우저에서 동작하게 한다.
- 사용자 흐름: 설정 -> 행동 -> 완료 또는 재설계 -> 다음 행동이다.
- backend: Slice 1에서 검증된 계약을 제공하며 frontend/release 파일을 수정하지 않는다.
- frontend: typed API client와 상태 저장소를 먼저 만들고, 이어 세 화면과 접근 가능한 feedback을 연결한다.
- QA: loading, empty, error, success, 세션 만료, stale 응답, 늦게 도착한 응답 무시, 중복 클릭과 reload 사례를 검증한다.
- 제외: 로그인, 자유 입력, 개인화 AI.
- 다음 진입 조건: `mvp-frontend-state`와 `mvp-frontend-journey`의 독립 검증 통과.

### Slice 3: 릴리스 후보

- 목적: 하나의 통합 head에서 신규·완료·재설계·복원 흐름을 재현한다.
- 사용자 흐름: 깨끗한 브라우저와 재방문 브라우저의 전체 흐름이다.
- backend: production image와 DB health/readiness를 제공한다.
- frontend: production image에서 same-origin `/api` proxy를 사용한다.
- QA: compose smoke, Playwright, responsive/a11y smoke, session 격리를 검증한다.
- 제외: 클라우드 계정 생성과 운영 배포.
- 완료 조건: `mvp-release-stack`과 독립 `mvp-release-e2e`가 새 immutable 통합 head에서 통과하고 runbook의 실행·health check·rollback이 재현된다.

### 실행 패키지

| packageId | 역할 | 실제 선행 조건 | 실행 목표와 소유 경로 | 패키지 완료 조건 |
| --- | --- | --- | --- | --- |
| `mvp-backend-core` | `backend` | 없음 | `backend/`의 build, session, schema, journey/quest API와 테스트를 새로 만든다. frontend와 release 파일은 수정하지 않는다. | 세션 격리, 원자적 다음 행동 생성, command replay/reuse, stale version, 비활성 quest, rollback을 양성·음성·실패 회귀로 검증하고 backend test와 health test를 통과한다. |
| `mvp-frontend-shell` | `frontend-ui` | 없음 | `frontend/`의 package 설정, 공용 app/style/component, 라우팅과 화면 boundary를 만든다. API/store 기능은 만들지 않는다. | `/`, `/start`, `/quest`의 heading/focus 구조와 loading·empty·error·success shell을 component test, lint, build와 `360x800`·`768x1024`·`1280x800`에서 검증한다. |
| `mvp-frontend-state` | `frontend-state` | `mvp-frontend-shell` | `frontend/src/api/`, `frontend/src/state/`에서 정본 API shape, credential 요청, command ID와 request lifecycle을 구현한다. | 성공·400·401·404·409, 동일 command 재시도, stale snapshot 교체, session 만료, 취소·늦은 응답 무시를 단위 테스트로 검증한다. |
| `mvp-frontend-journey` | `frontend-ui` | `mvp-frontend-shell`, `mvp-frontend-state` | `frontend/src/features/`, `frontend/src/routes/`에서 랜딩·설정·현재 행동·재설계·최근 기록 흐름을 연결한다. | 완료와 재설계, reload 복원, 재시도, 키보드, `aria-live`, reduced motion과 세 viewport의 overflow 없는 화면을 component/integration test로 검증한다. |
| `mvp-release-stack` | `backend-infra` | `mvp-backend-core`, `mvp-frontend-journey` | backend/frontend Dockerfile, `compose.yaml`, same-origin proxy, `ops/` smoke와 `docs/RUNBOOK.md`만 소유한다. 도메인 결함은 이 패키지에서 우회하지 않는다. | PostgreSQL readiness 뒤 API health가 되고 `/api/v1/**` proxy, secure-cookie 환경 주입, compose config/smoke가 통과하며 runbook에 백업·실행·health·로그·비파괴 rollback이 있다. |
| `mvp-release-e2e` | `backend-infra` | `mvp-backend-core`, `mvp-frontend-journey`, `mvp-release-stack` | 독립 `e2e/` workspace에서 검증된 backend, frontend, release stack만 소비하는 release acceptance suite를 만든다. 제품·container 구현 파일은 수정하지 않는다. | 새 integration head와 깨끗한 browser context에서 신규·완료·재설계·reload·세션 격리·중복 명령·stale·오류 복구, 세 viewport와 키보드 흐름이 통과한다. |

같은 역할 agent가 여러 명 실행되더라도 위 소유 경로를 넘지 않는다. 패키지 완료 보고에는
검증한 immutable source head, 실제 명령, 기대·실제 결과, 실패 또는 skip 이유를 남긴다.
backend와 frontend 결과는 서로의 테스트로 대체하지 않고, `mvp-release-e2e`가 두 결과와
release stack을 결합해 제품 완료를 증명한다.

### 패키지 의존성

```text
mvp-backend-core ----------------------------------------------+
                                                               +-> mvp-release-stack -> mvp-release-e2e
mvp-frontend-shell -> mvp-frontend-state -> mvp-frontend-journey+
```

`mvp-backend-core`와 `mvp-frontend-shell`은 병렬이다. backend 구현이 끝나기 전에도
frontend는 이 문서의 정본 API 계약을 기준으로 진행할 수 있다. `mvp-release-e2e`의
backend/frontend 의존성은 계약을 새로 정하기 위한 것이 아니라 각 source head의 검증 완료를
요구하기 위한 것이다. 모든 edge는 실제 파일 기반 또는 릴리스 인수 선행 조건이며 순환하지 않는다.

### 충돌 방지 소유권

- `mvp-backend-core`만 backend Gradle 파일, migration, session/config 및 journey/quest package를 수정한다.
- `mvp-frontend-shell`만 frontend package manager와 공용 app/style/component 파일을 수정한다.
- `mvp-frontend-state`는 API와 상태 디렉터리, `mvp-frontend-journey`는 route와 화면 feature 디렉터리만 수정한다.
- `mvp-release-stack`은 container, compose, verification script, runbook만 수정한다.
- `mvp-release-e2e`는 독립 `e2e/` workspace만 수정한다.
- CI workflow 같은 `.github/` 변경은 실행 backlog에 넣지 않고 별도 승인 후속 작업으로 남긴다.

### 정본 통합과 진행 보고

정본 통합은 `origin/main@1ee04def44b7c0c63d6f758b4fa8f9bf7297654b`에서 시작한
새 패키지 source head만 DAG 순서로 포함한다. 통합 전후 ancestry를 확인해 PR #99 및 승인되지
않은 과거 worker SHA가 조상이 아님을 증명한다. 개별 패키지 PASS를 제품 PASS로 승격하지 않는다.

각 slice 보고는 `현재 패키지와 immutable head`, `변경 경로`, `실행 명령과 결과`, `남은 제품
위험`, `다음 package 진입 조건`을 기록한다. Slice 1에서는 backend와 frontend 증거를 분리하고,
Slice 2에서는 실제 request lifecycle과 사용자 여정을, Slice 3에서는 새 integration head의
compose smoke와 release E2E를 기록한다. secret 값, 쿠키 원문, 사용자 입력 원문은 증적에 남기지
않는다.

## 7. 통합 완료 조건

개별 worker PR이 아니라 모든 source head가 포함된 정본 통합 head에서 다음을 모두 만족해야 MVP 완료다.

1. clean checkout에서 문서화된 한 명령으로 backend/frontend/DB를 시작하고 health가 통과한다.
2. 신규 사용자가 가입 없이 5분 이내 행동을 받고 완료하면 완료 수와 다음 행동이 갱신된다.
3. 어려움 이유를 고르면 이전보다 쉽거나 최저 fallback인 행동이 나오고 원인이 기록된다.
4. 새로고침 후 여정, 현재 행동, 최근 기록이 복원된다.
5. 서로 다른 두 익명 세션의 읽기와 변경 데이터가 격리된다.
6. 같은 command 재전송은 중복 기록을 만들지 않고 stale version은 최신 snapshot과 `409`를 반환한다.
7. backend 단위/DB 통합, frontend component/build, Playwright 핵심 흐름이 통과한다.
8. 세 viewport에 텍스트 겹침·가로 overflow가 없고 키보드로 핵심 흐름을 완료한다.
9. repository에 secret, dependency cache, build output을 포함하지 않는다.
10. runbook에 백업 대상, 실행, health check, 로그 확인, non-destructive rollback을 기록한다.

## 8. 릴리스 이후 관찰

첫 릴리스 이후에는 개인 식별 정보 없이 `설정 완료`, `행동 완료`, `재설계 선택`의 집계 필요성을 별도 검토한다. 초기 문구와 난이도 조정은 가능하지만, 완료·재설계·idempotency·세션 격리 상태 전이 계약은 변경하지 않는다.
