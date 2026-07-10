# Re:Start Quest

취업 공백자가 구직 행동을 다시 시작할 수 있도록, AI가 공고 탐색, 이력서 개선, 면접 연습을 10~30분 단위 실행 계획으로 쪼개고 실패 시 더 쉬운 단계로 재설계하는 구직 루틴 코치입니다.

## 핵심 포지셔닝

Re:Start Quest는 기능 많은 취업 종합 앱이 아니라, 실패 후에도 다시 시작하게 만드는 AI 실행 재설계 서비스입니다.

핵심 흐름:

1. 사용자가 현재 상태와 오늘 가능한 에너지 수준을 입력합니다.
2. AI가 오늘 실행 가능한 구직 퀘스트 3개를 생성합니다.
3. 사용자가 퀘스트를 완료하거나 실패 이유를 기록합니다.
4. 실패한 퀘스트는 AI가 더 낮은 난이도의 행동으로 재설계합니다.
5. 대시보드에 진행률, 실패 후 재설계 기록, 다음 행동이 반영됩니다.

## MVP 범위

1순위:

- 로그인/회원가입
- 온보딩
- 오늘의 퀘스트 생성
- 퀘스트 완료/실패
- 실패 이유 입력
- AI 재설계
- 대시보드

2순위:

- 이력서 입력/피드백
- 모의면접 질문/답변 피드백
- 더미 공고 저장
- 더미 정책 추천

3순위:

- 실제 공고 API/크롤링
- 캘린더 연동
- 상담사/관리자 화면
- 알림 기능
- 정책 자동 업데이트

## 기술 방향

- Frontend: React, TypeScript, Tailwind CSS
- Backend: Spring Boot, Java, Spring Security, JPA
- DB: PostgreSQL 또는 MySQL
- AI: LLM JSON 구조화 출력 기반 퀘스트 생성/재설계
- Deploy: 프론트와 백엔드 분리 배포

## 프로젝트 문서

- [인수인계 문서](docs/RESTART_QUEST_HANDOFF.md)
- [제품 방향성](docs/PRODUCT_DIRECTION.md)
- [코드 품질 가드레일](docs/CODE_QUALITY_GUARDRAILS.md)
- [백엔드 Agent 역할](docs/agents/ROLE_BACKEND.md)
- [GitHub 작업 흐름](docs/workflow/GITHUB_FLOW.md)
- [Slack 명령 처리 흐름](docs/workflow/SLACK_COMMANDS.md)
