# 백엔드 도메인/API 계약 초안

## 1. 목적

이 문서는 Re:Start Quest MVP의 백엔드 구현 기준을 정한다. 서버는 취업 기능을 많이 담는 종합 앱이 아니라, 사용자가 실패 후 더 작은 행동으로 다시 진입하는 흐름을 안정적으로 저장하고 검증하는 역할에 집중한다.

핵심 서버 흐름은 아래 한 줄로 검증한다.

```text
온보딩 저장 -> 오늘의 퀘스트 생성 -> 실패 이유 저장 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

## 2. MVP 서버 범위

### 포함

- 이메일 기반 사용자 식별과 사용자별 데이터 격리.
- 온보딩 프로필 저장과 조회.
- 오늘의 퀘스트 3개 생성, 조회, 완료, 실패 처리.
- 실패 이유와 메모 저장.
- 실패한 퀘스트를 더 작은 행동 후보로 재설계.
- 재설계 후보 수락 시 오늘의 다음 행동으로 반영.
- 오늘 진행률, 다음 행동, 재설계 이력 대시보드 조회.
- LLM 응답 JSON 구조 검증과 실패 유형별 오류 분리.

### 제외

- 실제 채용 사이트 크롤링.
- 정책 대상 여부 확정 판정.
- 정신건강 상담, 진단, 위험도 평가.
- 상담사/관리자 감시 화면.
- 복잡한 알림, 캘린더 연동, 소셜 로그인.

## 3. 계층 책임

| 계층 | 책임 | 금지 |
|---|---|---|
| `presentation` | Controller, request validation, response DTO mapping | 도메인 상태 판단, prompt 작성 |
| `application` | use case orchestration, transaction boundary, port 호출 | HTTP 세부사항, provider SDK 직접 의존 |
| `domain` | entity, enum, 상태 전이, 실패 이유 정책 | DB/LLM 호출 |
| `infrastructure` | JPA repository, AI provider client, external adapter | 사용자 메시지 카피 결정 |

권장 use case 클래스:

- `SaveOnboardingProfileService`
- `GenerateDailyQuestsService`
- `CompleteQuestService`
- `FailQuestService`
- `RedesignQuestService`
- `AcceptRedesignedQuestService`
- `GetTodayDashboardService`

## 4. 도메인 모델

### UserAccount

사용자 식별과 인증 기준이다.

- `id`
- `email`
- `passwordHash`
- `displayName`
- `status`: `ACTIVE`, `WITHDRAWN`
- `createdAt`
- `updatedAt`

### OnboardingProfile

퀘스트 난이도와 방향을 조절하기 위한 사용자 입력이다. 사용자를 평가하기 위한 데이터가 아니다.

- `id`
- `userId`
- `desiredJob`: 필수, 2~50자.
- `careerGapMonths`: 0 이상의 정수.
- `region`: 선택.
- `desiredWorkType`: `FULL_TIME`, `PART_TIME`, `REMOTE`, `HYBRID`, `ANY`
- `resumeStatus`: `NONE`, `DRAFT`, `READY`
- `interviewExperience`: `NONE`, `LOW`, `SOME`
- `energyLevel`: `LOW`, `MEDIUM`, `HIGH`
- `interests`: 문자열 목록.
- `completedAt`
- `updatedAt`

제약:

- 사용자당 활성 온보딩 프로필은 1개다.
- `region`은 정책 추천이 본격화되기 전까지 필수로 만들지 않는다.

### DailyQuestBatch

사용자별 특정 날짜의 퀘스트 생성 단위다.

- `id`
- `userId`
- `targetDate`
- `status`: `DRAFT`, `GENERATED`, `PARTIALLY_DONE`, `DONE`
- `generatedBy`: `AI`, `MOCK`, `MANUAL`
- `createdAt`

제약:

- `(userId, targetDate)`는 유일하다.
- MVP에서는 하루 기본 퀘스트 3개를 권장한다.

### Quest

오늘 실행할 수 있는 구직 행동이다.

- `id`
- `userId`
- `batchId`
- `parentQuestId`: 재설계로 생성된 경우 원래 퀘스트.
- `title`
- `description`
- `category`: `JOB_SEARCH`, `RESUME`, `INTERVIEW`, `LEARNING`, `POLICY`, `ROUTINE`
- `difficulty`: `MICRO`, `EASY`, `NORMAL`
- `estimatedMinutes`
- `completionCriteria`
- `status`: `TODO`, `DONE`, `FAILED`, `REDESIGNED`, `SKIPPED`
- `dueDate`
- `createdAt`
- `completedAt`
- `failedAt`

제약:

- 일반 생성 퀘스트는 10~30분 안에 끝나는 행동이어야 한다.
- 재설계 퀘스트는 5~15분 안에 끝나는 더 작은 행동이어야 한다.
- `DONE`, `SKIPPED` 상태의 퀘스트는 실패 처리하거나 재설계하지 않는다.
- `FAILED` 퀘스트만 재설계 요청할 수 있다.

### QuestFailure

실패 이유와 짧은 메모를 보관한다.

- `id`
- `questId`
- `userId`
- `reason`: `TIME_SHORT`, `TOO_BIG`, `DONT_KNOW_WHAT_TO_WRITE`, `MISSING_MATERIALS`, `LOW_ENERGY`, `JOB_NOT_MATCHED`, `OTHER`
- `memo`: 선택, 300자 이하.
- `createdAt`

제약:

- 실패 이유는 점수화하지 않는다.
- 사용자 화면에는 `실패 패턴`, `의지 점수`, `위험 사용자` 같은 표현을 반환하지 않는다.

### QuestRedesign

실패한 퀘스트를 더 작은 행동 후보로 바꾼 결과다.

- `id`
- `originalQuestId`
- `failureId`
- `status`: `PROPOSED`, `ACCEPTED`, `DISMISSED`
- `generatedBy`: `AI`, `MOCK`, `MANUAL`
- `createdAt`
- `acceptedAt`

### QuestRedesignOption

재설계 후보를 보존한다. 후보 수락 시 `Quest`로 승격하고 `parentQuestId`를 연결한다.

- `id`
- `redesignId`
- `title`
- `description`
- `estimatedMinutes`
- `completionCriteria`
- `sortOrder`
- `acceptedQuestId`: 선택.

## 5. 상태 전이

```text
TODO -> DONE
TODO -> FAILED
TODO -> SKIPPED
FAILED -> REDESIGNED
REDESIGNED -> SKIPPED
```

재설계 수락 시 원래 퀘스트는 `REDESIGNED`가 되고, 수락된 후보는 새로운 `TODO` 퀘스트가 된다. 원래 퀘스트를 덮어쓰지 않는 이유는 대시보드와 활동 기록에서 "어려웠던 행동이 더 작은 행동으로 바뀐 흐름"을 보여주기 위해서다.

## 6. API 계약

모든 API는 `/api` 하위에 둔다. 인증이 붙은 뒤에는 모든 조회와 변경에서 `userId` ownership을 확인한다.

### Auth

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/auth/signup` | 이메일 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `GET` | `/api/users/me` | 내 계정 조회 |

