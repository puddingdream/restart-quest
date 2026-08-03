# Re:Start Quest MVP 패키지 경계 ledger

## 1. 목적과 revision

이 문서는 `docs/MVP_IMPLEMENTATION_BLUEPRINT.md`의 구현 DAG에 대한 canonical 실행 경계와 감사 증거다. 제품·도메인·API·화면 결정은 blueprint를 따르고, 이 문서는 package 소유권, dependency base, worker head, 실제 변경 경로와 residual mismatch를 기록한다.

- backlog: `TASK-002-MVP`, boundary revision `8e8f350e1ccf-D1`
- 적용 결의: `TASK-002-COLLAB-8e8f350e1ccf-A1-director-D1`
- 계약 통합 revision: `e79f8d050e`
- 비교 방식: 누적 PR도 `main`과 비교하지 않고 선언된 dependency head와 현재 worker head의 tree를 `git diff --name-only <base> <head>`로 비교한다.
- core 통합 base `a0f668917cb1dd1a7d95b2737567aacc58fea9be`에는 선언된 backend endpoint 4개와 frontend feature 2개의 source head가 모두 ancestor로 포함되어 있다.
- 아래 실제 경로 집합은 wildcard-free directory prefix로 압축 표기한다. 각 표기는 해당 diff에서 그 prefix 아래 발견된 파일 전체를 뜻하며, 정확한 잔여 경로는 별도로 파일 단위로 기록한다.

## 2. 경계 원칙

1. backend는 실제 구조인 `domain`, `application`, `infrastructure`, `presentation` 계층을 따른다. 이전 설계의 존재하지 않는 feature-first Java 경로를 허용하지 않는다.
2. 여러 backend use case가 함께 쓰는 `QuestPlanStore`와 adapter는 `be-quest-storage`, 공개 quest 여정/현재 퀘스트 응답 모델은 `be-quest-api-model`이 단독 소유한다.
3. frontend root build/package-manager 설정, 공통 `apiRequest`, shared auth와 공통 style entry는 `fe-app-entry`가 단독 소유한다.
4. feature mock handler/test와 feature 사이 outcome refresh binding은 해당 feature가 소유한다. feature API는 자기 mock handler를 `apiRequest`에 전달하며 중앙 shared mock router를 두지 않는다.
5. E2E 실행 파일은 `fe-core-flow-integration`이 소유하지만 `package.json`, TypeScript/Vite 설정 변경은 `fe-app-entry` 소유 변경으로 선행 반영한다.
6. canonical docs는 Design work item만 수정한다. backend/frontend package에서는 모두 read-only context다.
7. 책임 밖 변경을 정당화하기 위해 `backend/src/**`, `frontend/src/**` 같은 포괄 경계나 중복 소유 경계를 추가하지 않는다.

## 3. 12개 worker head 대응표

