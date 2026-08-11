# TASK-011 canonical baseline 정합화 계획

## 1. 목적

이 문서는 분산 worker가 이미 만든 Re:Start Quest MVP를 다시 구현하지 않고, 검증 가능한 새 integration lineage로 가져와 canonical 기준선 후보를 만드는 실행 정본이다.

사용자 가치 자체는 바꾸지 않는다.

> 취업 공백자가 오늘 할 수 있는 작은 구직 행동을 시작하고, 어려웠던 행동을 이유에 맞게 더 작은 행동으로 바꿔 다시 이어갈 수 있어야 한다.

`7fb8c5fd2ad6b0f65101c8f6b8c641e61d1e122d`는 완성된 구현을 가진 **source candidate**일 뿐이다. 이 SHA나 branch 이름만으로 canonical이라고 부르지 않는다. 새 integration head가 provenance, package ownership, API·UI binding, 전체 회귀, 실제 브라우저 흐름을 모두 통과했을 때에만 그 새 immutable SHA를 canonical 후보로 보고한다.

## 2. 사용자 목표와 금지 범위

### 2.1 이번 작업의 목표

1. `main` 기준 SHA와 후보 SHA의 계보를 고정한다.
2. 후보가 실제로 포함한 worker head와 현재 움직이는 remote branch tip을 구분한다.
3. 후보 tree를 새 integration branch로 계보를 보존해 가져온다.
4. 기존 package ownership을 유지한 채 확인된 계약·mock·문서·접근성 residual만 소유 역할에서 보정한다.
5. backend 전체 테스트, frontend lint/test/build, 실제 HTTP core flow, 실제 브라우저 core flow를 최종 published head에서 다시 실행한다.
6. 같은 최종 head의 QA와 Reviewer 증거가 모인 뒤에만 immutable SHA를 canonical 기준선 후보로 기록한다.

### 2.2 금지 범위

- 후보 구현을 기능별로 새로 작성하거나 기존 worker 결과를 수동 복사하지 않는다.
- moving branch 이름을 source evidence로 사용하거나, 후보의 조상이 아닌 최신 tip을 자동으로 추가 merge하지 않는다.
- 검증 전 `7fb8c5f` 또는 중간 integration head를 canonical이라고 부르지 않는다.
- 이력서 첨삭, 모의면접, 공고·정책 연동, 알림, 캘린더, 관리자 화면을 이번 정합화에 섞지 않는다.
- production 서버, 운영 DB, 외부 AI provider 설정을 변경하지 않는다.
- secret, local DB, `backend/build/`, `frontend/dist/`, `frontend/node_modules/`, `frontend/test-results/`를 commit하지 않는다.
- source 결함을 E2E assertion 완화나 HTTP fallback 성공으로 숨기지 않는다.

## 3. 고정 provenance

2026-08-11 읽기 전용 조사 결과는 다음과 같다.

| 구분 | commit SHA | tree SHA | 판정 |
|---|---|---|---|
| `origin/main` 기준 | `35e7b25b05aabf45f61d96da0777bbafb9ceb655` | `2638a79bb905039c81087990e8ad910e671f7797` | 설계 문서 5개만 가진 시작점 |
| source candidate | `7fb8c5fd2ad6b0f65101c8f6b8c641e61d1e122d` | `ff4507a1ab753d267837cdfbb496631a916eaaf9` | 검증 전 후보 |

- `git merge-base --is-ancestor 35e7b25... 7fb8c5f...`는 성공한다.
- 후보는 기준 SHA보다 first-parent와 merged worker history를 포함해 57 commits 앞선다.
- 새 integration branch는 기준 SHA에서 시작해 exact candidate commit을 merge해야 한다. 후보 tree의 파일만 path copy하거나 squash하면 worker ancestry 검증 목적을 충족하지 못한다.
- merge 뒤 `35e7b25...`와 아래 frozen source head 전부가 새 head의 조상인지 다시 검사한다.
- 후보 merge가 충돌하면 자동 선택하지 않는다. 충돌 파일, 양쪽 blob, canonical owner를 기록하고 해당 owner package로 보낸다.

### 3.1 후보에 포함된 frozen source와 현재 tip

아래 `포함 head`는 후보 first-parent merge history에서 고정한 실제 source evidence다. `현재 tip`은 조사 시점의 remote metadata이며 이동할 수 있다.

