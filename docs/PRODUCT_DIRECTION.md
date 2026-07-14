# Re:Start Quest 제품 방향성

이 문서는 `docs/RESTART_QUEST_HANDOFF.md`의 배경과 결론을 바탕으로 frontend/backend 구현자가 따를 정본 설계 기준을 정리한다. 새 설계 문서를 늘리기보다 이 문서를 제품 방향, MVP 유저 플로우, 도메인 모델, API 초안, 화면 흐름, 구현 우선순위의 기준 문서로 사용한다.

## 1. 제품 방향

### 1.1 한 줄 정의

취업 공백자가 구직 행동을 다시 시작할 수 있도록, AI가 큰 취업 준비 과정을 10~30분 실행 단위로 쪼개고 실패 후에도 더 쉬운 행동으로 재설계하는 서비스입니다.

### 1.2 핵심 포지셔닝

Re:Start Quest는 취업 종합 앱이 아니라 **구직 행동 재진입 엔진**입니다.

핵심 흐름:

```text
온보딩
-> 오늘 가능한 에너지와 상황 확인
-> 오늘의 퀘스트 3개 생성
-> 완료 또는 실패 이유 입력
-> 실패한 퀘스트를 더 쉬운 행동으로 재설계
-> 대시보드에 진행률과 다음 행동 반영
```

이력서, 면접, 공고, 정책 기능은 독립 서비스가 아니라 오늘의 퀘스트를 만들기 위한 재료입니다. 일정이 부족하면 부가 기능보다 `실패 이유 입력 -> 더 쉬운 퀘스트 재설계` 흐름을 먼저 완성합니다.

### 1.3 사용자 목표

- 어디서부터 다시 시작해야 할지 모르는 취업 공백자가 오늘 할 수 있는 첫 행동을 얻는다.
- 사용자는 취업 준비 전체가 아니라 10~30분 안에 끝낼 수 있는 작은 구직 행동을 수행한다.
- 실패했을 때 비난이나 평가 없이 실패 이유에 맞는 더 작은 행동을 다시 받는다.
- 사용자는 대시보드에서 오늘 완료한 행동, 실패 후 재설계된 행동, 다음에 이어갈 행동을 확인한다.

### 1.4 금지 범위

- 정신건강 상담, 치료, 우울증 개선 서비스처럼 보이는 문구와 기능을 넣지 않는다.
- 취업 의지 점수, 위험 점수, 성실도 평가처럼 사용자를 감시하거나 평가하는 지표를 만들지 않는다.
- 정부지원정책 대상 여부를 확정 판정하지 않는다. "확인해볼 만한 정책"과 "신청 전 확인 항목"만 제공한다.
- MVP에서 실제 채용 사이트 크롤링이나 외부 채용 사이트 자동 지원을 구현하지 않는다.
- AI가 이력서나 자기소개서를 대신 완성해주는 방향을 핵심 경험으로 만들지 않는다.
- 첫 화면을 기능 설명용 랜딩 페이지로 만들지 않는다. 로그인 이후 사용자는 온보딩 또는 오늘의 퀘스트 화면으로 바로 들어간다.

## 2. MVP와 후순위 범위

### 2.1 MVP 포함

MVP는 아래 흐름이 끊기지 않는 것을 완료 기준으로 삼는다.

1. 로그인/회원가입 또는 개발용 세션으로 사용자 식별
2. 온보딩 프로필 저장
3. 오늘의 퀘스트 3개 생성
4. 퀘스트 완료 처리
5. 실패 이유 입력
6. 실패 이유 기반 재설계 퀘스트 생성
7. 대시보드에 오늘의 진행 상태와 재설계 기록 표시

MVP의 퀘스트 재료는 온보딩 프로필, 더미 공고, 사용자가 직접 저장한 공고 정도로 제한한다.

### 2.2 MVP에서 제외

- 실제 사람인/알바몬/고용24 크롤링 또는 API 연동
- 캘린더 연동과 알림
- 상담사, 관리자, 보호자 화면
- 정책 데이터 자동 업데이트
- 정교한 이력서 전문 편집기
- 음성 기반 모의면접
- 커뮤니티 기능
- 결제, 구독, 추천인, 랭킹 기능

