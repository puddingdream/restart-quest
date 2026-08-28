# TASK-021 새 통합 기준선 및 MVP 검증 계획

## 1. 목적과 완료 상태

이 문서는 TASK-021의 단일 통합 기준선, 재사용 범위, 독립 구현 slice와 최종 gate를 정의하는 정본 계획이다. TASK-010, TASK-015, TASK-020 보고서와 PR #73/#74는 조사 근거로만 사용하며, 과거에 막힌 remediation worktree나 미게시 변경을 이어받지 않는다.

TASK-021이 증명할 사용자 가치는 다음과 같다.

> 사용자가 가입과 온보딩을 마친 뒤 오늘의 작은 구직 행동을 시작하고, 어려웠던 행동을 이유에 맞게 더 작은 행동으로 바꾼 다음, 그 결과와 바로 이어갈 행동을 대시보드에서 확인할 수 있다.

현재 단계의 완료 상태는 다음과 같다.

| 단계 | 상태 | 증적 |
|---|---|---|
| main 및 정본 문서 조사 | 완료 | `35e7b25b05aabf45f61d96da0777bbafb9ceb655`, clean worktree |
| PR #73/#74 계보 비교 | 완료 | #73 head가 #74 head의 직접 부모임을 확인 |
| 단일 통합 후보 확정 | 완료 | `agentflow/task-015-contract-4a8feeaa49-design-design@6a63905385d0c35e97d9aa1bbd23f1bd5e891613` |
| source import | 완료 | merge commit `faa19e2d604cadafd551297dbde22ea4c7002017`, main 대비 source 224-file manifest |
| 계약·provenance 문서 정합화 | 작성 완료, publish 대기 | `task-021-contract-provenance` 소유 문서 4개 |
| 역할별 수정·검증 | 진행 중 | 아래 package DAG의 독립 package가 같은 import 기준선에서 실행 |
| QA/Reviewer 및 최종 보고 | 대기 | 동일 immutable 통합 head의 새 증거만 사용 |

## 2. 사용자 목표와 금지 범위

### 사용자 목표

1. 회원가입 또는 로그인 후 온보딩을 완료한다.
2. 오늘 가능한 에너지를 고르고 10~30분 퀘스트 세 개를 받는다.
3. 퀘스트를 완료하거나 `오늘은 어려웠어요` 이유를 입력한다.
4. 같은 목적을 유지한 5~15분의 단일 대체 퀘스트를 받는다.
5. 대시보드에서 완료 수, 재설계 기록, 다음 행동을 확인한다.
6. 로그아웃하면 현재 세션이 폐기되고 보호 화면에 다시 접근할 수 없다.

### 금지 범위

- 취업 의지, 성실성, 위험도, 정신 상태를 평가하거나 점수화하지 않는다.
- 상담·치료·진단, 정책 자격 확정, 실제 채용 사이트 크롤링을 MVP에 포함하지 않는다.
- 이력서 첨삭, 모의면접, 공고·정책 기능을 핵심 흐름보다 먼저 구현하지 않는다.
- LLM 원문을 검증 없이 저장·노출하거나 token, 비밀번호 관련 값을 provider에 전달하지 않는다.
- PR #73의 막힌 remediation round, dirty worktree, 미게시 29-file 변경을 복원·복사·재개하지 않는다.
- PR #73과 #74를 별도 구현 기준선처럼 병합하거나 같은 auth, quest, 화면 흐름을 다시 구현하지 않는다.
- source import만으로 테스트, 리뷰 thread, CI 또는 출시 gate가 통과했다고 판단하지 않는다.

## 3. 조사 결과와 단일 기준선

### 3.1 계보 결정

| 대상 | 확인한 head | 결론 |
|---|---|---|
| `main` | `35e7b25b05aabf45f61d96da0777bbafb9ceb655` | 제품 문서 5개만 있는 공통 조상 |
| PR #73 | `779439facde6c2a6bc824917fa0d04d31cb8de05` | 기존 통합 구현과 logout 회귀 테스트를 포함하지만 current-head finding이 남은 참고 head |
| PR #74 | `6a63905385d0c35e97d9aa1bbd23f1bd5e891613` | PR #73을 직접 부모로 하고 logout API 정본 문서까지 포함한 최신 재사용 후보 |

PR #74 head는 main, 기존 TASK-002 통합 head `7fb8c5fd2ad6b0f65101c8f6b8c641e61d1e122d`, PR #73 head를 모두 조상으로 가진다. 따라서 TASK-021은 다음 immutable source 한 개만 root package에서 merge 방식으로 import했다.