| package | 후보에 포함된 head | 조사 시점 현재 tip | 현재 tip도 후보 조상인가 |
|---|---|---|---|
| design apply | `c645c4c4a9ddb92a6e98208f4cfdeb4503055d79` | 동일 | 예 |
| `be-user-context` | `faf34375ecbf08b218c12b47fd9ae37d19387fd1` | 동일 | 예 |
| `be-quest-domain` | `45d4792bb3e6c8351a232d7193a582ca72eae450` | 동일 | 예 |
| `be-ai-adapter` | `68659245d9dde2384768c99b268f6855e6ce2189` | `3105e82221bd4e39b336ef92c876d31b9190841a` | 아니오 |
| `be-daily-generation` | `ee503ba8f7c519a6f8bd094d2fc6f1c979b91576` | 동일 | 예 |
| `be-quest-completion` | `fa7e310080ed66e4a37cb9cb7eccf3049ec544db`, `59f43d632866cdc529508dbdf94e1f7b753ae57d` | `fa7e310080ed66e4a37cb9cb7eccf3049ec544db` | 예 |
| `be-failure-redesign` | `6b12c51c0b805a8aafc66c551c10ace4434ee009` | `780515e6dae6d39a5e33b6eab1f29566e3e27091` | 아니오 |
| `be-dashboard` | `0243892ced1513a063c04ef2dba04d755a07d518`, `5c04e12e9984696e392ab2e6218dab68343db322` | `0243892ced1513a063c04ef2dba04d755a07d518` | 예 |
| `fe-app-entry` | `1e396a481d49b33e927093ff28da1ee1c827d895`, `ecb7bee12f996d3827486c58ed5cdaa223a9e081` | `6048d82278fb7e13f3fd819e3295ff5dd38a545c` | 아니오 |
| `fe-today-quests` | `cbd8621dcc4c9730b85eef6e5da732576a3fb311`, `caec3e862e7e784a3863190b89ef168e791fa7fa` | `7b3b0e78ee7ca5c89f92126da4476cc032d79bed` | 아니오 |
| `fe-quest-outcomes` | `ef51b29bf88a21c7e463401445f1550d8083b2d2`, `fa08139e8037c3dc43172b7c7fb19d7edef6e12e` | `ef51b29bf88a21c7e463401445f1550d8083b2d2` | 예 |
| `fe-dashboard` | `3c6a7815e88962cb34ac2f0043e178128077b582`, `c8cf3f9baf63d32e7744027722388409a8ffbfef` | `0ae0095347d9cb63f914fc7c8e14b6f7dcf1e5ae` | 아니오 |
| `fe-core-flow-integration` | `14e5ee53baf3ce86e02c2cd0198569dd136c7547`, `87b3f6f6682ca3c21c7585a4108abfc90495c16d` | `7d53cc5beaa47e09f6c818e8a6c17b93d6c2d24c` | 아니오 |

후보의 조상이 아닌 여섯 current tip은 누락이라고 단정하지 않는다. 먼저 각 tip의 dependency base 대비 patch와 candidate final tree의 owner path를 비교한다. 후보에 동등하거나 후속 fix가 있으면 중복 merge하지 않고 근거를 ledger에 남긴다. candidate에 없는 유효 변경이면 해당 package owner에게만 재적용하고 회귀 테스트를 요구한다.

## 4. 재사용할 구현과 ownership 결정

후보의 다음 자산을 그대로 재사용한다.

- Spring Boot/Java 17/Gradle backend와 `domain -> application -> infrastructure -> presentation` 경계
- User, OnboardingProfile, DailyQuestPlan, QuestJourney, Quest, QuestRedesign 도메인
- typed `QuestAiClient`, deterministic adapter, runtime provider adapter와 오류 분류
- React/TypeScript/Vite frontend의 `auth`, `onboarding`, `quests`, `dashboard` feature 구조
- feature-owned mock adapter, quest outcome refresh binding, HTTP wire mapper
- `docs/MVP_IMPLEMENTATION_BLUEPRINT.md`, `docs/MVP_PACKAGE_BOUNDARIES.md`, `docs/api/quest-api.md`
- 실제 Spring Boot와 headless Chrome/Edge를 연결하는 E2E harness

