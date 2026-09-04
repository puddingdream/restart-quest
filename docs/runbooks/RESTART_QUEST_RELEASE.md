# Re:Start Quest 릴리스 Runbook

## 1. 범위와 판정 기준

이 문서는 동일 revision의 backend JAR와 frontend 정적 산출물을 PostgreSQL 및 Nginx same-origin proxy로 실행하는 절차다. 클라우드 계정, DNS/TLS, 운영 서버, CI와 repository-control은 이 릴리스 범위가 아니다.

릴리스 성공은 다음 조건을 모두 만족할 때만 선언한다.

- backend/frontend clean build, 전체 자동 테스트와 정적 검사가 통과한다.
- `docker compose config --quiet`와 image build가 통과한다.
- `db`, `backend`, `web`이 `healthy`이고 Flyway migration이 성공했다.
- public origin의 `/`는 production HTML을 반환하고 `/api/v1/bootstrap`은 backend에 도달한다. 세션 없는 401은 도달 확인일 뿐 제품 smoke 성공은 아니다.
- `deploy/smoke.mjs`가 첫 session부터 막힘 재설계, 완료, 기록, 전체 삭제와 삭제 후 격리를 모두 통과한다.
- 이전 image tag와 DB backup을 확보했고 rollback 책임자가 판정 기준을 확인했다.

## 2. 사전 조건과 환경 변수

BuildKit을 활성화한 Docker Engine, Docker Compose 2.17 이상, Git, Node.js 20 이상이 필요하다. Compose의 named build context로 package별 최소 context와 배포 설정을 결합한다. Docker build 내부에서 Java 21과 Node 22를 사용하므로 host Java 버전은 container build에 영향을 주지 않는다.

필수 환경 변수는 아래 다섯 개뿐이다. 값을 저장소, shell history, 로그, PR에 기록하지 않는다.

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `RQ_ALLOWED_ORIGINS`
- `RQ_COOKIE_SECURE`

`DB_URL`은 compose의 `db:5432/restart_quest`를 가리키는 JDBC URL이어야 한다. `RQ_ALLOWED_ORIGINS`는 브라우저의 public origin 한 개만 사용하며 wildcard와 쉼표 목록은 entrypoint가 거부한다. HTTPS이면 `RQ_COOKIE_SECURE=true`, 로컬 HTTP rehearsal에서만 `false`를 사용한다.

값을 출력하지 않고 set 여부만 확인한다.

```bash
for name in DB_URL DB_USERNAME DB_PASSWORD RQ_ALLOWED_ORIGINS RQ_COOKIE_SECURE; do
  if [ -n "$(printenv "$name")" ]; then printf '%s=set\n' "$name"; else printf '%s=empty\n' "$name"; fi
done
```

위 명령은 read-only이고 값 자체를 출력하지 않는다. 하나라도 `empty`면 중단한다. `.env` 파일을 저장소에 만들지 말고 승인된 secret 주입 수단으로 현재 process에 전달한다.

## 3. clean build와 구성 검증

검증 revision을 먼저 고정한다.

```bash
git status --short
git rev-parse HEAD
```

첫 명령은 read-only다. 예상하지 않은 변경이 있으면 build 증거가 다른 revision과 섞일 수 있으므로 중단한다.

```bash
(cd backend && ./gradlew --no-daemon clean test bootJar)
(cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build)
docker compose config --quiet
docker compose build --pull backend web
```

`clean`과 `npm ci`는 각 프로젝트의 생성 산출물/의존성 디렉터리를 재생성하지만 source나 DB를 삭제하지 않는다. `--pull`은 base image를 갱신할 수 있으므로 동일 릴리스 내에서는 한 번만 수행하고 생성된 image ID를 기록한다. `config --quiet`은 secret을 출력하지 않고 해석 가능 여부만 반환한다.

build 직후 rollback용 immutable tag를 보존한다. `<revision>`은 앞서 고정한 전체 Git SHA다.

```bash
docker tag restart-quest-backend:local restart-quest-backend:<revision>
docker tag restart-quest-frontend:local restart-quest-frontend:<revision>
docker image inspect --format '{{.Id}}' restart-quest-backend:<revision>
docker image inspect --format '{{.Id}}' restart-quest-frontend:<revision>
```

tag 명령은 image metadata를 변경하지만 container나 DB는 변경하지 않는다. inspect 결과는 image ID뿐이며 secret을 포함하지 않는다.

## 4. 백업과 기동

기존 DB가 있으면 변경 전에 backup을 만든다. backup 파일은 사용자 데이터이므로 저장소 밖의 접근 제한 경로에 두고 내용을 출력하거나 commit하지 않는다.

```bash
mkdir -p ../restart-quest-backups
docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' > ../restart-quest-backups/restart_quest-YYYYMMDD-HHMM.dump
docker compose exec -T db pg_restore --list < ../restart-quest-backups/restart_quest-YYYYMMDD-HHMM.dump > /dev/null
```