```text
branch=agentflow/task-015-contract-4a8feeaa49-design-design
expectedHeadSha=6a63905385d0c35e97d9aa1bbd23f1bd5e891613
operation=merge
```

trusted host는 import 직전에 branch/SHA와 main ancestry를 재확인했고, design head
`f9ff2f76529e0e73795043ad45f4b4d63447b7a1` 및 source SHA를 두 부모로 하는 merge commit
`faa19e2d604cadafd551297dbde22ea4c7002017`을 만들었다. 이 기준선을 다시 만들 때 branch가 위 SHA를
가리키지 않거나 main ancestry가 달라지면 import를 중단하고 새 설계 판단을 요청한다. provider는 fetch,
merge, rebase를 수행하지 않는다.

### 3.2 재사용하는 구현

- Spring Security, opaque access token 발급·폐기, 회원·온보딩 API
- `DailyQuestPlan`, `QuestJourney`, `Quest`, `QuestRedesign` 도메인과 소유권·동시성 불변식
- typed `QuestAiClient`, 결정적 테스트 adapter, provider 오류 분류와 JSON 구조 검증
- 오늘 세 퀘스트 생성·조회, 완료, 이유 기반 재설계, 대시보드 API와 회귀 테스트
- React route guard, 인증·온보딩, 오늘 퀘스트, 재설계 dialog, 대시보드 화면
- 실제 backend HTTP E2E harness와 desktop/mobile screenshot 경로
- `docs/MVP_IMPLEMENTATION_BLUEPRINT.md`, `docs/MVP_PACKAGE_BOUNDARIES.md`, `docs/api/quest-api.md`

재사용은 현재 후보 tree의 코드와 계약을 확장한다는 뜻이며 과거 테스트 결과를 새 head의 통과 증거로 재사용한다는 뜻이 아니다.

### 3.3 import 후 새로 처리할 확인된 차이

1. 기본 frontend API mode가 `mock`으로 고정되어 일반 dev/build가 backend를 우회한다.
2. mock 최초 `history`가 current quest를 포함하고, 다중 재설계 대시보드가 각 replacement가 아닌 최신 제목을 사용할 수 있다.
3. canonical `INVALID_INPUT`과 `fieldErrors`가 입력별 피드백으로 연결되지 않는다.
4. 빈 `careerGapMonths`가 숫자 0으로 바뀌어 필수 입력 누락이 유효 데이터로 저장될 수 있다.
5. production smoke가 존재하지 않는 고정 `/assets/index.js`를 조회한다.
6. strict browser E2E가 실제 logout 버튼, `/login` 이동, 로그아웃 전 token의 보호 API 401을 검증하지 않는다.
7. blueprint와 package provenance ledger가 logout 및 cross-stack import ownership을 완전히 설명하지 않는다.

이 목록은 과거 remediation을 재개하라는 지시가 아니다. 각 package는 imported clean head에서 현재 동작을 먼저 재현하고, 해당하는 공통 원인만 새 변경으로 처리한다.

## 4. MVP와 후순위 범위

### TASK-021 MVP 통합 범위

- immutable source import와 package lineage 기록
- 기존 backend 전체 회귀와 logout token 폐기 계약 재검증
- 기본 HTTP mode와 명시적 mock opt-in
- wire/mock 이력과 대시보드 표시 정합성
- canonical 입력 오류 및 온보딩 빈 숫자 처리
- current build hashed asset smoke
- 실제 브라우저의 가입 → 온보딩 → 생성 → 완료 → 재설계 → 대시보드 → logout 흐름
- 같은 immutable head의 QA, Reviewer, CI·secret scan(제공되는 경우), thread 정산과 최종 보고

### 후순위

- 첫 활성 퀘스트 중심으로 카드 위계를 줄이는 시각 개편
- 진행률 백분율보다 다음 행동을 우선하는 대시보드 개편
- 최소 보조 글자 크기와 dialog focus trap의 별도 접근성 개선
- 이력서, 모의면접, 공고, 정책, 알림, 캘린더, 관리자 기능
- refresh token, 소셜 로그인, 다중 기기 세션, 실제 AI provider 운영 연결
- CI workflow 신설과 배포 인프라 구성

후순위 UI 개선은 320/390/768/1280px screenshot과 키보드 증적을 먼저 확보한 뒤 별도 `frontend-ui` slice로 진입한다. 현재 통합의 correctness·계약 gate와 섞지 않는다.

