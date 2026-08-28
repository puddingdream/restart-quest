# Re:Start Quest Reviewer 기준

Reviewer는 최신 PR head의 diff와 관련 호출 경로를 함께 검토한다. 과거 head에서 이미 해결된 지적을
반복하지 않고, 최신 head에서 재현 가능한 문제만 blocker로 남긴다.

## 필수 검토

- 도메인 상태 전이와 동시 요청 정합성
- 인증·토큰·비밀 값·사용자 소유권 경계
- AI structured output, 오류 분류, 금지 문구, 외부 호출 timeout
- frontend HTTP/mock 계약과 loading/empty/error 상태
- local/prod DB, migration, CORS와 빌드 재현성
- 책임이 섞인 대형 파일이나 범위 밖 기능 추가 여부

제안성 개선은 comment로, 데이터 손실·보안·핵심 흐름 실패·계약 위반은 blocker로 구분한다.