`pg_dump`는 DB read-only지만 host에 민감한 backup을 생성한다. 두 번째 명령은 archive 목록을 검사하며 내용을 남기지 않는다. 신규 volume이라 `db`가 아직 없으면 첫 기동 뒤 smoke 전에 동일 형식의 baseline backup을 남긴다.

```bash
docker compose up -d db
docker compose up -d backend
docker compose up -d web
docker compose ps
docker compose images
```

`up -d`는 로컬 runtime을 변경하고 migration을 적용한다. `db -> backend -> web` 순서로 기동하며 각 단계가 healthy가 아니면 다음 단계로 진행하지 않는다. `images` 결과의 세 image ID를 revision 증거에 남긴다. volume 삭제 옵션은 사용하지 않는다.

## 5. health, migration, route와 전체 smoke

```bash
docker compose exec -T backend curl --fail --silent --show-error http://127.0.0.1:8080/actuator/health > /dev/null
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select version || chr(58) || success from flyway_schema_history order by installed_rank"'
curl --fail --silent --show-error "$RQ_ALLOWED_ORIGINS/" > /dev/null
curl --silent --output /dev/null --write-out '%{http_code}\n' "$RQ_ALLOWED_ORIGINS/api/v1/bootstrap"
node deploy/smoke.mjs "$RQ_ALLOWED_ORIGINS"
```

health/route 명령은 read-only다. migration 조회는 모든 행이 `<version>:t`이고 최신 migration이 repository와 일치해야 통과다. 세션 없는 bootstrap은 `401`이어야 proxy 도달 성공이다. 마지막 smoke만 검증용 workspace를 만들고 삭제하며, `PASS:` 한 줄로 끝나야 한다.

검증 뒤 `git rev-parse HEAD`와 `git status --short`를 다시 확인한다. 최초 SHA가 같고 예상하지 않은 source 변경이 없어야 같은 revision 증거로 인정한다.

## 6. 복구 연습

운영 DB를 덮어쓰거나 DROP하지 않는다. backup은 별도 recovery DB로 복원해 먼저 검증한다.

```bash
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" restart_quest_recovery'
docker compose exec -T db sh -c 'pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d restart_quest_recovery' < ../restart-quest-backups/restart_quest-YYYYMMDD-HHMM.dump
docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d restart_quest_recovery -Atc "select count(*) from flyway_schema_history where success"'
```

이 절차는 별도 DB를 생성하므로 상태 변경이다. 승인된 recovery 환경에서만 실행한다. 출력한 migration 수가 backup 시점 기대값과 일치하고 `pg_restore`가 0으로 끝나야 복구 가능으로 판정한다. 실제 전환은 복원 DB를 가리키는 새 `DB_URL`을 승인받아 backend만 재생성한 뒤 health와 전체 smoke를 다시 통과해야 한다.

## 7. 애플리케이션 rollback

현재 migration이 이전 애플리케이션과 호환되는지 먼저 확인한다. 호환되지 않거나 불명확하면 image만 되돌리지 말고 별도 recovery DB 전환 또는 roll-forward를 선택한다.

```bash
docker tag restart-quest-backend:<previous-revision> restart-quest-backend:local
docker tag restart-quest-frontend:<previous-revision> restart-quest-frontend:local
docker compose up -d --no-build --force-recreate backend web
docker compose ps
```

이 명령은 backend/web container를 교체해 짧은 중단을 만들지만 PostgreSQL volume은 유지한다. DB service와 volume을 내리거나 삭제하지 않는다. rollback 뒤 backend health, public web/API route, 이전 revision에 맞는 smoke를 다시 실행한다. 하나라도 실패하면 traffic 전환을 유지하지 않고 incident 책임자에게 escalation한다.

## 8. 실패 시 수집과 중단 기준

secret이나 사용자 입력을 포함할 수 있는 raw 로그 전체를 공유하지 않는다. 먼저 `docker compose ps`의 상태와 종료 코드, health 결과, 고정 SHA, 실패한 명령 이름만 기록한다. 추가 로그가 필요하면 승인된 보안 경계에서 민감값을 redaction한 최소 구간만 다룬다.

- migration 실패: backend 재시작을 반복하지 않고 migration 오류 원인을 수정하거나 recovery DB로 전환한다.
- backend unhealthy: web 배포 성공으로 판정하지 않는다.
- web 200/API 401 조건 실패: proxy 설정 또는 backend reachability를 점검한다.
- smoke 실패: 생성된 test workspace가 남을 수 있으므로 자동으로 DB를 삭제하지 말고 격리된 rehearsal DB를 사용한다.
- rollback health 실패: 동일 명령을 반복하지 않고 이전 image/DB 호환성과 환경 변수 set 상태를 다시 확인한다.
