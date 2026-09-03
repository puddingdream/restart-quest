# Re:Start Quest 릴리스 Runbook

이 문서는 `compose.yaml`과 같은 revision의 backend, frontend, PostgreSQL 17을 한 호스트에서 실행하는 절차다. 브라우저에는 `http://localhost:8080`만 공개되며 backend와 database 포트는 Compose 내부 네트워크에만 연결된다.

## 1. 준비

필수 도구는 Docker Engine, Docker Compose plugin, Bash, curl이다. 배포 호스트에는 이미지 build와 PostgreSQL volume을 위한 여유 공간이 있어야 한다.

```bash
docker version
docker compose version
bash --version
curl --version
```

위 명령은 버전과 daemon 연결만 조회하므로 위험도는 낮다. 운영 변경 전에는 현재 revision과 기존 이미지 식별자를 별도 변경 기록에 남긴다.

```bash
git rev-parse HEAD
```

이 명령은 read-only다. revision은 rollback 때 사용할 수 있도록 접근이 통제된 배포 기록에 보관한다.

## 2. 환경 변수

database 이름과 계정 이름은 secret이 아니지만 명시적으로 고정한다. 비밀번호는 저장소의 `.env`나 shell history에 기록하지 않고 secret manager 또는 대화형 입력으로 주입한다.

```bash
export DATABASE_NAME=restart_quest
export DATABASE_USERNAME=restart_quest
read -r -s -p 'DATABASE_PASSWORD: ' DATABASE_PASSWORD
printf '\n'
export DATABASE_PASSWORD

if [[ -n "${DATABASE_PASSWORD:-}" ]]; then
  printf 'DATABASE_PASSWORD=set\n'
else
  printf 'DATABASE_PASSWORD=empty\n'
fi
```

확인문은 값을 노출하지 않고 `set`/`empty`만 출력한다. 빈 값이면 진행하지 않는다. 운영 TLS 환경에서는 `SESSION_COOKIE_SECURE`를 설정하지 않아 기본값 `true`를 유지한다. 로컬 HTTP smoke에서만 다음 값을 현재 shell에 설정한다.

```bash
export SESSION_COOKIE_SECURE=false
```

HTTP에서 secure cookie를 끄는 명령이므로 위험도는 중간이며 로컬 검증 외 환경에서는 사용하지 않는다. Compose 해석 검증은 반드시 출력 없는 모드로 실행한다. 일반 출력 모드는 치환된 secret을 노출할 수 있다.

```bash
docker compose config --quiet
docker compose images --format json
```

두 명령은 read-only이며 비밀번호를 출력하지 않는다. 두 번째 명령의 현재 이미지 식별자도 rollback용 배포 기록에 보관한다.

## 3. 이미지 build와 기동

기존 database volume을 갱신하는 배포라면 아래 build 전에 6절의 pre-deploy backup을 먼저 완료한다. 완전히 새 database로 시작할 때만 이 단계를 생략한다.

```bash
docker compose build --pull
docker compose up -d --wait --wait-timeout 180
```

`build`는 외부 registry에서 base image와 의존성을 받고 로컬 이미지를 갱신한다. `up`은 컨테이너와 네트워크를 만들고 persistent PostgreSQL volume을 연결하므로 위험도는 중간이다. database health 통과 후 backend가 시작되고, backend `/actuator/health`가 `UP`일 때 web이 준비된다. backend와 database는 호스트 포트를 열지 않는다.

기동 실패 시 먼저 상태와 제한된 최근 로그를 확인한다. 애플리케이션 로그 정책은 이메일, 메모, 비밀번호, cookie, CSRF token을 남기지 않지만 로그 파일 자체는 운영 정보로 취급한다.

```bash
docker compose ps
docker compose logs --since 10m database backend web
```

두 명령은 read-only이나 로그에 운영 메타데이터가 포함될 수 있어 공유 범위를 제한한다.

## 4. migration과 health check

backend 시작 시 Flyway가 V1부터 순서대로 migration을 검증·적용하고, Hibernate는 결과 schema를 `validate`만 한다. 새 database에서는 backend health가 올라오기 전에 migration이 완료되어야 한다.

```bash
docker compose exec -T database \
  psql -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  -c 'SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank;'

curl --fail --silent --show-error http://localhost:8080/actuator/health
bash scripts/smoke.sh
```

첫 명령과 health 요청은 read-only다. health 응답은 세부정보 없이 `UP`만 노출한다. smoke script는 세 서비스의 running 상태, public health, landing, `/today` SPA 직접 진입, 없는 asset의 404, CSRF API, 비인증 API의 401 보존을 검사하며 token 본문을 출력하지 않는다.

