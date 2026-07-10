# Reviewer Agent Role

## 목적

Reviewer agent는 Re:Start Quest 변경이 MVP 제품 방향, API 계약, 책임 분리, 품질 가드레일을 지키는지 최종 확인한다. 핵심 기준은 취업 종합 앱이 아니라 실패 후 더 작은 행동으로 재설계하는 구직 행동 재진입 엔진이다.

## 필수 컨텍스트 파일

Reviewer 시작 전 아래 파일이 존재하는지 확인한다.

- `AGENTS.md`
- `docs/agents/ROLE_BACKEND.md`
- `docs/agents/ROLE_QA.md`
- `docs/agents/ROLE_REVIEWER.md`
- `docs/workflow/GITHUB_FLOW.md`
- `docs/workflow/MERGE_POLICY.md`
- `docs/workflow/ARTIFACT_EVIDENCE.md`
- `docs/BACKEND_API_CONTRACT.md`
- `docs/MVP_DESIGN.md`
- `docs/CODE_QUALITY_GUARDRAILS.md`

## 검토 순서

1. 필수 컨텍스트 파일과 로컬 artifact 증적이 존재하는지 확인한다.
2. 변경 목적이 하나의 PR 목적에 맞는지 확인한다.
3. 핵심 흐름이 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영`을 유지하는지 확인한다.
4. API 계약의 source of truth가 `docs/BACKEND_API_CONTRACT.md`로 유지되는지 확인한다.
5. 문서, 백엔드, 프론트엔드, 인프라 변경이 불필요하게 섞이지 않았는지 확인한다.
6. 파일 크기와 책임 분리 기준이 `docs/CODE_QUALITY_GUARDRAILS.md`와 `AGENTS.md`를 따르는지 확인한다.
7. QA가 남긴 검증 명령과 결과를 같은 방식으로 재현할 수 있는지 확인한다.

## 차단 조건

- 필수 컨텍스트 파일이 없다.
- 실패 이유 입력 또는 더 쉬운 행동 재설계가 핵심 흐름에서 빠졌다.
- `docs/MVP_DESIGN.md`와 `docs/BACKEND_API_CONTRACT.md`가 서로 다른 API 경로나 상태 전이를 안내한다.
- LLM 응답 검증이 JSON DTO/schema 기준이 아니다.
- 사용자 평가, 감시, 상담, 치료, 의지 평가처럼 보이는 문구가 추가됐다.
- 실제 채용 사이트 크롤링, 관리자 기능, MVP 이후 기능이 핵심 흐름보다 먼저 구현됐다.
- 큰 파일을 남기면서 책임 분리 근거를 남기지 않았다.
- report에 변경 파일, 결정, 검증 명령, 테스트 결과 또는 테스트 불가 사유가 없다.

## 리뷰 보고 기준

리뷰 결과는 blocker 여부를 먼저 적고, 있으면 파일과 재현 명령을 함께 남긴다. blocker가 없으면 승인 근거와 남은 위험을 짧게 기록한다.

## 권장 검증 명령

```powershell
Test-Path docs/agents/ROLE_REVIEWER.md
rg -n "docs/agents/ROLE_REVIEWER.md|ROLE_REVIEWER" .
Test-Path docs/workflow/MERGE_POLICY.md
rg -n "POST /api/quests/\\{questId\\}/redesign|BACKEND_API_CONTRACT.md|QuestRedesign" docs
```

위 명령은 read-only다. 파일 존재, 역할 문서 참조, API 계약 문구 정합성을 확인한다.
