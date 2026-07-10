# Re:Start Quest MVP 설계 문서

## 1. 목적

Re:Start Quest는 취업 정보를 많이 보여주는 종합 앱이 아니라, 구직 행동이 멈춘 사용자가 다시 시작하도록 돕는 재진입 엔진이다.

MVP의 핵심은 아래 흐름을 작게 완성하는 것이다.

```text
온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

이 흐름 밖의 이력서 첨삭, 모의면접, 공고 저장, 정책 추천은 첫 버전에서 보조 기능으로 둔다. 실패 후 더 작은 행동으로 재설계되는 경험이 없으면 이 서비스의 차별점도 사라진다.

## 2. MVP 범위

### 2.1 1차 범위

- 로그인/회원가입
- 온보딩 입력
- 오늘의 퀘스트 3개 생성
- 퀘스트 완료 처리
- 퀘스트 실패 이유 입력
- 실패 이유 기반 퀘스트 재설계
- 대시보드 진행 상태 반영

### 2.2 2차 범위

- 이력서/자기소개서 입력과 피드백
- 모의면접 질문 생성과 답변 피드백
- 더미 공고 저장
- 초기 정책 데이터 추천

### 2.3 MVP 제외

- 실제 채용 사이트 크롤링
- 정책 대상 여부 확정 판정
- 상담사/관리자 화면
- 사용자 의지 점수, 위험 점수, 감시성 리포트
- 정신건강 상담 또는 치료 기능처럼 보이는 표현

## 3. 핵심 사용자 시나리오

### 3.1 첫 진입

1. 사용자가 회원가입 또는 로그인을 한다.
2. 온보딩에서 희망 직무, 취업 공백 기간, 이력서 보유 여부, 면접 경험, 오늘 가능한 에너지 수준을 입력한다.
3. 시스템은 사용자의 상태를 평가하지 않고, 오늘 퀘스트 난이도 조절에만 사용한다고 안내한다.

### 3.2 오늘의 퀘스트 실행

1. 홈 대시보드에서 오늘의 진행 상태와 다음 행동을 확인한다.
2. 사용자가 `오늘의 퀘스트 생성`을 누른다.
3. 시스템은 10~30분 안에 실행 가능한 퀘스트 3개를 보여준다.
4. 사용자는 각 퀘스트를 완료하거나 실패 처리한다.

### 3.3 실패 후 재설계

1. 사용자가 실패 처리 버튼을 누른다.
2. 실패 이유를 선택한다.
3. 시스템은 실패 이유에 맞춰 더 작은 행동으로 퀘스트를 재설계한다.
4. 대시보드는 실패 기록을 비난 없이 보여주고, 바로 실행할 다음 행동을 강조한다.

## 4. 화면 흐름

```text
LoginPage
  -> OnboardingPage
  -> DashboardPage
      -> TodayQuestPage
          -> QuestDetailPage
              -> FailureReasonModal
              -> RedesignedQuestPanel
      -> ActivityHistoryPage
