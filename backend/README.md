# Backend Core

이 디렉터리는 Re:Start Quest MVP의 서버 도메인/오케스트레이션 코어입니다.

현재 repo에는 Spring Boot scaffold와 Gradle/Maven wrapper가 없으므로, 첫 구현은 외부 의존성 없이 JDK 17 `javac`로 검증 가능한 Java 코드로 둡니다. 이후 Spring Boot 프로젝트가 추가되면 `application` service와 `domain` model은 그대로 유지하고 controller, persistence, security adapter를 감싸는 방식으로 확장합니다.

## 구현 범위

- 온보딩 프로필 기반 오늘의 퀘스트 3개 생성
- 퀘스트 완료 처리
- 실패 이유 저장과 더 쉬운 퀘스트 재설계
- 오늘 대시보드 summary 계산
- API DTO 초안에 맞춘 presentation response/request record

## 검증 명령

PowerShell에서 아래 명령으로 main/test Java 파일을 컴파일하고 워크플로 테스트를 실행합니다.

```powershell
$out = "C:\java\assignment\spring\AgentFlow\.agentflow\state\provider-runs\task-049-03-backend-2\javac-classes"
New-Item -ItemType Directory -Force $out | Out-Null
$files = Get-ChildItem backend/src/main/java,backend/src/test/java -Recurse -Filter *.java | ForEach-Object { $_.FullName }
javac -encoding UTF-8 -d $out $files
java -ea -cp $out com.restartquest.backend.DailyQuestWorkflowTest
```

## 다음 구현 지점

- Spring Boot `@RestController` 추가
- JPA entity/repository adapter 추가
- 인증/사용자 식별 adapter 추가
- `QuestPlanner` 뒤에 LLM client adapter 추가
- DTO 검증 실패, provider timeout, quota 초과를 구분하는 error response 추가
