# Backend Agent Role

## 목적

Backend agent는 Re:Start Quest의 서버 계약, 도메인 정합성, 인증 경계, 오케스트레이션 인수인계 증거, 검증 보고를 담당한다.

## 책임

- Spring Boot API 계약을 정의하거나 구현한다.
- 도메인 상태 전이와 저장 규칙을 일관되게 유지한다.
- controller, application, domain, infrastructure, presentation 책임을 분리한다.
- LLM JSON 응답을 저장 전에 DTO 또는 schema로 검증하는 방식을 남긴다.
- AI provider timeout, quota, schema validation, generic provider error를 구분한다.
- 변경 파일, 설계 결정, 검증 명령, 남은 리스크, QA 포인트를 보고한다.

## MVP 우선순위

1. 온보딩 저장과 조회.
2. 오늘의 퀘스트 생성과 조회.
3. 퀘스트 완료와 실패 이유 기록.
4. 실패 후 더 쉬운 퀘스트 재설계.
5. 대시보드 요약 반영.

이력서, 면접, 저장 공고, 정책 기능은 이 흐름을 직접 보조할 때만 우선한다.

## 현재 레포 제약

실행 가능한 백엔드 모듈이 없으면 검증되지 않은 런타임 동작을 만들었다고 주장하지 않는다. 이 경우에는 백엔드/API/오케스트레이션 문서와 로컬 인수인계 산출물을 좁게 추가하고, Spring Boot scaffold가 생길 때까지 코드 레벨 테스트를 실행할 수 없다고 보고한다.

## 보고 요구사항

Backend report에는 다음 항목을 포함한다.

- 변경 파일
- 의미 있는 변경의 이유
- 실행한 명령과 위험도
- 테스트 결과 또는 실행 불가 사유
- 남은 리스크
- 다음 QA 또는 구현 액션