| packageId | 실행 목표 | dependency 기준 base SHA | 현재 head SHA | 변경 수 | 소유 판단 | 결과 |
|---|---|---|---|---:|---|---|
| `be-user-context` | bootstrap, 인증, 내 정보, 온보딩 | `f4de4b745afae6f7e50dfac27d3371b4b259c2c8` | `faf34375ecbf08b218c12b47fd9ae37d19387fd1` | 51 | build와 사용자 context 계층에 응집 | pass |
| `be-quest-domain` | 순수 quest 도메인 불변식 | `faf34375ecbf08b218c12b47fd9ae37d19387fd1` | `45d4792bb3e6c8351a232d7193a582ca72eae450` | 17 | domain은 소유, store port/adapter/test는 `be-quest-storage` 소유 | residual mismatch 4 |
| `be-ai-adapter` | typed AI port와 adapter | `45d4792bb3e6c8351a232d7193a582ca72eae450` | `68659245d9dde2384768c99b268f6855e6ce2189` | 16 | application AI 계약과 infrastructure AI adapter에 응집 | pass |
| `be-daily-generation` | 당일 멱등 생성/조회 | `68659245d9dde2384768c99b268f6855e6ce2189` | `ee503ba8f7c519a6f8bd094d2fc6f1c979b91576` | 12 | use case/API는 소유, store와 공용 DTO는 선행 package 소유 | residual mismatch 3 |
| `be-quest-completion` | 현재 퀘스트 완료 전이 | `45d4792bb3e6c8351a232d7193a582ca72eae450` | `59f43d632866cdc529508dbdf94e1f7b753ae57d` | 9 | use case/API는 소유, store와 공용 DTO/test는 선행 package 소유 | residual mismatch 5 |
| `be-failure-redesign` | 이유 기반 원자적 재설계 | `68659245d9dde2384768c99b268f6855e6ce2189` | `6b12c51c0b805a8aafc66c551c10ace4434ee009` | 12 | use case/API는 소유, domain/store/공용 DTO는 선행 package 소유 | residual mismatch 5 |
| `be-dashboard` | 오늘 집계 read model | `45d4792bb3e6c8351a232d7193a582ca72eae450` | `5c04e12e9984696e392ab2e6218dab68343db322` | 5 | dashboard application/presentation에 응집 | pass |
| `fe-app-entry` | frontend 기반, 인증, 온보딩 | `f4de4b745afae6f7e50dfac27d3371b4b259c2c8` | `1e396a481d49b33e927093ff28da1ee1c827d895` | 50 | 기반/shared/auth/onboarding은 소유, feature placeholder는 feature 소유 | residual mismatch 2 |
| `fe-today-quests` | 오늘 퀘스트 생성/카드 | `1e396a481d49b33e927093ff28da1ee1c827d895` | `cbd8621dcc4c9730b85eef6e5da732576a3fb311` | 16 | quests feature는 소유, shared/build/common style은 app-entry 소유 | residual mismatch 4 |
| `fe-quest-outcomes` | 완료/더 작게 바꾸기 | `cbd8621dcc4c9730b85eef6e5da732576a3fb311` | `ef51b29bf88a21c7e463401445f1550d8083b2d2` | 21 | quests outcome feature는 소유, shared/build/common style은 app-entry 소유 | residual mismatch 6 |
| `fe-dashboard` | 오늘 요약/다음 행동 | `1e396a481d49b33e927093ff28da1ee1c827d895` | `3c6a7815e88962cb34ac2f0043e178128077b582` | 13 | dashboard feature는 소유, shared/build/common style은 app-entry 소유 | residual mismatch 4 |
| `fe-core-flow-integration` | 실제 backend smoke/E2E | `a0f668917cb1dd1a7d95b2737567aacc58fea9be` | `14e5ee53baf3ce86e02c2cd0198569dd136c7547` | 11 | E2E와 quest wire는 소유, root build 파일은 app-entry 소유 | residual mismatch 5 |

## 4. dependency-relative 실제 변경 경로

### 4.1 Backend