배포 전 script 문법도 검사한다.

```bash
bash -n scripts/smoke.sh
```

문법 검사는 파일을 실행하지 않는 read-only 검증이다.

## 5. 중지와 재기동

```bash
docker compose stop
docker compose start
docker compose ps
```

`stop`은 서비스 중단을 일으키므로 위험도는 중간이지만 컨테이너와 PostgreSQL volume은 보존한다. volume 삭제 옵션은 데이터 손실 위험 때문에 이 Runbook에서 사용하지 않는다.

## 6. 데이터 백업

배포와 rollback 전에 쓰기 트래픽을 중지하거나 maintenance window를 확보한 뒤 custom-format dump를 저장소 밖의 접근 통제 경로에 생성한다.

```bash
backup_dir="../restart-quest-backups"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_file="$backup_dir/restart_quest_$(date -u +%Y%m%dT%H%M%SZ).dump"

docker compose exec -T database \
  pg_dump -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  --format=custom --no-owner --no-privileges > "$backup_file"
chmod 600 "$backup_file"
pg_restore --list "$backup_file" >/dev/null
```

`pg_dump`는 운영 데이터를 읽고 민감한 backup 파일을 생성하므로 위험도는 높다. 암호화된 저장소, 최소 권한, 보존 기간을 적용하고 파일명이나 내용을 PR·로그에 첨부하지 않는다. 마지막 명령은 archive 구조만 읽어 검증한다.

## 7. 애플리케이션 이미지 rollback

새 migration이 이전 애플리케이션과 호환되는 경우 PostgreSQL volume은 그대로 두고 변경 기록에 보관한 이전 immutable image digest를 입력한다.

```bash
read -r -p '이전 backend image digest: ' BACKEND_IMAGE
read -r -p '이전 web image digest: ' WEB_IMAGE
export BACKEND_IMAGE WEB_IMAGE

docker compose pull backend web
docker compose up -d --no-build --wait --wait-timeout 180 backend web
bash scripts/smoke.sh
```

서비스 이미지를 교체하고 일시 중단을 만들 수 있어 위험도는 높다. tag 대신 검증된 digest를 사용하고, health나 smoke가 실패하면 현재 release digest를 다시 설정해 같은 명령으로 roll-forward한다. database volume은 삭제하거나 초기화하지 않는다.

## 8. schema 비호환 rollback

이전 코드가 이미 적용된 schema와 호환되지 않으면 기존 volume을 수정하지 않는다. maintenance 승인을 받은 뒤 pre-deploy backup을 별도 Compose project의 새 volume에 복구하고, 18080 포트에서 먼저 검증한다.

```bash
rollback_project="restartquest-rollback-$(date -u +%Y%m%d%H%M%S)"
export COMPOSE_PROJECT_NAME="$rollback_project"
export HTTP_PORT=18080

docker compose pull backend web
docker compose up -d --wait database
docker compose exec -T database \
  pg_restore -U "$DATABASE_USERNAME" -d "$DATABASE_NAME" \
  --no-owner --no-privileges < "$backup_file"
docker compose up -d --no-build --wait --wait-timeout 180 backend web
BASE_URL=http://localhost:18080 bash scripts/smoke.sh
```

별도 database를 만들고 개인정보 backup을 복구하는 고위험 절차다. `BACKEND_IMAGE`와 `WEB_IMAGE`는 이 절차 전에 이전 digest로 설정되어 있어야 한다. 검증이 통과한 뒤에만 maintenance window에서 기존 web/backend를 멈추고 rollback web의 공개 포트를 전환한다.

```bash
docker compose -p restart-quest stop web backend
HTTP_PORT=8080 docker compose -p "$rollback_project" \
  up -d --no-deps --no-build --force-recreate web
docker compose -p "$rollback_project" ps
COMPOSE_PROJECT_NAME="$rollback_project" BASE_URL=http://localhost:8080 \
  bash scripts/smoke.sh
```

마지막 전환은 서비스 중단과 트래픽 변경을 일으키므로 운영 승인 후 수행한다. 전환 실패 시 다음처럼 rollback project를 멈추고 원래 project를 다시 시작해 roll-forward한다.

```bash
docker compose -p "$rollback_project" stop
docker compose -p restart-quest start backend web
COMPOSE_PROJECT_NAME=restart-quest BASE_URL=http://localhost:8080 \
  bash scripts/smoke.sh
```

두 `stop`/`start` 경로 모두 volume을 보존한다. 기존 PostgreSQL volume과 실패한 복구 volume은 원인 분석과 사람의 보존 결정 전까지 삭제하지 않는다.
