# TASK-046 Re:Start Quest MVP 회의 결론

## 1. 종합 결론

Re:Start Quest의 최종 MVP 방향은 **취업 종합 앱**이 아니라 **구직 행동 재진입 엔진**이다.

서비스가 증명해야 할 핵심 경험은 아래 한 줄이다.

```text
온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

이력서 첨삭, 모의면접, 공고 저장, 정책 추천은 모두 이 흐름을 보조하는 재료로만 다룬다. MVP에서 여러 기능을 병렬로 넓히는 것보다, 실패 후 더 작은 행동으로 다시 시작하게 만드는 반복 루프를 끝까지 구현하는 것이 우선이다.

참고한 회의 입력은 TASK-045 설계자, 프론트엔드, 백엔드, QA 보고서다. 직전 TASK-045 묶음에는 reviewer report가 없었으므로 reviewer 기준은 `AGENTS.md`와 `docs/CODE_QUALITY_GUARDRAILS.md`의 차단 조건을 반영했다.

## 2. 사용자 목표와 금지 범위

### 사용자 목표

- 취업 공백자가 오늘 다시 시작할 수 있는 10~30분 단위 행동을 받는다.
- 사용자는 실패했을 때 이유를 고르고, 같은 목표를 더 쉬운 행동으로 다시 받는다.
- 사용자는 대시보드에서 완료율보다 다음 행동과 재설계 기록을 확인한다.
- 온보딩 정보는 사용자를 평가하기 위한 값이 아니라 퀘스트 난이도와 방향을 조절하기 위한 값이다.

### 금지 범위

- 정신건강 상담, 치료, 진단, 위험도 판정처럼 보이는 표현과 기능은 넣지 않는다.
- 취업 의지 점수, 성실도 점수, 위험 점수처럼 사용자를 평가하는 지표를 만들지 않는다.
- 실제 채용 사이트 크롤링은 MVP 범위가 아니다.
- 정부지원정책 대상 여부를 확정 판정하지 않는다.
- 이력서 대필, 면접 점수화, 관리자 감시 화면을 핵심 흐름보다 먼저 만들지 않는다.
- 기능 설명용 랜딩 페이지를 첫 화면으로 만들지 않는다.

## 3. MVP 범위

### MVP 필수

1. 최소 사용자 식별
   - 구현 초반에는 데모용 mock user로 시작할 수 있다.
   - 배포 전에는 최소 로그인과 사용자별 데이터 격리를 추가한다.
2. 온보딩
   - 희망 직무, 취업 공백 기간, 이력서 보유 여부, 면접 경험, 오늘 에너지 수준을 받는다.
3. 오늘의 퀘스트 생성
   - 하루 3개 정도의 작은 퀘스트를 생성한다.
   - 각 퀘스트는 제목, 설명, 카테고리, 난이도, 예상 시간, 완료 기준을 가진다.
4. 완료/실패 처리
   - 퀘스트는 완료 또는 실패 처리할 수 있다.
   - 실패에는 반드시 분류 가능한 실패 이유가 필요하다.
5. 실패 후 재설계
   - 실패한 퀘스트를 더 낮은 난이도와 더 짧은 예상 시간의 행동으로 재설계한다.
   - 재설계 결과는 원 퀘스트와 연결된 기록으로 남긴다.
6. 대시보드
   - 오늘 진행 상태, 재설계 횟수, 다음 행동, 최근 실행 기록만 먼저 보여준다.

### 후순위

- 이력서/자기소개서 전문 피드백 화면
- 모의면접 질문 생성과 답변 피드백
- 더미 공고 저장함의 고도화
- 정책 추천 상세 화면
- 실제 채용 사이트 API/크롤링
- 캘린더/알림 연동
- 관리자/상담사 화면
- 장기 통계, 랭킹, 게임화 점수

## 4. 도메인 결정

### 핵심 모델

- `OnboardingProfile`
  - 사용자 현재 상태와 퀘스트 생성 조건을 담는다.
- `Quest`
  - 오늘 실행할 구직 행동 단위다.
- `QuestAttempt` 또는 `QuestHistory`
  - 완료, 실패, 재설계 같은 실행 기록을 남긴다.
- `RedesignHistory`
  - 실패 이유와 재설계 결과를 원 퀘스트와 연결한다.
- `DashboardSummary`
  - 퀘스트 기록에서 읽기 전용으로 계산되는 요약이다.

### enum 후보

- `QuestStatus`
  - `TODO`, `DONE`, `FAILED`, `REDESIGNED`
- `QuestCategory`
  - `RESUME`, `JOB_SEARCH`, `INTERVIEW`, `LEARNING`, `POLICY`, `ROUTINE`
- `QuestDifficulty`
  - `EASY`, `NORMAL`, `HARD`
- `FailureReason`
  - `TIME_SHORTAGE`
  - `TOO_BURDENSOME`
  - `DONT_KNOW_WHAT_TO_WRITE`
  - `LACK_OF_MATERIAL`
  - `LOW_CONFIDENCE`
  - `LOW_CONDITION`
  - `JOB_NOT_APPEALING`

### 상태 전이 규칙

- `TODO -> DONE`은 완료 처리다.
- `TODO -> FAILED`는 실패 이유가 있을 때만 가능하다.
- `FAILED -> REDESIGNED`는 재설계 결과가 저장된 뒤 가능하다.
- `DONE` 상태 퀘스트는 실패 처리하거나 재설계하지 않는다.
- 재설계 퀘스트는 원 퀘스트보다 난이도나 예상 시간이 낮아야 한다.
- 자연어 문자열을 파싱해서 상태나 이유를 판단하지 않는다.

## 5. API 결정

MVP API는 아래 흐름만 먼저 고정한다.

```text
POST  /api/onboarding
GET   /api/onboarding/me
POST  /api/quests/generate
GET   /api/quests/today
PATCH /api/quests/{id}/complete
PATCH /api/quests/{id}/fail
POST  /api/quests/{id}/redesign
GET   /api/dashboard
```

`PATCH /api/quests/{id}/fail` 요청에는 `failureReason` enum이 필수다.

LLM 응답은 JSON DTO로 검증한 뒤 저장한다. 최소 필드는 아래와 같다.

```json
{
  "title": "관심 공고 2개 저장하기",
  "description": "희망 직무 키워드로 공고를 찾아 2개만 저장합니다.",
  "category": "JOB_SEARCH",
  "difficulty": "EASY",
  "estimatedMinutes": 15,
  "completionCriteria": "공고 2개를 저장하면 완료",
  "fallbackQuest": "공고 사이트에서 직무 키워드 1개만 검색하기"
}
```

AI 오류는 사용자 경험과 운영 로그에서 구분 가능해야 한다.

- `AI_TIMEOUT`
- `AI_QUOTA_EXCEEDED`
- `AI_INVALID_RESPONSE`
- `AI_PROVIDER_UNAVAILABLE`

초기 구현은 `QuestAiClient` port와 mock adapter를 먼저 만들고, 실제 provider adapter는 교체 가능한 구조로 붙인다.

## 6. 화면 흐름 결정

첫 화면은 랜딩 페이지가 아니라 작업 화면이다.

```text
온보딩 없음
-> OnboardingPage
-> 오늘의 퀘스트 생성
-> TodayQuestPage
-> 완료 또는 막힌 이유 선택
-> RedesignResult
-> DashboardPage
```

온보딩이 이미 있으면 오늘의 퀘스트 또는 대시보드로 진입한다.

### 화면 책임

- `OnboardingPage`
  - 현재 상태와 오늘 에너지 입력만 담당한다.
- `TodayQuestPage`
  - 퀘스트 생성, 목록, 완료/실패 CTA를 담당한다.
- `FailureReasonSelect`
  - 실패 이유를 접근 가능한 라디오/버튼 semantics로 받는다.
- `RedesignedQuestList`
  - 더 쉬워진 행동과 원 퀘스트와의 연결을 보여준다.
- `DashboardPage`
  - 진행률보다 다음 행동, 재설계 기록, 오늘 상태를 우선 보여준다.

### 필수 UI 상태

- 생성 전 empty
- 생성 중 loading
- 생성 실패 error와 재시도
- 퀘스트 완료
- 실패 이유 선택 전/후
- 재설계 요청 중
- 재설계 완료
- 대시보드 반영 완료

문구는 "실패했습니다"를 강조하지 않는다. "오늘 막힌 이유를 골라 더 작은 행동으로 바꿔볼게요"처럼 재시작 중심으로 쓴다.

## 7. 구현 우선순위

1. 도메인/API/AI JSON 계약 확정
   - 프론트와 백엔드가 같은 타입과 상태 전이를 보게 만든다.
2. 백엔드 핵심 도메인과 mock AI adapter
   - 퀘스트 생성, 실패 처리, 재설계, 대시보드 요약을 mock user 기준으로 동작시킨다.
3. 프론트 MVP 화면 골격
   - 온보딩, 오늘의 퀘스트, 실패 이유, 재설계 결과, 대시보드를 연결한다.
4. API 연동
   - loading, empty, error, retry 상태까지 포함한다.
5. 최소 인증과 사용자별 데이터 격리
   - 핵심 루프를 압도하지 않는 범위로 붙인다.
6. 실제 LLM provider adapter
   - JSON schema 검증, timeout, quota, invalid response 처리를 포함한다.
7. QA smoke/e2e와 UX 카피 검수
   - 낮은 에너지 사용자와 실패 후 재설계 흐름을 우선 검증한다.

## 8. 다음 task 후보

### TASK-047: MVP 도메인/API/AI 계약 문서 확정

- 담당 후보: design + backend + frontend
- 산출물: enum, DTO, endpoint, AI response schema, 오류 코드 문서
- 완료 기준: 프론트/백엔드가 같은 계약으로 mock 구현을 시작할 수 있다.

### TASK-048: 백엔드 퀘스트 핵심 use case 구현

- 담당 후보: backend
- 범위: `GenerateDailyQuestService`, `FailQuestService`, `RedesignQuestService`, `DashboardSummaryService`
- 완료 기준: mock AI client로 생성, 실패, 재설계, 대시보드 요약 테스트가 통과한다.

### TASK-049: 프론트 핵심 플로우 prototype 구현

- 담당 후보: frontend
- 범위: 온보딩, 오늘의 퀘스트, 실패 이유 선택, 재설계 결과, 대시보드
- 완료 기준: mock API로 핵심 시나리오를 끊김 없이 시연할 수 있다.

### TASK-050: 프론트/백엔드 API 연동

- 담당 후보: frontend + backend
- 범위: 퀘스트 생성, 완료, 실패, 재설계, 대시보드 반영
- 완료 기준: 브라우저에서 MVP 핵심 흐름이 실제 API로 동작한다.

### TASK-051: LLM provider adapter와 JSON 검증

- 담당 후보: backend
- 범위: `QuestAiClient` 실제 구현, schema validation, 오류 구분
- 완료 기준: invalid JSON, timeout, quota 초과가 구분되어 처리된다.

### TASK-052: QA 핵심 시나리오와 카피 검수

- 담당 후보: QA
- 범위: 낮은 에너지 온보딩, 실패 이유별 재설계, 대시보드 반영, 금지 문구 검수
- 완료 기준: MVP 회귀 체크리스트와 smoke/e2e 후보가 정리된다.

### TASK-053: 최소 인증과 사용자별 데이터 격리

- 담당 후보: backend + frontend
- 범위: 로그인/회원가입, 현재 사용자 조회, 사용자별 퀘스트 격리
- 완료 기준: 포트폴리오 배포 전에 사용자 데이터가 섞이지 않는다.

## 9. 리뷰 기준

리뷰어는 구현 PR에서 아래 항목을 차단 기준으로 본다.

- 실패 후 재설계 흐름 없이 주변 기능이 먼저 커지는 변경
- LLM 응답을 JSON 검증 없이 자연어 문자열로 파싱하는 변경
- 실패 이유가 enum/DTO가 아니라 임의 텍스트로만 저장되는 변경
- 사용자 평가, 감시, 상담 서비스처럼 읽히는 카피
- Controller 또는 Page 컴포넌트에 도메인 판단, API 호출, 상태 관리가 과도하게 섞인 변경
- 450줄 초과 파일에 책임 분리 근거가 없는 변경

