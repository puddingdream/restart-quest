# Re:Start Quest 백엔드 API 계약 초안

## 1. 목적

이 문서는 Spring Boot 구현 전 백엔드가 지켜야 할 MVP API, 도메인 상태, AI 오케스트레이션 계약을 정리한다.

핵심 흐름은 아래 한 가지다.

```text
온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

백엔드는 이 흐름을 안정적으로 저장하고 검증하는 책임을 가진다. 이력서, 면접, 공고, 정책 기능은 MVP 이후 확장으로 두며, 실제 채용 사이트 크롤링은 포함하지 않는다.

## 2. 서버 책임 범위

### 2.1 MVP 포함

- 이메일 기반 회원 식별과 `GET /api/users/me` 응답 계약
- 온보딩 프로필 저장과 조회
- 오늘의 퀘스트 3개 생성, 조회, 완료 처리
- 실패 이유 저장
- 실패한 퀘스트를 더 쉬운 퀘스트로 재설계
- 대시보드 요약 조회
- LLM 응답 JSON DTO 검증과 실패 유형 분리

### 2.2 MVP 제외

- 실제 채용 사이트 크롤링
- 정책 대상 여부 확정 판정
- 정신건강 상담, 치료, 위험도 판단
- 사용자 의지 점수, 감시성 리포트
- 관리자 또는 상담사 화면용 API

## 3. 도메인 상태와 불변식

### 3.1 QuestStatus

```text
TODO -> DONE
TODO -> FAILED
FAILED -> REGENERATED
```

- `TODO`: 아직 완료 또는 실패 처리하지 않은 퀘스트
- `DONE`: 사용자가 완료한 퀘스트
- `FAILED`: 실패 이유가 저장된 퀘스트
- `REGENERATED`: 실패 후 새 퀘스트가 만들어진 원본 퀘스트
- `SKIPPED`: MVP에서는 예약만 하고 기본 API 흐름에는 포함하지 않는다.

`FAILED -> REGENERATED` 전환 시 원본 퀘스트의 실패 기록은 `QuestFailure`에 남긴다. 대시보드의 실패 수는 최종 `Quest.status`만 보지 않고 `QuestFailure` 기준으로 계산한다.

### 3.2 FailureReason

```text
NO_TIME
TOO_HARD
DONT_KNOW_WHAT_TO_WRITE
NO_MATERIAL
LOW_CONFIDENCE
LOW_ENERGY
```

실패 이유는 사용자를 평가하기 위한 값이 아니라 재설계 입력값이다. API 응답 문구도 "점수", "위험", "의지 부족" 같은 표현을 사용하지 않는다.

### 3.3 QuestDifficulty

```text
VERY_EASY
EASY
NORMAL
```

- 생성 퀘스트는 10~30분을 기본 범위로 한다.
- 재설계 퀘스트는 원본보다 같거나 낮은 난이도여야 하고, 권장 범위는 5~15분이다.
- `estimatedMinutes`는 1 이상 30 이하로 저장한다.

### 3.4 데이터 정합성 규칙

- 오늘의 퀘스트 생성은 사용자와 날짜 기준으로 멱등 처리한다.
- 기본 생성은 하루 3개를 목표로 하며, 이미 생성된 퀘스트가 있으면 기존 목록을 반환한다.
- `complete`는 `TODO` 상태에서만 허용한다.
- `fail`은 `TODO` 상태에서만 허용하고, 반드시 `FailureReason`을 저장한다.
- `redesign`은 같은 사용자의 `FAILED` 퀘스트와 연결된 `QuestFailure`가 있을 때만 허용한다.
- 재설계가 성공하면 새 `TODO` 퀘스트를 만들고 `QuestRedesign`을 저장한 뒤 원본을 `REGENERATED`로 바꾼다.
- 같은 `QuestFailure`에 대해 재설계 요청이 중복되면 기존 `QuestRedesign`과 새 퀘스트를 반환한다.

## 4. API 계약

공통 응답 시간은 ISO-8601 문자열을 사용한다. 인증이 붙은 뒤에는 모든 사용자 리소스에 서버의 현재 사용자 ID를 적용하고, 요청 body의 `userId`는 받지 않는다.

### 4.1 내 정보

```http
GET /api/users/me
```

```json
{
  "id": "user-1",
  "email": "user@example.com",
  "name": "사용자",
  "onboardingCompleted": true
}
```

### 4.2 온보딩 저장

```http
POST /api/onboarding
```

```json
{
  "desiredJob": "백엔드 개발자",
  "careerGapMonths": 8,
  "hasResume": true,
  "interviewExperience": "LOW",
  "energyLevel": "LOW",
  "region": "서울",
  "desiredWorkType": "FULL_TIME",
  "interests": ["Java", "Spring"]
}
```

```json
{
  "id": "onboarding-1",
  "desiredJob": "백엔드 개발자",
  "careerGapMonths": 8,
  "hasResume": true,
  "interviewExperience": "LOW",
  "energyLevel": "LOW",
  "updatedAt": "2026-07-10T00:00:00Z"
}
```

### 4.3 온보딩 조회

```http
GET /api/onboarding/me
```

온보딩이 없으면 `404 ONBOARDING_NOT_FOUND`를 반환한다. 퀘스트 생성 전 클라이언트는 이 응답으로 온보딩 화면 이동을 결정한다.

### 4.4 오늘의 퀘스트 조회

```http
GET /api/quests/today?date=2026-07-10
```

```json
{
  "date": "2026-07-10",
  "quests": [
    {
      "id": "quest-1",
      "title": "관심 공고 2개 저장하기",
      "description": "희망 직무와 지역에 맞는 공고를 2개 찾아 저장합니다.",
      "category": "JOB_SEARCH",
      "difficulty": "EASY",
      "estimatedMinutes": 15,
      "completionCriteria": "공고 2개 저장",
      "status": "TODO",
      "dueDate": "2026-07-10",
      "redesignedFromQuestId": null
    }
  ]
}
```

### 4.5 오늘의 퀘스트 생성

```http
POST /api/quests/generate
```

```json
{
  "date": "2026-07-10"
}
```

- 온보딩이 없으면 `409 ONBOARDING_REQUIRED`를 반환한다.
- 같은 날짜에 이미 생성된 퀘스트가 있으면 새 AI 호출 없이 기존 목록을 반환한다.
- LLM JSON 검증 실패, quota 초과, timeout은 서로 다른 에러 코드로 반환한다.

### 4.6 퀘스트 완료

```http
PATCH /api/quests/{questId}/complete
```

```json
{
  "id": "quest-1",
  "status": "DONE",
  "completedAt": "2026-07-10T00:00:00Z"
}
```

`TODO`가 아닌 퀘스트를 완료하려 하면 `409 INVALID_QUEST_STATE`를 반환한다.

### 4.7 퀘스트 실패

```http
PATCH /api/quests/{questId}/fail
```

```json
{
  "reason": "DONT_KNOW_WHAT_TO_WRITE",
  "memo": "첫 문장을 어떻게 시작해야 할지 막힘"
}
```

```json
{
  "quest": {
    "id": "quest-1",
    "status": "FAILED"
  },
  "failure": {
    "id": "failure-1",
    "reason": "DONT_KNOW_WHAT_TO_WRITE",
    "memo": "첫 문장을 어떻게 시작해야 할지 막힘",
    "createdAt": "2026-07-10T00:00:00Z"
  }
}
```

### 4.8 퀘스트 재설계

```http
POST /api/quests/{questId}/redesign
```

```json
{
  "failureId": "failure-1"
}
```

```json
{
  "originalQuestId": "quest-1",
  "failureReason": "DONT_KNOW_WHAT_TO_WRITE",
  "redesignedQuest": {
    "id": "quest-2",
    "title": "프로젝트에서 사용한 기술 3개만 적기",
    "description": "자기소개서를 작성하기 전에 사용한 기술 이름만 먼저 적습니다.",
    "category": "RESUME",
    "difficulty": "VERY_EASY",
    "estimatedMinutes": 5,
    "completionCriteria": "기술 키워드 3개 작성",
    "status": "TODO",
    "redesignedFromQuestId": "quest-1"
  },
  "redesignSummary": "작성 부담을 낮추기 위해 문장 작성 전 키워드 수집 단계로 줄였습니다."
}
```

### 4.9 대시보드 조회

```http
GET /api/dashboard?date=2026-07-10
```

```json
{
  "date": "2026-07-10",
  "todayTotalCount": 3,
  "todayDoneCount": 1,
  "todayFailedCount": 1,
  "todayRedesignedCount": 1,
  "nextQuest": {
    "id": "quest-2",
    "title": "프로젝트에서 사용한 기술 3개만 적기",
    "estimatedMinutes": 5
  },
  "recentRedesigns": [
    {
      "originalQuestTitle": "자기소개서 지원동기 작성하기",
      "newQuestTitle": "프로젝트에서 사용한 기술 3개만 적기",
      "failureReason": "DONT_KNOW_WHAT_TO_WRITE"
    }
  ]
}
```

## 5. 공통 에러 형식

```json
{
  "code": "INVALID_QUEST_STATE",
  "message": "현재 상태에서는 요청한 퀘스트 처리를 할 수 없습니다.",
  "details": {
    "currentStatus": "DONE"
  }
}
```

### 5.1 에러 코드

- `VALIDATION_ERROR`: 요청 DTO 검증 실패
- `UNAUTHORIZED`: 인증 필요
- `FORBIDDEN`: 다른 사용자의 리소스 접근
- `RESOURCE_NOT_FOUND`: 리소스 없음
- `ONBOARDING_REQUIRED`: 퀘스트 생성 전 온보딩 필요
- `INVALID_QUEST_STATE`: 허용되지 않는 상태 전이
- `AI_SCHEMA_VALIDATION_FAILED`: LLM JSON 구조 검증 실패
- `AI_QUOTA_EXCEEDED`: provider quota 초과
- `AI_PROVIDER_TIMEOUT`: provider timeout
- `AI_PROVIDER_ERROR`: 분류되지 않은 provider 실패

## 6. AI 오케스트레이션 계약

Application 계층은 아래 port만 의존한다.

```java
public interface QuestAiClient {
    GeneratedQuestResponse generateDailyQuests(QuestGenerationCommand command);
    RedesignedQuestResponse redesignQuest(QuestRedesignCommand command);
}
```

구현 원칙:

- provider별 구현은 `infrastructure.ai` 아래에 둔다.
- application service는 prompt 문자열이나 HTTP client 세부 구현을 알지 않는다.
- LLM 응답은 `GeneratedQuestResponse`, `RedesignedQuestResponse` DTO로 역직렬화한 뒤 Bean Validation과 enum 검증을 통과해야 저장한다.
- JSON 검증 실패는 재시도 여부와 관계없이 `AI_SCHEMA_VALIDATION_FAILED`로 분리한다.
- mock provider는 데모와 테스트를 위해 결정적 응답을 반환할 수 있지만, 운영 provider와 동일 DTO를 사용한다.
- 실패 시 사용자에게 상담, 평가, 감시처럼 보이는 문구를 내려주지 않는다.

## 7. Spring 패키지 초안

```text
com.restartquest
  domain
    onboarding
    quest
    dashboard
  application
    onboarding
    quest
      GenerateDailyQuestService
      CompleteQuestService
      FailQuestService
      RedesignQuestService
    dashboard
  infrastructure
    persistence
    ai
  presentation
    auth
    onboarding
    quest
    dashboard