## 5. 구현자가 따라야 할 도메인·API 결정

### 5.1 도메인 불변식

- 서비스 기준일은 `Asia/Seoul`이고 사용자별 당일 계획은 하나다.
- 최초 퀘스트 여정은 정확히 세 개이며, 같은 날 재생성은 기존 세 여정을 반환한다.
- 여정마다 현재 `TODO` 퀘스트는 최대 하나다.
- 완료와 재설계가 경쟁하면 하나만 성공하고 다른 요청은 `409 QUEST_ALREADY_RESOLVED`다.
- 재설계는 같은 journey와 category를 유지하는 대체 퀘스트 하나다. steps는 1~3개, 5~15분이며 원본 시간보다 길지 않다.
- 이유 기록, 원본 `REDESIGNED`, 대체 퀘스트, 재설계 기록 저장은 한 트랜잭션이다.
- dashboard 분모는 세 여정이며 `progressPercent`는 평가 점수가 아니다.

### 5.2 API 계약

정본은 import 후의 `docs/api/quest-api.md`다. 새 endpoint나 병행 v2 계약을 만들지 않는다.

- base path: `/api/v1`
- 보호 API: `Authorization: Bearer <access-token>`
- logout: `POST /auth/logout`, body 없음, 성공 `204`, 현재 token 폐기, 같은 token의 이후 보호 API 호출 `401 UNAUTHORIZED`
- onboarding: `PUT /onboarding/me`; `careerGapMonths`는 필수 정수 `0..600`이며 빈 입력과 숫자 0을 구분한다.
- today: 생성 전 `journeys: []`; 생성 후 정확히 세 여정
- `history`: 현재 퀘스트를 제외한 이전 revision만 오래된 순으로 포함
- redesign 응답: 갱신된 journey 필드와 `redesign`을 같은 최상위 객체에 둔다.
- 오류: `INVALID_INPUT`과 허용된 `fieldErrors`를 입력에 연결하되 provider 원문, stack, token은 표시하지 않는다.

### 5.3 AI 경계

- application은 `QuestAiClient` port만 의존한다.
- provider DTO와 공개 API DTO를 분리한다.
- 생성 결과는 정확히 세 개, 재설계 결과는 대체 퀘스트 하나인지 검증한 뒤 저장한다.
- timeout, quota, provider unavailable, invalid response를 각각 504/429/503/502 코드로 유지한다.
- imported 결정적 adapter를 테스트와 로컬 안전 경로에 재사용하고 provider 호출을 새로 만들지 않는다.

## 6. 화면 흐름과 구현 기준

```text
/signup 또는 /login
  -> 인증 성공
  -> 온보딩 미완료: /onboarding
  -> 온보딩 완료: /today
  -> 에너지 선택 및 세 퀘스트 생성
  -> 완료 또는 더 작게 바꾸기
  -> /dashboard에서 3개 중 완료 수, 재설계 기록, 다음 행동 확인
  -> logout
  -> /login 이동, 보호 route와 폐기 token 재사용 차단
```

- 소개 랜딩 페이지를 핵심 흐름 앞에 두지 않는다.
- 생성·완료·재설계·logout 제출 중 중복 action을 막고 결과를 한 번만 반영한다.
- loading, empty, error, success 상태를 명시한다.
- 화면에는 `실패` 대신 `오늘은 어려웠어요`, `더 작게 바꾸기`, `다시 설계한 행동`을 사용한다.
- 재설계 성공 뒤 today와 dashboard refresh를 함께 수행한다.
- API 오류가 해결되면 stale 오류를 지우고 현재 server state를 표시한다.
- QA viewport는 desktop `1280x800`, tablet `768x1024`, mobile `390x844`와 `320x568`이며, 필수 핵심 흐름은 keyboard-only로도 가능해야 한다.

## 7. 독립 구현 package DAG

의존성은 실제 source/contract 선행 조건만 나타낸다. root import 이후 backend 검증, 문서 정합화, 세 frontend correctness package는 병렬로 실행할 수 있다. frontend 파일 소유권은 서로 겹치지 않으며 마지막 E2E package만 이 결과들에 의존한다.

```text
task-021-baseline-import
  ├─ task-021-be-regression
  ├─ task-021-contract-provenance
  ├─ task-021-fe-api-boundary ───────┐
  ├─ task-021-fe-onboarding-input ───┼─ task-021-fe-core-e2e
  └─ task-021-fe-mock-history ───────┘
       task-021-be-regression ───────┘
```

