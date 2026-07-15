# Re:Start Quest Backend Slice 1

This backend slice implements the core re-entry loop mock only:

- onboarding profile input
- today's quest generation through a mock `QuestAiClient`
- quest completion/failure
- easier quest redesign after a failure reason
- dashboard summary

The implementation is dependency-free Java 17 because this worktree does not yet include a build tool and local Maven/Gradle commands are unavailable. The package layout keeps the backend boundaries expected by the Spring Boot target architecture:

- `domain`: entities, enums, and state transition rules
- `application`: use-case services and ports
- `infrastructure`: mock AI provider
- `presentation`: HTTP API adapter

Excluded from this slice: authentication, database persistence, real LLM calls, frontend code, deployment, resume/interview/job/policy features.

## Run Locally

```powershell
javac -encoding UTF-8 -d backend/out/classes (Get-ChildItem backend/src/main/java -Recurse -Filter *.java).FullName
java -cp backend/out/classes com.restartquest.RestartQuestApplication 8080
```

## Verify

```powershell
javac -encoding UTF-8 -d backend/out/classes (Get-ChildItem backend/src/main/java -Recurse -Filter *.java).FullName
javac -encoding UTF-8 -cp backend/out/classes -d backend/out/test-classes (Get-ChildItem backend/src/test/java -Recurse -Filter *.java).FullName
java -cp "backend/out/classes;backend/out/test-classes" com.restartquest.application.CoreFlowTest
java -cp "backend/out/classes;backend/out/test-classes" com.restartquest.application.ApiServerSmokeTest
```
