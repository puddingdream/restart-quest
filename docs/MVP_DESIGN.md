# Re:Start Quest MVP 설계

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

변경 명령은 `(sessionId, commandId)` receipt와 요청 payload digest를 현재 quest와 `expectedVersion` 검사보다 먼저 확인한다. 동일 payload receipt가 있으면 현재 version이 달라졌어도 저장한 최초 응답을 그대로 반환하고, 다른 payload이면 아무 상태도 바꾸지 않고 `COMMAND_ID_REUSED`를 반환한다. 신규 명령만 여정 version과 활성 행동을 같은 DB transaction에서 잠그고 검증하며, unique constraint로 중복 receipt와 복수 `ACTIVE` 생성을 막는다.

모든 journey/quest 조회와 변경은 현재 세션을 repository 조건에 포함한다. 다른 세션 소유이거나 존재하지 않는 식별자는 모두 동일한 `404` 계약으로 응답해 resource 존재 여부를 노출하지 않는다. 허용 Origin, JSON content type, session cookie 중 하나라도 유효하지 않으면 controller 진입 전에 거부하며, 오류 본문과 log에 cookie 원문이나 digest를 포함하지 않는다.

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

- 앱 시작 시 `POST /api/v1/session`을 완료한 뒤 journey를 복원한다. 세션 생성, journey 조회, 변경 요청은 각각 loading/empty/error/success 상태를 가지며 전체 화면을 영구 spinner로 막지 않는다.
- API client는 `credentials: include`와 `AbortController` 기반 10초 timeout을 공통 적용한다. timeout은 서버 실패 응답으로 가장하지 않고 재시도 가능한 client 오류로 표시한다.
- 개발 서버는 same-origin 호출 형태를 유지하도록 `/api`와 `/actuator`를 기본 `http://localhost:8080`에 proxy한다. 임의 origin 허용이나 cookie token의 브라우저 저장소 복제는 금지한다.
- 변경 요청 동안 해당 버튼만 disabled하고 진행 문구를 표시한다.
- timeout이나 연결 단절 뒤의 수동 재시도는 같은 `commandId`를 사용한다. 확정 응답을 받은 뒤 사용자가 다음 상태 변경을 명시적으로 누를 때만 새 ID를 만든다.
- `STALE_JOURNEY`는 서버가 준 최신 snapshot으로 교체하고 `다른 요청이 먼저 반영되어 최신 상태를 불러왔어요.`라고 알린다.
- 세션 만료는 시작 화면으로 보내기 전에 `세션이 만료되어 새로 시작합니다.`라고 설명한다.

## 6. 구현 기준과 slice backlog

기술 기준은 Java 21 + Spring Boot 3 + Gradle, PostgreSQL + Flyway, React + TypeScript + Vite다. 테스트는 backend 단위/DB 통합, frontend component/build, 독립 Playwright E2E로 분리한다. 실제 버전은 각 소유 패키지가 서로 호환되는 안정 버전을 선택하고 lockfile과 wrapper로 고정한다.

이 설계는 `origin/main@1ee04def44b7c0c63d6f758b4fa8f9bf7297654b`에서 시작한 정본 계약이다. 설계 PR이 승인·통합된 뒤에만 구현 패키지를 배정한다. 과거 `agentflow/*` branch와 release-stack 후보는 감사·비교 자료일 뿐 base, source import, 전달 구현 또는 검증 증거로 사용하지 않는다. 과거 자산이 꼭 필요해지면 구현자가 가져오지 않고, 정확한 remote branch와 40자 head SHA를 포함한 별도 provenance proposal로 Director와 host의 승인을 먼저 받는다.

### Slice 0: 정본 계약 확정

- 목적: 제품, 도메인, API, 화면 흐름과 패키지 경계를 구현 전에 고정한다.
- 사용자 흐름: 랜딩 -> 익명 설정 -> 행동 완료 또는 재설계 -> 다음 행동 -> reload 복원이다.
- backend: 구현하지 않고 세션·인가, 상태 전이, 격리, 정합성, idempotency 계약을 이 문서로 입력받는다.
- frontend: 구현하지 않고 route, 요청 생명주기, 상태별 UI, 접근성, 반응형 계약을 이 문서로 입력받는다.
- QA: enum, endpoint, 오류, 화면 상태와 통합 완료 조건이 양성·음성 사례를 모두 정의하는지 문서 검토한다.
- 제외: 실행 코드, 과거 branch import, 운영 배포.
- 다음 진입 조건: 이 정본 설계와 구조화된 backlog가 같은 revision으로 승인된다.

