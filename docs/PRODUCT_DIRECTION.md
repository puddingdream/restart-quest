# Re:Start Quest 정본 설계 문서

## 1. 문서 역할

이 문서는 Re:Start Quest의 제품 방향, MVP 유저 플로우, 도메인 모델, API 초안, 화면 흐름, 구현 우선순위를 정리한 정본 설계 문서다.

`docs/RESTART_QUEST_HANDOFF.md`는 아이디어 배경과 인수인계 기록으로 유지한다. 구현자는 중복 기획 문서를 새로 만들지 말고 이 문서를 기준으로 프론트엔드, 백엔드, QA 작업을 나눈다.

## 2. 제품 방향

### 2.1 한 줄 정의

취업 공백자가 구직 행동을 다시 시작할 수 있도록, AI가 큰 취업 준비 과정을 작은 실행 단위로 쪼개고 실패 후에도 다시 시작할 수 있게 재설계하는 서비스다.

### 2.2 핵심 포지셔닝

Re:Start Quest는 취업 종합 앱이 아니다. 공고 추천, 이력서 첨삭, 면접 연습, 정책 추천을 많이 모으는 것보다 사용자가 오늘 다시 움직일 수 있게 만드는 **구직 행동 재진입 엔진**이 핵심이다.

핵심 경험:

```text
온보딩
-> 오늘의 퀘스트 생성
-> 완료 또는 실패 기록
-> 실패 이유 입력
-> 더 쉬운 퀘스트로 재설계
-> 대시보드에 다음 행동과 재설계 이력 반영
```

### 2.3 사용자 목표

- 취업 준비를 다시 시작할 수 있는 첫 행동을 찾는다.
- 오늘 에너지와 상황에 맞는 10~30분 단위 구직 행동을 받는다.
- 실패했을 때 비난이나 평가 없이 더 쉬운 단계로 다시 시작한다.
- 공고 탐색, 이력서 개선, 면접 연습, 학습, 정책 확인을 하나의 일일 루틴으로 연결한다.
- 포트폴리오 프로젝트로서 React, Spring Boot, DB 모델링, LLM 구조화 출력 검증을 설명할 수 있는 MVP를 만든다.

### 2.4 금지 범위

- 정신건강 상담, 치료, 진단, 우울증 개선 서비스처럼 보이게 만들지 않는다.
- 사용자의 취업 의지, 성실성, 위험도를 점수화하거나 감시하는 문구를 쓰지 않는다.
- AI가 이력서나 자기소개서를 대신 완성하는 대필 서비스처럼 만들지 않는다.
- 정부지원정책 대상 여부를 확정 판정하지 않는다. "확인해볼 만한 정책"과 "신청 전 확인 항목"까지만 제공한다.
- MVP에서 실제 채용 사이트 크롤링이나 외부 공고 API 연동을 하지 않는다.
- 공고, 정책, 면접, 이력서 기능을 핵심 재설계 흐름보다 먼저 크게 확장하지 않는다.

## 3. MVP 범위

### 3.1 MVP 필수 기능

1. 인증: 회원가입, 로그인, 현재 사용자 조회. 포트폴리오 MVP에서는 이메일 기반 인증을 우선한다.
2. 온보딩: 지역, 희망 직무, 희망 근무 형태, 취업 공백 기간, 이력서 보유 여부, 면접 경험, 관심 분야, 기본 에너지 수준을 입력한다. 입력값은 평가가 아니라 퀘스트 난이도와 방향 조정에만 쓴다.
3. 오늘의 퀘스트 생성: 온보딩 정보와 오늘 에너지 수준을 기반으로 3개의 퀘스트를 생성한다. 각 퀘스트는 10~30분 안에 끝낼 수 있어야 한다.
4. 퀘스트 상태 변경: 사용자는 퀘스트를 완료, 실패, 건너뛰기 처리할 수 있다.
5. 실패 이유 입력: 실패 처리 시 선택형 이유를 필수로 받고 선택 메모를 함께 받을 수 있다.
6. 퀘스트 재설계: 실패 이유에 따라 기존 퀘스트보다 더 작은 행동으로 재설계하고 원본 퀘스트와 연결한다.
7. 대시보드: 오늘 진행률, 완료/실패/재설계 개수, 다음 추천 행동, 최근 재설계 이력을 보여준다.

