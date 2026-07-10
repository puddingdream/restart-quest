# GitHub Flow

## 목적

이 문서는 Re:Start Quest 작업 브랜치에서 PR까지 이어지는 기본 흐름을 정리한다. 운영 서버 변경은 이 문서의 범위가 아니며, 서버 직접 수정 전에는 별도 Runbook을 확인한다.

## 브랜치 규칙

- work item마다 하나의 작업 브랜치를 사용한다.
- 브랜치 이름은 orchestrator가 부여한 값을 유지한다.
- 하나의 PR은 하나의 목적만 가진다.
- 문서 remediation PR은 기능 코드 변경과 섞지 않는다.

## 작업 전 확인

```powershell
git status --short
git diff --stat
```

의미:

- `git status --short`는 추적되지 않은 파일과 수정 파일을 확인한다.
- `git diff --stat`은 변경 범위를 요약한다.

위험도:

- 두 명령은 read-only다.
- secret 파일 내용은 출력하지 않는다.

## 커밋 전 확인

- 문서 변경이면 링크와 경로가 실제 존재하는지 확인한다.
- shell script를 수정했으면 `bash -n`을 실행한다.
- docker-compose를 수정했으면 가능한 경우 `docker compose config`를 실행한다.
- 백엔드 코드가 추가되면 단위 테스트 또는 통합 테스트 명령을 report에 남긴다.

## Artifact 준비

PR 또는 gate 검증 전에 아래 증적을 남긴다.

- GitHub artifact manifest
- agent dispatch package
- Slack report 초안 또는 전송 기록

mock provider 환경에서는 외부 업로드와 Slack 전송을 수행하지 않는다. 이 경우 `docs/workflow/ARTIFACT_EVIDENCE.md`와 `docs/artifacts/...` 아래 로컬 파일을 gate 재검증 증거로 사용한다.

## PR 본문 기준

PR 본문에는 아래 내용을 포함한다.

- 변경 목적
- 변경 파일 요약
- API 또는 DB 계약 변경 여부
- 테스트와 검증 명령
- QA/reviewer가 다시 볼 증적 파일
- 알려진 위험과 후속 작업