### Slice 1: 병렬 제품 구현

- 목적: 정본 계약 하나를 기준으로 backend와 frontend의 전체 핵심 루프를 독립 구현한다.
- 사용자 흐름: backend는 API 수준에서, frontend는 mock 가능한 계약 경계에서 설정 -> 현재 행동 -> 완료/재설계 -> 복원을 각각 재현한다.
- backend: `backend-core`가 앱 골격, DB migration, 익명 세션, 행동 카탈로그, 상태 전이, health를 함께 소유한다.
- frontend: `frontend-app`이 route shell, API client/state, 세 화면, loading/empty/error/success, timeout/retry, 개발 proxy를 함께 소유한다.
- QA: backend는 양성·음성·stale·중복·세션 격리 테스트, frontend는 component/build와 성공·실패·접근성·세 viewport smoke를 각 패키지에서 검증한다.
- 제외: container, compose, cross-service E2E, 클라우드 운영 계정.
- 다음 진입 조건: `backend-core`와 `frontend-app`이 서로의 source branch를 import하지 않고 독립 검증을 통과한다.

#### Slice 1 실행 handoff와 신뢰 검증

`backend-core`와 `frontend-app`은 모두 `dependsOn: []`인 병렬 패키지다. 한 패키지가 다른 패키지의 파일이나 검증을 대신 소유하지 않는다.

| 패키지 | 구현·변경 경계 | source head 신뢰 명령 | 필수 증거 |
| --- | --- | --- | --- |
| `backend-core` (`backend`) | backend Gradle/wrapper/lock, migration, session/config, health, journey/quest와 backend test만 변경한다. frontend 파일은 변경하지 않는다. | `cd backend && ./gradlew test` (Windows: `cd backend; .\\gradlew.bat test`) | 단위 및 실제 PostgreSQL DB 통합 테스트, 양성·음성·stale·중복·세션 격리 사례의 명령·실제 결과·검증 head SHA |
| `frontend-app` (`frontend`) | frontend package manager/lock, 공용 app/style/component, route, API client/state와 frontend test만 변경한다. backend 파일은 생성·수정하지 않고 backend test를 실행하지 않는다. | `cd frontend && npm ci`, `npm run test`, `npm run lint`, `npm run build` | 네 명령의 실제 결과·검증 head SHA와 `360x800`, `768x1024`, `1280x800` 사용자 흐름 확인 |

QA는 두 패키지의 신뢰 증거를 각 source head 기준으로 독립 판정한다. 두 source head가 모두 포함된 새 immutable 정본 통합 head에서는 `GET /actuator/health`가 `UP`인지와 frontend 첫 진입·세션 복원이 성공하는지를 같은 release 후보에서 추가 smoke 검증한다. 이 결합 검증은 package 사이의 새 구현 의존성이 아니며 어느 한 worker의 독립 완료 증거를 대신하지 않는다.

### Slice 2: 릴리스 스택

- 목적: 승인된 backend와 frontend 결과만 조합해 한 origin의 재현 가능한 로컬 릴리스 스택을 만든다.
- 사용자 흐름: frontend origin에서 `/`, `/start`, `/quest`, `/api`, health에 접근한다.
- backend: 제품 코드나 계약을 바꾸지 않고 production image, DB health/readiness 연결만 구성한다.
- frontend: 제품 코드나 계약을 바꾸지 않고 production image와 same-origin `/api` proxy만 구성한다.
- QA: compose config/build/up/health/smoke와 Runbook의 backup 대상, 로그 확인, 비파괴 rollback 절차를 검증한다.
- 제외: 제품 backend/frontend 수정, E2E assertion 소유, cloud deploy와 CI workflow.
- 다음 진입 조건: `release-stack`이 `backend-core`와 `frontend-app`의 승인된 결과를 포함한 immutable integration head에서 통과한다.

### Slice 3: 릴리스 E2E