### 3.2 MVP 제외 범위

- 실제 채용 사이트 크롤링 또는 외부 공고 API 연동.
- 정교한 공고 추천 알고리즘.
- 이력서 전체 첨삭과 자기소개서 대필.
- 음성 기반 모의면접.
- 상담사, 관리자, 보호자 화면.
- 캘린더 연동과 알림 자동화.
- 정부지원정책 자동 업데이트와 자격 판정.
- 취업 성공률 예측, 의지 점수, 위험도 점수.

### 3.3 후순위 확장

1. 더미 공고 및 사용자 저장 공고: 크롤링 없이 샘플 공고와 사용자가 직접 저장한 공고부터 시작하고, 저장 공고는 퀘스트 생성 소재로만 사용한다.
2. 이력서/자기소개서 점검: 전체 대필이 아니라 오늘 수정할 1~3개 항목을 퀘스트로 연결한다.
3. 모의면접: 희망 직무와 저장 이력서 기반 질문을 만들고 다음 연습 퀘스트로 연결한다.
4. 정책 확인: 몇 개의 정책을 직접 등록해 "확인해볼 만한 정책"으로 노출한다.
5. 알림과 루틴 리마인드: 핵심 재설계 흐름이 동작한 뒤 추가한다.

## 4. MVP 유저 플로우

### 4.1 첫 사용 흐름

1. 사용자가 회원가입 또는 로그인한다.
2. 온보딩 화면에서 현재 구직 상태와 기본 에너지 수준을 입력한다.
3. 앱은 홈으로 이동해 오늘의 퀘스트 생성 CTA를 보여준다.
4. 사용자가 오늘 에너지 수준을 확인하거나 수정한다.
5. 사용자가 "오늘의 퀘스트 생성"을 실행한다.
6. 시스템은 3개의 퀘스트를 생성하고 오늘의 퀘스트 화면에 표시한다.
7. 사용자는 각 퀘스트를 완료하거나 실패 처리한다.
8. 실패 처리 시 실패 이유를 입력한다.
9. 시스템은 실패 이유를 기반으로 더 쉬운 퀘스트를 생성한다.
10. 대시보드는 오늘 진행률, 실패 후 재설계 기록, 다음 행동을 갱신한다.

### 4.2 실패 후 재설계 흐름

```text
Quest(TODO)
-> 사용자가 실패 선택
-> QuestFailure 입력
-> Quest(FAILED)
-> Redesign 요청
-> child Quest(TODO) 생성
-> 원본 Quest는 REDESIGNED 또는 redesignCount로 추적
-> Dashboard 반영
```

재설계 결과는 항상 원본보다 부담이 낮아야 한다. 예를 들어 "자기소개서 지원동기 작성하기"가 실패했고 이유가 "무엇을 써야 할지 몰랐다"라면, 재설계는 "기업 키워드 3개 적기", "내 경험 2개만 적기", "첫 문장 후보 1개 쓰기"처럼 더 작은 행동이어야 한다.

### 4.3 퀘스트 생성 기준

- 하루 기본 퀘스트 수는 3개다.
- 기본 예상 소요 시간은 10~30분이다. 재설계 퀘스트는 5분까지 허용한다.
- 에너지 수준이 낮으면 탐색, 읽기, 정리처럼 마찰이 낮은 행동을 우선한다.
- 한 퀘스트는 하나의 완료 기준만 가져야 한다.
- 카테고리는 `JOB_SEARCH`, `RESUME`, `INTERVIEW`, `LEARNING`, `POLICY`, `ROUTINE` 중 하나다.
- MVP에서는 외부 데이터가 없을 수 있으므로 더미 공고, 사용자 입력, 일반적인 직무 준비 행동을 소재로 삼는다.

### 4.4 실패 이유 코드