### 2.3 후순위 기능

1. 이력서/자기소개서 피드백: 전체 대필이 아니라 오늘 수정할 항목 1~3개를 퀘스트로 연결한다.
2. 모의면접: 질문 생성, 답변 피드백, 다음 연습 미션 생성까지 연결한다.
3. 공고 저장함: 더미 공고와 수동 등록 공고를 저장하고 지원 상태를 관리한다.
4. 정책 추천: 확정 판정 없이 확인해볼 정책과 체크리스트를 보여준다.
5. 외부 연동: 실제 공고 API, 캘린더, 알림은 핵심 흐름이 완성된 뒤 검토한다.

## 3. MVP 유저 플로우

### 3.1 첫 방문 흐름

1. 사용자가 로그인 또는 회원가입을 한다.
2. 온보딩 상태가 없으면 온보딩 화면으로 이동한다.
3. 사용자는 거주 지역, 희망 직무, 희망 근무 형태, 취업 공백 기간, 이력서 보유 여부, 면접 경험 여부, 관심 분야, 오늘 가능한 에너지 수준을 입력한다.
4. 저장 후 오늘의 퀘스트 화면으로 이동한다.

### 3.2 오늘의 퀘스트 생성 흐름

1. 사용자가 오늘의 퀘스트 화면에서 생성 버튼을 누른다.
2. backend는 온보딩 프로필과 오늘 날짜 기준의 기존 퀘스트를 확인한다.
3. 이미 오늘 생성된 활성 퀘스트가 있으면 중복 생성하지 않고 기존 퀘스트를 반환한다.
4. 생성이 필요하면 AI 또는 fallback rule로 3개의 퀘스트를 만든다.
5. 각 퀘스트는 제목, 설명, 카테고리, 난이도, 예상 시간, 완료 기준, 실패 시 낮출 수 있는 방향을 가진다.

### 3.3 완료 흐름

1. 사용자가 퀘스트 카드에서 완료를 선택한다.
2. backend는 상태를 `DONE`으로 변경하고 완료 시간을 저장한다.
3. dashboard summary는 오늘 완료 수, 남은 수, 다음 행동을 갱신한다.

### 3.4 실패 후 재설계 흐름

1. 사용자가 실패를 선택한다.
2. UI는 실패 이유 선택과 선택적 메모 입력을 보여준다.
3. 사용자가 실패 이유를 제출한다.
4. backend는 원래 퀘스트를 `FAILED`로 기록하고 실패 기록을 저장한다.
5. backend는 실패 이유와 원래 퀘스트를 AI 또는 fallback rule에 전달한다.
6. 재설계 결과로 더 쉬운 퀘스트 1~3개를 생성하고 원래 퀘스트와 연결한다.
7. UI는 "다음에 할 더 작은 행동"으로 재설계 퀘스트를 보여준다.
8. dashboard는 실패 기록과 재설계된 다음 행동을 함께 표시한다.

### 3.5 실패 이유 분류

초기 enum은 아래 값으로 시작한다.

| 코드 | 표시 문구 | 재설계 방향 |
|---|---|---|
| `NOT_ENOUGH_TIME` | 시간이 부족했다 | 예상 시간을 줄이고 한 단계만 수행하게 한다 |
| `TOO_OVERWHELMING` | 너무 부담스러웠다 | 산출물을 만들기 전 읽기/고르기 수준으로 낮춘다 |
| `UNCLEAR_WHAT_TO_WRITE` | 무엇을 써야 할지 몰랐다 | 예시 수집, 키워드 나열, 첫 문장 작성으로 쪼갠다 |
| `MISSING_MATERIALS` | 필요한 자료가 없었다 | 자료 찾기나 링크 저장을 먼저 수행하게 한다 |
| `LOW_CONFIDENCE` | 자신감이 낮았다 | 평가성 표현을 피하고 작은 확인 행동으로 낮춘다 |
| `NOT_RELEVANT` | 공고나 주제가 맞지 않았다 | 직무/지역/관심 조건을 다시 좁히게 한다 |
| `LOW_ENERGY` | 오늘 에너지가 낮았다 | 5~10분 루틴 또는 읽기 중심 행동으로 낮춘다 |