```

### 4.1 로그인 / 회원가입

- 목적: 인증 진입점 제공
- 주요 상태: 입력 전, 검증 실패, 제출 중, 인증 실패, 성공
- 주의: MVP에서는 복잡한 소셜 로그인보다 기본 이메일 인증 흐름을 우선한다.

### 4.2 온보딩

- 목적: 오늘의 퀘스트 난이도와 방향을 조절할 최소 정보 수집
- 필수 입력: 희망 직무, 취업 공백 기간, 이력서 보유 여부, 면접 경험, 오늘 에너지 수준
- 선택 입력: 지역, 희망 근무 형태, 관심 분야
- 접근성: 라디오/셀렉트 그룹은 명확한 label과 error text를 연결한다.
- 문구 원칙: "평가"가 아니라 "퀘스트 조절"을 위한 입력임을 유지한다.

### 4.3 홈 대시보드

- 목적: 오늘의 진행률, 재설계 기록, 다음 행동을 한 화면에서 보여준다.
- 주요 영역:
  - 오늘 진행률
  - 남은 퀘스트
  - 재설계된 퀘스트
  - 다음 행동 CTA
- 빈 상태: 온보딩 전, 퀘스트 생성 전, 오늘 기록 없음

### 4.4 오늘의 퀘스트

- 목적: 오늘 할 수 있는 3개 퀘스트를 실행 단위로 보여준다.
- 카드 정보: 제목, 카테고리, 예상 소요 시간, 난이도, 완료 기준
- 주요 액션: 완료, 실패, 상세 보기
- 반응형: 모바일에서는 카드가 1열, 태블릿 이상에서는 2~3열로 정렬된다.

### 4.5 퀘스트 상세 / 실패 입력

- 목적: 사용자가 실패 이유를 남기고 재설계를 요청할 수 있게 한다.
- 실패 이유 예시:
  - 시간이 부족했다
  - 너무 부담스러웠다
  - 무엇을 써야 할지 몰랐다
  - 자료가 없었다
  - 자신감이 낮았다
  - 오늘 컨디션이 낮았다
- 주의: 실패 입력 화면은 반성문처럼 보이면 안 된다. 재설계에 필요한 조건 선택으로 표현한다.

### 4.6 재설계 결과

- 목적: 기존 퀘스트보다 더 작은 행동을 즉시 제시한다.
- 표시 항목: 원래 퀘스트, 선택한 실패 이유, 재설계된 작은 행동, 예상 시간
- 주요 액션: 새 퀘스트로 시작, 나중에 하기
- 성공 기준: 사용자가 실패 직후에도 다음 행동을 한 문장으로 이해할 수 있다.

## 5. 프론트엔드 상태 모델

### 5.1 QuestStatus

```ts
type QuestStatus = "TODO" | "DONE" | "FAILED" | "SKIPPED" | "REGENERATED";
```

`SKIPPED`는 이후 확장을 위한 예약 상태이며, MVP 기본 API 흐름은 `TODO`, `DONE`, `FAILED`, `REGENERATED`를 사용한다.

### 5.2 FailureReason

```ts
type FailureReason =
  | "NO_TIME"
  | "TOO_HARD"
  | "DONT_KNOW_WHAT_TO_WRITE"
  | "NO_MATERIAL"
  | "LOW_CONFIDENCE"
  | "LOW_ENERGY";
```

### 5.3 QuestViewModel

```ts
type QuestViewModel = {
  id: string;
  title: string;
  description: string;
  category: "RESUME" | "JOB_SEARCH" | "INTERVIEW" | "LEARNING" | "POLICY" | "ROUTINE";
  difficulty: "VERY_EASY" | "EASY" | "NORMAL";
  estimatedMinutes: number;
  completionCriteria: string;
  status: QuestStatus;
  redesignedFromQuestId?: string;
};
```

## 6. API 초안

상세 요청/응답, 상태 전이, 에러 코드, AI 오케스트레이션 계약은 [백엔드 API 계약 초안](BACKEND_API_CONTRACT.md)을 기준으로 구현한다. 이 문서의 API 목록은 화면 흐름에서 필요한 엔드포인트를 요약한 것이며, 충돌 시 `BACKEND_API_CONTRACT.md`를 우선한다.

### 6.1 인증

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/users/me`

### 6.2 온보딩

- `POST /api/onboarding`
- `GET /api/onboarding/me`

### 6.3 퀘스트

- `GET /api/quests/today?date=YYYY-MM-DD`
- `POST /api/quests/generate`
- `PATCH /api/quests/{questId}/complete`
- `PATCH /api/quests/{questId}/fail`
- `POST /api/quests/{questId}/redesign`

### 6.4 대시보드

- `GET /api/dashboard?date=YYYY-MM-DD`

### 6.5 MVP 이후 확장 후보

이력서, 면접, 공고, 정책 기능은 이번 MVP API 계약에 포함하지 않는다. 확장 시 별도 work item에서 API 계약, 데이터 모델, QA 기준을 다시 작성한다.

## 7. 도메인 모델 초안

### 7.1 User

- `id`
- `email`
- `name`
- `region`
- `careerGapMonths`
- `desiredJob`
- `desiredWorkType`
- `energyLevel`
- `createdAt`

### 7.2 Quest

- `id`
- `userId`
- `title`
- `description`
- `category`
- `difficulty`
- `estimatedMinutes`
- `completionCriteria`
- `status`
- `dueDate`
- `generatedByAi`
- `redesignedFromQuestId`
- `createdAt`
- `completedAt`

### 7.3 QuestFailure

- `id`
- `questId`
- `userId`
- `reason`
- `memo`
- `createdAt`

### 7.4 QuestRedesign