| Code | 화면 문구 | 재설계 방향 |
|---|---|---|
| `NOT_ENOUGH_TIME` | 시간이 부족했다 | 소요 시간을 줄이고 오늘 끝낼 수 있는 최소 행동으로 축소 |
| `TOO_BURDENSOME` | 너무 부담스러웠다 | 읽기, 고르기, 한 문장 작성처럼 부담이 낮은 행동으로 변경 |
| `DID_NOT_KNOW_HOW` | 무엇을 해야 할지 몰랐다 | 예시, 체크리스트, 첫 단계 조사 행동으로 변경 |
| `MISSING_MATERIAL` | 필요한 자료가 없었다 | 자료를 찾거나 준비하는 선행 행동으로 변경 |
| `LOW_CONFIDENCE` | 자신감이 없었다 | 평가받지 않는 초안 작성, 키워드 나열 중심으로 변경 |
| `LOW_ENERGY` | 오늘 에너지가 낮았다 | 5~10분짜리 루틴 또는 확인 행동으로 변경 |
| `NOT_RELEVANT` | 지금 상황과 맞지 않았다 | 희망 직무, 지역, 상태 정보를 다시 반영해 방향 수정 |

## 5. 도메인 모델 초안

### 5.1 MVP 핵심 엔티티

#### User

`id`, `email`, `passwordHash`, `name`, `createdAt`, `updatedAt`

#### OnboardingProfile

`id`, `userId`, `region`, `desiredJob`, `desiredWorkType`, `careerGapMonths`, `hasResume`, `interviewExperienceLevel`, `interests`, `defaultEnergyLevel`, `createdAt`, `updatedAt`

#### DailyQuestPlan

`id`, `userId`, `targetDate`, `energyLevel`, `status`, `generationSource`, `summary`, `createdAt`, `updatedAt`

하루 퀘스트 묶음이다. 같은 날짜에 무제한으로 새 계획을 만들지 않도록 사용자와 날짜 기준 하나의 활성 계획을 우선한다.

#### Quest

`id`, `userId`, `dailyQuestPlanId`, `parentQuestId`, `title`, `description`, `category`, `difficulty`, `estimatedMinutes`, `completionCriteria`, `status`, `sourceType`, `createdAt`, `completedAt`, `failedAt`

사용자가 실제로 수행하는 최소 행동 단위다. 재설계 퀘스트는 `parentQuestId`로 원본과 연결한다.

#### QuestFailure

`id`, `questId`, `userId`, `reasonCode`, `memo`, `energyLevelAtFailure`, `createdAt`

실패 처리의 근거다. 재설계 요청은 반드시 이 데이터를 기준으로 해야 한다.

#### QuestRedesign

`id`, `originalQuestId`, `failureId`, `redesignedQuestIds`, `strategySummary`, `createdAt`

원본 실패와 재설계 결과를 추적한다. DB 구현에서는 별도 조인 테이블 또는 `Quest.parentQuestId` 기반 조회로 단순화할 수 있다.

#### DashboardSummary

저장 엔티티가 아니라 조회 모델로 시작한다. 필드는 `targetDate`, `totalQuestCount`, `doneCount`, `failedCount`, `redesignedCount`, `progressRate`, `nextQuest`, `recentRedesigns`다.

### 5.2 후순위 엔티티

- `ResumeDocument`: `id`, `userId`, `title`, `content`, `feedbackSummary`, `createdAt`, `updatedAt`. 전체 대필이 아니라 다음 퀘스트 생성을 위한 소재로 사용한다.
- `JobPosting`: `id`, `title`, `company`, `location`, `workType`, `deadline`, `source`, `url`, `createdAt`. 더미 데이터 또는 사용자 직접 등록부터 시작한다.
- `SavedJob`: `id`, `userId`, `jobPostingId`, `status`, `memo`, `createdAt`, `updatedAt`.
- `PolicyCandidate`: `id`, `title`, `description`, `targetSummary`, `officialUrl`, `createdAt`, `updatedAt`. 정책은 확정 판정 대상이 아니라 확인 후보로만 노출한다.

### 5.3 Enum 초안

```text
EnergyLevel: LOW, MEDIUM, HIGH
QuestCategory: JOB_SEARCH, RESUME, INTERVIEW, LEARNING, POLICY, ROUTINE
QuestDifficulty: VERY_EASY, EASY, NORMAL
QuestStatus: TODO, DONE, FAILED, SKIPPED, REDESIGNED
QuestSourceType: AI_GENERATED, MANUAL, SEED
DailyQuestPlanStatus: ACTIVE, ARCHIVED
InterviewExperienceLevel: NONE, LOW, MEDIUM, HIGH
SavedJobStatus: INTERESTED, PREPARING, APPLIED, INTERVIEWING, REJECTED, ACCEPTED
FailureReasonCode: NOT_ENOUGH_TIME, TOO_BURDENSOME, DID_NOT_KNOW_HOW, MISSING_MATERIAL, LOW_CONFIDENCE, LOW_ENERGY, NOT_RELEVANT
```