후보의 마지막 integration fix 세 개(`97efab7`, `858f5e3`, `7fb8c5f`)는 package별 worker를 대체하는 새 기능이 아니라 실행 환경에서 드러난 공통 결함을 보정한 integration-owned 변경으로 유지한다. 새 정합화에서 이를 worker별로 다시 풀어 쓰지 않는다.

`baseline-foundation`만 전체 후보 commit을 기계적으로 merge할 수 있다. 이 권한은 cross-role source 수정 권한이 아니다. 이후 code diff는 아래 소유 package 경계 안에서만 만든다.

## 5. 고정 제품·도메인·API·화면 결정

### 5.1 제품과 범위

- MVP는 `회원가입/로그인 -> 온보딩 -> 에너지 선택 -> 세 퀘스트 생성 -> 완료 또는 더 작게 재설계 -> 대시보드 반영`이다.
- 화면에는 `실패율`, `의지 점수`, `위험`, `낙오`, 상담·진단 문구를 쓰지 않는다.
- 진행률은 완료한 여정 수를 세 최초 여정으로 나눈 실행 현황이며 사용자 평가값이 아니다.

### 5.2 도메인

- Asia/Seoul 서비스 기준일마다 최초 여정은 정확히 세 개이고 생성은 멱등이다.
- 한 `QuestJourney`에는 현재 `TODO` quest가 최대 하나다.
- 완료와 재설계가 같은 현재 quest에 경쟁하면 하나만 성공하고 나머지는 `409 QUEST_ALREADY_RESOLVED`다.
- 재설계는 같은 journey와 category를 유지하는 단일 replacement를 만들며 이전 revision만 history에 남긴다.
- AI 출력은 typed 구조, enum, 길이, 시간, 단계 수, 금지 문구 검증 뒤에만 저장한다.

### 5.3 HTTP 계약

- base path는 `/api/v1`, JSON은 camelCase, 식별자는 UUID 문자열, 날짜·시간은 정본 형식을 따른다.
- `QuestJourneyResponse.currentQuest`는 현재 revision 하나다.
- `history`는 current quest를 포함하지 않는 이전 revision의 오래된 순 배열이다. 최초 journey의 history는 빈 배열이다.
- dashboard의 `completedJourneys`와 `activeJourneys`는 배열이 아니라 정수 count다.
- 구현과 frontend가 이미 사용하는 `POST /api/v1/auth/logout` 204 응답을 `docs/api/quest-api.md` 인증 표와 오류 규칙에 추가한다. 이는 additive한 v1 문서 정합화이며 기존 consumer를 깨지 않는다.

### 5.4 화면과 runtime mode

- route는 `/signup`, `/login`, `/onboarding`, `/today`, `/dashboard`만 사용한다.
- 첫 진입은 인증·온보딩 상태에 따라 핵심 route로 보낸다. 소개 landing이나 placeholder route를 다시 연결하지 않는다.
- 일반 frontend build/dev의 기본 데이터 mode는 mock이다. 실제 backend 연동은 `VITE_API_MODE=http`로 명시한다. Vite proxy 설정만으로 HTTP mode가 되지는 않는다.
- 현재 styling은 Tailwind가 아니라 repository CSS 파일을 사용한다. README를 실제 선택에 맞춘다.
- 재설계 dialog는 최초 focus, Tab/Shift+Tab focus containment, Escape 닫기, trigger focus 복귀를 모두 보장한다.

## 6. 현재 확인된 residual mismatch

| ID | 근거 | owner | 완료 조건 |
|---|---|---|---|
| `R1-api-logout` | backend와 frontend는 logout을 사용하지만 API 정본 표에 없다. | `be-api-contract-alignment` | 204 계약과 인증 요구를 문서화하고 API 회귀를 유지 |
| `R2-mock-history` | `questMockApi` 최초 journey가 `history: [quest]`를 만든다. | `fe-wire-contract-parity` | 최초 history는 빈 배열, 재설계 후에는 이전 revision만 포함 |
| `R3-enum-label-drift` | quest와 dashboard가 category/reason enum·label을 별도 선언한다. | `fe-wire-contract-parity` | 큰 shared 추상화 대신 exact key fixture test로 drift 감시 |
| `R4-runtime-doc` | README는 Tailwind와 backend proxy 연결을 설명하지만 실제 CSS와 기본 mock mode를 명시하지 않는다. | `fe-runtime-ux-alignment` | 실제 styling과 mock/http 실행법을 구분 |
| `R5-dead-placeholder` | `ProtectedRoutePlaceholder`는 정의만 있고 실제 route가 사용하지 않는다. | `fe-runtime-ux-alignment` | 제거하고 실제 `/today`, `/dashboard` route 회귀 유지 |
| `R6-dialog-focus` | 최초 focus, Escape, trigger 복귀는 있으나 Tab focus containment가 없다. | `fe-runtime-ux-alignment` | keyboard focus가 열린 dialog 밖으로 나가지 않는 browser 회귀 |
| `R7-e2e-fallback` | HTTP API core flow는 browser launch 실패 fallback에서만 별도 실행된다. | `fe-final-integration-gate` | API core flow를 항상 실행하고 browser-required flow를 별도로 강제 |

