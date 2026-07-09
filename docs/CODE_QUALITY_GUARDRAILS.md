# 코드 품질 가드레일

## 목표

Re:Start Quest는 개인 포트폴리오 프로젝트지만, 코드가 한 파일에 몰리거나 수천 줄짜리 컴포넌트/서비스가 생기지 않게 관리한다.

오케스트레이터와 agent는 기능 구현 속도보다 **작은 변경 단위, 명확한 책임, 리뷰 가능한 PR**을 우선한다.

## 파일 크기 기준

| 구분 | 권장 | 경고 | 기본 차단 |
|---|---:|---:|---:|
| React component | 150줄 이하 | 250줄 초과 | 450줄 초과 |
| React hook/service | 150줄 이하 | 250줄 초과 | 450줄 초과 |
| Spring Controller | 120줄 이하 | 180줄 초과 | 350줄 초과 |
| Spring Service/UseCase | 180줄 이하 | 300줄 초과 | 450줄 초과 |
| DTO/Schema | 120줄 이하 | 250줄 초과 | 450줄 초과 |
| Test file | 250줄 이하 | 450줄 초과 | 700줄 초과 |

차단 기준을 넘는 경우 PR 본문에 분리하지 않은 이유와 후속 분리 계획을 적어야 한다.

## 백엔드 분리 기준

### Controller

- HTTP method/path 매핑
- request validation
- application service 호출
- response mapping

Controller에서 하지 않는 것:

- DB 조회 조건 조립
- LLM prompt 작성
- quest 재설계 정책 판단
- 복잡한 트랜잭션 흐름

### Application Service

- use case 단위로 분리한다.
- 예: `GenerateDailyQuestService`, `FailQuestService`, `RedesignQuestService`
- 여러 화면의 모든 기능을 `QuestService` 하나에 몰지 않는다.

### Domain

- quest status, failure reason, difficulty, category 같은 정책은 enum/value object로 분리한다.
- 실패 이유에 따른 재설계 규칙은 테스트 가능한 정책 클래스로 둔다.

### Infrastructure

- LLM provider 호출은 application service에서 직접 하지 않는다.
- `QuestAiClient` 같은 port를 두고, 실제 구현은 infrastructure에 둔다.

## 프론트엔드 분리 기준

### Page

페이지는 route 단위 화면 조립만 담당한다.

예:

- `OnboardingPage`
- `TodayQuestPage`
- `DashboardPage`

### Feature

기능별 폴더를 둔다.

```text
src/features/quests/
  api/
  components/
  hooks/
  types/
  pages/
```

### Component

컴포넌트는 하나의 UI 책임만 가진다.

예:

- `QuestCard`
- `FailureReasonSelect`
- `RedesignedQuestList`
- `ProgressSummary`

### Hook

API 호출, mutation, 화면 상태 조합은 hook으로 분리한다.

예:

- `useTodayQuests`
- `useCompleteQuest`
- `useFailQuest`
- `useRedesignQuest`

## PR 분리 기준

권장 PR 단위:

1. 문서/설계
2. 백엔드 도메인/API
3. 프론트 화면 골격
4. API 연동
5. AI provider 연동
6. QA/test 보강

피해야 할 PR:

- 백엔드, 프론트, AI, 디자인, 문서가 한 PR에 모두 섞인 변경
- 한 번에 수십 개 파일을 만들고 테스트가 없는 변경
- MVP와 무관한 기능을 선행 구현하는 변경

## Reviewer 차단 조건

Reviewer는 아래 조건이면 `BLOCKED`로 보고한다.

- 핵심 흐름과 무관한 기능이 먼저 구현됨
- 파일 하나가 지나치게 커지고 분리 계획이 없음
- LLM JSON 출력 검증 없이 문자열 파싱에 의존함
- 실패 이유 기반 재설계가 빠짐
- 사용자에게 취업 의지 점수, 위험 점수처럼 평가성 문구를 노출함
- 정신건강 상담 서비스처럼 해석될 수 있는 문구가 있음

## 원칙

작게 만들고, 실행 흐름을 먼저 완성하고, 포트폴리오에서 설명 가능한 구조를 유지한다.
