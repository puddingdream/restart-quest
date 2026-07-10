# Slack Commands Workflow

## 목적

Slack 명령은 AgentFlow task를 생성할 수 있다. 명령 문구가 짧거나 모호할 수 있으므로 원문을 보존하고, worker가 추론한 범위를 명확히 기록한다.

## 필수 처리

Slack에서 시작된 작업은 다음을 지킨다.

- 원본 channel과 command text를 task 또는 artifact evidence에 남긴다.
- task, issue, branch, PR, thread metadata가 제공되면 연결한다.
- 주어진 맥락을 넘어 제품 동작을 임의로 확정하지 않는다.
- 명령이 구체적인 기능을 지정하지 않으면 ambiguity를 risk로 기록한다.
- 직접 Slack posting을 할 수 없으면 `slack-report.md`를 생성한다.

## `publish 해줘` 처리 범위

`publish 해줘`는 worker가 운영 배포를 실행하라는 뜻으로 해석하지 않는다. 현재 AgentFlow에서는 다음 산출물을 준비하라는 요청으로 처리한다.

- GitHub artifact manifest
- agent dispatch package
- Slack report
- 검증 명령 결과와 남은 리스크

운영 서버 변경이나 실제 외부 게시가 필요하면 별도 승인과 연동 환경이 필요하다.

## Report Contents

Slack report에는 다음 항목을 포함한다.

- status
- work item
- summary
- changed files
- verification result
- known risks
- next QA 또는 reviewer action

## 현재 제한

mock provider run에서는 로컬 `slack-report.md`가 외부 Slack 전달의 증거 역할을 한다. Slack 연동이 켜진 환경에서는 오케스트레이터 또는 CI가 연결된 thread에 게시한다.
