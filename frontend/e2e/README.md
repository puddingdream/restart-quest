# 릴리스 브라우저 E2E

이 디렉터리는 `compose.yaml`로 실행한 same-origin 통합 runtime을 검증한다. 테스트가 runtime을 직접 시작하거나 종료하지 않으므로, 데이터 volume과 서비스 수명 주기는 [릴리스 Runbook](../../docs/RUNBOOK.md)을 따른다.

## 사전 조건

- backend, frontend, PostgreSQL이 모두 같은 깨끗한 Git checkout에서 build되어야 한다.
- 기본 진입점 `http://localhost:8080`의 `/actuator/health`가 `UP`이어야 한다.
- 테스트 전용 새 database를 사용해야 한다. 가입 제한과 날짜별 유일성 때문에 기존 데이터가 있는 runtime을 재사용하지 않는다.
- `INTEGRATION_HEAD_SHA`에는 runtime을 build한 checkout의 40자리 Git head를 넣는다. 테스트는 실제 checkout head 및 dirty 상태를 다시 확인하고, 일치하지 않으면 증거 생성을 거부한다.

## 실행

frontend 의존성을 설치한 뒤 Chromium을 한 번 준비한다.

```bash
npm ci
npm run test:e2e:install
```

브라우저 설치는 로컬 Playwright cache를 변경하고 네트워크를 사용하므로 위험도는 낮지만 CI cache 용량을 확인한다. 통합 runtime 기동은 컨테이너와 PostgreSQL volume을 생성하므로 Runbook의 환경 변수, health check, 중지 절차를 먼저 확인한다.

깨끗한 checkout에서 다음처럼 실행한다.

```bash
export INTEGRATION_HEAD_SHA="$(git rev-parse HEAD)"
npm run test:e2e
```

다른 로컬 포트를 사용하면 `E2E_BASE_URL`도 함께 지정한다. `git rev-parse HEAD`는 revision만 읽는 read-only 명령이다. `npm run test:e2e`는 테스트 계정과 체크인·행동 기록을 지정한 테스트 database에 생성하므로 운영 환경에서는 실행하지 않는다.

성공 증거에는 다음이 포함된다.

- backend, frontend, runtime에 동일하게 기록된 `INTEGRATION_HEAD_SHA`
- 가입→체크인→추천→막힘→축소→완료→최근 기록의 전체 브라우저 여정
- 다른 계정의 읽기 격리와 타 계정 UUID 완료·막힘 요청의 `404`
- 중복 클릭 1회 요청 및 stale version `409` 뒤 결과가 두 건뿐이라는 검증
- `360x800`, `768x1024`, `1440x900`의 키보드 흐름, 오류·빈 상태, 가로 overflow와 44px CTA 검증

성공 screenshot과 SHA 첨부물은 `dist/playwright/test-results/`, HTML 보고서는 `dist/playwright/report/`에 생성되며 Git에는 포함하지 않는다. `dist/`는 기존 package-local build 경계로 ignore되어 E2E 생성물이 저장소 변경으로 섞이지 않는다.
