# Re:Start Quest API v1 정본 계약

이 문서는 `TASK-002-DAG-428755fc98-12-fe-core-flow-integration`이 실제 HTTP API를 연결할 때 따르는
wire 계약의 단일 정본이다. `docs/MVP_IMPLEMENTATION_BLUEPRINT.md`의 제품·도메인 원칙을 구체화하며,
Spring presentation DTO가 producer 기준이다. frontend 화면 모델과 mock fixture는 wire 계약을 바꾸는
근거가 아니고 API 경계에서 명시적으로 변환한다.

## 1. 공통 규칙

- 모든 경로의 prefix는 `/api/v1`이다.
- 인증 경로를 제외한 요청은 `Authorization: Bearer <access-token>`을 사용한다.
- 날짜는 `YYYY-MM-DD`, 시각은 offset을 포함한 ISO 8601 문자열, 식별자는 UUID 문자열이다.
- enum은 이 문서에 적힌 대문자 문자열만 허용한다.
- 응답에 선언된 배열은 비어 있어도 생략하지 않는다. nullable 필드만 JSON `null`을 허용한다.
- 알 수 없는 응답 필드는 consumer가 무시해도 되지만, 필수 필드의 이름이나 타입을 추정해 바꾸지 않는다.

오류 응답은 다음 형태다. `fieldErrors`는 오류가 없어도 빈 배열이며 `traceId`는 현재 `null`일 수 있다.

```json
{
  "code": "INVALID_INPUT",
  "message": "입력값을 확인해 주세요.",
  "fieldErrors": [{ "field": "energyLevel", "reason": "지원하지 않는 값이 포함되어 있습니다." }],
  "traceId": null
}
```

주요 상태/코드는 `401 UNAUTHORIZED`, `404 ONBOARDING_NOT_FOUND`, `404 QUEST_NOT_FOUND`,
`409 EMAIL_ALREADY_EXISTS`, `409 ONBOARDING_REQUIRED`, `409 QUEST_ALREADY_RESOLVED`,
`429 AI_QUOTA_EXCEEDED`, `502 AI_INVALID_RESPONSE`, `503 AI_PROVIDER_UNAVAILABLE`,
`504 AI_PROVIDER_TIMEOUT`이다. Bean validation 또는 읽을 수 없는 JSON/enum은 `400 INVALID_INPUT`이다.

## 2. 인증과 사용자 컨텍스트

| Method | Path | Request | Success |
|---|---|---|---|
| POST | `/auth/signup` | `email`, `password`, `name` | 201 `AuthResponse` |
| POST | `/auth/login` | `email`, `password` | 200 `AuthResponse` |
| POST | `/auth/logout` | body 없음 | 204 body 없음 |
| GET | `/users/me` | 없음 | 200 `UserResponse` |
| GET | `/onboarding/me` | 없음 | 200 `OnboardingResponse` |
| PUT | `/onboarding/me` | `OnboardingRequest` | 200 `OnboardingResponse` |

`AuthResponse`는 `accessToken: string`, `user: UserResponse`를 가진다. `UserResponse`는
`id`, `email`, `name`, `onboardingCompleted`만 공개한다.

로그아웃은 공통 인증 규칙에 따라 현재 access token을 Bearer header로 전달한다. 성공하면 해당 token을
폐기하고 body 없이 204를 반환하며, 이후 같은 token으로 보호된 API를 호출하면 `401 UNAUTHORIZED`다.

`OnboardingRequest` 필드는 다음과 같다.

- `desiredJob: string` — 2~80자
- `region?: string | null` — 최대 80자
- `desiredWorkType: FULL_TIME | CONTRACT | PART_TIME | ANY`
- `careerGapMonths: integer` — 0~600
- `hasResume: boolean`
- `interviewExperience: NONE | LIMITED | EXPERIENCED`

`OnboardingResponse`는 `profile`, `onboardingCompleted: true`를 가진다. `profile`은 요청 필드에
`userId`, `updatedAt`을 더한다. 저장된 지역이 없으면 wire 응답의 `region`은 `null`이며 frontend form
view model은 이를 빈 문자열로 정규화한다.