- 목적: 제품 완료 조건을 제품 구현과 분리된 workspace에서 black-box로 증명한다.
- 사용자 흐름: 신규 세션 -> 행동 생성 -> 완료, 어려움 기록 -> 더 쉬운 행동 -> 다음 행동 -> reload 복원이다.
- backend: 수정하지 않으며 E2E가 세션 격리, stale, 중복 요청 결과를 외부 계약으로 검증한다.
- frontend: 수정하지 않으며 E2E가 loading/empty/error/success, timeout/proxy 실패, 키보드와 반응형 흐름을 검증한다.
- QA: compose same-origin을 대상으로 깨끗한 브라우저, 재방문, 서로 다른 두 세션, `360x800`, `768x1024`, `1280x800`을 실행한다.
- 제외: 테스트를 통과시키기 위한 제품·계약 수정, 운영 배포와 실사용 데이터.
- 완료 조건: `release-e2e`가 `release-stack`의 동일 immutable head에서 통과하고 실패 시 재현 절차와 실제 결과를 남긴다.

### 패키지 의존성

```text
승인된 docs/MVP_DESIGN.md
        |-- backend-core --+
        |                  +--> release-stack --> release-e2e
        `-- frontend-app --+
```

정본 설계는 이 Design work item의 산출물이지 별도 구현 package가 아니다. 따라서 실행 DAG에서 `backend-core`와 `frontend-app`의 `dependsOn`은 비어 있고 둘은 병렬 배정한다. `release-stack`만 두 제품 구현에 의존하고 `release-e2e`만 `release-stack`에 의존한다. 관행적인 역할 순서나 과거 branch ancestry를 의존성으로 추가하지 않는다.

### 패키지 소유권과 검증 경계

| Package | Role | 쓰기 소유권 | 독립 완료 증거 |
| --- | --- | --- | --- |
| `backend-core` | `backend` | `backend/`의 Gradle/wrapper/lock, application, migration, session/journey/quest, backend test | Gradle 단위·PostgreSQL 통합 테스트, 양성·음성·stale·중복·격리 표 |
| `frontend-app` | `frontend` | `frontend/`의 package/lock/config, `src/`, `public/`, component test | lint/typecheck/component/build, timeout과 success/error 회귀, 세 viewport·키보드 smoke |
| `release-stack` | `backend-infra` | 두 Dockerfile/.dockerignore, `frontend/nginx.conf`, `compose.yml`, `scripts/verify-release.*`, `docs/RUNBOOK.md` | compose config/build/up/health/same-origin smoke, shell syntax, 비파괴 rollback 검토 |
| `release-e2e` | `frontend` | 독립 `e2e/` workspace와 그 내부 결과 ignore | Playwright 핵심 흐름, reload, 두 세션, stale/중복, timeout/proxy, responsive/a11y 결과 |

#### 실행 package 계약

모든 package는 `AGENTS.md`, `docs/PROJECT_BRIEF.md`, `docs/MVP_DESIGN.md`를 read-only context로 사용하며 `sourceImport`는 `null`이다. 아래 경로만 해당 package의 쓰기 범위다. 디렉터리 표기의 `/**`는 그 하위 전체를 뜻하며 dependency cache와 build output은 포함하지 않는다.

`backend-core` (`backend`, `dependsOn: []`)

- Allowed paths: `backend/build.gradle`, `backend/settings.gradle`, `backend/gradle.properties`, `backend/gradle.lockfile`, `backend/gradle/**`, `backend/gradlew`, `backend/gradlew.bat`, `backend/.gitignore`, `backend/src/main/java/**`, `backend/src/main/resources/**`, `backend/src/test/java/**`, `backend/src/test/resources/**`
- 완료 조건: wrapper로 단위·PostgreSQL 통합 테스트가 통과하고, API v1 양성 흐름과 validation, 다른 세션 404 격리, stale version, 같은/다른 payload의 중복 `commandId`, 최저 fallback 및 허용되지 않은 Origin/content type을 회귀 테스트한다.
- 금지: frontend, compose, E2E, 정본 설계를 변경하거나 과거 branch 자산을 가져오지 않는다.

`frontend-app` (`frontend`, `dependsOn: []`)

- Allowed paths: `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`, `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/eslint.config.js`, `frontend/index.html`, `frontend/.gitignore`, `frontend/src/**`, `frontend/public/**`
- 완료 조건: `npm ci`, test, lint, production build가 통과하고 세 route, 세션·여정 복원, loading/empty/error/success, 10초 timeout, 동일 `commandId` 재시도, stale snapshot, 세션 만료, 키보드·`aria-live`·reduced motion과 세 viewport를 mock API 경계에서 검증한다.
- 금지: backend test나 파일, release container, E2E workspace, 정본 설계를 변경하지 않는다.

`release-stack` (`backend-infra`, `dependsOn: [backend-core, frontend-app]`)

- Additional context: `backend/build.gradle`, `frontend/package.json`
- Allowed paths: `backend/Dockerfile`, `backend/.dockerignore`, `frontend/Dockerfile`, `frontend/.dockerignore`, `frontend/nginx.conf`, `compose.yml`, `scripts/verify-release.sh`, `scripts/verify-release.ps1`, `docs/RUNBOOK.md`
- 완료 조건: `docker compose config`, image build, DB-aware readiness, `/actuator/health`, frontend와 same-origin `/api` smoke가 통과하고 shell script는 `bash -n`으로 검사한다. Runbook은 백업 대상, 실행, health, 로그, 비파괴 rollback을 함께 제공한다.
- 금지: backend/frontend 제품 코드·dependency·API/UI 계약과 `.github/`를 변경하지 않는다. Docker volume 삭제, DB DROP, 운영 배포를 실행하지 않는다.

`release-e2e` (`frontend`, `dependsOn: [release-stack]`)

- Additional context: `compose.yml`, `docs/RUNBOOK.md`
- Allowed paths: `e2e/package.json`, `e2e/package-lock.json`, `e2e/playwright.config.ts`, `e2e/tsconfig.json`, `e2e/.gitignore`, `e2e/tests/**`, `e2e/fixtures/**`
- 완료 조건: 신규 세션의 행동 생성·완료, 어려움 이유와 더 쉬운 행동, 다음 행동, reload 복원, 두 세션 격리, stale·같은/다른 payload 중복 명령, timeout·proxy 실패, 키보드와 세 viewport를 compose same-origin black-box로 검증한다.
- 금지: 제품, 계약, release-stack을 테스트 통과 목적으로 변경하거나 이전 head의 테스트 결과를 재사용하지 않는다.

- 제품 구현 패키지는 `docs/MVP_DESIGN.md`와 `docs/PROJECT_BRIEF.md`를 읽되 수정하지 않는다. 계약 변경이 필요하면 구현에 섞지 않고 collaboration proposal로 되돌린다.
- `release-stack`은 backend/frontend source, build file, package file, API/UI 계약을 수정하지 않는다.
- `release-e2e`는 backend/frontend/release-stack 파일을 수정하지 않고 관찰 가능한 계약만 검증한다.
- 모든 패키지의 `sourceImport`는 비워 둔다. worker가 `fetch`, `merge`, `rebase`로 과거 자산을 가져오지 않는다.
- `.github/`와 다른 repository-control 변경은 실행 backlog에 넣지 않고 별도 승인 후속 작업으로 남긴다.

### 협업 결정 적용 기록

- `ac533fabc9a5`: backend와 frontend 검증 provenance를 분리한다. 최신 패키지 이름인 `backend-core`와 `frontend-app` 모두 무의존 병렬 실행하며, backend test는 backend source head에서만, frontend install/test/lint/build는 frontend source head에서만 완료 증거로 인정한다.
- `b1f0f5994aab`: Re:Start Quest 제품 선택을 확정하고 `origin/main@1ee04def44b7c0c63d6f758b4fa8f9bf7297654b` 기준 역할별 package로 재구성한다. 과거 release-stack과 PR #99의 구현·승인·테스트는 새 정본 base나 gate 증거로 재사용하지 않는다.
- 다음 진행 상태는 정본 설계 승인 후 `backend-core`와 `frontend-app` 병렬 실행이다. 둘의 승인된 source head만 새 integration head에 모아 `release-stack`, 이어서 같은 immutable head에서 `release-e2e`와 독립 QA/Reviewer gate를 실행한다.

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