```

Controller는 요청/응답 매핑과 검증만 담당한다. 상태 전이, 멱등성, AI 호출, 트랜잭션 경계는 application service가 담당한다.

## 8. DB 모델 초안

### 8.1 users

- `id`
- `email`
- `password_hash`
- `name`
- `created_at`

### 8.2 onboarding_profiles

- `id`
- `user_id`
- `desired_job`
- `career_gap_months`
- `has_resume`
- `interview_experience`
- `energy_level`
- `region`
- `desired_work_type`
- `interests_json`
- `updated_at`

### 8.3 quests

- `id`
- `user_id`
- `title`
- `description`
- `category`
- `difficulty`
- `estimated_minutes`
- `completion_criteria`
- `status`
- `due_date`
- `generated_by_ai`
- `redesigned_from_quest_id`
- `created_at`
- `completed_at`

권장 인덱스:

- `(user_id, due_date)`
- `(user_id, status, due_date)`
- `(redesigned_from_quest_id)`

### 8.4 quest_failures

- `id`
- `quest_id`
- `user_id`
- `reason`
- `memo`
- `created_at`

권장 인덱스:

- `(quest_id)`
- `(user_id, created_at)`

### 8.5 quest_redesigns

- `id`
- `original_quest_id`
- `failure_id`
- `new_quest_id`
- `failure_reason`
- `redesign_summary`
- `created_at`

권장 제약:

- `failure_id` unique
- `original_quest_id`, `new_quest_id`, `failure_id`는 같은 사용자 소유 리소스여야 한다.

## 9. 테스트 우선순위

### P0

- `Quest` 상태 전이 단위 테스트
- `FailQuestService`가 실패 이유와 상태를 함께 저장하는지 검증
- `RedesignQuestService`가 중복 요청 시 기존 재설계 결과를 반환하는지 검증
- LLM DTO 검증 실패가 `AI_SCHEMA_VALIDATION_FAILED`로 분리되는지 검증
- 대시보드 실패 수가 `QuestFailure` 기준으로 계산되는지 검증

### P1

- Controller validation 테스트
- 다른 사용자의 퀘스트 접근 차단 테스트
- 오늘의 퀘스트 생성 멱등성 테스트
- AI timeout, quota 초과, provider error 매핑 테스트

### P2

- 이력서, 면접, 더미 공고, 정책 API 확장 테스트

## 10. QA 포인트

- 실패 후 재설계가 실제로 더 작은 행동을 반환하는지 확인한다.
- `fail`만 호출된 상태와 `redesign`까지 완료된 상태가 대시보드에서 혼동되지 않는지 확인한다.
- 에러 응답이 사용자 평가나 감시처럼 해석되는 표현을 포함하지 않는지 확인한다.
- AI provider가 실패할 때 부분 저장된 퀘스트나 재설계 기록이 남지 않는지 확인한다.