## 3. 오늘의 퀘스트

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/quests/today` | 없음 | 200 `DailyQuestResponse` |
| POST | `/quests/today/generate` | `{ "energyLevel": "LOW | MEDIUM | HIGH" }` | 200 `DailyQuestResponse` |
| POST | `/quests/{questId}/completion` | body 없음 | 200 `QuestJourneyResponse` |
| POST | `/quests/{questId}/failure-redesign` | `FailureRedesignRequest` | 200 `FailureRedesignResponse` |

`DailyQuestResponse` 필드는 `date`, nullable `energyLevel`, `generatedNow`, `journeys`다. 오늘 계획이
없으면 `energyLevel`은 `null`, `generatedNow`는 `false`, `journeys`는 빈 배열이다. 생성된 계획은
세 `QuestJourneyResponse`를 가진다.

`QuestJourneyResponse` 필드는 다음과 같다.

- `journeyId: UUID string`
- `status: ACTIVE | COMPLETED`
- `currentQuest: QuestResponse`
- `history: QuestResponse[]`

`currentQuest`는 여정의 현재 revision 하나다. `history`는 현재 퀘스트를 포함하지 않고 이전 revision만
오래된 순으로 담는다. 최초 퀘스트의 `history`는 빈 배열이다. 완료된 최초 퀘스트도 동일하게 빈 배열이고,
재설계가 한 번 있었다면 원본 퀘스트 한 개가 `history`에 남는다.

`QuestResponse` 필드는 `questId`, nullable `parentQuestId`, `revision`, `title`, `description`,
`completionCriteria`, `steps`, `category`, `difficulty`, `estimatedMinutes`, `status`, `generatedByAi`,
`createdAt`, nullable `completedAt`이다. category는 `RESUME | JOB_SEARCH | INTERVIEW | LEARNING |
POLICY | ROUTINE`, difficulty는 `EASY | MEDIUM | HARD`, status는 `TODO | DONE | REDESIGNED`다.

`FailureRedesignRequest`는 `reasonCode`와 최대 300자의 nullable `reasonNote`를 가진다. reasonCode는
`TIME_SHORTAGE | TASK_TOO_LARGE | START_POINT_UNCLEAR | MATERIALS_MISSING | LOW_ENERGY |
TASK_NOT_RELEVANT | OTHER`다.

`FailureRedesignResponse`는 `journeyId`, `status`, `currentQuest`, `history`, `redesign`을 같은 최상위
객체에 둔다. `redesign`은 `redesignId`, `journeyId`, `originalQuestId`, `replacementQuestId`,
`reasonCode`, nullable `reasonNote`, `createdAt`을 가진다.

### 3.1 frontend 경계 변환

현재 화면 모델을 유지하려면 `questApi` 경계에서 아래 변환을 한 번만 수행한다.

| Wire | 기존 화면 모델 | 규칙 |
|---|---|---|
| `QuestResponse.questId` | `Quest.id` | 이름만 변경하고 값은 보존 |
| `QuestResponse`의 추가 메타데이터 | 기존 `Quest` | 필요하지 않으면 무시 가능 |
| 최상위 `FailureRedesignResponse` 여정 필드 | `RedesignQuestResponse.journey` | `journeyId`, `status`, `currentQuest`, `history`로 조립 |
| `redesign.redesignId` | `QuestRedesign.id` | 이름만 변경하고 값은 보존 |

mock의 `history`가 현재 퀘스트까지 포함하는 기존 fixture는 wire 계약이 아니다. HTTP 통합 테스트는 최초
여정의 빈 `history`와 재설계 후 이전 revision만 포함하는 응답을 기준으로 한다.

## 4. 오늘 대시보드

`GET /dashboard/today`는 다음 `TodayDashboardResponse`를 반환한다.

| Field | Type | Rule |
|---|---|---|
| `date` | date string | Asia/Seoul 기준 오늘 |
| `totalJourneys` | integer | 생성 전 0, 생성 후 최초 여정 수 3 |
| `completedJourneys` | integer | 완료된 여정 수; 배열이 아님 |
| `activeJourneys` | integer | 활성 여정 수; 배열이 아님 |
| `redesignCount` | integer | 오늘 재설계 기록 수 |
| `progressPercent` | integer | 완료/전체 비율을 반올림; 평가 점수가 아님 |
| `nextQuest` | object 또는 `null` | 최초 슬롯 순서의 첫 활성 현재 퀘스트 |
| `recentRedesigns` | array | `createdAt` 최신순 |

`nextQuest`는 `journeyId`, `questId`, `revision`, `title`, `description`, `completionCriteria`, `steps`,
`category`, `difficulty`, `estimatedMinutes`를 가진다. `recentRedesigns` 항목은 `redesignId`, `journeyId`,
`originalQuestId`, `originalQuestTitle`, `replacementQuestId`, `replacementQuestTitle`, `reasonCode`,
nullable `reasonNote`, `createdAt`을 가진다.

frontend는 기존 mock의 `completedJourneys[]`, `activeJourneys[]` 상세 배열을 사용하지 않는다. 대시보드
view model은 두 값을 정수 count로 받아 요약 문구를 표시한다. 완료 여정 상세 목록은 v1 producer가
제공하지 않으므로 core-flow 통합에서 추정하거나 별도 API로 합성하지 않는다.

## 5. 공유 UI binding

퀘스트 완료와 재설계 성공 뒤 `refreshQuestOutcomeQueries()`를 정확히 한 번 호출한다. 이 함수는
`frontend/src/features/quests/questOutcomeQueryRefresh.ts`가 소유하며,
`QUEST_OUTCOME_QUERY_KEYS.today`와 `QUEST_OUTCOME_QUERY_KEYS.dashboard`에 등록된 모든 refresher를 함께
실행한다. 각 화면 hook은 `registerQuestOutcomeQueryRefresher()`로 mount 시 등록하고 unmount 시 반환된
disposer를 호출한다. 일부 refresh 실패가 다른 refresh를 취소하지 않도록 현재 `Promise.allSettled`
동작을 유지한다. 이전 `frontend/src/shared/api/queryRefresh.ts` 경로와 `QUEST_QUERY_KEYS`,
`registerQueryRefresher` 이름은 제거된 v1 내부 binding이므로 다시 사용하지 않는다.

mock routing도 feature가 소유한다. `apiRequest()`는 각 feature API가 전달한 `mock` handler를 실행하며,
auth, onboarding, quests, dashboard는 각각 자기 feature 아래 mock adapter를 제공한다. 삭제된 중앙
`frontend/src/shared/api/mockApi.ts` router를 재도입하거나 새 endpoint를 그 파일에 등록하지 않는다.

## 6. Producer/consumer 동기화 증적

| Change ID | Producer 정본 | Consumer | 확정 결과 |
|---|---|---|---|
| `TASK-002-DAG-428755fc98-01-be-user-context-contract-1` | auth/user/onboarding controller DTO | `fe-app-entry` | 필드와 상태 유지; nullable region만 form에서 빈 문자열로 정규화 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-01-be-user-context-contract-1` | auth/user/onboarding controller DTO | `fe-app-entry` | signup/login/me와 onboarding GET/PUT의 canonical 응답·오류 상태를 producer 구현 기준으로 유지 |
| `TASK-002-DAG-428755fc98-02-be-quest-domain-schema-1` | quest domain과 `QuestPlanStore` | daily/completion/redesign/dashboard backend | 사용자 소유권, 단일 current quest, 동일 journey revision, write lock 유지 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-02-be-quest-domain-contract-1` | quest domain과 `QuestPlanStore` | daily/completion/redesign/dashboard backend | 원본 persistence 계약과 같은 불변식·낙관적 잠금 의미로 통합 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-04-be-daily-generation-contract-1` | daily quest controller DTO | `fe-today-quests`, `fe-quest-outcomes`, `fe-core-flow-integration` | GET/generate 모두 `generatedNow`, canonical `currentQuest`와 이전 revision만의 `history` 사용 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-05-be-quest-completion-contract-1` | completion controller와 quest DTO | `fe-quest-outcomes`, `fe-core-flow-integration` | 현재 TODO만 완료하며 미소유·미존재와 이미 처리된 경쟁 요청의 오류를 구분 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-06-be-failure-redesign-contract-1` | redesign controller와 quest DTO | `fe-quest-outcomes`, `fe-core-flow-integration` | 같은 journey의 단일 replacement와 최상위 journey 필드·`redesign` 응답을 사용 |
| `TASK-002-DAG-428755fc98-07-be-dashboard-contract-1` | `TodayDashboardResponse` | `fe-dashboard`, `fe-core-flow-integration` | count 필드와 상세 `nextQuest`/`recentRedesigns`를 producer 기준으로 확정 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-07-be-dashboard-contract-1` | dashboard controller DTO | `fe-dashboard`, `fe-core-flow-integration` | 세 journey 기준 summary, 다음 quest와 최신순 redesign 이력을 canonical producer와 일치시킴 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-08-fe-app-entry-contract-1` | `apiRequest.ts`와 feature mock adapters | 모든 frontend feature | 중앙 mock router를 제거하고 feature API가 자기 mock handler를 전달하는 binding으로 확정 |
| `TASK-002-DAG-428755fc98-10-fe-quest-outcomes-contract-1` | outcome refresh 동작 | `fe-dashboard` | today/dashboard 동시 refresh 의미는 유지하되 경로·이름은 후속 APPLY 계약으로 대체 |
| `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-10-fe-quest-outcomes-contract-1` | `features/quests/questOutcomeQueryRefresh.ts` | `fe-dashboard`, `fe-core-flow-integration` | `QUEST_OUTCOME_QUERY_KEYS`와 feature-owned 등록 API를 최종 binding으로 사용 |

`fe-core-flow-integration`은 위 변환을 적용한 뒤 실제 HTTP 모드에서
`온보딩 -> 생성 -> 완료 -> 다른 활성 여정 재설계 -> today/dashboard 재조회`를 검증한다. 완료된 동일
퀘스트를 다시 재설계하는 흐름은 계약상 `409 QUEST_ALREADY_RESOLVED`이므로 smoke 순서로 사용하지 않는다.
