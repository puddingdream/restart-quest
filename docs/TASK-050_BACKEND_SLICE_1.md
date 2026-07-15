# TASK-050 Backend Slice 1

## 구현 slice

현재 backend 작업은 **Slice 1: 핵심 재진입 루프 mock**만 담당한다.

흐름은 아래 API 표면을 기준으로 한다.

- `POST /api/onboarding`에 대응하는 `RestartQuestApi.postOnboarding`
- `GET /api/onboarding/me`에 대응하는 `RestartQuestApi.getOnboardingMe`
- `POST /api/quests/generate`에 대응하는 `RestartQuestApi.postGenerateQuests`
- `GET /api/quests/today`에 대응하는 `RestartQuestApi.getTodayQuests`
- `PATCH /api/quests/{id}/complete`에 대응하는 `RestartQuestApi.patchCompleteQuest`
- `PATCH /api/quests/{id}/fail`에 대응하는 `RestartQuestApi.patchFailQuest`
- `POST /api/quests/{id}/redesign`에 대응하는 `RestartQuestApi.postRedesignQuest`
- `GET /api/dashboard`에 대응하는 `RestartQuestApi.getDashboard`

## 같은 역할 pool agent와의 충돌 방지

이 backend agent의 담당 파일 범위는 아래로 제한했다.

- `backend/src/main/java/com/restartquest/backend/domain/**`
- `backend/src/main/java/com/restartquest/backend/application/**`
- `backend/src/main/java/com/restartquest/backend/infrastructure/**`
- `backend/src/main/java/com/restartquest/backend/presentation/**`
- `backend/src/test/java/com/restartquest/backend/**`
- `backend/README.md`
- `docs/TASK-050_BACKEND_SLICE_1.md`
- `.gitignore`

제외 범위:

- frontend 화면과 API 연동
- 인증/인가
- DB/JPA/migration
- 실제 LLM provider
- 이력서, 면접, 공고, 정책, 알림, 캘린더, 관리자 기능
- 운영 배포 설정

## 설계 결정

- 현재 repo에는 Spring Boot scaffold, Maven, Gradle wrapper가 없다.
- 따라서 이번 slice는 외부 의존성 없이 JDK 17로 컴파일 가능한 backend core로 구현했다.
- 계층은 추후 Spring Boot adapter가 감쌀 수 있도록 `domain`, `application`, `infrastructure`, `presentation`으로 나눴다.
- mock AI는 `QuestAiClient` port 뒤의 `MockQuestAiClient`로 둬서 Slice 3에서 실제 provider로 교체할 수 있게 했다.
- 첫 slice 저장소는 단일 사용자 인메모리 `RestartQuestStore`로 제한했다.
- 실패 후 재설계는 원래 퀘스트보다 더 낮은 난이도 또는 TINY 하한에서 더 짧은 예상 시간이어야 한다.
- 대시보드 진행률은 설계 문서대로 `DONE / 오늘 생성된 원 퀘스트 수` 기준으로 계산하고, 재설계 퀘스트는 분모에 넣지 않는다.

## 검증 기록

검증 명령은 repository root에서 실행한다.

```powershell
$out = "C:\java\assignment\spring\AgentFlow\.agentflow\state\provider-runs\task-050-04-backend\javac-classes"
New-Item -ItemType Directory -Force $out | Out-Null
$files = Get-ChildItem backend/src/main/java,backend/src/test/java -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -encoding UTF-8 -d $out $files
java -ea -cp $out com.restartquest.backend.RestartQuestSliceWorkflowTest
```

테스트 범위:

- 온보딩 입력 후 오늘 퀘스트 3개 생성
- profile의 희망 직무가 mock quest에 반영되는지 확인
- 퀘스트 완료 상태 전이
- 실패 이유 저장
- 실패한 퀘스트의 더 쉬운 재설계 생성
- 대시보드 완료/실패/재설계/다음 행동 반영
- enum 검증 실패
- 예상 시간 범위 검증
- 더 쉬워지지 않은 재설계 결과 차단

## 진행 보고 기록

- 기획 문서와 TASK-050 slice plan을 확인했다.
- 요청된 `docs/agents/ROLE_BACKEND.md`, `docs/workflow/GITHUB_FLOW.md`는 현재 worktree에 없음을 확인했다.
- 동일 역할 backend pool branch가 현재 design commit과 동일해 아직 코드 충돌 대상이 없음을 확인했다.
- backend 작업은 Slice 1 mock loop로 제한했다.
- Spring Boot scaffold 부재로 인해 HTTP adapter 대신 검증 가능한 backend core와 presentation facade를 먼저 구현했다.

## 다음 slice 후보

- Slice 2에서 Spring Boot scaffold, HTTP controller, persistence adapter 또는 단일 사용자 DB 저장을 추가한다.
- Slice 3에서 `QuestAiClient` 실제 LLM provider adapter와 JSON schema 검증 실패/error 구분을 추가한다.