위 표에 없는 새로운 mismatch가 owner 경계를 넘으면 현재 package의 allowed path를 넓히지 않는다. 정확한 파일과 consumer 영향을 보고하고 backlog를 다시 계획한다.

## 7. MVP slice와 DAG

```text
baseline-foundation
├── be-api-contract-alignment ──> fe-wire-contract-parity ──┐
└── fe-runtime-ux-alignment ────────────────────────────────┤
                                                            └── fe-final-integration-gate
```

| packageId | role | dependsOn | 단일 실행 목표 | writable scope 요약 |
|---|---|---|---|---|
| `baseline-foundation` | backend | 없음 | exact candidate merge, ancestry·owner audit | candidate가 추가한 repository 파일과 이 문서; source 내용 편집 금지 |
| `be-api-contract-alignment` | backend | `baseline-foundation` | logout producer/정본 계약과 회귀 증거 일치 | `docs/api/quest-api.md`, user-context API test |
| `fe-wire-contract-parity` | frontend | `be-api-contract-alignment` | mock/wire history와 enum·label fixture 일치 | quest/dashboard/auth API·type test 경계 |
| `fe-runtime-ux-alignment` | frontend | `baseline-foundation` | runtime 안내, dead placeholder, dialog keyboard residual 해소 | README, app placeholder, quest dialog·CSS·집중 E2E |
| `fe-final-integration-gate` | frontend | 앞의 backend/frontend residual package 전부 | HTTP flow를 항상 실행하고 browser-required 전체 gate 수행 | E2E harness와 frontend root test script만; 제품 source 결함은 owner에게 반환 |

`baseline-foundation`의 role이 backend인 이유는 runtime schema가 integration-only role을 지원하지 않기 때문이다. 이 package는 source-control transport owner일 뿐 frontend source를 설계하거나 수정할 권한이 없다. candidate merge 뒤 발생하는 새 code change는 각 backend/frontend owner package로만 보낸다.

### Slice A — 후보 계보 고정

- 목적: exact candidate를 새 integration lineage로 가져오고 source ancestry와 owner path를 감사한다.
- 사용자 흐름: 화면 기능은 바꾸지 않는다.
- backend/frontend 작업: source code를 재작성하지 않고 merge와 diff audit만 수행한다.
- QA 기준: 기준 SHA와 frozen source head가 모두 새 head의 조상이고 conflict가 없다.
- 제외: non-ancestor current tip의 무근거 추가 merge.
- 다음 진입 조건: candidate tree와 TASK-011 설계 문서 외 예상치 못한 diff가 없다.

### Slice B — 계약과 runtime residual 정합화

- 목적: R1~R6을 소유 역할별로 작게 보정한다.
- 사용자 흐름: logout, mock/http parity, keyboard dialog 흐름이 실제 계약과 일치한다.
- backend 작업: logout canonical API와 regression evidence.
- frontend 작업: history fixture, enum drift fixture, README/runtime mode, dead placeholder, dialog focus containment.
- QA 기준: package 집중 테스트와 frontend lint/test/build 통과.
- 제외: 화면 재디자인, 공용 enum framework, 신규 기능.
- 다음 진입 조건: 각 residual ID에 변경 파일과 회귀 명령이 연결된다.

### Slice C — 최종 통합 검증

- 목적: 같은 published head에서 전체 자동 검증과 실제 브라우저 흐름을 증명한다.
- 사용자 흐름: signup부터 dashboard까지 HTTP와 browser에서 각각 끝까지 실행된다.
- backend 작업: source 수정 없이 전체 suite 통과.
- frontend 작업: API core flow를 항상 수행하도록 harness를 고정하고 browser fallback을 canonical 증거로 인정하지 않는다.
- QA 기준: 8절 promotion gate 전부 통과.
- 제외: 테스트를 통과시키기 위한 제품 assertion 완화.
- 완료 조건: QA와 Reviewer가 같은 immutable published head를 검증한다.