UI 문구는 사용자를 평가하지 않고 상황을 설명하는 표현만 사용한다.

## 4. 도메인 모델 초안

### 4.1 핵심 엔티티

#### User

- `id`
- `email`
- `passwordHash`
- `name`
- `createdAt`
- `updatedAt`

#### OnboardingProfile

- `id`
- `userId`
- `region`
- `desiredJob`
- `desiredWorkType`
- `careerGapMonths`
- `hasResume`
- `interviewExperienceLevel`
- `interests`
- `defaultEnergyLevel`
- `createdAt`
- `updatedAt`

`OnboardingProfile`은 사용자를 평가하기 위한 데이터가 아니라 퀘스트 난이도와 소재를 조정하기 위한 context입니다.

#### DailyQuestSet

- `id`
- `userId`
- `questDate`
- `energyLevel`
- `status`
- `createdAt`
- `updatedAt`

하루 단위 퀘스트 묶음입니다. 같은 사용자와 날짜에 활성 `DailyQuestSet`은 하나만 유지합니다.

#### Quest

- `id`
- `dailyQuestSetId`
- `userId`
- `parentQuestId`
- `title`
- `description`
- `category`
- `difficulty`
- `estimatedMinutes`
- `completionCriteria`
- `status`
- `source`
- `sortOrder`
- `createdAt`
- `completedAt`

`parentQuestId`는 실패 후 재설계된 퀘스트가 원래 퀘스트를 추적하기 위해 사용합니다.

#### QuestFailure

- `id`
- `questId`
- `userId`
- `reason`
- `memo`
- `createdAt`

실패 기록은 재설계와 대시보드 설명에 사용합니다. 사용자를 평가하는 점수로 변환하지 않습니다.

#### QuestRedesign

- `id`
- `originalQuestId`
- `failureId`
- `redesignedQuestIds`
- `strategySummary`
- `createdAt`

재설계 결과와 원인을 추적합니다. 구현 초기에는 `redesignedQuestIds`를 join table로 분리해도 되고 JSON column으로 시작해도 됩니다.

#### DashboardSnapshot

- `userId`
- `date`
- `totalQuests`
- `doneQuests`
- `failedQuests`
- `redesignedQuests`
- `nextQuestId`
- `recentEvents`

초기에는 저장 엔티티가 아니라 조회용 response model로 만든다.

### 4.2 후순위 엔티티

#### Resume

- `id`
- `userId`
- `title`
- `content`
- `feedbackSummary`
- `createdAt`
- `updatedAt`

#### InterviewPractice

- `id`
- `userId`
- `question`
- `answer`
- `feedback`
- `createdAt`

점수화는 MVP에서 제외합니다. 필요하면 구조화 피드백만 저장합니다.

#### JobPosting

- `id`
- `title`
- `company`
- `location`
- `jobType`
- `deadline`
- `source`
- `url`
- `createdAt`

MVP에서는 더미 데이터 또는 사용자가 직접 등록한 데이터만 사용합니다.

#### SavedJob

- `id`
- `userId`
- `jobPostingId`
- `status`
- `memo`
- `createdAt`
- `updatedAt`

#### Policy

- `id`
- `title`
- `description`
- `targetSummary`
- `checklist`
- `link`
- `createdAt`

정책은 추천이 아니라 "확인해볼 항목"으로 표현합니다.

### 4.3 enum 초안

```text
QuestCategory = RESUME, JOB_SEARCH, INTERVIEW, LEARNING, POLICY, ROUTINE
QuestDifficulty = TINY, EASY, NORMAL
QuestStatus = TODO, DONE, FAILED, REDESIGNED, SKIPPED
QuestSource = AI, FALLBACK_RULE, MANUAL
EnergyLevel = LOW, MEDIUM, HIGH
DailyQuestSetStatus = ACTIVE, ARCHIVED
SavedJobStatus = INTERESTED, PREPARING, APPLIED, INTERVIEWING, REJECTED, ACCEPTED
```