`QuestStatus.REDESIGNED`는 원본 퀘스트가 실패 후 재설계까지 완료되었음을 표시할 때 사용한다. 단순 실패 직후에는 `FAILED`로 둔다.

## 6. AI 출력 계약

LLM 응답은 자연어 문자열로 파싱하지 않는다. 백엔드는 JSON schema 또는 DTO로 검증한 뒤 DB에 저장한다.

### 6.1 오늘의 퀘스트 생성 응답

```json
{
  "summary": "오늘은 부담을 낮춘 탐색과 한 문장 작성 중심으로 시작합니다.",
  "quests": [
    {
      "title": "관심 공고 2개 저장하기",
      "description": "희망 직무와 지역에 맞는 공고를 2개 찾아 저장합니다.",
      "category": "JOB_SEARCH",
      "difficulty": "EASY",
      "estimatedMinutes": 15,
      "completionCriteria": "공고 2개를 저장하면 완료",
      "reasoningTag": "LOW_ENERGY_JOB_SEARCH"
    }
  ]
}
```

검증 규칙:

- `quests`는 정확히 3개다.
- `estimatedMinutes`는 5~30 범위다.
- `category`, `difficulty`는 enum 값만 허용한다.
- `title`, `description`, `completionCriteria`는 비어 있으면 안 된다.
- 평가성 문구나 정신건강 진단처럼 보이는 문구가 포함되면 저장하지 않는다.

### 6.2 재설계 응답

```json
{
  "strategySummary": "작성 부담을 낮추기 위해 자료 정리와 첫 문장 후보 작성으로 나눕니다.",
  "redesignedQuests": [
    {
      "title": "프로젝트 키워드 3개 적기",
      "description": "이력서에 넣을 프로젝트에서 사용한 기술이나 역할 키워드를 3개만 적습니다.",
      "category": "RESUME",
      "difficulty": "VERY_EASY",
      "estimatedMinutes": 10,
      "completionCriteria": "키워드 3개를 적으면 완료"
    }
  ]
}
```

검증 규칙:

- `redesignedQuests`는 1~3개다.
- 각 퀘스트는 원본보다 같거나 낮은 난이도여야 한다.
- 실패 이유가 `NOT_ENOUGH_TIME` 또는 `LOW_ENERGY`이면 예상 시간이 원본보다 짧아야 한다.
- 원본 퀘스트와 무관한 기능 추천이나 장기 목표 제안은 제외한다.

## 7. API 초안

API 경로는 `/api` 하위에 둔다. Controller는 요청 검증과 응답 매핑만 담당하고, 퀘스트 생성/실패/재설계 정책은 application service와 domain policy로 분리한다.

### 7.1 MVP API

| Method | Path | 목적 |
|---|---|---|
| `POST` | `/api/auth/signup` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `GET` | `/api/users/me` | 현재 사용자 조회 |
| `GET` | `/api/onboarding/profile` | 내 온보딩 정보 조회 |
| `PUT` | `/api/onboarding/profile` | 온보딩 정보 생성 또는 수정 |
| `GET` | `/api/quest-plans/today` | 오늘 활성 퀘스트 계획 조회 |
| `POST` | `/api/quest-plans/today` | 오늘 퀘스트 생성 |
| `PATCH` | `/api/quests/{questId}/complete` | 퀘스트 완료 |
| `PATCH` | `/api/quests/{questId}/skip` | 퀘스트 건너뛰기 |
| `POST` | `/api/quests/{questId}/fail` | 실패 이유 저장 및 실패 처리 |
| `POST` | `/api/quests/{questId}/redesign` | 실패 이유 기반 재설계 |
| `GET` | `/api/dashboard/today` | 오늘 진행 요약 |
| `GET` | `/api/dashboard/activity` | 최근 활동 기록 |

### 7.2 주요 요청/응답 DTO

`PUT /api/onboarding/profile`:

```json
{
  "region": "서울",
  "desiredJob": "백엔드 개발자",
  "desiredWorkType": "정규직",
  "careerGapMonths": 8,
  "hasResume": true,
  "interviewExperienceLevel": "LOW",
  "interests": ["Java", "Spring", "커머스"],
  "defaultEnergyLevel": "LOW"
}
```

`POST /api/quest-plans/today`:

```json
{ "energyLevel": "LOW" }
```

`POST /api/quests/{questId}/fail`:

```json
{
  "reasonCode": "DID_NOT_KNOW_HOW",
  "memo": "첫 문장을 어떻게 시작해야 할지 모르겠음",
  "energyLevelAtFailure": "LOW"
}
```

`GET /api/dashboard/today`:

```json
{
  "targetDate": "2026-07-14",
  "totalQuestCount": 4,
  "doneCount": 1,
  "failedCount": 1,
  "redesignedCount": 1,
  "progressRate": 25,
  "nextQuest": {
    "id": 10,
    "title": "프로젝트 키워드 3개 적기",
    "estimatedMinutes": 10
  },
  "recentRedesigns": [
    {
      "originalQuestTitle": "이력서 프로젝트 설명 한 문단 수정하기",
      "reasonCode": "DID_NOT_KNOW_HOW",
      "redesignedQuestTitles": ["프로젝트 키워드 3개 적기"]
    }
  ]
}
```

### 7.3 API 구현 결정

- `redesign`은 실패 처리된 퀘스트에만 허용한다.
- 이미 재설계된 퀘스트에 다시 `redesign`이 호출되면 기존 결과를 반환하거나 명확한 중복 요청 오류를 반환한다.
- 완료된 퀘스트는 실패 처리할 수 없다.
- 재설계된 child quest는 같은 `DailyQuestPlan`에 포함하고 `parentQuestId`를 가진다.
- 후순위 API는 이력서, 공고, 면접, 정책 기능이 핵심 흐름 뒤에 붙을 때 추가한다.

## 8. 화면 흐름

### 8.1 MVP 화면 목록

1. `LoginPage` / `SignupPage`: 인증만 담당한다.
2. `OnboardingPage`: 현재 상태 입력과 기본 에너지 수준 설정. "퀘스트 난이도를 맞추기 위한 정보"로 설명한다.
3. `TodayQuestPage`: 첫 화면의 중심이다. 오늘 에너지 수준 선택, 퀘스트 생성 CTA, 퀘스트 카드 3개, 진행 상태를 보여준다. 기능 설명용 랜딩 페이지로 시작하지 않는다.
4. `QuestDetailPage` 또는 `QuestActionPanel`: 완료, 실패, 건너뛰기 액션. 실패 선택 시 실패 이유 선택 UI를 연다.
5. `FailureReasonPanel`: 실패 이유 코드 선택과 선택 메모 입력. "왜 못 했나요?"보다 "무엇이 막혔나요?"처럼 비난 없는 문구를 사용한다.
6. `RedesignResultPanel`: 더 쉬운 퀘스트 결과를 보여주고 오늘 계획에 추가한다.
7. `DashboardPage`: 오늘 진행률, 다음 행동, 최근 재설계 이력, 카테고리별 진행 요약.

### 8.2 기본 진입 규칙

```text
미인증 사용자 -> LoginPage
인증 사용자 + 온보딩 미완료 -> OnboardingPage
인증 사용자 + 온보딩 완료 + 오늘 계획 없음 -> TodayQuestPage(생성 CTA)
인증 사용자 + 오늘 계획 있음 -> TodayQuestPage(퀘스트 목록)
TodayQuestPage에서 완료/실패/재설계 발생 -> DashboardPage와 TodayQuestPage 데이터 갱신
```

### 8.3 UI 문구 기준

사용해도 되는 방향:

- "오늘 다시 시작할 수 있는 작은 행동"
- "부담을 낮춘 다음 단계"
- "막힌 이유를 알려주면 더 쉬운 퀘스트로 바꿉니다"
- "완료하지 못해도 오늘 계획은 다시 조정할 수 있습니다"

피해야 할 방향:

- "의지가 부족합니다"
- "위험도 높음"
- "취업 의지 점수"
- "정신건강 상태 분석"
- "우울감 개선"
- "감시", "관리 대상", "성실도 평가"

### 8.4 프론트엔드 구조 기준