### Package path ownership

`task-021-baseline-import`만 source tree 전체 도입을 소유한다. 허용 경로는 imported diff를 모두 포함하면서 secret·cache·build output을 허용하지 않도록 다음으로 고정한다.

```text
README.md
backend/.gitattributes
backend/.gitignore
backend/build.gradle
backend/settings.gradle
backend/gradlew
backend/gradlew.bat
backend/gradle/**
backend/src/main/**
backend/src/test/**
frontend/.gitignore
frontend/index.html
frontend/package.json
frontend/package-lock.json
frontend/eslint.config.mjs
frontend/tsconfig.app.json
frontend/tsconfig.json
frontend/tsconfig.test.json
frontend/vite.config.mjs
frontend/scripts/**
frontend/src/**
docs/MVP_IMPLEMENTATION_BLUEPRINT.md
docs/MVP_PACKAGE_BOUNDARIES.md
docs/agents/ROLE_QA.md
docs/agents/ROLE_REVIEWER.md
docs/api/quest-api.md
docs/workflow/MERGE_POLICY.md
docs/workflow/REVIEW_REMEDIATION.md
```

import 이후 병렬 package는 다음 경계를 넘지 않는다.

| packageId | allowed paths |
|---|---|
| `task-021-be-regression` | `backend/src/test/**` |
| `task-021-contract-provenance` | `README.md`, `docs/MVP_IMPLEMENTATION_BLUEPRINT.md`, `docs/MVP_PACKAGE_BOUNDARIES.md`, `docs/TASK_021_INTEGRATION_PLAN.md` |
| `task-021-fe-api-boundary` | `frontend/index.html`, `frontend/src/shared/api/**`, `frontend/src/features/auth/**`, `frontend/src/features/quests/api/mockQuestOutcomes.ts`, `frontend/src/features/quests/questErrorFeedback.ts`, `frontend/src/features/quests/questOutcomeErrorFeedback.ts` |
| `task-021-fe-onboarding-input` | `frontend/src/features/onboarding/**` |
| `task-021-fe-mock-history` | `frontend/src/features/quests/api/questMockApi.ts`, `frontend/src/features/quests/api/questMockApi.test.ts`, `frontend/src/features/quests/testing/**`, `frontend/src/features/dashboard/api/dashboardMockApi.ts`, `frontend/src/features/dashboard/api/dashboardMockApi.test.ts` |
| `task-021-fe-core-e2e` | `frontend/scripts/**` |

context file은 읽기 전용이며 같은 경로가 위 allowed paths에 명시된 package만 수정한다. 실제 결함을 고치려면 이 범위를 넘어야 하는 경우 임의로 넓히지 않고 원인과 필요한 경로를 보고해 새 remediation slice를 만든다.

### 7.1 `task-021-baseline-import` — backend-infra

- 목적: exact branch/SHA를 한 번만 merge import하고 새 immutable 통합 SHA와 imported tree manifest를 기록한다.
- 사용자 흐름: 변경하지 않는다. 기존 전체 흐름을 재사용 가능한 공통 기준선으로 materialize한다.
- 작업: branch/SHA fail-closed 확인, main ancestry 확인, 224-file cross-stack 범위와 rollback 단위 기록
- QA: imported head가 source SHA와 main을 모두 조상으로 포함하고 conflict·unexpected path가 없어야 한다.
- 제외: 기능 수정, 과거 remediation 복원, 개별 commit cherry-pick, 테스트 통과 주장
- 다음 진입 조건: host가 import 결과 SHA를 고정하고 downstream package가 같은 SHA를 base로 받음

### 7.2 `task-021-be-regression` — backend

- 목적: imported backend를 재작성하지 않고 auth/logout, quest, dashboard, AI schema, migration·동시성 회귀를 새 head에서 검증한다.
- backend 작업: 기존 test suite를 재실행하고 확인된 테스트 공백만 `backend/src/test/**`에 보강한다.
- frontend 작업: 없음
- QA: 전체 backend test, logout 204와 같은 token의 `/users/me` 401, 생성 멱등성, 소유권 은닉, 완료/재설계 경쟁, provider 오류 무변경이 통과한다.
- 제외: 새 endpoint, DB schema 재설계, provider 교체
- 다음 진입 조건: product defect가 없으면 E2E base로 전달하고, 결함이 있으면 새 원인별 remediation을 생성한다.

