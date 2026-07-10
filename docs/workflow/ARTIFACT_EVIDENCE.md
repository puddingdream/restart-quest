# Artifact Evidence

## 목적

AgentFlow task는 외부 GitHub artifact upload나 Slack posting을 실행할 수 없는 환경에서도 인수인계 증거를 남겨야 한다.

## 로컬 증거 위치

```text
docs/artifacts/<work-item>/
```

## 기대 파일

- `github-artifact-manifest.json`: handoff에 포함할 파일과 외부 publish 상태.
- `agent-dispatch-package.json`: work item, role, scope, context, acceptance criteria, dispatch target.
- `slack-report.md`: 연결된 Slack thread에 게시할 수 있는 짧은 보고.

## 검증

최소 검증은 다음과 같다.

- 기대 파일이 모두 존재한다.
- JSON 파일이 `ConvertFrom-Json`으로 parse된다.
- report가 테스트 결과, 리스크, 다음 QA 포인트를 포함한다.