React 코드는 `src/features/auth`, `src/features/onboarding`, `src/features/quests`, `src/features/dashboard` 단위로 분리한다.

- `pages`: route 단위 화면 조립.
- `components`: `QuestCard`, `FailureReasonSelect`, `RedesignResultList`, `ProgressSummary`.
- `hooks`: `useTodayQuestPlan`, `useGenerateTodayQuests`, `useCompleteQuest`, `useFailQuest`, `useRedesignQuest`.
- `api`: API client 함수.
- `types`: API DTO와 UI view model.

페이지 컴포넌트는 화면 조립만 담당한다. API 호출, form state, 복잡한 view model은 hook 또는 service로 분리한다.

## 9. 백엔드 구현 기준

### 9.1 패키지 방향

Spring Boot 코드는 `domain`, `application`, `infrastructure`, `presentation` 계층으로 분리한다.

권장 use case:

- `CreateOrUpdateOnboardingProfileService`
- `GenerateDailyQuestPlanService`
- `CompleteQuestService`
- `FailQuestService`
- `RedesignQuestService`
- `GetTodayDashboardService`

### 9.2 도메인 정책

- 실패 이유별 재설계 방향은 테스트 가능한 domain policy로 둔다.
- LLM provider 호출은 application service에서 직접 구현하지 말고 `QuestAiClient` 같은 port를 통해 호출한다.
- infrastructure 구현체는 AI 호출 실패, JSON 파싱 실패, quota 초과, provider timeout을 구분 가능한 에러로 반환한다.
- Controller는 HTTP 요청/응답 매핑과 validation만 담당한다.

### 9.3 테스트 기준

- 온보딩 정보가 있어야 오늘 퀘스트를 생성할 수 있다.
- 오늘 퀘스트 생성 결과는 3개이며 enum과 시간 범위를 검증한다.
- 완료된 퀘스트는 실패 처리할 수 없다.
- 실패 이유가 없는 재설계 요청은 거부한다.
- 재설계 퀘스트는 원본 퀘스트와 연결된다.
- 대시보드는 완료/실패/재설계 개수를 올바르게 계산한다.

## 10. 구현 우선순위

1. 설계 문서: 이 문서를 기준으로 작업 범위를 나눈다.
2. 백엔드 도메인과 API 골격: User, OnboardingProfile, DailyQuestPlan, Quest, QuestFailure, 온보딩 API, 오늘 퀘스트 생성 mock AI client, 완료/실패/재설계 API, 대시보드 API, LLM JSON DTO 검증 구조.
3. 프론트 MVP 화면 골격: 인증, 온보딩, 오늘의 퀘스트, 실패 이유 입력, 재설계 결과, 대시보드 화면. mock API 또는 MSW 기반으로 핵심 흐름을 먼저 연결한다.
4. API 연동과 QA: 프론트와 백엔드 DTO를 맞추고 핵심 사용자 흐름을 E2E 또는 수동 QA 체크리스트로 검증한다. 평가성, 감시성, 상담/치료성 문구가 없는지 리뷰한다.
5. 확장 기능: 저장 공고와 더미 공고, 이력서 피드백, 모의면접, 정책 후보, 알림과 캘린더 연동.

## 11. Agent 작업 분배 기준

### Backend agent

- 이 문서의 5장, 6장, 7장, 9장을 기준으로 구현한다.
- 처음에는 실제 LLM 호출 대신 검증 가능한 mock `QuestAiClient`를 둘 수 있다.
- 실제 LLM 연동 시 JSON schema/DTO 검증과 에러 분기를 먼저 구현한다.

### Frontend agent

- 이 문서의 4장, 7장, 8장을 기준으로 구현한다.
- 핵심 흐름은 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 재설계 결과 -> 대시보드 반영`이다.
- 랜딩 페이지나 기능 소개 화면보다 사용자가 바로 행동할 수 있는 화면을 우선한다.

### QA/Reviewer agent

- 실패 후 재설계 흐름이 빠지면 차단한다.
- MVP 범위 밖 기능이 핵심 흐름보다 먼저 커지면 차단한다.
- LLM 응답을 자연어 문자열로 파싱하면 차단한다.
- 평가성, 감시성, 상담/치료성 문구가 보이면 수정 요청한다.
- 파일 크기보다 책임 분리와 변경 이유의 일관성을 먼저 본다.