### 7.3 `task-021-contract-provenance` — backend-infra

- 목적: import가 cross-stack root임을 문서화하고 logout·API mode·lineage·rollback 계약을 정본에 동기화한다.
- 작업: blueprint 인증 표, package provenance ledger, TASK-021 진행 상태와 README 기술·실행 설명 정합화
- QA: source branch/SHA, 224-file 범위, 원본/superseding lineage, package ownership과 merge-commit 전체 revert가 추적 가능해야 한다.
- 제외: 기능 코드, PR metadata mutation, DB rollback 실행
- 다음 진입 조건: Reviewer가 코드와 문서에서 같은 계약을 읽을 수 있음

### 7.4 `task-021-fe-api-boundary` — frontend-state

- 목적: 일반 dev/build를 HTTP fail-safe로 만들고 canonical 입력 오류를 안전하게 표시한다.
- frontend 작업: 미지정·알 수 없는 API mode는 HTTP, `mock`만 명시적 opt-in; `INVALID_INPUT`과 허용된 `fieldErrors`를 입력별 오류에 연결
- backend 작업: 없음; 현재 `/api/v1` contract를 소비한다.
- QA: mode 양성·음성 회귀, UTF-8 72-byte password 오류, 401 session 정리, 민감값 비노출 test가 통과한다.
- 제외: auth/logout 재구현, 중앙 mock router 재도입, 새 오류 schema
- 다음 진입 조건: 기본 build와 E2E가 실제 backend를 사용함

### 7.5 `task-021-fe-onboarding-input` — frontend-state

- 목적: 빈 경력 공백 입력과 숫자 0을 구분해 누락 값을 저장하지 않는다.
- frontend 작업: form type, parser, validation, request 변환과 접근 가능한 field error를 feature 내부에서 보강한다.
- backend 작업: 없음; `careerGapMonths: integer 0..600` 계약을 유지한다.
- QA: 빈 값은 submit 차단, 문자열 `0`은 숫자 0, 범위 밖과 유효 값은 각각 올바른 결과를 내는 회귀 test가 통과한다.
- 제외: 온보딩 항목 추가, 사용자 평가값 생성
- 다음 진입 조건: 유효한 onboarding만 `/today`로 이동함

### 7.6 `task-021-fe-mock-history` — frontend-state

- 목적: mock과 HTTP가 동일한 journey/history 및 dashboard 재설계 이력을 보여준다.
- frontend 작업: 최초 history 빈 배열, current quest 제외, original/replacement ID로 정확한 revision title 조회
- backend 작업: 없음; producer 응답이 정본이다.
- QA: 최초·1회·다중 재설계 양성 사례와 current quest 중복 음성 사례가 통과하고 dashboard 최신 title 덮어쓰기가 없어야 한다.
- 제외: wire schema 변경, 새 dashboard API, 공용 enum 조기 추상화
- 다음 진입 조건: mock component test와 HTTP E2E의 상태 전이가 같음

### 7.7 `task-021-fe-core-e2e` — frontend

- 목적: current production build와 실제 backend로 전체 MVP 및 logout을 strict browser에서 검증한다.
- frontend 작업: smoke가 `dist/index.html`의 실제 hashed asset을 읽도록 수정; E2E에 로그인 token 캡처, logout 버튼, `/login`, 폐기 token 401을 추가
- backend 작업: 변경하지 않고 같은 immutable head의 실행 서버를 사용한다.
- QA: `npm ci`, lint, test, build, hashed asset smoke, `E2E_REQUIRE_BROWSER=1 npm run e2e`; desktop/mobile screenshot과 cleanup 성공
- 제외: HTTP fallback을 browser PASS로 간주, 운영 배포, 새 UI 개편
- 다음 진입 조건: 모든 구현 package를 합친 새 immutable head를 QA/Reviewer에 전달

## 8. QA·리뷰·수정·재검증 흐름

1. 각 구현 package는 자기 allowed paths와 acceptance criteria를 검증해 별도 PR을 만든다.
2. 모든 package를 dependency 순서로 통합한 하나의 immutable head SHA를 고정한다.
3. QA는 backend 전체 test와 frontend install/lint/test/build/smoke/strict browser E2E를 같은 head에서 실행한다.
4. Reviewer는 새 head의 코드, current unresolved thread, 자동리뷰, CI·secret scan(제공되는 경우), 문서·범위를 검토한다.
5. 실제 제품 결함은 공통 원인별 좁은 remediation slice로 되돌리고, runner 권한 문제는 product defect와 분리한다.
6. 수정 commit이 생기면 이전 QA·review 증거를 폐기하고 새 head에서 전체 관련 회귀를 재검증한다.
7. 최종 보고는 source/import SHA, worker PR/head, 실행 명령, 실제 결과, 미해결 위험, rollback을 기록한다.

