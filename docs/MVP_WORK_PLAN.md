# Re:Start Quest MVP 작업 우선순위

## 1. 작업 원칙

MVP의 목적은 취업 기능을 많이 만드는 것이 아니라, 실패 후 더 작은 행동으로 다시 시작하는 흐름을 증명하는 것이다. 모든 작업은 아래 흐름에 직접 연결되는지 먼저 확인한다.

```text
온보딩 -> 오늘의 퀘스트 생성 -> 실패 이유 입력 -> 더 쉬운 퀘스트 재설계 -> 대시보드 반영
```

## 2. 우선순위

### P0. 설계 기준 고정

완료 조건:

- 제품 방향성 문서가 구직 행동 재진입 엔진을 명확히 설명한다.
- 백엔드 도메인/API 초안이 상태 전이와 실패 이유 기반 재설계를 포함한다.
- 프론트 화면 흐름이 재설계 CTA와 대시보드 반영을 포함한다.
- 코드 품질 가드레일이 계층 분리와 파일 크기 리뷰 기준을 포함한다.

### P1. Backend 핵심 도메인/API skeleton

목표:

- Spring Boot 프로젝트 skeleton 생성.
- Auth는 MVP에서 최소 세션/JWT 중 하나를 선택하고 사용자별 데이터 격리를 보장.
- 온보딩, 오늘의 퀘스트, 실패 처리, 재설계, 대시보드 API를 세로 흐름으로 구현.
- AI provider는 처음에 mock adapter로 시작하되 실제 provider 교체 가능한 port를 둔다.

완료 조건:

- `온보딩 저장 -> 퀘스트 생성 -> 실패 -> 재설계 -> 수락 -> 대시보드 조회` 통합 테스트 통과.
- LLM 출력 DTO validation 실패가 `AI_OUTPUT_INVALID`로 분리된다.
- Controller가 도메인 판단과 prompt 작성을 하지 않는다.

### P2. Frontend 핵심 화면 skeleton

목표:

- 온보딩, 오늘의 퀘스트, 실패 이유 입력, 재설계 결과, 대시보드 화면을 연결한다.
- 랜딩 페이지보다 실제 사용 흐름을 첫 경험으로 둔다.
- 실패 이유 문구는 평가나 감시처럼 보이지 않게 유지한다.

완료 조건:

- 키보드만으로 퀘스트 생성부터 재설계 수락까지 진행 가능.
- mobile 390px에서 카드/버튼/텍스트 overflow 없음.
- API 응답을 자연어 파싱하지 않는다.

### P3. AI provider 연동

목표:

- mock adapter와 같은 DTO schema를 쓰는 실제 LLM adapter를 추가한다.
- provider timeout, quota 초과, invalid JSON을 구분한다.
- prompt는 상담/진단/감시 표현을 피하고 작은 행동 생성에만 집중한다.

완료 조건:

- provider 실패 시 기존 퀘스트 데이터가 손상되지 않는다.
- 재설계 후보가 1~3개로 제한된다.
- JSON schema 또는 DTO validation을 통과한 결과만 저장한다.

### P4. 보조 기능 확장

후순위 기능:

- 이력서 입력/피드백.
- 모의면접 질문/답변 피드백.
- 더미 공고 저장과 지원 상태 관리.
- 정책 안내 DB seed.

완료 조건:

- 각 보조 기능은 독립 화면보다 먼저 퀘스트 category로 연결된다.
- 실제 크롤링이나 정책 대상 확정 판정은 하지 않는다.

## 3. 에이전트별 분리

| 역할 | 1차 책임 | 산출물 |
|---|---|---|
| PM/Docs | MVP 범위, 사용자 시나리오, 우선순위 정리 | 제품/작업계획 문서 |
| Backend | 도메인 모델, API, 데이터 정합성, 테스트 | backend skeleton, API 계약, 통합 테스트 |
| Frontend | 핵심 화면 흐름, 접근성, API 연동 | feature별 화면과 hook |
| AI | JSON schema, prompt, provider adapter | mock/real adapter, 오류 분리 |
| QA | 핵심 사용자 흐름과 카피 검증 | QA 체크리스트, 결함 보고 |

하나의 PR은 하나의 목적만 가진다. 설계 문서 PR과 구현 PR은 분리한다.

## 4. 첫 구현 세로 흐름

1. `UserAccount`, `OnboardingProfile`, `DailyQuestBatch`, `Quest`, `QuestFailure`, `QuestRedesign` 엔티티를 만든다.
2. mock AI client가 고정된 DTO로 오늘 퀘스트 3개를 반환하게 한다.
3. 오늘 퀘스트 생성 API와 조회 API를 구현한다.
4. 실패 이유 저장 API를 구현한다.
5. mock AI client가 실패 이유별 더 작은 후보를 반환하게 한다.
6. 재설계 후보 수락 API를 구현한다.
7. 대시보드 query service를 구현한다.
8. 세로 흐름 통합 테스트를 고정한다.

## 5. QA 포인트

- 실패 이유 선택 후 원래 퀘스트가 사라지지 않고 이력으로 남는가.
- 재설계 후보가 원래 퀘스트보다 작고 실행 가능한가.
- 대시보드 첫 화면에 다음 행동이 보이는가.
- 평가성 문구, 감시성 문구, 상담/진단처럼 읽히는 문구가 없는가.
- 같은 날짜에 퀘스트 생성 버튼을 반복 클릭해도 중복 배치가 생기지 않는가.
- 다른 사용자의 퀘스트 ID로 상태 변경을 시도하면 차단되는가.

## 6. 남은 결정 사항

- MVP 인증 방식: JWT access token 단독으로 시작할지, refresh token까지 둘지 결정해야 한다.
- DB 선택: PostgreSQL과 MySQL 중 배포 환경에 맞춰 결정해야 한다.
- 실제 LLM provider와 비용 제한 정책을 정해야 한다.
- API 문서 형식: OpenAPI yaml을 별도 관리할지, Spring REST Docs를 쓸지 결정해야 한다.