`QuestDifficulty`는 MVP에서 어려운 과제를 만들지 않기 위해 `HARD`를 두지 않습니다. 후순위 기능에서 필요해질 때만 추가합니다.

## 5. AI 출력 및 검증 기준

LLM 응답은 자연어 본문 파싱이 아니라 JSON schema 또는 DTO 검증을 통과한 구조만 저장합니다.

### 5.1 오늘의 퀘스트 생성 응답

```json
{
  "quests": [
    {
      "title": "관심 공고 2개 저장하기",
      "description": "희망 직무와 지역에 맞는 공고를 2개 찾아 저장합니다.",
      "category": "JOB_SEARCH",
      "difficulty": "EASY",
      "estimatedMinutes": 15,
      "completionCriteria": "공고 2개를 저장하면 완료",
      "fallbackStrategy": "직무 키워드 1개만 검색하기"
    }
  ]
}
```

검증 규칙:

- `quests`는 정확히 3개를 기본값으로 한다.
- `estimatedMinutes`는 5~30 사이여야 한다.
- `category`, `difficulty`는 enum 값만 허용한다.
- 제목과 설명에 상담, 진단, 의지 평가 표현이 들어가면 저장하지 않는다.
- 검증 실패, provider timeout, quota 초과는 구분 가능한 에러로 처리하고 fallback rule을 사용할 수 있게 한다.

### 5.2 재설계 응답

```json
{
  "strategySummary": "작성 부담을 줄이고 키워드 나열부터 시작하도록 낮춤",
  "quests": [
    {
      "title": "프로젝트에서 사용한 기술 3개 적기",
      "description": "완성된 문장을 쓰지 말고 기술 이름 3개만 적습니다.",
      "category": "RESUME",
      "difficulty": "TINY",
      "estimatedMinutes": 5,
      "completionCriteria": "기술 이름 3개를 적으면 완료"
    }
  ]
}
```

검증 규칙:

- 재설계 퀘스트는 원래 퀘스트보다 같거나 쉬워야 한다.
- 재설계 퀘스트는 1~3개를 허용한다.
- 실패 이유가 prompt와 저장 데이터에 포함되어야 한다.
- 사용자를 탓하는 표현은 허용하지 않는다.

## 6. API 초안

API path는 MVP 구현자가 그대로 시작할 수 있는 초안이며, 세부 field 이름은 DTO 작성 시 이 문서를 기준으로 맞춘다.

### 6.1 Auth / User

| Method | Path | 목적 |
|---|---|---|
| `POST` | `/api/auth/signup` | 회원가입 |
| `POST` | `/api/auth/login` | 로그인 |
| `GET` | `/api/users/me` | 현재 사용자와 온보딩 완료 여부 조회 |

개발 초기에는 실제 인증을 간소화할 수 있지만, controller contract는 유지합니다.

### 6.2 Onboarding

| Method | Path | 목적 |
|---|---|---|
| `GET` | `/api/onboarding/me` | 내 온보딩 프로필 조회 |
| `PUT` | `/api/onboarding/me` | 온보딩 프로필 생성 또는 수정 |

`PUT /api/onboarding/me` request 핵심 field:

```json
{
  "region": "서울",
  "desiredJob": "백엔드 개발자",
  "desiredWorkType": "FULL_TIME",
  "careerGapMonths": 8,
  "hasResume": true,
  "interviewExperienceLevel": "LOW",
  "interests": ["Java", "Spring"],
  "defaultEnergyLevel": "LOW"
}
```

### 6.3 Daily Quests

| Method | Path | 목적 |
|---|---|---|
| `GET` | `/api/daily-quest-sets/today` | 오늘의 퀘스트 묶음 조회 |
| `POST` | `/api/daily-quest-sets/today` | 오늘의 퀘스트 생성. 이미 있으면 기존 묶음 반환 |
| `PATCH` | `/api/quests/{questId}/complete` | 퀘스트 완료 처리 |
| `POST` | `/api/quests/{questId}/failures` | 실패 이유 저장과 재설계 퀘스트 생성 |
| `PATCH` | `/api/quests/{questId}/skip` | 선택적 건너뛰기. MVP에서는 낮은 우선순위 |

`POST /api/quests/{questId}/failures` request:

```json
{
  "reason": "UNCLEAR_WHAT_TO_WRITE",
  "memo": "지원동기에 어떤 경험을 넣어야 할지 모르겠음"
}
```

response는 실패 처리된 원래 퀘스트와 새로 생성된 재설계 퀘스트를 함께 반환합니다.

### 6.4 Dashboard

| Method | Path | 목적 |
|---|---|---|
| `GET` | `/api/dashboard/today` | 오늘 진행률, 실패/재설계 기록, 다음 행동 조회 |

dashboard response에는 평가 점수 대신 count, timeline, next action만 포함합니다.

### 6.5 후순위 API

| Method | Path | 목적 |
|---|---|---|
| `POST` | `/api/resumes` | 이력서 저장 |
| `GET` | `/api/resumes` | 이력서 목록 |
| `POST` | `/api/resumes/{resumeId}/feedback` | 피드백과 다음 수정 퀘스트 생성 |
| `POST` | `/api/interviews/questions` | 모의면접 질문 생성 |
| `POST` | `/api/interviews/feedback` | 답변 피드백과 다음 연습 퀘스트 생성 |
| `GET` | `/api/jobs` | 더미/수동 공고 목록 |
| `POST` | `/api/jobs/{jobId}/save` | 공고 저장 |
| `GET` | `/api/saved-jobs` | 저장한 공고 조회 |
| `PATCH` | `/api/saved-jobs/{savedJobId}/status` | 지원 상태 수정 |
| `GET` | `/api/policies` | 정책 목록 |
| `POST` | `/api/policies/recommendations` | 확인해볼 정책 추천 |

## 7. 화면 흐름

### 7.1 MVP 화면 목록

| Route | 화면 | 책임 |
|---|---|---|
| `/login` | 로그인/회원가입 | 사용자 식별 |
| `/onboarding` | 온보딩 | 퀘스트 생성을 위한 context 수집 |
| `/today` | 오늘의 퀘스트 | 오늘의 퀘스트 생성, 카드 목록, 완료/실패 진입 |
| `/quests/:questId` | 퀘스트 상세 | 설명, 완료 기준, 완료/실패 action |
| `/quests/:questId/fail` | 실패 이유 입력 | 실패 이유 선택, 메모 입력, 재설계 요청 |
| `/dashboard` | 대시보드 | 오늘 진행률, 실패 후 재설계 기록, 다음 행동 |

`/today`와 `/dashboard`는 초기 구현에서 하나의 page 안에 section으로 구성해도 됩니다. 단, route 책임이 섞여 복잡해지면 분리합니다.

### 7.2 로그인 이후 라우팅 규칙

```text
로그인 성공
-> 온보딩 미완료: /onboarding
-> 온보딩 완료: /today
```

앱 첫 화면은 제품 설명 랜딩이 아니라 사용자가 바로 행동을 시작하는 화면이어야 합니다.

### 7.3 오늘의 퀘스트 화면 구성

- 상단: 오늘 날짜, 오늘 에너지 수준, 퀘스트 생성/새로고침 버튼
- 본문: 퀘스트 카드 3개
- 카드: 카테고리, 제목, 예상 시간, 완료 기준, 완료 버튼, 실패 버튼
- 하단 또는 side panel: 오늘 진행률과 다음 행동 요약

문구 기준:

- 사용: "오늘 할 수 있는 작은 행동", "더 쉬운 단계로 다시 나눴어요", "다음 행동"
- 금지: "의지 부족", "위험", "문제 상태", "관리 필요", "진단"

### 7.4 실패 이유 화면 구성

- 원래 퀘스트 요약
- 실패 이유 segmented control 또는 radio list
- 선택적 메모 textarea
- 제출 버튼
- 제출 후 재설계 퀘스트 목록

실패 이유 선택은 사용자가 자신을 평가하게 만드는 UI가 아니라 상황을 고르는 UI로 설계합니다.

### 7.5 대시보드 구성

- 오늘 진행률: 완료/전체 count
- 재설계 기록: 실패한 퀘스트, 실패 이유, 새 퀘스트
- 다음 행동: 가장 작고 바로 실행 가능한 TODO 퀘스트
- 최근 활동 timeline

