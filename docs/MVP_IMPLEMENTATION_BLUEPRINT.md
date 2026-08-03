# Re:Start Quest MVP 구현 설계

## 1. 문서 목적과 성공 기준

이 문서는 Re:Start Quest MVP의 제품 범위, 도메인, API, 화면 흐름과 구현 순서를 정의하는 canonical 설계 문서다. 구현 세부 결정이 충돌하면 `AGENTS.md`, 이 문서, `docs/CODE_QUALITY_GUARDRAILS.md`를 함께 확인한다.

MVP가 증명할 사용자 가치는 다음 한 문장이다.

> 취업 공백자가 오늘 할 수 있는 작은 구직 행동을 시작하고, 어려웠던 행동을 이유에 맞게 더 작은 행동으로 바꿔 다시 이어갈 수 있다.

성공 기준은 기능 수가 아니라 다음 흐름을 처음부터 끝까지 시연할 수 있는지다.

```text
회원가입/로그인
-> 온보딩
-> 오늘 에너지 선택 및 퀘스트 3개 생성
-> 퀘스트 완료 또는 어려웠던 이유 선택
-> 기존 퀘스트를 더 쉬운 퀘스트로 재설계
-> 대시보드에 완료, 재설계 기록, 다음 행동 반영
```

## 2. 사용자 목표와 금지 범위

### 2.1 사용자 목표

- 짧은 온보딩으로 희망 직무와 현재 준비 상태를 남긴다.
- 오늘 가능한 에너지에 맞는 10~30분 퀘스트 3개를 받는다.
- 퀘스트를 완료하거나 오늘 어려웠던 이유를 부담 없이 선택한다.
- 어려웠던 퀘스트를 원래 목적을 유지한 5~15분의 작은 행동 하나로 바꾼다.
- 대시보드에서 완료한 여정, 재설계 기록, 바로 할 다음 행동을 확인한다.

### 2.2 제품 및 표현 금지 범위

- 취업 의지, 성실성, 위험도, 정신 상태를 점수화하거나 판정하지 않는다.
- 상담, 치료, 진단, 위기 감지 서비스처럼 표현하지 않는다.
- 실패 횟수, 연속 출석, 사용자 순위로 압박하지 않는다.
- AI가 취업 결과를 보장하거나 사용자를 대신해 지원한다고 표현하지 않는다.
- 정책 자격을 확정하거나 실제 채용 사이트를 크롤링하지 않는다.
- LLM 원문 응답을 검증 없이 저장하거나 클라이언트에 전달하지 않는다.

도메인은 일관된 상태 처리를 위해 코드 값을 쓰되, 화면에는 `실패` 대신 `오늘은 어려웠어요`, `더 작게 바꾸기`, `다시 설계한 행동`처럼 재진입을 돕는 문구를 쓴다.

## 3. 범위 결정

### 3.1 MVP 포함

1. 이메일 회원가입, 로그인, 내 정보 조회
2. 온보딩 생성 및 수정
3. 오늘 에너지 수준 입력
4. 구조화된 AI 출력 기반 오늘 퀘스트 3개 생성과 당일 재조회
5. 퀘스트 완료
6. 어려웠던 이유 입력과 단일 대체 퀘스트 재설계
7. 오늘의 진행, 재설계 이력, 다음 행동 대시보드
8. AI timeout, quota, provider 오류, JSON 검증 오류의 구분 처리
9. 테스트용 결정적 AI adapter와 실행 환경용 provider adapter

### 3.2 후순위

- 이력서/자기소개서 저장, 첨삭, 대필 보조
- 모의면접 질문과 답변 피드백
- 더미 또는 사용자 입력 공고 저장과 지원 상태 관리
- 더미 정책 추천과 신청 전 확인 항목
- 실제 공고 API/크롤링과 정책 자동 업데이트
- 캘린더, 알림, 관리자/상담사 화면
- 소셜 로그인, 비밀번호 재설정, refresh token, 다중 기기 세션 관리
- 연속 기록, 배지, 커뮤니티, 사용자 비교

후순위 기능은 MVP 핵심 흐름의 퀘스트 `category` 값으로만 확장 지점을 남기고 화면이나 API를 선행 구현하지 않는다.

## 4. 핵심 제품 결정

### 4.1 하루 세 개의 독립된 퀘스트 여정