- `id`
- `originalQuestId`
- `failureId`
- `newQuestId`
- `failureReason`
- `redesignSummary`
- `createdAt`

### 7.5 DashboardSummary

- `userId`
- `todayTotalCount`
- `todayDoneCount`
- `todayFailedCount`
- `todayRedesignedCount`
- `nextQuestId`

## 8. AI 출력 계약

LLM 응답은 자연어 문자열 파싱이 아니라 JSON schema/DTO로 검증한다.

### 8.1 퀘스트 생성 응답

```json
{
  "quests": [
    {
      "title": "관심 공고 2개 저장하기",
      "description": "희망 직무와 지역에 맞는 공고를 2개 찾아 저장합니다.",
      "category": "JOB_SEARCH",
      "difficulty": "EASY",
      "estimatedMinutes": 15,
      "completionCriteria": "공고 2개 저장"
    }
  ]
}
```

### 8.2 재설계 응답

```json
{
  "originalQuestId": "quest-1",
  "failureReason": "DONT_KNOW_WHAT_TO_WRITE",
  "redesignedQuest": {
    "title": "프로젝트에서 사용한 기술 3개만 적기",
    "description": "자기소개서를 작성하기 전에 사용한 기술 이름만 먼저 적습니다.",
    "category": "RESUME",
    "difficulty": "VERY_EASY",
    "estimatedMinutes": 5,
    "completionCriteria": "기술 키워드 3개 작성"
  },
  "redesignSummary": "작성 부담을 낮추기 위해 문장 작성 전 키워드 수집 단계로 줄였습니다."
}
```

## 9. 작업 우선순위

### P0

- 제품 방향성 문구 확정
- 온보딩 입력 항목 확정
- 퀘스트 생성/실패/재설계 도메인 모델 확정
- 오늘의 퀘스트와 대시보드 화면 골격
- 실패 이유 선택과 재설계 결과 UI

### P1

- API DTO와 프론트 타입 정렬
- 서버 상태 관리 hook 분리
- 폼 검증과 접근성 에러 연결
- 퀘스트 완료/실패 mutation
- 재설계 결과 저장 후 대시보드 반영

### P2

- 이력서 피드백 화면
- 모의면접 화면
- 더미 공고 저장함
- 초기 정책 추천 화면

## 10. 책임 분리 가드레일

### 10.1 프론트엔드

- 페이지 컴포넌트는 route 단위 화면 조립만 담당한다.
- API 호출, form state, mutation은 hook/service로 분리한다.
- feature 폴더는 `features/onboarding`, `features/quests`, `features/dashboard`를 먼저 둔다.
- 퀘스트 카드, 실패 이유 선택, 재설계 결과, 진행률 요약은 독립 컴포넌트로 분리한다.
- 한 컴포넌트가 250줄을 넘으면 책임이 섞였는지 검토한다.

### 10.2 백엔드

- Controller는 요청/응답 매핑과 검증만 담당한다.
- use case는 `GenerateDailyQuestService`, `FailQuestService`, `RedesignQuestService`처럼 흐름별로 분리한다.
- LLM provider 호출은 application service가 직접 구현하지 않고 port/interface 뒤에 둔다.
- 실패 이유와 난이도 정책은 enum/value object로 검증한다.

### 10.3 리뷰 차단 조건

- 실패 이유 기반 재설계가 빠진 화면 또는 API
- 사용자 평가, 감시, 의지 점수처럼 해석되는 문구
- 자연어 AI 응답을 그대로 파싱하는 구현
- MVP 핵심 흐름보다 실제 채용 사이트 크롤링을 먼저 구현하는 변경
- 큰 파일을 유지하면서 책임 분리 근거가 없는 변경

## 11. 시각 검증 기준

현재 레포에는 실행 가능한 프론트엔드 앱이 없으므로 이번 작업의 시각 검증 대상은 화면 흐름 문서다. 이후 React 앱 골격이 생기면 아래 기준으로 스크린샷을 남긴다.

- 모바일 390px: 온보딩 폼, 퀘스트 카드 1열, 실패 이유 모달
- 태블릿 768px: 대시보드와 퀘스트 목록
- 데스크톱 1280px: 대시보드, 재설계 결과 패널
- 키보드 이동: 실패 이유 선택과 CTA 버튼 focus 순서
- 텍스트 검토: 상담/감시/평가로 보이는 문구 없음