- `be-user-context` (51): `backend/.gitattributes`, `backend/.gitignore`, `backend/build.gradle`, `backend/settings.gradle`, `backend/gradlew`, `backend/gradlew.bat`, `backend/gradle/wrapper/**`, `backend/src/main/java/com/restartquest/RestartQuestApplication.java`, `backend/src/main/java/com/restartquest/application/error/**`, 사용자 관련 `backend/src/main/java/com/restartquest/application/port/` 5개 파일, `backend/src/main/java/com/restartquest/application/user/**`, `backend/src/main/java/com/restartquest/domain/user/**`, 사용자 관련 `backend/src/main/java/com/restartquest/infrastructure/persistence/` 3개 adapter, `backend/src/main/java/com/restartquest/infrastructure/security/**`, `backend/src/main/java/com/restartquest/presentation/auth/**`, `backend/src/main/java/com/restartquest/presentation/error/**`, `backend/src/main/java/com/restartquest/presentation/onboarding/**`, `backend/src/main/java/com/restartquest/presentation/user/**`, `backend/src/main/resources/application.yml`, `backend/src/test/java/com/restartquest/RestartQuestApplicationTests.java`, `backend/src/test/java/com/restartquest/infrastructure/persistence/UserRepositoryTest.java`, `backend/src/test/java/com/restartquest/presentation/UserContextApiTest.java`.
- `be-quest-domain` (17): `backend/src/main/java/com/restartquest/domain/quest/**`, `backend/src/test/java/com/restartquest/domain/quest/**`와 아래 residual 4개.
- `be-ai-adapter` (16): `backend/src/main/java/com/restartquest/application/ai/**`, `backend/src/main/java/com/restartquest/application/port/QuestAiClient.java`, `backend/src/main/java/com/restartquest/infrastructure/ai/**`, `backend/src/test/java/com/restartquest/application/ai/**`, `backend/src/test/java/com/restartquest/infrastructure/ai/**`.
- `be-daily-generation` (12): `backend/src/main/java/com/restartquest/application/quest/DailyQuestException.java`, `GenerateDailyQuestsService.java`, `GetTodayQuestsService.java`, `TodayQuestPlan.java`, `backend/src/main/java/com/restartquest/infrastructure/config/QuestTimeConfiguration.java`, `backend/src/main/java/com/restartquest/presentation/quest/DailyQuestController.java`, `DailyQuestResponse.java`, `GenerateDailyQuestsRequest.java`, `backend/src/test/java/com/restartquest/presentation/DailyQuestApiTest.java`와 아래 residual 3개.
- `be-quest-completion` (9): `backend/src/main/java/com/restartquest/application/quest/CompleteQuestService.java`, `backend/src/main/java/com/restartquest/presentation/quest/QuestController.java`, `backend/src/test/java/com/restartquest/application/quest/CompleteQuestServiceTest.java`, `backend/src/test/java/com/restartquest/presentation/QuestCompletionApiTest.java`와 아래 residual 5개.
- `be-failure-redesign` (12): `backend/src/main/java/com/restartquest/application/quest/RedesignQuestResult.java`, `RedesignQuestService.java`, `backend/src/main/java/com/restartquest/presentation/quest/QuestRedesignController.java`, `FailureRedesignRequest.java`, `FailureRedesignResponse.java`, `QuestRedesignResponse.java`, `backend/src/test/java/com/restartquest/presentation/FailureRedesignApiTest.java`와 아래 residual 5개.
- `be-dashboard` (5): `backend/src/main/java/com/restartquest/application/dashboard/**`, `backend/src/main/java/com/restartquest/presentation/dashboard/**`, `backend/src/test/java/com/restartquest/presentation/DashboardApiTest.java`.

### 4.2 Frontend

