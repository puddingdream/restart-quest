# TASK-040 Publish Orchestration Backend Scope

## 요청

원본 Slack command:

```text
publish 해줘
```

연결 metadata:

- Task: `TASK-040`
- Work item: `TASK-040-01-backend`
- Slack channel: `#C0BFADNB6HW`
- Provider: `mock`

## 현재 레포 상태

현재 branch에는 실행 가능한 Spring Boot backend module이 없다. 따라서 서버 코드를 실제로 컴파일하거나 API 테스트를 실행할 수 없다.

이번 backend work item은 런타임 동작을 꾸며 만들지 않고, `publish 해줘` 요청을 처리하기 위한 서버/오케스트레이션 계약과 로컬 산출물 증거를 추가한다.

## 구현한 범위

- backend agent 역할 문서를 추가해 서버 계약과 검증 보고 책임을 명확히 했다.
- GitHub publish evidence 흐름을 추가했다.
- Slack command 처리 흐름을 추가했다.
- mock provider에서 필요한 로컬 artifact evidence 규칙을 추가했다.
- TASK-040용 GitHub artifact manifest, agent dispatch package, Slack report를 생성했다.

## 서버 계약 초안

향후 Spring Boot backend가 생기면 `publish 해줘` 요청은 내부 orchestration endpoint로 처리한다.

Endpoint:

```text
POST /api/orchestration/slack/publish-requests
```

Request:

```json
{
  "channelId": "C0BFADNB6HW",
  "commandText": "publish 해줘",
  "requestedBy": "slack-user-id",
  "threadTs": "optional-thread-ts",
  "taskId": "TASK-040",
  "workItem": "TASK-040-01-backend"
}
```

Response:

```json
{
  "status": "PREPARED_FOR_QA_REVIEW",
  "artifactManifestPath": "docs/artifacts/TASK-040-01-backend/github-artifact-manifest.json",
  "dispatchPackagePath": "docs/artifacts/TASK-040-01-backend/agent-dispatch-package.json",
  "slackReportPath": "docs/artifacts/TASK-040-01-backend/slack-report.md"
}
```

검증 규칙:

- Slack signature 검증은 controller filter 또는 security layer에서 처리한다.
- `commandText` 원문을 보존한다.
- `publish 해줘`는 운영 배포 명령이 아니라 publish evidence 준비 명령으로 해석한다.
- 같은 `channelId`, `threadTs`, `taskId`, `workItem` 조합은 idempotency key로 사용한다.
- secret 값이나 token은 저장하거나 report에 출력하지 않는다.

상태:

```text
REQUESTED -> ARTIFACTS_PREPARED -> DISPATCH_READY -> REPORTED
```

`contextFiles`가 없거나 JSON artifact 생성에 실패하면 `BLOCKED`로 보고한다.

## QA 포인트

QA는 다음을 확인한다.

- `docs/artifacts/TASK-040-01-backend/`에 3개 산출물이 모두 있다.
- JSON artifact 파일이 parse된다.
- Slack report가 원본 command와 mock provider 제한을 명확히 기록한다.
- 문서가 운영 서버 배포나 실제 Slack posting을 수행했다고 주장하지 않는다.
- 제품 방향상 사용자 평가, 감시, 상담 서비스처럼 보이는 문구가 없다.

## 다음 backend 단계

다음 backend implementation task에서는 Spring Boot scaffold를 만든 뒤 orchestration endpoint, idempotency 저장소, artifact writer port를 테스트 가능한 계층으로 분리한다.
