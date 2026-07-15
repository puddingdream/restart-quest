# Backend Slice 1

이 디렉터리는 Re:Start Quest의 첫 번째 백엔드 slice 구현을 담는다.

현재 repository에는 Spring Boot scaffold, Maven, Gradle wrapper가 없다. 그래서 이번 slice는 이 환경에서 바로 검증할 수 있도록 JDK 17 기반 backend core로 구현했다. 패키지 구조는 이후 Spring Boot adapter가 감쌀 수 있게 `domain`, `application`, `infrastructure`, `presentation`으로 나눴다.

## 구현 범위

- 현재 온보딩 프로필 저장/조회
- 온보딩 입력 기반 오늘의 mock 퀘스트 3개 생성
- 퀘스트 완료 처리
- 실패 이유와 선택 메모 기록
- 실패한 퀘스트를 더 작은 mock 퀘스트로 재설계
- 대시보드 진행률, 실패 수, 재설계 수, 다음 행동, 재설계 이력 요약

## 제외 범위

- 인증/인가
- DB/JPA 영속화
- 실제 LLM provider 호출
- 이력서, 면접, 공고, 정책, 알림, 캘린더, 관리자 기능
- Spring Boot build scaffold가 추가되기 전까지의 HTTP controller

## 검증

repository root에서 실행한다.

```powershell
$out = "C:\java\assignment\spring\AgentFlow\.agentflow\state\provider-runs\task-050-04-backend\javac-classes"
New-Item -ItemType Directory -Force $out | Out-Null
$files = Get-ChildItem backend/src/main/java,backend/src/test/java -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -encoding UTF-8 -d $out $files
java -ea -cp $out com.restartquest.backend.RestartQuestSliceWorkflowTest
```
