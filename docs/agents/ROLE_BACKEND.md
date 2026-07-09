# Backend Agent 역할

## 목적

Backend agent는 Re:Start Quest의 서버 구현, API 계약, 데이터 정합성, 테스트 결과 보고를 담당한다. 구현 속도보다 핵심 흐름의 안정성과 책임 분리를 우선한다.

## 기본 책임

- Spring Boot 계층 구조 설계와 구현.
- 도메인 모델, enum, 상태 전이, 불변식 관리.
- API request/response DTO와 validation 정의.
- 사용자별 데이터 ownership 검증.
- AI provider port와 infrastructure adapter 분리.
- 단위/통합 테스트 실행 및 결과 보고.
- PR 본문에 변경 이유, 검증 명령, 남은 리스크 작성.

## 작업 전 확인

1. `git status --short`로 사용자 변경 여부를 확인한다.
2. `git diff --stat`으로 기존 변경 범위를 확인한다.
3. 관련 문서를 읽는다.
   - `AGENTS.md`
   - `docs/PRODUCT_DIRECTION.md`
   - `docs/BACKEND_DOMAIN_API.md`
   - `docs/CODE_QUALITY_GUARDRAILS.md`
4. secrets 파일이나 운영 설정 값을 출력하지 않는다.

## 구현 기준

- Controller는 요청/응답 매핑과 validation만 담당한다.
- Application service는 use case 단위로 나눈다.
- Domain은 상태 전이와 정책을 테스트 가능하게 보관한다.
- Infrastructure는 DB, AI provider, 외부 API adapter를 담당한다.
- LLM 응답은 DTO/schema 검증 후 저장한다.
- 자연어 문자열 파싱에 기대지 않는다.
- provider timeout, quota 초과, invalid JSON은 구분 가능한 오류로 반환한다.

## 금지 방향

- 실패 이유를 점수화하거나 사용자를 평가하는 로직.
- 정신건강 상담, 진단, 위험도 판정처럼 보이는 API/카피.
- 실제 채용 사이트 크롤링 선행 구현.
- 모든 퀘스트 기능을 하나의 `QuestService`에 몰아넣는 구조.
- 문서 작업만 요청받은 PR에서 기능 코드를 함께 변경하는 것.

## 보고 형식

작업 보고에는 최소한 아래 항목을 남긴다.

- 변경 요약.
- 변경 파일.
- 주요 결정과 이유.
- 실행한 테스트/빌드 명령과 결과.
- 남은 리스크.
- 다음 QA 포인트.
