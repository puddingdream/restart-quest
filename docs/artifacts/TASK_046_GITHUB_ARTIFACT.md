# TASK-046 GitHub Artifact Draft

> 로컬 산출물 초안이다. 사용자 요청에 따라 GitHub Issue, PR, branch는 생성하지 않았다.

## Title

Re:Start Quest MVP 방향 및 구현 순서 회의 결론

## Summary

TASK-045 설계자, 프론트엔드, 백엔드, QA 보고서를 종합해 Re:Start Quest의 MVP를 `구직 행동 재진입 엔진`으로 확정한다. 직전 보고서 묶음에 reviewer report는 없었으므로 reviewer 판단은 `AGENTS.md`와 `docs/CODE_QUALITY_GUARDRAILS.md`의 차단 기준을 반영한다.

## Final MVP Direction

핵심 흐름은 `온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영`이다.

MVP는 이 루프를 시연 가능한 수준으로 완성하는 데 집중한다. 이력서 첨삭, 모의면접, 공고 저장, 정책 추천은 후순위 또는 퀘스트 카테고리 수준으로 제한한다.

## Implementation Order

1. 도메인/API/AI JSON 계약 확정
2. 백엔드 핵심 도메인과 mock AI adapter 구현
3. 프론트 핵심 플로우 prototype 구현
4. 프론트/백엔드 API 연동
5. 최소 인증과 사용자별 데이터 격리
6. 실제 LLM provider adapter와 JSON 검증
7. QA smoke/e2e 및 UX 카피 검수

## Next Task Candidates

- TASK-047: MVP 도메인/API/AI 계약 문서 확정
- TASK-048: 백엔드 퀘스트 핵심 use case 구현
- TASK-049: 프론트 핵심 플로우 prototype 구현
- TASK-050: 프론트/백엔드 API 연동
- TASK-051: LLM provider adapter와 JSON 검증
- TASK-052: QA 핵심 시나리오와 카피 검수
- TASK-053: 최소 인증과 사용자별 데이터 격리

## Constraints

- 실제 채용 사이트 크롤링 제외
- 정책 대상 확정 판정 제외
- 상담/치료/감시/의지 평가처럼 보이는 기능과 문구 제외
- 기능 설명용 랜딩 페이지 제외
- LLM 자연어 파싱 제외

