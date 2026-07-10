# GitHub Flow

## 목적

이 문서는 AgentFlow 기반 Re:Start Quest 작업의 GitHub 인수인계 흐름을 정의한다. 운영 서버 직접 변경을 승인하지 않는다.

## 작업 전 확인

실행 명령:

```powershell
git status --short
git diff --stat
```

의미:

- `git status --short`는 수정 파일과 untracked 파일을 확인한다.
- `git diff --stat`은 현재 diff 규모를 요약한다.

위험도:

- 두 명령은 read-only다.
- secret 파일 내용은 출력하지 않는다.

## 브랜치와 PR 단위

- 오케스트레이터가 배정한 브랜치를 사용한다.
- 하나의 PR은 하나의 목적을 가진다.
- 프론트엔드, 백엔드, 인프라, 문서 변경이 섞이면 PR 본문에 이유를 남긴다.

## Publish Evidence

`publish 해줘`처럼 외부 게시 요청이 들어오면, publish 가능 여부를 판단할 수 있도록 다음 증거를 준비한다.

- 변경 파일 목록
- 설계 결정
- 테스트 또는 검증 명령
- 남은 리스크
- QA와 reviewer 인수인계 포인트
- GitHub artifact manifest
- agent dispatch package
- Slack report

## Mock Provider 규칙

provider가 `mock`이면 외부 GitHub 업로드, issue comment, PR 생성, Slack posting은 로컬 증거 파일로 대체할 수 있다. 로컬 증거 위치는 `docs/artifacts/<work-item>/`를 사용하고, 외부 게시 또는 실제 PR 생성은 GitHub/Slack 연동이 가능한 오케스트레이터나 CI가 담당한다.