### Onboarding

`PUT /api/onboarding/me`

요청:

```json
{
  "desiredJob": "백엔드 개발자",
  "careerGapMonths": 8,
  "region": "서울",
  "desiredWorkType": "FULL_TIME",
  "resumeStatus": "DRAFT",
  "interviewExperience": "LOW",
  "energyLevel": "LOW",
  "interests": ["Java", "Spring"]
}
```

응답: 저장된 온보딩 프로필과 `completedAt`.

`GET /api/onboarding/me`: 내 온보딩 프로필 조회.

### Today Quests

`POST /api/quests/today/generate`

설명:

- 오늘 배치가 없으면 3개 생성한다.
- 이미 오늘 배치가 있으면 기존 배치를 반환한다.
- 초기 문서의 `/api/quests/generate`는 같은 use case를 호출하는 alias로 둘 수 있다.

응답:

```json
{
  "targetDate": "2026-07-10",
  "quests": [
    {
      "id": "quest-1",
      "title": "관심 공고 2개 저장하기",
      "description": "희망 직무와 가까운 공고를 2개만 찾아 저장합니다.",
      "category": "JOB_SEARCH",
      "difficulty": "EASY",
      "estimatedMinutes": 15,
      "status": "TODO",
      "completionCriteria": "공고 2개 저장"
    }
  ]
}
```

`GET /api/quests/today?date=YYYY-MM-DD`: 특정 날짜의 퀘스트 목록 조회.

`PATCH /api/quests/{questId}/complete`: `TODO` 퀘스트를 완료 처리.

`POST /api/quests/{questId}/fail`

요청:

```json
{
  "reason": "DONT_KNOW_WHAT_TO_WRITE",
  "memo": "프로젝트 설명을 어떻게 시작할지 막혔어요."
}
```

응답: 실패 처리된 퀘스트와 저장된 실패 이유.

### Quest Redesign

`POST /api/quests/{questId}/redesign`

설명:

- `FAILED` 상태에서만 호출한다.
- 실패 이유, 온보딩, 원래 퀘스트를 AI 입력으로 사용한다.
- 후보 1~3개를 구조화된 JSON으로 저장한다.

응답:

```json
{
  "redesignId": "redesign-1",
  "originalQuestId": "quest-1",
  "options": [
    {
      "id": "option-1",
      "title": "프로젝트에서 사용한 기술 3개만 적기",
      "description": "문장으로 만들기 전에 기술 키워드만 적습니다.",
      "estimatedMinutes": 5,
      "completionCriteria": "기술 키워드 3개 작성"
    }
  ]
}
```

`POST /api/quest-redesigns/{redesignId}/options/{optionId}/accept`

응답: 새로 생성된 `TODO` 퀘스트와 갱신된 대시보드 요약.

### Dashboard

`GET /api/dashboard/today?date=YYYY-MM-DD`

응답:

```json
{
  "targetDate": "2026-07-10",
  "progress": {
    "total": 3,
    "done": 1,
    "failed": 1,
    "redesigned": 1
  },
  "nextAction": {
    "questId": "quest-4",
    "title": "프로젝트에서 사용한 기술 3개만 적기",
    "estimatedMinutes": 5
  },
  "redesignHistory": [
    {
      "originalTitle": "이력서 프로젝트 설명 한 문단 수정하기",
      "reason": "DONT_KNOW_WHAT_TO_WRITE",
      "acceptedTitle": "프로젝트에서 사용한 기술 3개만 적기"
    }
  ]
}
```

## 7. 공통 오류

| HTTP | Code | 사용 상황 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | request field 오류 |
| 401 | `AUTH_REQUIRED` | 인증 없음 |
| 403 | `FORBIDDEN_RESOURCE` | 다른 사용자의 리소스 접근 |
| 404 | `RESOURCE_NOT_FOUND` | 존재하지 않는 리소스 |
| 409 | `INVALID_QUEST_STATE` | 허용되지 않는 상태 전이 |
| 429 | `AI_QUOTA_EXCEEDED` | provider quota 초과 |
| 502 | `AI_OUTPUT_INVALID` | JSON schema/DTO 검증 실패 |
| 504 | `AI_PROVIDER_TIMEOUT` | provider timeout |

오류 응답은 사용자에게 평가성 표현을 노출하지 않고, 프론트가 재시도/직접 축소 fallback을 표시할 수 있게 `code`, `message`, `retryable`을 포함한다.

## 8. AI 구조화 출력 정책

Application 계층은 `DailyQuestAiPort`, `QuestRedesignAiPort`만 의존한다. 실제 provider client는 infrastructure에 둔다.

출력 검증 기준:

- JSON array 크기: 오늘 퀘스트 3개, 재설계 후보 1~3개.
- `title`: 2~60자.
- `description`: 10~300자.
- `estimatedMinutes`: 일일 퀘스트 10~30, 재설계 후보 5~15.
- `category`, `difficulty`는 enum 값만 허용.
- 상담, 진단, 감시, 의지 평가로 읽히는 문구는 저장 전 필터링한다.

검증 실패는 자연어 파싱으로 보정하지 않고 `AI_OUTPUT_INVALID`로 처리한다. mock provider는 같은 DTO를 생성해 컨트랙트 테스트에서 실제 provider와 같은 검증 경로를 탄다.

## 9. 테스트 기준

- Domain: 퀘스트 상태 전이, 실패 이유 저장, 재설계 수락 불변식.
- Application: 오늘 배치 중복 생성 방지, 실패 후 재설계 후보 저장, 수락 시 새 퀘스트 생성.
- Presentation: validation error와 ownership error 응답 형태.
- Infrastructure: AI timeout, quota, invalid JSON 오류 매핑.
- Contract: 프론트가 기대하는 퀘스트 카드/대시보드 응답 shape 고정.

현재 레포에는 Spring Boot 소스가 없으므로 이번 작업에서는 문서 계약과 whitespace 검증까지만 수행한다. 실제 서버 skeleton이 추가되는 다음 작업에서 위 테스트를 구현한다.