- 사용자별 서비스 기준일에 최초 생성한 퀘스트는 정확히 3개다.
- 각 최초 퀘스트는 하나의 `QuestJourney` 루트가 된다.
- 어려웠던 퀘스트는 같은 여정 안에서 대체 퀘스트 하나로 교체한다.
- 대체 퀘스트가 다시 어려우면 같은 방식으로 한 단계 더 줄일 수 있다.
- 대시보드 분모는 항상 세 여정이므로 재설계 후 진행률이 역행하지 않는다.

재설계 결과를 여러 병렬 퀘스트로 늘리지 않는다. 필요한 세부 행동은 단일 대체 퀘스트의 `steps` 1~3개로 표현한다. 실패할수록 할 일이 늘어나는 역효과를 막기 위한 결정이다.

### 4.2 당일 생성의 멱등성

- 같은 사용자가 같은 서비스 기준일에 생성 API를 다시 호출하면 새 퀘스트를 만들지 않고 기존 세 여정을 반환한다.
- DB에는 사용자와 퀘스트 날짜로 일일 계획 유일성 제약을 둔다.
- 동시 요청에서도 세 개를 초과하지 않도록 트랜잭션과 유일성 제약을 함께 사용한다.
- MVP 서비스 기준일은 `Asia/Seoul`이며 서버가 날짜를 결정한다.

### 4.3 재설계의 원자성

`어려웠던 이유 기록 -> 기존 퀘스트 REDESIGNED 전이 -> 대체 퀘스트 저장 -> 재설계 기록 저장`은 하나의 트랜잭션이다. 같은 현재 퀘스트에 완료와 재설계가 경쟁하면 하나만 성공하고 다른 요청은 `QUEST_ALREADY_RESOLVED`로 응답한다.

### 4.4 AI 의존성과 오류

- application 계층은 `QuestAiClient` port만 의존한다.
- 실행 환경 adapter는 JSON Schema 또는 같은 수준의 typed structured output을 사용한다.
- 테스트 adapter는 입력별 결정적 응답을 반환하며 네트워크와 비밀 값 없이 테스트된다.
- provider 장애를 일반 퀘스트로 숨기지 않고 구분된 오류 코드로 반환한다.
- 구조, enum, 길이, 개수, 예상 시간 검증을 통과한 DTO만 저장한다.
- provider 원문 응답은 저장하거나 API 오류에 포함하지 않는다.

## 5. 도메인 모델

### 5.1 Aggregate와 값 객체

#### User

- `id`, `email`, `passwordHash`, `name`, `onboardingCompleted`, `createdAt`
- 이메일은 정규화 후 유일하며 비밀번호는 단방향 해시만 저장한다.

#### OnboardingProfile

- `userId`
- `desiredJob`: 필수, 2~80자
- `region`: 선택, 최대 80자
- `desiredWorkType`: `FULL_TIME | CONTRACT | PART_TIME | ANY`
- `careerGapMonths`: 0~600
- `hasResume`: boolean
- `interviewExperience`: `NONE | LIMITED | EXPERIENCED`
- `updatedAt`

오늘 에너지는 사용자 평가값이 아니므로 프로필 점수로 저장하지 않고 퀘스트를 생성한 날의 `DailyQuestPlan.energyLevel`로만 기록한다.

#### DailyQuestPlan

- `id`, `userId`, `questDate`, `energyLevel`, `createdAt`
- `energyLevel`: `LOW | MEDIUM | HIGH`
- 최초 생성 시 정확히 세 개의 `QuestJourney`를 가진다.

#### QuestJourney

- `id`, `dailyQuestPlanId`, `rootQuestId`, `currentQuestId`
- `status`: `ACTIVE | COMPLETED`
- 최초 퀘스트와 모든 대체 퀘스트를 같은 여정으로 묶는다.

#### Quest

- `id`, `journeyId`, `parentQuestId`, `revision`
- `title`, `description`, `completionCriteria`
- `steps`: 1~3개의 짧은 실행 단계
- `category`: `RESUME | JOB_SEARCH | INTERVIEW | LEARNING | POLICY | ROUTINE`
- `difficulty`: `EASY | MEDIUM | HARD`
- `estimatedMinutes`: 최초 10~30분, 대체 5~15분
- `status`: `TODO | DONE | REDESIGNED`
- `generatedByAi`, `createdAt`, `completedAt`
- 한 여정에는 `TODO`인 현재 퀘스트가 최대 하나다.

#### QuestRedesign

- `id`, `journeyId`, `originalQuestId`, `replacementQuestId`
- `reasonCode`, `reasonNote`, `createdAt`
- `reasonCode`: `TIME_SHORTAGE | TASK_TOO_LARGE | START_POINT_UNCLEAR | MATERIALS_MISSING | LOW_ENERGY | TASK_NOT_RELEVANT | OTHER`
- `reasonNote`: 선택, 최대 300자

