# Merge Policy

## 목적

이 정책은 Re:Start Quest의 문서, 백엔드, 프론트엔드, AI provider 변경이 MVP 방향성과 품질 가드레일을 지킨 뒤 병합되도록 하는 기준이다.

## 병합 전 필수 조건

- 작업 브랜치의 변경 목적이 하나로 설명된다.
- `AGENTS.md`와 역할 문서를 따른다.
- 핵심 흐름이 유지된다.
- API 계약과 화면 흐름 문서가 충돌하지 않는다.
- QA/reviewer가 재검증할 수 있는 artifact 증거가 남아 있다.
- 테스트 명령 또는 테스트 불가 사유가 report에 기록되어 있다.

## 필수 컨텍스트 파일

- `AGENTS.md`
- `docs/agents/ROLE_BACKEND.md`
- `docs/agents/ROLE_QA.md`
- `docs/workflow/GITHUB_FLOW.md`
- `docs/workflow/MERGE_POLICY.md`
- `docs/workflow/ARTIFACT_EVIDENCE.md`

위 파일 중 하나가 없으면 QA는 blocker로 보고한다.

## API 계약 정책

- MVP API source of truth는 `docs/BACKEND_API_CONTRACT.md`다.
- `docs/MVP_DESIGN.md`는 화면 흐름과 API 요약을 제공한다.
- 충돌이 발견되면 백엔드 계약을 기준으로 다른 문서를 수정하거나, 명시적 설계 결정을 남긴다.
- MVP 이후 기능의 API는 현재 계약에 섞지 않는다.
- 퀘스트 실패 후 재설계는 `POST /api/quests/{questId}/redesign`를 사용한다.

## Artifact 정책

gate 통과 전 아래 로컬 증적을 확인할 수 있어야 한다.

- `docs/artifacts/TASK-033-R01-01-backend/github-artifact-manifest.json`
- `docs/artifacts/TASK-033-R01-01-backend/agent-dispatch-package.json`
- `docs/artifacts/TASK-033-R01-01-backend/slack-report.md`

외부 GitHub artifact 업로드나 Slack 전송은 backend/mock provider가 직접 보장하지 않는다. 로컬 증적이 존재하면 이번 gate의 재검증 근거는 충족한 것으로 보고, 실제 게시가 필요한 경우 orchestrator 또는 CI가 수행한다.

## 차단 조건

- 필수 컨텍스트 파일 누락
- 핵심 흐름에서 실패 이유 입력 또는 더 쉬운 행동 재설계 누락
- LLM JSON DTO 검증 원칙 누락
- 사용자 평가, 감시, 상담, 치료처럼 보이는 문구 추가
- 실제 채용 사이트 크롤링을 MVP 핵심보다 먼저 구현
- 파일 크기와 책임 분리 가드레일 위반
- QA/reviewer가 artifact를 재검증할 수 없는 상태

## 승인 기준

QA가 blocker 없음으로 보고하고 reviewer가 유지보수 기준을 승인한 뒤 병합한다. 문서-only 변경은 기능 테스트 대신 경로 존재, 문서 링크, API 문구 정합성 검증을 필수로 남긴다.

