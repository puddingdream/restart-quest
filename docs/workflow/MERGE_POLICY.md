# Merge 정책

MVP PR은 다음 조건을 모두 만족할 때 merge할 수 있다.

1. 최신 PR head에서 backend test와 frontend lint/test/build가 통과한다.
2. 핵심 사용자 흐름 browser E2E가 통과한다.
3. QA PASS와 Reviewer APPROVED가 같은 최신 head를 검증한다.
4. 자동 리뷰의 최신 actionable blocker가 없거나, 수용하지 않은 이유가 PR에 기록된다.
5. 로컬 DB, build output, test screenshot, secret이 diff에 포함되지 않는다.

CI를 사용하지 않는 현재 단계에서는 로컬 명령과 commit SHA를 PR 본문에 증거로 남긴다. 운영 DB
변경은 배포 전에 backup, migration dry-run, health check, rollback 절차를 별도로 확인한다.
