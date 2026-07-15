# TASK-050 MVP Slice Plan

## 1. 읽은 문서와 전제

이번 설계는 아래 문서를 기준으로 한다.

- `AGENTS.md`
- `README.md`
- `docs/RESTART_QUEST_HANDOFF.md`
- `docs/PRODUCT_DIRECTION.md`
- `docs/CODE_QUALITY_GUARDRAILS.md`

요청에 포함된 `docs/agents/ROLE_DESIGN.md`, `docs/workflow/GITHUB_FLOW.md`는 현재 worktree에 없었다. 따라서 레포에 존재하는 제품/인수인계/품질 문서를 우선 근거로 삼는다.

## 2. 사용자 목표와 금지 범위

### 사용자 목표

- 취업 공백자가 오늘 다시 시작할 수 있는 작은 구직 행동을 얻는다.
- 사용자가 실패 이유를 남기면 같은 목표를 더 쉬운 행동으로 다시 쪼갠다.
- 대시보드에서 오늘의 진행률, 실패 후 재설계 기록, 다음 행동을 바로 확인한다.
- MVP는 기능 수보다 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영` 흐름의 선명도를 우선한다.

### 금지 범위

- 정신건강 상담, 치료, 진단, 위험도 판단처럼 보이는 문구와 기능을 만들지 않는다.
- 사용자의 의지, 성실성, 취업 가능성을 점수화하거나 감시하지 않는다.
- 실제 채용 사이트 크롤링, 외부 공고 API, 정책 자동 업데이트는 첫 MVP 범위에 넣지 않는다.
- LLM 응답을 자연어 문자열로 파싱하는 구조를 만들지 않는다.
- 첫 slice에서 로그인/회원가입, 이력서 첨삭, 모의면접, 공고 저장, 정책 추천을 함께 구현하지 않는다.

## 3. MVP와 후순위 범위

### MVP 핵심

- 온보딩 입력
- 오늘의 퀘스트 생성
- 퀘스트 완료/실패 처리
- 실패 이유 입력
- 더 쉬운 퀘스트 재설계
- 대시보드 반영
- mock AI 또는 provider port 기반 구조화 JSON 결과

### MVP 안에서 뒤로 미룰 수 있는 것

- 로그인/회원가입과 사용자별 장기 기록
- DB 영속화
- 실제 LLM provider 연동
- 더미 공고 저장함
- 이력서/자기소개서 피드백
- 모의면접 질문/답변 피드백
- 정책 추천

### MVP 밖 또는 후순위

- 실제 채용 사이트 크롤링
- 캘린더 연동
- 상담사/관리자 화면
- 알림 기능
- 정부지원정책 대상 여부 확정 판정
- 정책 데이터 자동 업데이트

## 4. 도메인 결정

첫 slice는 도메인 이름과 상태 전이를 먼저 고정한다.

### 주요 개념

- `OnboardingProfile`: 퀘스트 난이도와 방향을 조정하기 위한 사용자 입력이다. 사용자를 평가하는 데이터가 아니다.
- `DailyQuest`: 오늘 실행할 수 있는 10~30분 단위의 구직 행동이다.
- `FailureReason`: 실패를 비난하지 않고 재설계 기준으로만 사용하는 선택 값이다.
- `RedesignedQuest`: 실패한 원래 퀘스트를 더 낮은 부담의 행동으로 쪼갠 결과다.
- `DashboardSummary`: 오늘의 진행률, 남은 다음 행동, 재설계 기록 요약이다.

### Enum 초안

- `EnergyLevel`: `LOW`, `MEDIUM`, `HIGH`
- `QuestCategory`: `JOB_SEARCH`, `RESUME`, `INTERVIEW`, `LEARNING`, `POLICY`, `ROUTINE`
- `QuestDifficulty`: `TINY`, `EASY`, `NORMAL`
- `QuestStatus`: `TODO`, `DONE`, `FAILED`, `REDESIGNED`
- `FailureReason`: `NO_TIME`, `TOO_BIG`, `NOT_SURE_WHAT_TO_WRITE`, `NO_MATERIAL`, `LOW_CONFIDENCE`, `LOW_ENERGY`, `NOT_INTERESTED`

### 정책 결정

- 첫 slice의 퀘스트는 mock 생성이어도 응답은 실제 LLM 연동을 가정한 JSON DTO 형태를 따른다.
- 재설계는 원래 퀘스트보다 난이도와 예상 시간이 낮아야 한다.
- 실패한 퀘스트는 삭제하지 않고 `FAILED` 또는 `REDESIGNED` 이력으로 대시보드에 남긴다.
- 완료율은 `DONE / 오늘 생성된 원 퀘스트 수` 기준으로 계산한다. 재설계 퀘스트는 다음 행동으로 보여주되 첫 slice에서는 완료율 분모에 넣지 않는다.

## 5. API 결정

첫 slice는 인증 없이 데모 가능한 session 기반 또는 단일 사용자 mock 상태로 구현한다. API path는 나중에 인증을 붙여도 깨지지 않게 `/api` 하위로 둔다.

### Onboarding

- `POST /api/onboarding`
  - 입력: 지역, 희망 직무, 희망 근무 형태, 공백 기간, 이력서 보유 여부, 면접 경험 여부, 관심 분야, 오늘 에너지 수준
  - 출력: 저장된 `OnboardingProfile`
- `GET /api/onboarding/me`
  - 출력: 현재 profile

### Quest

- `POST /api/quests/generate`
  - 입력: 없음 또는 profile id
  - 출력: 오늘의 퀘스트 3개
- `GET /api/quests/today`
  - 출력: 오늘 퀘스트와 재설계 퀘스트 목록
- `PATCH /api/quests/{id}/complete`
  - 출력: 변경된 quest
- `PATCH /api/quests/{id}/fail`
  - 입력: `failureReason`, optional note
  - 출력: 실패 처리된 quest
- `POST /api/quests/{id}/redesign`
  - 입력: `failureReason`
  - 출력: 더 쉬운 재설계 퀘스트 1~3개와 원 퀘스트 연결 정보

### Dashboard

- `GET /api/dashboard`
  - 출력: 오늘 진행률, 완료/실패/재설계 수, 다음 행동, 최근 재설계 기록

### DTO 기준

- 모든 AI mock 출력은 `title`, `description`, `category`, `difficulty`, `estimatedMinutes`, `completionCriteria`를 포함한다.
- backend는 enum 값 검증과 최소/최대 예상 시간 검증을 담당한다.
- frontend는 DTO 필드 이름을 그대로 사용하고 화면용 문자열 변환은 feature 내부 mapper로 둔다.

## 6. 화면 흐름 결정

첫 화면은 랜딩 페이지가 아니라 실제 사용 흐름이다.

1. `OnboardingPage`
   - 사용자가 현재 상태와 오늘 에너지 수준을 입력한다.
   - 제출 후 `TodayQuestPage`로 이동한다.
2. `TodayQuestPage`
   - 오늘의 퀘스트가 없으면 "오늘의 퀘스트 생성" 행동을 제공한다.
   - 생성 후 퀘스트 카드 3개를 보여준다.
   - 각 카드에서 완료 또는 실패 입력으로 진입한다.
3. `QuestFailurePanel`
   - 실패 이유를 선택하고 선택적으로 짧은 메모를 남긴다.
   - 제출 후 재설계 결과를 보여준다.
4. `DashboardPage`
   - 완료율, 오늘 남은 다음 행동, 실패 후 재설계 기록을 보여준다.
   - 사용자가 실패했다는 사실보다 "다음에 더 쉬운 행동이 생겼다"는 점을 우선 노출한다.

## 7. MVP Slice Backlog

각 slice는 1~2일 안에 독립 검증 가능해야 한다.

| 순서 | Slice | 목적 | backend 작업 | frontend 작업 | QA 기준 | 제외 범위 | 다음 slice 진입 조건 |
|---:|---|---|---|---|---|---|---|
| 1 | 핵심 재진입 루프 mock | 온보딩부터 재설계와 대시보드 반영까지 제품 차별점을 눈으로 확인한다. | 인증 없는 onboarding/quest/dashboard API, mock quest generator, mock redesign policy, enum/DTO 검증 | 온보딩 폼, 오늘 퀘스트 생성/상태 처리, 실패 이유 입력, 재설계 결과, 대시보드 요약 | 새 사용자가 온보딩 입력 후 퀘스트 3개 생성, 1개 실패, 실패 이유 선택, 더 쉬운 퀘스트 표시, 대시보드 반영 확인 | 로그인, DB, 실제 LLM, 이력서/면접/공고/정책 | QA와 review가 핵심 흐름, 문구, 책임 분리를 통과 |
| 2 | 사용자별 상태 저장 | 새로고침 후에도 slice 1 상태를 유지한다. | DB schema, repository, service transaction, 단일 사용자 또는 간단 auth 연결 | API loading/error 처리, 새로고침 유지 확인 | 같은 profile과 quest 상태가 재접속 후 유지됨 | 실제 LLM, 장기 통계 | 저장 흐름과 기본 회귀 테스트 통과 |
| 3 | 구조화 AI provider 연결 | mock을 실제 LLM port로 교체할 수 있게 한다. | `QuestAiClient` port, mock implementation 유지, JSON schema 검증, provider error 구분 | provider 실패 시 재시도/대체 메시지 | JSON 필수 필드 누락과 provider timeout 처리 확인 | prompt 고도화, 여러 provider | mock과 provider 구현을 설정으로 교체 가능 |
| 4 | 대시보드 기록 강화 | 실행 지속을 포트폴리오 데모에 더 잘 보여준다. | 활동 기록 query, 재설계 이력 조회, 간단 통계 | progress summary, recent redesign history, next action 영역 | 오늘/최근 기록이 상태별로 정확히 표시됨 | 장기 리포트, 알림 | 핵심 통계가 제품 방향과 맞음 |
| 5 | 이력서 micro-quest | 이력서 기능을 독립 기능이 아니라 퀘스트 소스로 연결한다. | resume draft 저장, resume 기반 quest 생성 seed | resume 입력/요약, 관련 퀘스트 카드 | 이력서 내용을 기반으로 작은 수정 퀘스트가 생성됨 | AI 첨삭 전체 자동화 | resume이 퀘스트 흐름을 보조함 |
| 6 | 더미 공고/정책 seed | 공고/정책을 실제 연동 없이 오늘 행동의 재료로 제공한다. | seed job/policy, saved job 상태, policy check item | 더미 공고 저장, 확인할 정책 표시 | 저장한 공고/정책이 다음 퀘스트에 반영됨 | 크롤링, 대상 여부 판정 | 데이터 소스가 핵심 루프를 해치지 않음 |

## 8. 현재 라운드 구현 slice

현재 라운드에서 구현할 slice는 **Slice 1: 핵심 재진입 루프 mock** 하나뿐이다.

### 완료 조건

- 온보딩 입력을 저장하고 다음 화면으로 이동한다.
- 오늘의 퀘스트 생성 mock으로 3개 퀘스트를 만든다.
- 퀘스트 카드는 제목, 설명, 카테고리, 난이도, 예상 시간, 완료 기준을 보여준다.
- 사용자가 퀘스트 1개를 완료 처리할 수 있다.
- 사용자가 퀘스트 1개를 실패 처리하고 실패 이유를 선택할 수 있다.
- 실패 이유를 기반으로 더 쉬운 재설계 퀘스트가 mock으로 생성된다.
- 대시보드는 오늘 진행률, 완료 수, 실패/재설계 수, 다음 행동을 반영한다.
- 화면 문구는 평가/감시/치료 뉘앙스 없이 실행 재시작에 초점을 둔다.

### 이번 라운드에서 하지 않을 것

- 로그인/회원가입
- DB migration과 운영 DB 연결
- 실제 LLM API 호출
- 이력서 첨삭 화면
- 모의면접 화면
- 실제 공고/정책 연동
- 알림, 캘린더, 관리자 기능

## 9. 역할 지시 패키지

### Team Lead

- frontend/backend 작업을 Slice 1에만 배정한다.
- backend와 frontend는 병렬 진행하되 API 계약은 이 문서의 field name을 따른다.
- QA/review 통과 전 Slice 2를 시작하지 않는다.
- 다음 slice 후보는 Slice 2이지만, Slice 1에서 상태 저장 필요성이 QA에서 확인된 뒤 진입한다.

### Backend

- Spring Boot 계층을 `domain`, `application`, `infrastructure`, `presentation`으로 나눈다.
- `GenerateDailyQuestService`, `FailQuestService`, `RedesignQuestService`, `GetDashboardService`처럼 use case 단위 책임을 분리한다.
- 첫 slice에서는 in-memory repository 또는 단일 사용자 mock store를 허용한다.
- mock generator도 `QuestAiClient` port 뒤에 둬서 Slice 3에서 실제 LLM provider로 교체할 수 있게 한다.
- Controller는 request validation, service 호출, response mapping만 담당한다.
- enum 검증, estimated minutes 범위, 재설계 퀘스트 난이도 하향 조건을 테스트한다.

### Frontend

- React feature 구조는 `features/onboarding`, `features/quests`, `features/dashboard`를 사용한다.
- page는 화면 조립만 담당하고 API 호출과 form state는 hook/service로 분리한다.
- 첫 화면은 온보딩 또는 오늘 퀘스트 화면이며 마케팅 랜딩 페이지를 만들지 않는다.
- 퀘스트 실패 UI는 실패를 비난하는 표현 대신 "더 작게 다시 나누기" 흐름으로 표현한다.
- Dashboard는 카드 나열보다 오늘의 다음 행동과 재설계 결과가 먼저 보이게 구성한다.

### QA

- 핵심 시나리오를 기준으로 수동/자동 검증한다.
- 온보딩 입력값이 quest mock 생성에 최소 1개 이상 반영되는지 확인한다.
- 실패 이유별로 재설계 결과가 원래 퀘스트보다 더 쉬운지 확인한다.
- 대시보드 숫자가 완료/실패/재설계 액션 직후 갱신되는지 확인한다.
- 평가성 문구, 상담/치료처럼 보이는 문구, MVP 범위 밖 화면 진입이 없는지 확인한다.

### Reviewer

- 한 파일에 UI, API 호출, 상태 관리, 도메인 판단이 몰리지 않았는지 본다.
- 실패 이유 기반 재설계가 빠지면 핵심 흐름 누락으로 본다.
- mock AI라도 JSON DTO 검증 없이 자연어 파싱에 의존하면 막는다.
- 실제 공고 크롤링, 정책 판정, 로그인 등 Slice 1 밖 기능이 섞였는지 확인한다.
- 파일 크기 자체보다 책임 분리와 추상화 근거를 우선 리뷰한다.

## 10. 진행 보고 기록

- 기존 기획/인수인계/제품 방향/품질 문서를 확인했다.
- 요청된 일부 context file은 현재 worktree에 없음을 확인했다.
- MVP 전체를 한 번에 구현하지 않고 1~2일 단위 slice backlog로 분리했다.
- 현재 라운드 구현 대상은 Slice 1 하나로 고정했다.
- 이번 design 작업은 기능 코드를 수정하지 않고 후속 구현자가 따를 설계 기준을 남기는 데 한정했다.

## 11. 산출물 기록

- 이 문서: `docs/TASK-050_MVP_SLICE_PLAN.md`
- 후속 frontend/backend/QA/reviewer는 이 문서를 Slice 1 작업 계약으로 사용한다.
