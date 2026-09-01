# Re:Start Quest 릴리스 스택 Runbook

이 문서는 PostgreSQL, backend, same-origin frontend로 구성된 로컬 릴리스 스택의 검증과 비파괴 rollback 절차를 설명한다. 클라우드 또는 운영 서버 변경은 이 범위에 포함하지 않는다.

## 구성과 운영 경계

- 외부에는 `127.0.0.1:${APP_PORT:-8080}`의 frontend만 공개한다.
- Nginx가 `/api/`와 `/actuator/health`를 내부 `backend:8080`으로 전달한다. backend와 PostgreSQL port는 host에 공개하지 않는다.
- PostgreSQL의 `/var/lib/postgresql/data`는 `postgres-data` named volume에 보존한다.
- JDK/JRE, Node, Nginx, PostgreSQL base image는 version tag와 multi-platform manifest digest를 함께 고정한다.
- `DB_PASSWORD`는 필수 환경 변수다. Compose 설정, image, 문서에는 실제 값을 기록하지 않는다.
- `DB_NAME`, `DB_USER`, `APP_PORT`, `RELEASE_TAG`는 환경 변수로 덮어쓸 수 있다.
- 로컬 HTTP 검증에서는 `SESSION_COOKIE_SECURE=false`를 사용한다. HTTPS reverse proxy 뒤의 릴리스에서는 반드시 `true`로 주입한다.

## 사전 조건과 실행

필요 도구는 Docker Engine, Docker Compose, `curl`이다. Bash 검증에는 Bash가, Windows 검증에는 PowerShell 7 이상이 필요하다.

PowerShell에서는 secret 입력을 화면에 표시하지 않고 현재 process 환경에만 둔 뒤 검증한다.

```powershell
$secret = Read-Host 'DB password' -AsSecureString
$env:DB_PASSWORD = [Net.NetworkCredential]::new('', $secret).Password
$env:SESSION_COOKIE_SECURE = 'false'
./scripts/verify-release.ps1
```

Bash에서도 입력 echo를 끄고 현재 shell 환경에만 둔다.

```bash
read -r -s -p 'DB password: ' DB_PASSWORD && printf '\n'
export DB_PASSWORD
export SESSION_COOKIE_SECURE=false
bash ./scripts/verify-release.sh
```

두 script는 secret 값 대신 `set` 또는 `empty`만 보고한 뒤 다음 순서로 실행한다.

1. `docker compose config --quiet`: 보간 결과를 출력하지 않고 Compose 문법과 필수 값을 검사한다. 위험도는 낮으며 container 상태를 바꾸지 않는다.
2. `docker compose build`: 고정된 build 입력과 lockfile로 backend/frontend multi-stage image를 만든다. host repository에는 Gradle/npm cache나 build output을 만들지 않지만 image cache와 disk를 사용한다.
3. `docker compose up --detach --wait --wait-timeout 120`: DB health, Flyway가 반영된 backend health, frontend health 순서로 기다린다. container를 생성·갱신하므로 로컬 실행 상태를 바꾼다.
4. frontend origin을 통해 health, 익명 session, journey 생성·조회, `/quest` 직접 진입을 확인한다. 매번 새 익명 session과 journey row가 추가되므로 공유 운영 DB에는 실행하지 않는다.

검증 뒤 container를 중지하되 volume을 보존하려면 다음을 실행한다.

```bash
docker compose stop
```

`stop`은 container만 중지하며 `postgres-data` volume을 삭제하지 않는다. `docker compose down -v`와 volume 삭제 명령은 사용하지 않는다.

## Health와 redacted 로그 확인

외부 health는 frontend와 backend의 same-origin 경계를 함께 확인한다.

```bash
curl --fail --silent --show-error http://127.0.0.1:${APP_PORT:-8080}/actuator/health
docker compose ps
```

정상 응답은 HTTP 200과 `{"status":"UP"}`이다. `docker compose ps`에서는 세 서비스가 healthy여야 한다.

로그는 secret 후보를 redaction한 출력만 공유한다.

```bash
docker compose logs --since 10m --no-color db backend frontend \
  | sed -E 's/((password|token|cookie|authorization)[=: ]+)[^ ]+/\1[REDACTED]/Ig'
```

```powershell
docker compose logs --since 10m --no-color db backend frontend |
  ForEach-Object { $_ -replace '(?i)((password|token|cookie|authorization)[=: ]+)\S+', '$1[REDACTED]' }
```

로그 원문은 issue, PR, Slack에 붙이지 않는다. DB password, session cookie, Authorization 값은 항상 `[REDACTED]`로 바꾼다.

## 배포 전 백업

백업 대상은 `postgres-data` volume의 PostgreSQL database 전체다. host의 `backups/`는 Git에서 제외되며 접근 권한과 보존 기간은 실행자가 별도로 관리한다.

```bash
mkdir -p backups
docker compose exec -T db sh -c 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --file=/tmp/restart-quest-backup.dump'
docker compose cp db:/tmp/restart-quest-backup.dump ./backups/restart-quest-backup.dump
```

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
docker compose exec -T db sh -c 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom --file=/tmp/restart-quest-backup.dump'
docker compose cp db:/tmp/restart-quest-backup.dump ./backups/restart-quest-backup.dump
```

백업 생성은 읽기 위주지만 DB I/O와 host disk를 사용한다. 복원은 기존 데이터를 덮을 수 있으므로 이 runbook의 자동 rollback에 포함하지 않으며 별도 승인과 복원 rehearsal 후 수행한다.

## 비파괴 Rollback

릴리스마다 `RELEASE_TAG`로 image를 보존하고 rollback 대상 tag가 local registry 또는 승인된 registry에 존재하는지 먼저 확인한다. DB migration은 forward-only이며 rollback 중 schema나 volume을 되돌리지 않는다.

1. 현재 health와 redacted 로그를 기록하고 위 절차로 DB backup을 만든다.
2. 이전에 검증한 backend/frontend image tag를 설정한다.
3. DB를 재생성하지 않고 애플리케이션 container만 이전 revision으로 교체한다.
4. health와 session/journey 조회 smoke를 다시 실행한다.

```bash
export RELEASE_TAG='<previous-verified-tag>'
docker compose config --quiet
docker compose up --detach --no-deps --wait --wait-timeout 120 backend frontend
curl --fail --silent --show-error http://127.0.0.1:${APP_PORT:-8080}/actuator/health
```

PowerShell에서는 같은 명령 전에 `$env:RELEASE_TAG = '<previous-verified-tag>'`를 사용한다. `docker compose up --no-deps`는 application container를 교체하지만 `db`와 `postgres-data` volume을 유지한다.

이전 application이 현재 forward schema와 호환되지 않거나 health가 회복되지 않으면 반복 재시작하지 않는다. redacted 증거를 남기고 마지막 정상 image로 재전개하거나 forward fix를 준비한다. table 삭제, down migration, DB DROP, volume 제거는 rollback 수단으로 사용하지 않는다.