사람 호출은 source ref/SHA 불일치, 외부 runner·GitHub 권한이나 설정 부재, 요구 충돌·위험 수용 판단이 필요한 경우에만 한다. 관리형 sandbox가 native child process를 거부하면 우회 설정을 자동 활성화하지 않고 trusted runner 검증으로 넘긴다.

## 9. 최종 완료 조건

- source import가 한 번만 수행되고 resulting head에서 provenance가 추적된다.
- 기존 MVP/auth/logout 구현을 중복 생성하지 않는다.
- backend 전체 회귀가 새 immutable head에서 통과한다.
- frontend 기본 mode가 HTTP이고 mock은 명시적 opt-in이다.
- onboarding 빈 숫자, canonical field error, 최초·다중 redesign history가 회귀 test로 고정된다.
- production build의 실제 hashed asset smoke가 통과한다.
- strict browser E2E가 가입 → 온보딩 → 세 퀘스트 → 완료 → 재설계 → dashboard → logout → 폐기 token 401을 검증한다.
- QA PASS와 Reviewer APPROVE가 동일 head를 가리키고 blocking actionable thread가 없다.
- 제공되는 CI와 secret scan 및 quiet window가 통과한다.
- 최종 보고에 구현 PR, 검증 명령·결과, 남은 nonblocking 위험과 rollback이 있다.

## 10. 작업 산출물과 현재 진행 보고

7절의 package별 역할 지시와 allowed path를 TASK-021 실행 계약으로 유지한다. 현재 산출물과 다음 gate는
아래와 같으며, 과거 PR의 테스트나 review 결과를 완료 증거로 승격하지 않는다.

| work/package | 담당 | 산출물 또는 상태 |
|---|---|---|
| `TASK-021-01-design` | design | 단일 source와 독립 slice DAG를 이 문서에 기록, PR #77 |
| `task-021-baseline-import` | backend-infra | exact source를 한 번 import한 merge commit `faa19e2d604cadafd551297dbde22ea4c7002017`, PR #78 |
| `task-021-contract-provenance` | backend-infra | blueprint logout, package ledger, README와 이 진행 보고 작성 완료; AgentFlow publish 대기 |
| backend 회귀와 세 frontend correctness package | backend / frontend-state | import 기준선에서 독립 구현·검증 진행 |
| `task-021-fe-core-e2e` | frontend | 선행 package 통합 뒤 실제 backend와 strict browser 검증 대기 |
| QA / Reviewer | qa / reviewer | 모든 구현을 합친 동일 immutable head와 최신 thread/CI 증거 대기 |

## 11. Rollback 및 배포 복귀 경계

- 코드 rollback 단위는 integration merge commit `faa19e2d604cadafd551297dbde22ea4c7002017`
  전체다. downstream commit이 있으면 먼저 역순으로 되돌린 뒤
  `git revert -m 1 faa19e2d604cadafd551297dbde22ea4c7002017`로 역변경 commit을 만든다. 이 명령은
  저장소를 변경하므로 승인된 rollback에서만 실행하고, 일부 224-file 경로만 골라 삭제하지 않는다.
- 배포 rollback은 위 코드 역변경과 별개로, SHA와 health 결과가 함께 보존된 직전 검증 배포본으로
  artifact/image 또는 traffic pointer를 복귀한다. mutable branch를 다시 build해 이전 배포본으로
  간주하지 않는다.
- 복귀 뒤 backend 전체 test, frontend lint/test/build/smoke, 실제 HTTP health check와 strict browser
  핵심 흐름을 다시 확인한다. 어느 검증도 과거 head의 결과를 재사용하지 않는다.
- 이 import는 기존 `V1__initial_schema.sql`을 코드 계보에 포함하지만 이 문서 slice는 DB를 변경하지
  않는다. rollback 과정에서 DB DROP, volume 삭제 또는 적용된 migration의 파괴적 역실행을 지시하지
  않으며, 데이터는 보존하고 필요한 schema 조정은 별도 검증된 forward migration으로 처리한다.