### 5.2 재설계 검증 규칙

- 대체 퀘스트는 원본과 같은 여정과 category를 유지한다.
- 예상 시간은 5~15분이며 원본 예상 시간을 넘지 않는다.
- 제목, 설명, 완료 기준과 1~3개 steps가 모두 존재해야 한다.
- 사용자를 평가하거나 치료·진단하는 문구를 포함하지 않는다.
- 검증 실패 시 `AI_INVALID_RESPONSE`로 전체 요청을 취소한다.

의미상 더 쉬운지를 코드가 완전히 판정할 수는 없다. provider prompt에는 선택한 `reasonCode`, 원래 목적 유지, 범위 또는 준비 단계 축소를 명시하고 구조적으로 시간 상한과 단계 수를 검증한다.

## 6. Backend 책임 경계

- `domain`: aggregate, enum, 상태 전이, 재설계 불변식
- `application`: `UpsertOnboarding`, `GenerateDailyQuests`, `CompleteQuest`, `RedesignQuest`, `GetTodayDashboard`
- `infrastructure`: JPA repository, migration, `QuestAiClient` 구현, provider 오류 매핑
- `presentation`: 인증 사용자 해석, 요청 검증, use case 호출, 응답 DTO 매핑

Controller에서 prompt, 상태 전이, DB query를 만들지 않는다. provider DTO와 공개 API DTO를 분리하고 provider 교체가 공개 API 변경으로 이어지지 않게 한다.

## 7. API 계약 v1

### 7.1 공통 규칙

- base path: `/api/v1`
- JSON 필드: `camelCase`
- 시간: ISO-8601 offset datetime, 날짜: `YYYY-MM-DD`
- 인증: `Authorization: Bearer <access-token>`
- access token은 응답 body로 전달하고 MVP에는 refresh token을 두지 않는다.
- 프런트는 access token을 session 범위에만 보관하고 로그, URL, 오류 화면에 노출하지 않는다.

오류 응답은 다음 형태로 고정한다.

```json
{
  "code": "QUEST_ALREADY_RESOLVED",
  "message": "이미 처리된 퀘스트입니다.",
  "fieldErrors": [
    { "field": "reasonCode", "reason": "지원하지 않는 값입니다." }
  ],
  "traceId": "optional-correlation-id"
}
```

AI 오류는 `AI_QUOTA_EXCEEDED`(429), `AI_INVALID_RESPONSE`(502), `AI_PROVIDER_UNAVAILABLE`(503), `AI_PROVIDER_TIMEOUT`(504)로 구분한다.

### 7.2 인증 및 온보딩

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/auth/signup` | `email`, `password`, `name` | 201, `accessToken`, `user` |
| POST | `/auth/login` | `email`, `password` | 200, `accessToken`, `user` |
| GET | `/users/me` | 없음 | 200, `user` |
| GET | `/onboarding/me` | 없음 | 200 또는 미작성 시 404 |
| PUT | `/onboarding/me` | `desiredJob`, `region?`, `desiredWorkType`, `careerGapMonths`, `hasResume`, `interviewExperience` | 200, `profile`, `onboardingCompleted: true` |

`user` 응답은 `id`, `email`, `name`, `onboardingCompleted`만 공개한다.

### 7.3 오늘의 퀘스트

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/quests/today` | 없음 | 200, `DailyQuestResponse`; 미생성 시 빈 `journeys` |
| POST | `/quests/today/generate` | `energyLevel` | 200, 기존 또는 신규 `DailyQuestResponse` |
| POST | `/quests/{questId}/completion` | 없음 | 200, 갱신된 `QuestJourneyResponse` |
| POST | `/quests/{questId}/failure-redesign` | `reasonCode`, `reasonNote?` | 200, 갱신된 여정과 `redesign` |

생성 응답은 `generatedNow`로 이번 호출에서 생성됐는지를 알린다. 온보딩을 완료하지 않은 사용자는 `ONBOARDING_REQUIRED`(409)를 받는다. 여정 응답에는 `journeyId`, `status`, `currentQuest`, `history`를 포함해 새로고침 후에도 재설계 맥락을 복원한다.

