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
- [MVP 구현 정본](docs/MVP_IMPLEMENTATION_BLUEPRINT.md)
- [API 계약](docs/api/quest-api.md)
- [코드 품질 가드레일](docs/CODE_QUALITY_GUARDRAILS.md)
- [QA 기준](docs/agents/ROLE_QA.md)
- [Reviewer 기준](docs/agents/ROLE_REVIEWER.md)
- [Merge 정책](docs/workflow/MERGE_POLICY.md)

## 로컬 실행

필수 환경은 Java 17과 Node.js 20 이상입니다. 로컬 백엔드는 별도 DB 설치 없이
파일 기반 H2를 사용하며 데이터는 Git에 포함되지 않는 `backend/.data/`에 저장됩니다.

```bash
# terminal 1
cd backend
./gradlew bootRun

# terminal 2
cd frontend
npm ci
npm run dev
```

Windows PowerShell에서는 백엔드를 `./gradlew.bat bootRun`으로 실행합니다. 프론트 개발
서버는 `/api` 요청을 `http://localhost:8080`으로 전달합니다.

## 검증

```bash
cd backend
./gradlew test

cd ../frontend
npm ci
npm run lint
npm test
npm run build
E2E_REQUIRE_BROWSER=1 npm run e2e
```

브라우저 E2E는 실제 Spring Boot 서버와 HTTP 모드 프론트를 실행해 `회원가입 -> 온보딩
-> 퀘스트 3개 생성 -> 완료 -> 이유 기반 재설계 -> 대시보드 반영`을 검증합니다. 생성된
스크린샷과 로컬 DB는 테스트 증거일 뿐 Git에는 포함하지 않습니다.

## 운영 프로필

운영에서는 `SPRING_PROFILES_ACTIVE=prod`를 지정하고 `DB_URL`, `DB_USERNAME`,
`DB_PASSWORD`를 환경 변수로 주입합니다. 스키마는 Flyway migration으로 적용하고 JPA는
`validate`만 수행합니다. 실제 AI provider를 연결할 때는 `AI_PROVIDER=runtime`과 provider
설정 `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_API_KEY`를 환경에서 주입하며 비밀 값은 문서나
로그에 남기지 않습니다.