대시보드에는 streak, ranking, 의지 점수 같은 평가성 지표를 넣지 않습니다.

## 8. 구현 우선순위

### 8.1 Backend 우선순위

1. domain enum과 entity 초안: `User`, `OnboardingProfile`, `DailyQuestSet`, `Quest`, `QuestFailure`
2. onboarding 저장/조회 API
3. 오늘의 퀘스트 생성/조회 API. 초기에는 deterministic fallback rule로 동작 가능하게 구현
4. 완료 처리 API
5. 실패 이유 저장과 재설계 API
6. dashboard summary API
7. AI provider port와 JSON schema 검증. provider 실패 시 fallback rule 유지

backend는 Controller, application service, domain, infrastructure 계층을 분리합니다. LLM provider 호출은 application service에서 직접 하지 않고 `QuestAiClient` 같은 port 뒤에 둡니다.

### 8.2 Frontend 우선순위

1. route 골격: `/login`, `/onboarding`, `/today`, `/dashboard`
2. onboarding form과 API 연동
3. today quest list, quest card, complete/fail action
4. failure reason form과 redesign 결과 표시
5. dashboard summary 표시
6. loading, empty, error state 정리

frontend는 feature 단위로 나눕니다.

```text
src/features/onboarding/
src/features/quests/
src/features/dashboard/
```

페이지 컴포넌트는 조립만 담당하고 API 호출, form state, view model은 hook/service로 분리합니다.

### 8.3 AI 연동 우선순위

1. fallback rule로 전체 MVP 흐름을 먼저 완성한다.
2. `QuestAiClient` contract와 DTO 검증을 만든다.
3. 오늘의 퀘스트 생성에 AI를 연결한다.
4. 실패 후 재설계에 AI를 연결한다.
5. provider timeout, quota 초과, JSON 검증 실패를 구분한다.

AI가 실패해도 사용자는 fallback rule 기반 퀘스트를 받아야 합니다.

### 8.4 QA 우선순위

1. 온보딩 완료 후 `/today`로 이동하는지 확인
2. 오늘의 퀘스트가 3개 생성되는지 확인
3. 완료 처리 후 dashboard count가 반영되는지 확인
4. 실패 이유 제출 후 더 쉬운 퀘스트가 생성되는지 확인
5. 화면 문구가 상담/감시/평가처럼 보이지 않는지 확인
6. 실제 채용 사이트 크롤링이나 정책 확정 판정이 섞이지 않았는지 확인

## 9. 데모 시나리오

포트폴리오 시연은 아래 흐름을 기준으로 합니다.

1. 사용자가 온보딩을 입력한다.
   - 취업 공백 8개월
   - 희망 직무: 백엔드 개발자
   - 이력서 있음
   - 면접 경험 적음
   - 오늘 에너지 낮음
2. AI 또는 fallback rule이 오늘의 퀘스트 3개를 생성한다.
   - 공고 2개 저장하기
   - 이력서 프로젝트 설명 한 문단 수정하기
   - 공백 기간 답변 3문장 작성하기
3. 사용자가 이력서 수정 퀘스트를 실패 처리한다.
   - 실패 이유: 무엇을 써야 할지 몰랐다
4. 시스템이 더 쉬운 퀘스트로 재설계한다.
   - 프로젝트에서 사용한 기술 3개만 적기
   - 맡은 역할 1문장만 적기
   - 문제 해결 경험 1개만 고르기
5. 대시보드에 오늘의 진행률, 실패 후 재설계 기록, 다음 행동이 표시된다.

## 10. 리뷰 체크리스트

- 사용자 목표와 금지 범위가 기능/문구에 반영되었는가?
- MVP가 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영`으로 닫히는가?
- 실패 이유와 재설계 결과가 도메인 모델에 남는가?
- LLM 응답은 JSON schema/DTO 검증을 통과한 뒤 저장되는가?
- 실제 채용 사이트 크롤링, 상담/관리자 화면, 정책 확정 판정이 MVP에 섞이지 않았는가?
- frontend/backend 변경이 기능별 책임 분리 기준을 따르는가?