- `fe-app-entry` (50): frontend root의 `.gitignore`, `eslint.config.mjs`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.test.json`, `vite.config.mjs`; `frontend/scripts/prepareBuild.mjs`, `frontend/scripts/smoke.mjs`; `frontend/src/app/**`, `frontend/src/features/auth/**`, `frontend/src/features/onboarding/**`, `frontend/src/main.tsx`, `frontend/src/shared/api/**`, `frontend/src/shared/auth/**`, 공통 `frontend/src/styles.css`와 `frontend/src/styles/{auth,base,forms,onboarding,responsive,routes,shell}.css`, `frontend/src/vite-env.d.ts` 및 아래 placeholder residual 2개.
- `fe-today-quests` (16): `frontend/src/features/quests/**`, `frontend/src/styles/quests.css`와 아래 residual 4개.
- `fe-quest-outcomes` (21): `frontend/src/features/quests/**`, `frontend/src/styles/quest-outcomes.css`와 아래 residual 6개.
- `fe-dashboard` (13): `frontend/src/features/dashboard/**`, `frontend/src/styles/dashboard.css`와 아래 residual 4개.
- `fe-core-flow-integration` (11): `frontend/scripts/e2e.mjs`, `frontend/scripts/e2e/**`, `frontend/src/features/quests/api/questApi.ts`, `frontend/src/features/quests/api/questWire.test.ts`, `frontend/src/features/quests/api/questWire.ts`와 아래 residual 5개.

## 5. 정확한 residual mismatch와 이동 대상

| current worker | 책임 밖 정확한 경로 | canonical owner / 조치 |
|---|---|---|
| `be-quest-domain` | `backend/src/main/java/com/restartquest/application/port/QuestPlanStore.java`; `backend/src/main/java/com/restartquest/infrastructure/persistence/QuestPlanStoreAdapter.java`; `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestJourneyConcurrencyTest.java`; `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestPlanRepositoryTest.java` | 네 파일을 `be-quest-storage`로 이동 |
| `be-daily-generation` | `backend/src/main/java/com/restartquest/infrastructure/persistence/QuestPlanStoreAdapter.java` | store 변경을 `be-quest-storage`로 이동 |
| `be-daily-generation` | `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestJourneyResponse.java`; `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestResponse.java` | 공용 DTO를 `be-quest-api-model`로 이동 |
| `be-quest-completion` | `backend/src/main/java/com/restartquest/application/port/QuestPlanStore.java`; `backend/src/main/java/com/restartquest/infrastructure/persistence/QuestPlanStoreAdapter.java`; `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestCompletionStoreTest.java` | `be-quest-storage`로 이동 |
| `be-quest-completion` | `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestJourneyResponse.java`; `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestResponse.java` | `be-quest-api-model`의 DTO를 소비하도록 변경 |
| `be-failure-redesign` | `backend/src/main/java/com/restartquest/application/port/QuestPlanStore.java`; `backend/src/main/java/com/restartquest/infrastructure/persistence/QuestPlanStoreAdapter.java` | `be-quest-storage`로 이동 |
| `be-failure-redesign` | `backend/src/main/java/com/restartquest/domain/quest/QuestJourney.java` | 불변식 변경을 `be-quest-domain`으로 이동 |
| `be-failure-redesign` | `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestJourneyResponse.java`; `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestResponse.java` | `be-quest-api-model`의 DTO를 소비하도록 변경 |
| `fe-app-entry` | `frontend/src/features/dashboard/pages/DashboardPage.tsx`; `frontend/src/features/quests/pages/TodayPage.tsx` | placeholder를 `src/app` 아래 route fallback으로 옮기거나 각각 `fe-dashboard`, `fe-today-quests`가 생성 |
| `fe-today-quests` | `frontend/src/shared/api/mockApi.quests.test.ts`; `frontend/src/shared/api/mockApi.ts`; `frontend/src/styles.css`; `frontend/tsconfig.test.json` | quest mock handler/test를 feature api로 이동; router/style entry/test config 변경은 `fe-app-entry`에서 선행 |
| `fe-quest-outcomes` | `frontend/src/shared/api/mockApi.quests.test.ts`; `frontend/src/shared/api/mockApi.ts`; `frontend/src/shared/api/queryRefresh.test.ts`; `frontend/src/shared/api/queryRefresh.ts`; `frontend/src/styles.css`; `frontend/tsconfig.test.json` | quest handler는 feature로 이동; query refresh와 root 파일은 `fe-app-entry` 단독 소유 |
| `fe-dashboard` | `frontend/src/shared/api/mockApi.dashboard.test.ts`; `frontend/src/shared/api/mockApi.ts`; `frontend/src/styles.css`; `frontend/tsconfig.test.json` | dashboard handler/test를 feature api로 이동; root/shared router는 `fe-app-entry` 단독 소유 |
| `fe-core-flow-integration` | `frontend/.gitignore`; `frontend/package.json`; `frontend/tsconfig.app.json`; `frontend/tsconfig.test.json`; `frontend/vite.config.mjs` | 필요한 설정을 `fe-app-entry` 소유 head에 선행 반영하고 core worker는 E2E/wire 파일만 수정 |

## 6. canonical package allowedPaths

아래 경로만 수정 가능하다. directory prefix는 wildcard-free `/**`만 사용하며 root/shared/build 파일은 정확한 파일 단위로 한 owner에만 나타난다.

### 6.1 Backend packages

#### `be-user-context`

- `backend/.gitattributes`
- `backend/.gitignore`
- `backend/build.gradle`
- `backend/settings.gradle`
- `backend/gradlew`
- `backend/gradlew.bat`
- `backend/gradle/**`
- `backend/src/main/java/com/restartquest/RestartQuestApplication.java`
- `backend/src/main/java/com/restartquest/application/error/**`
- `backend/src/main/java/com/restartquest/application/port/AccessTokenManager.java`
- `backend/src/main/java/com/restartquest/application/port/AccessTokenStore.java`
- `backend/src/main/java/com/restartquest/application/port/OnboardingProfileStore.java`
- `backend/src/main/java/com/restartquest/application/port/PasswordHasher.java`
- `backend/src/main/java/com/restartquest/application/port/UserStore.java`
- `backend/src/main/java/com/restartquest/application/user/**`
- `backend/src/main/java/com/restartquest/domain/user/**`
- `backend/src/main/java/com/restartquest/infrastructure/persistence/AccessTokenStoreAdapter.java`
- `backend/src/main/java/com/restartquest/infrastructure/persistence/OnboardingProfileStoreAdapter.java`
- `backend/src/main/java/com/restartquest/infrastructure/persistence/UserStoreAdapter.java`
- `backend/src/main/java/com/restartquest/infrastructure/security/**`
- `backend/src/main/java/com/restartquest/presentation/auth/**`
- `backend/src/main/java/com/restartquest/presentation/error/**`
- `backend/src/main/java/com/restartquest/presentation/onboarding/**`
- `backend/src/main/java/com/restartquest/presentation/user/**`
- `backend/src/main/resources/application.yml`
- `backend/src/main/resources/db/migration/V1__user_and_onboarding.sql`
- `backend/src/test/java/com/restartquest/RestartQuestApplicationTests.java`
- `backend/src/test/java/com/restartquest/infrastructure/persistence/UserRepositoryTest.java`
- `backend/src/test/java/com/restartquest/presentation/UserContextApiTest.java`
- `backend/src/test/resources/**`

#### `be-quest-domain`

- `backend/src/main/java/com/restartquest/domain/quest/**`
- `backend/src/test/java/com/restartquest/domain/quest/**`

#### `be-quest-storage`

- `backend/src/main/java/com/restartquest/application/port/QuestPlanStore.java`
- `backend/src/main/java/com/restartquest/infrastructure/persistence/QuestPlanStoreAdapter.java`
- `backend/src/main/resources/db/migration/V2__daily_quest_domain.sql`
- `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestJourneyConcurrencyTest.java`
- `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestPlanRepositoryTest.java`
- `backend/src/test/java/com/restartquest/infrastructure/persistence/QuestCompletionStoreTest.java`

#### `be-quest-api-model`

- `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestJourneyResponse.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestResponse.java`
- `backend/src/test/java/com/restartquest/presentation/quest/dto/**`

#### `be-ai-adapter`

- `backend/src/main/java/com/restartquest/application/ai/**`
- `backend/src/main/java/com/restartquest/application/port/QuestAiClient.java`
- `backend/src/main/java/com/restartquest/infrastructure/ai/**`
- `backend/src/test/java/com/restartquest/application/ai/**`
- `backend/src/test/java/com/restartquest/infrastructure/ai/**`

#### `be-daily-generation`

- `backend/src/main/java/com/restartquest/application/quest/DailyQuestException.java`
- `backend/src/main/java/com/restartquest/application/quest/GenerateDailyQuestsService.java`
- `backend/src/main/java/com/restartquest/application/quest/GetTodayQuestsService.java`
- `backend/src/main/java/com/restartquest/application/quest/TodayQuestPlan.java`
- `backend/src/main/java/com/restartquest/infrastructure/config/QuestTimeConfiguration.java`
- `backend/src/main/java/com/restartquest/presentation/quest/DailyQuestController.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/DailyQuestResponse.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/GenerateDailyQuestsRequest.java`
- `backend/src/test/java/com/restartquest/application/quest/GenerateDailyQuestsServiceTest.java`
- `backend/src/test/java/com/restartquest/presentation/DailyQuestApiTest.java`

#### `be-quest-completion`

- `backend/src/main/java/com/restartquest/application/quest/CompleteQuestService.java`
- `backend/src/main/java/com/restartquest/presentation/quest/QuestController.java`
- `backend/src/test/java/com/restartquest/application/quest/CompleteQuestServiceTest.java`
- `backend/src/test/java/com/restartquest/presentation/QuestCompletionApiTest.java`

#### `be-failure-redesign`

- `backend/src/main/java/com/restartquest/application/quest/RedesignQuestResult.java`
- `backend/src/main/java/com/restartquest/application/quest/RedesignQuestService.java`
- `backend/src/main/java/com/restartquest/presentation/quest/QuestRedesignController.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/FailureRedesignRequest.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/FailureRedesignResponse.java`
- `backend/src/main/java/com/restartquest/presentation/quest/dto/QuestRedesignResponse.java`
- `backend/src/test/java/com/restartquest/application/quest/RedesignQuestServiceTest.java`
- `backend/src/test/java/com/restartquest/presentation/FailureRedesignApiTest.java`

#### `be-dashboard`

- `backend/src/main/java/com/restartquest/application/dashboard/**`
- `backend/src/main/java/com/restartquest/presentation/dashboard/**`
- `backend/src/test/java/com/restartquest/presentation/DashboardApiTest.java`

### 6.2 Frontend packages

#### `fe-app-entry`

- `frontend/.gitignore`
- `frontend/eslint.config.mjs`
- `frontend/index.html`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.json`
- `frontend/tsconfig.test.json`
- `frontend/vite.config.mjs`
- `frontend/scripts/prepareBuild.mjs`
- `frontend/scripts/smoke.mjs`
- `frontend/src/app/**`
- `frontend/src/features/auth/**`
- `frontend/src/features/onboarding/**`
- `frontend/src/main.tsx`
- `frontend/src/shared/api/ApiError.ts`
- `frontend/src/shared/api/apiRequest.ts`
- `frontend/src/shared/auth/**`
- `frontend/src/styles.css`
- `frontend/src/styles/auth.css`
- `frontend/src/styles/base.css`
- `frontend/src/styles/forms.css`
- `frontend/src/styles/onboarding.css`
- `frontend/src/styles/responsive.css`
- `frontend/src/styles/routes.css`
- `frontend/src/styles/shell.css`
- `frontend/src/vite-env.d.ts`

#### `fe-today-quests`

- `frontend/src/features/quests/**`
- `frontend/src/styles/quests.css`

#### `fe-quest-outcomes`

- `frontend/src/features/quests/**`
- `frontend/src/styles/quest-outcomes.css`

#### `fe-dashboard`

- `frontend/src/features/dashboard/**`
- `frontend/src/styles/dashboard.css`

#### `fe-core-flow-integration`

- `frontend/scripts/e2e.mjs`
- `frontend/scripts/e2e/**`
- `frontend/src/features/quests/api/questApi.ts`
- `frontend/src/features/quests/api/questWire.test.ts`
- `frontend/src/features/quests/api/questWire.ts`

## 7. 역할 지시와 진행 기준

### Backend

1. `be-quest-domain`에서 store 관련 네 파일을 떼어 `be-quest-storage` head를 만든다.
2. 공용 `QuestJourneyResponse`와 `QuestResponse`는 `be-quest-api-model`에서 한 번만 정의하고 직렬화 회귀 테스트를 둔다.
3. generation, completion, redesign, dashboard head는 새 storage/API model dependency head 위로 재구성하고 자기 use case 파일만 남긴다.
4. 재설계가 추가한 `QuestJourney` 불변식 변경은 domain head로 옮긴다.

### Frontend

1. 중앙 shared mock router를 제거하고 auth/onboarding/quests/dashboard API가 자기 feature mock handler를 `apiRequest`에 전달한다.
2. outcome query refresh는 `features/quests/questOutcomeQueryRefresh.ts`가 소유하고 today/dashboard consumer가 같은 key 등록 API를 사용한다. root build/test 설정은 `fe-app-entry`만 수정한다.
3. 공통 `styles.css`를 feature가 수정하지 않도록 feature CSS를 page/component가 직접 import한다.
4. core integration은 root 설정 diff를 제거하고 E2E/wire 파일만 유지한다.

### Reviewer

새 head마다 이 문서의 base/head를 갱신한 뒤 `git diff --name-only <dependency-base> <current-head>`의 모든 경로가 해당 package allowedPaths의 부분집합인지 확인한다. 12개 기존 worker와 새 foundation package 두 개의 결과를 pass/residual mismatch로 모두 기록하고, 코드 이동 뒤 backend/frontend 전체 회귀와 핵심 흐름을 재검증한다.

## 8. 현재 진행 보고

- pass: `be-user-context`, `be-ai-adapter`, `be-dashboard` (3개)
- residual mismatch: `be-quest-domain`, `be-daily-generation`, `be-quest-completion`, `be-failure-redesign`, `fe-app-entry`, `fe-today-quests`, `fe-quest-outcomes`, `fe-dashboard`, `fe-core-flow-integration` (9개)
- 신규 선행 package: `be-quest-storage`, `be-quest-api-model` (아직 worker head 없음)
- 이 revision은 책임 밖 변경을 허용한 metadata 예외가 아니다. 위 이동과 새 head 게시가 끝나야 12개 worker 모두 pass가 된다.
- 경로 이동이나 분리 후에는 backend 전체 test, frontend test/lint/build, 핵심 사용자 흐름 smoke/E2E를 다시 실행한다.

## 9. 계약 통합 revision `e79f8d050e`

3~8절은 원본 worker head의 dependency-relative 감사 기록으로 유지한다. 원본과 APPLY head의 구현 또는
binding이 다르면 아래 순서에서 뒤에 오는 APPLY 계약을 최종 정본으로 삼는다. 동일 SHA가 두 단계에
반복되어도 AgentFlow source evidence 순서를 보존한다.

### 9.1 Design DAG 기반 통합 순서

1. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-01-design`
2. `TASK-002-DAG-428755fc98-01-be-user-context`
3. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-01-be-user-context`
4. `TASK-002-DAG-428755fc98-02-be-quest-domain`
5. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-02-be-quest-domain`
6. `TASK-002-DAG-428755fc98-03-be-ai-adapter`
7. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-03-be-ai-adapter`
8. `TASK-002-DAG-428755fc98-04-be-daily-generation`
9. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-04-be-daily-generation`
10. `TASK-002-DAG-428755fc98-05-be-quest-completion`
11. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-05-be-quest-completion`
12. `TASK-002-DAG-428755fc98-06-be-failure-redesign`
13. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-06-be-failure-redesign`
14. `TASK-002-DAG-428755fc98-07-be-dashboard`
15. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-07-be-dashboard`
16. `TASK-002-DAG-428755fc98-08-fe-app-entry`
17. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-08-fe-app-entry`
18. `TASK-002-DAG-428755fc98-09-fe-today-quests`
19. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-09-fe-today-quests`
20. `TASK-002-DAG-428755fc98-10-fe-quest-outcomes`
21. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-10-fe-quest-outcomes`
22. `TASK-002-DAG-428755fc98-11-fe-dashboard`
23. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-11-fe-dashboard`
24. `TASK-002-DAG-428755fc98-12-fe-core-flow-integration`
25. `TASK-002-COLLAB-8e8f350e1ccf-APPLY-task-002-dag-428755fc98-12-fe-core-flow-integration`

### 9.2 최종 producer/consumer 경계

- 인증·사용자·온보딩 producer는 auth/user/onboarding controller DTO이며 `fe-app-entry`가 그대로 소비한다.
- quest persistence producer는 domain과 `QuestPlanStore`이며 generation, completion, redesign, dashboard가
  사용자 소유권, 단일 current quest, 동일 journey revision과 낙관적 잠금 의미를 공유한다.
- daily/completion/redesign/dashboard HTTP producer의 wire 필드는 `docs/api/quest-api.md`를 따르고 frontend는
  API 경계에서만 화면 model로 변환한다.
- mock 호출은 feature API가 자기 handler를 공통 `apiRequest`에 전달한다. 삭제된
  `frontend/src/shared/api/mockApi.ts`는 최종 router가 아니다.
- outcome refresh producer는 `frontend/src/features/quests/questOutcomeQueryRefresh.ts`이며 today와 dashboard
  hook이 각각 `QUEST_OUTCOME_QUERY_KEYS`로 등록한다. 삭제된 `frontend/src/shared/api/queryRefresh.ts`의
  경로와 export 이름은 최종 binding이 아니다.

모든 frontend consumer는 위 feature-owned binding을 사용한 뒤
`온보딩 -> 오늘 퀘스트 생성 -> 완료 또는 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영`
흐름을 검증한다. 상담·감시·의지 평가 의미를 추가하거나 완료 상세 배열처럼 producer가 제공하지 않는
필드를 consumer가 합성하지 않는다.