### 7.4 대시보드

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/dashboard/today` | 없음 | 200, 오늘 요약과 다음 행동 |

응답 필드는 `date`, `totalJourneys`, `completedJourneys`, `activeJourneys`, `redesignCount`, `progressPercent`, `nextQuest`, `recentRedesigns`다. `progressPercent`는 완료 여정 수를 전체 여정 수로 나눈 진행 표시이며 사용자 평가 점수가 아니다.

- 생성 전에는 여정 수와 진행률을 모두 `0`으로 반환한다. 생성 후 `totalJourneys`는 재설계 횟수와 무관하게 최초 세 여정이며, 정수 `progressPercent`는 완료 여정 비율을 반올림해 계산한다.
- `nextQuest`는 최초 슬롯 순서에서 가장 앞선 `ACTIVE` 여정의 현재 퀘스트다. 모두 완료했거나 생성 전이면 `null`이다. 필드는 `journeyId`, `questId`, `revision`, `title`, `description`, `completionCriteria`, `steps`, `category`, `difficulty`, `estimatedMinutes`다.
- `recentRedesigns`는 오늘 세 여정의 기록을 `createdAt` 최신순으로 반환한다. 각 항목은 `redesignId`, `journeyId`, `originalQuestId`, `originalQuestTitle`, `replacementQuestId`, `replacementQuestTitle`, `reasonCode`, `reasonNote`, `createdAt`을 포함한다.

## 8. AI 구조화 출력 계약

### 8.1 오늘 퀘스트 생성

provider DTO의 `quests` 배열 길이는 정확히 3이다. 각 원소는 `title`, `description`, `completionCriteria`, `steps`, `category`, `difficulty`, `estimatedMinutes`를 가진다. 문서의 enum, 길이, 10~30분 범위, 제목 중복 여부를 검증한다.

### 8.2 재설계

provider DTO는 `replacementQuest` 하나를 가진다. 애플리케이션은 category 유지, 5~15분, 원본 시간 이하, steps 1~3개를 검증한다. provider prompt에는 온보딩의 구직 준비 정보, 당일 에너지, 원 퀘스트 목적·완료 기준, 사용자가 고른 이유와 선택 메모만 전달한다. 이메일, 이름, token, 비밀번호 관련 값은 전달하지 않는다.

## 9. 화면 및 사용자 흐름

### 9.1 Route와 진입 규칙

| Route | 화면 | 진입/이탈 규칙 |
|---|---|---|
| `/signup` | 회원가입 | 성공 후 온보딩으로 이동 |
| `/login` | 로그인 | 온보딩 미완료면 온보딩, 완료면 오늘 퀘스트로 이동 |
| `/onboarding` | 온보딩 | 저장 성공 후 오늘 퀘스트로 이동 |
| `/today` | 오늘의 퀘스트 | 생성 전 energy 선택, 생성 후 3개 여정 카드 표시 |
| `/dashboard` | 오늘 대시보드 | 완료/재설계 현황과 다음 행동 표시 |

기능 소개 랜딩 페이지는 만들지 않는다. 인증 상태와 온보딩 완료 여부를 확인하는 route guard로 사용자가 핵심 흐름에 바로 진입하게 한다.

### 9.2 오늘 퀘스트와 재설계

1. 미생성 상태에는 `오늘 가능한 에너지` 세 옵션과 생성 버튼을 보여준다.
2. 생성 중에는 중복 클릭을 막고 세 개의 skeleton을 보여준다.
3. 생성 후 현재 퀘스트 카드 세 개를 보여준다.
4. 카드의 주 행동은 `완료했어요`, 보조 행동은 `더 작게 바꾸기`다.
5. 이유 선택과 선택 메모를 제출하는 동안 중복 요청을 막는다.
6. 성공하면 같은 카드 자리에서 새 퀘스트로 교체하고 이전 내용은 `바꾼 기록 보기`에 둔다.
7. AI 오류 시 입력을 유지하고 오류 코드별 재시도 안내를 제공한다.

### 9.3 대시보드

- 상단에는 `오늘 3개 중 N개 여정을 마쳤어요`를 표시한다.
- 현재 할 다음 퀘스트, 완료한 여정, 다시 설계한 기록을 보여준다.
- `실패율`, `의지 점수`, `위험`, `낙오`, 사용자 비교 문구를 표시하지 않는다.
- 데이터가 없으면 분석 차트 대신 오늘 퀘스트 생성으로 연결한다.

## 10. Frontend 책임 경계

- page는 route 화면 조립만 담당한다.
- `features/onboarding`, `features/quests`, `features/dashboard`로 나눈다.
- API 요청과 공개 DTO는 feature의 api/types에 둔다.
- server state는 query/mutation hook으로, 이유 입력의 임시 선택은 form/local state로 관리한다.
- 완료와 재설계 성공 후 오늘 퀘스트 및 대시보드 query를 갱신한다.
- API mock 기반 component/integration test로 backend 완료 전에도 검증한다.
- 오류 화면에는 provider 원문, stack trace, token을 표시하지 않는다.

## 11. 구현 패키지 DAG

의존성은 코드·계약 선행 조건만 나타낸다. frontend는 이 문서의 API 계약과 mock으로 backend와 병렬 구현하고, 실제 서버 결합은 마지막 통합 패키지에서 검증한다.

```text
be-user-context -> be-quest-domain
be-quest-domain -> be-ai-adapter, be-quest-completion, be-dashboard
be-ai-adapter -> be-daily-generation, be-failure-redesign

