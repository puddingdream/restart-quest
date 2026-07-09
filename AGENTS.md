# Re:Start Quest Agent Rules

## Language

- 기본 문서와 PR 설명은 한국어로 작성한다.
- 코드 식별자는 영어를 사용한다.

## Product Direction

- 이 프로젝트는 취업 종합 앱이 아니라 구직 행동 재진입 엔진이다.
- 핵심 경험은 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영`이다.
- 정신건강 상담, 치료, 감시, 의지 평가 서비스처럼 보이게 만들지 않는다.
- 실제 채용 사이트 크롤링은 MVP 범위가 아니다. 더미 공고와 사용자가 저장한 공고부터 시작한다.

## Maintainability Rules

- 한 파일에 모든 로직을 몰아넣지 않는다.
- 파일이 300줄을 넘으면 분리 후보로 본다.
- 파일이 450줄을 넘는 변경은 reviewer가 기본적으로 `BLOCKED` 처리한다. 단, 설정 파일/마이그레이션/생성 파일은 예외다.
- 하나의 PR은 하나의 목적만 가진다. 프론트, 백엔드, 문서, 인프라 변경이 섞이면 이유를 PR 본문에 적는다.
- 큰 기능은 도메인, API 계약, UI 흐름, 테스트를 작은 work item으로 나눈다.
- 중복 제거보다 먼저 가독성과 변경 범위를 우선한다. 조기 추상화는 피한다.

## Backend Rules

- Spring Boot 코드는 계층을 분리한다.
  - `domain`: 엔티티, 값 객체, enum, 도메인 정책
  - `application`: use case/service
  - `infrastructure`: 외부 API, DB adapter, AI provider client
  - `presentation`: controller, request/response DTO
- Controller는 요청/응답 매핑과 검증만 담당한다.
- Service는 여러 use case를 한 클래스에 과도하게 몰지 않는다.
- LLM 응답은 JSON schema/DTO로 검증한 뒤 저장한다. 자연어 문자열을 그대로 파싱하지 않는다.
- AI 호출 실패, JSON 파싱 실패, quota 초과, provider timeout은 구분 가능한 에러로 처리한다.

## Frontend Rules

- React 코드는 feature 단위로 나눈다.
  - `features/onboarding`
  - `features/quests`
  - `features/dashboard`
  - `features/resume`
  - `features/interview`
- 페이지 컴포넌트는 화면 조립만 담당한다.
- API 호출, form state, 복잡한 view model은 hook/service로 분리한다.
- 한 컴포넌트가 250줄을 넘으면 분리 후보로 본다.
- UI는 MVP에서도 핵심 흐름이 바로 보이게 만든다. 기능 설명용 랜딩 페이지를 첫 화면으로 만들지 않는다.

## QA / Review Rules

- QA agent는 핵심 사용자 흐름을 기준으로 검증한다.
- Reviewer agent는 다음 항목을 반드시 본다.
  - 파일 크기와 책임 분리
  - 실패 후 재설계 흐름이 제품 방향성과 맞는지
  - LLM JSON 출력 검증 여부
  - 사용자를 평가/감시하는 문구가 없는지
  - MVP 범위를 벗어난 기능이 섞이지 않았는지
- 유지보수 기준을 어긴 PR은 기능이 동작해도 승인하지 않는다.
