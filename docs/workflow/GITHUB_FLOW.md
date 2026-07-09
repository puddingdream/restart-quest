# GitHub 작업 흐름

## 목적

이 문서는 AgentFlow가 Re:Start Quest 레포에서 작업할 때 남겨야 하는 GitHub PR artifact 기준을 정한다. 실제 PR 생성 전에도 동일한 형식의 초안을 만들어 리뷰 가능한 상태를 유지한다.

## 작업 전

항상 read-only 명령부터 실행한다.

```bash
git status --short
git diff --stat
git branch --show-current
```

의미:

- `git status --short`: 현재 작업트리에 사용자 변경이나 이전 agent 변경이 있는지 확인한다.
- `git diff --stat`: 변경 규모를 확인한다.
- `git branch --show-current`: 작업 브랜치가 task 브랜치인지 확인한다.

위험도:

- 모두 read-only라서 파일을 변경하지 않는다.

## 변경 중

- 하나의 PR은 하나의 목적만 가진다.
- 설계 문서 PR과 기능 구현 PR을 섞지 않는다.
- secrets, 인증키, 운영 DB dump는 출력하거나 artifact에 저장하지 않는다.
- 코드 변경 시 repo의 계층 분리 규칙을 따른다.

## 검증

변경 유형별 권장 명령:

| 변경 | 검증 |
|---|---|
| Markdown 문서 | `git diff --check` |
| Shell script | `bash -n <script>` |
| Docker compose | `docker compose config` |
| Spring Boot | `./gradlew test` 또는 `./mvnw test` |
| Frontend | `npm test`, `npm run lint`, `npm run build` 중 repo script |

명령의 의미와 위험도:

- `git diff --check`: whitespace error를 찾는 read-only 검증이다.
- `bash -n`: shell script 문법만 확인하고 실행하지 않는다.
- `docker compose config`: compose 설정을 렌더링해 검증하며 컨테이너를 실행하지 않는다.
- test/build 명령은 소스와 임시 build output을 만들 수 있지만 운영 서버를 변경하지 않는다.

## PR artifact 기준

PR 본문 초안에는 아래 항목을 포함한다.

```text
## Summary
- 무엇을 왜 바꿨는지

## Changes
- 주요 변경 파일과 책임

## Validation
- 실행한 명령과 결과

## Risks
- 남은 리스크

## QA Notes
- reviewer/QA가 확인할 흐름
```

## Merge 전 확인

- 핵심 흐름이 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 재설계 -> 대시보드 반영`에서 벗어나지 않았는가.
- 평가성/감시성/상담성 표현이 추가되지 않았는가.
- MVP 범위를 넘는 실제 크롤링이나 정책 판정 기능이 섞이지 않았는가.
- LLM JSON 검증 정책이 구현 또는 문서화되어 있는가.
