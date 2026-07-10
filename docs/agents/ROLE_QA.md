# QA Agent Role

## 목적

QA agent는 Re:Start Quest MVP가 핵심 사용자 흐름과 제품 방향성을 충족하는지 검증한다. 단순 문서 존재 여부뿐 아니라 API 계약, 화면 흐름, artifact 증거가 새 reviewer도 재검증할 수 있을 만큼 남아 있는지 확인한다.

## 필수 검증 흐름

```text
온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

이 흐름이 빠지거나, 실패 후 재설계가 더 작은 행동으로 내려가지 않으면 QA FAIL로 본다.

## 필수 컨텍스트 파일

QA 시작 전 아래 파일이 존재하는지 확인한다.

- `AGENTS.md`
- `docs/agents/ROLE_BACKEND.md`
- `docs/agents/ROLE_QA.md`
- `docs/workflow/GITHUB_FLOW.md`
- `docs/workflow/MERGE_POLICY.md`
- `docs/workflow/ARTIFACT_EVIDENCE.md`
- `docs/BACKEND_API_CONTRACT.md`
- `docs/MVP_DESIGN.md`

## 문서 정합성 체크

- `docs/BACKEND_API_CONTRACT.md`를 MVP API 계약의 source of truth로 둔다.
- `docs/MVP_DESIGN.md`의 API 목록은 화면 흐름 요약이며, 충돌 시 백엔드 API 계약을 우선한다.
- 이력서, 면접, 공고, 정책 API는 별도 work item 전까지 MVP 필수 계약으로 보지 않는다.
- 퀘스트 재설계 엔드포인트는 `POST /api/quests/{questId}/redesign`로 통일한다.
- `QuestRedesign`에는 원본 퀘스트, 실패 기록, 새 퀘스트를 연결할 식별자가 있어야 한다.

## Artifact 증거 체크

QA는 아래 로컬 증적을 확인한다.

- `docs/artifacts/TASK-033-R01-01-backend/github-artifact-manifest.json`
- `docs/artifacts/TASK-033-R01-01-backend/agent-dispatch-package.json`
- `docs/artifacts/TASK-033-R01-01-backend/slack-report.md`

mock provider 작업에서는 외부 GitHub 업로드나 Slack 전송 여부를 로컬에서 직접 증명할 수 없다. 대신 위 파일을 로컬 재검증 기준으로 삼고, 실제 외부 게시가 필요한 경우 orchestrator 또는 CI 단계에서 수행한다.

## 차단 조건

- 필수 컨텍스트 파일이 없다.
- 핵심 흐름에서 실패 이유 기반 재설계가 빠졌다.
- API 문서가 서로 다른 경로 또는 상태 전이를 안내한다.
- LLM 출력 검증이 JSON DTO/schema 기준이 아니다.
- 사용자에게 상담, 치료, 위험도, 의지 평가, 감시처럼 보이는 문구를 노출한다.
- artifact 증거가 없어서 reviewer가 산출물을 재구성할 수 없다.
- MVP 범위를 벗어난 실제 채용 사이트 크롤링이나 관리자 기능이 우선 구현됐다.

## 권장 검증 명령

```powershell
Test-Path docs/agents/ROLE_QA.md
Test-Path docs/workflow/MERGE_POLICY.md
Test-Path docs/artifacts/TASK-033-R01-01-backend/github-artifact-manifest.json
Test-Path docs/artifacts/TASK-033-R01-01-backend/agent-dispatch-package.json
Test-Path docs/artifacts/TASK-033-R01-01-backend/slack-report.md
rg -n "POST /api/quests/\\{questId\\}/redesign|BACKEND_API_CONTRACT.md|QuestRedesign" docs
```