fe-app-entry -> fe-today-quests, fe-dashboard
fe-today-quests -> fe-quest-outcomes

backend endpoint packages + fe-quest-outcomes + fe-dashboard
-> fe-core-flow-integration
```

| packageId | role | 독립 검증 목표 | dependsOn |
|---|---|---|---|
| `be-user-context` | backend | bootstrap, 인증, 내 정보, 온보딩 API | 없음 |
| `be-quest-domain` | backend | 일일 계획/여정/퀘스트/재설계 도메인과 persistence 불변식 | `be-user-context` |
| `be-ai-adapter` | backend | typed AI port, schema 검증, provider 오류 분류 | `be-quest-domain` |
| `be-daily-generation` | backend | 당일 멱등 생성 및 조회 API | `be-ai-adapter` |
| `be-quest-completion` | backend | 현재 퀘스트 완료 상태 전이 API | `be-quest-domain` |
| `be-failure-redesign` | backend | 이유 기록과 단일 대체 퀘스트의 원자적 재설계 API | `be-ai-adapter` |
| `be-dashboard` | backend | 세 여정 기준 오늘 집계 read model API | `be-quest-domain` |
| `fe-app-entry` | frontend | React shell, 인증, route guard, 온보딩 | 없음 |
| `fe-today-quests` | frontend | mock 계약 기반 생성 전/후 오늘 퀘스트 화면 | `fe-app-entry` |
| `fe-quest-outcomes` | frontend | 완료 및 이유 선택/재설계 상호작용 | `fe-today-quests` |
| `fe-dashboard` | frontend | mock 계약 기반 오늘 요약과 다음 행동 화면 | `fe-app-entry` |
| `fe-core-flow-integration` | frontend | 실제 backend를 붙인 핵심 흐름 smoke/E2E | backend endpoint 4개와 frontend 기능 2개 |

각 패키지의 전체 완료 조건, 필수 컨텍스트, 수정 허용 경로는 AgentFlow design backlog report에 기록한다.

## 12. 공통 완료 기준

- `온보딩 -> 생성 -> 완료 -> 이유 기반 재설계 -> 대시보드 반영`이 자동화 smoke 또는 E2E에서 통과한다.
- 다른 사용자의 questId로 조회하거나 변경할 수 없다.
- 생성 중복, 완료/재설계 경쟁, provider 오류 회귀 테스트가 있다.
- LLM 응답은 typed schema와 도메인 규칙을 통과한 뒤에만 저장된다.
- 화면에 label, keyboard focus, 오류 연결과 loading/empty/error 상태가 있다.
- 사용자 평가·감시·상담 문구와 후순위 기능이 포함되지 않는다.
- 파일 책임과 크기는 `docs/CODE_QUALITY_GUARDRAILS.md`로 검토한다.

## 13. 명시적 가정과 미결 운영 항목

- 구현 scaffold가 없으므로 `backend/`와 `frontend/`를 분리된 프로젝트 루트로 쓴다.
- backend는 Spring Boot/Java/Gradle, frontend는 React/TypeScript/Vite/npm을 쓴다.
- runtime DB는 PostgreSQL을 우선하며 repository test는 격리 가능한 test DB를 쓴다.
- 실제 AI provider의 계정, endpoint, model, quota는 배포 환경에서 정한다. 공개 API와 application port는 provider 선택과 무관하게 유지한다.
- 비밀 값은 환경 변수로 주입하며 문서, fixture, 로그, Git 이력에 넣지 않는다.
- 누락된 `docs/agents/ROLE_DESIGN.md`, `docs/workflow/GITHUB_FLOW.md`, `docs/workflow/REVIEW_REMEDIATION.md`는 제품 설계를 막지 않지만, PR 운영 전에 공통 workflow가 제공되면 추가 확인한다.