## 8. 역할 지시와 최종 promotion gate

### Backend

- candidate import 단계에서는 merge ancestry와 tree만 다루고 feature code를 고치지 않는다.
- API producer가 정본과 다르면 producer 구현, DTO, test 근거를 함께 제시한다.
- 실행 명령: Windows는 `backend\\gradlew.bat test --no-daemon`, POSIX는 `backend/gradlew test --no-daemon`.

### Frontend

- mock은 화면 편의를 위한 별도 의미를 만들지 않고 canonical HTTP wire와 같은 journey/history 의미를 쓴다.
- enum/label 중복은 이번에는 fixture test로 감시한다. 실제 세 번째 consumer나 독립 변경 주기가 생길 때 shared contract 추출을 다시 판단한다.
- dialog keyboard와 320, 390, 768, 1280px viewport에서 겹침·잘림·배경 focus 이탈을 확인한다.
- `npm ci`, `npm run lint`, `npm test`, `npm run build`를 실행한다.

### QA

최종 published head SHA를 먼저 고정한 뒤 다음을 모두 실행한다.

1. backend 전체 test
2. frontend clean install, lint, 전체 test, production build
3. 실제 Spring Boot에 대한 HTTP API core flow: signup, onboarding, 세 journey 생성, 한 건 완료, 다른 한 건 재설계, today 재조회, dashboard count, 중복 처리 409
4. `E2E_REQUIRE_BROWSER=1`로 실제 Chrome/Edge core flow: route 전이, 새로고침 유지, dialog keyboard, 인증 만료, desktop/mobile viewport
5. `git status --short`, `git diff --check`, generated artifact와 secret 경로 부재

브라우저를 찾지 못해 HTTP fallback만 실행된 결과는 실제 browser PASS가 아니다. 외부 browser 설치 또는 `CHROME_PATH`가 필요할 때만 정확한 환경 blocker로 사용자에게 요청한다.

### Reviewer

- QA가 고정한 동일 SHA의 ancestry, owner path, API producer/consumer, mock parity, 테스트 증거를 확인한다.
- non-ancestor remote tip 여섯 개의 patch-equivalence 또는 의도적 제외 근거가 ledger에 있는지 확인한다.
- source 수정 없이 assertion만 약화한 변경, secret·DB·build output, 범위 밖 기능이 없는지 확인한다.

### Canonical 후보 보고 조건

다음이 모두 참이어야 한다.

- `35e7b25...`, `7fb8c5f...`, frozen source head가 최종 head의 조상이다.
- R1~R7이 파일·test 증거와 함께 닫혔다.
- backend test, frontend lint/test/build, HTTP core flow, browser-required core flow가 같은 최종 SHA에서 성공했다.
- QA PASS와 Reviewer APPROVED가 같은 최종 SHA를 가리킨다.
- worktree가 clean하고 generated artifact, local DB, secret이 diff에 없다.

그 전에는 `candidate`, `integration head`, `검증 중`으로만 부른다. 문서나 report 변경으로 SHA가 바뀌면 새 SHA에서 전체 promotion gate를 다시 실행한다.

## 9. 후순위

아래는 canonical baseline 승격에 필요한 defect가 확인되지 않는 한 별도 task로 둔다.

- 카드 정보 위계와 대시보드 시각 밀도 재디자인
- 실제 확장 수요 전 category/reason type을 공용 UI module로 추출
- Tailwind 도입 또는 CSS 체계 교체
- 이력서, 면접, 공고, 정책, 알림, 캘린더, 관리자 기능
- 운영 배포, 외부 AI provider credential과 quota 설정

## 10. rollback

이번 작업은 새 integration branch 안에서만 수행한다. promotion 실패 시 main이나 운영 환경을 되돌리는 명령을 실행하지 않고, 해당 branch를 merge하지 않은 채 blocker와 마지막 검증 SHA를 남긴다. 이미 통과한 source candidate와 worker branch는 변경하지 않으므로 재시도는 새 integration branch에서 동일 frozen SHA를 기준으로 시작할 수 있다.
