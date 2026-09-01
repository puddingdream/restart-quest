#!/usr/bin/env bash
set -Eeuo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf '[release-stack] 필요한 명령을 찾을 수 없습니다: %s\n' "$1" >&2
    exit 1
  fi
}

require_command curl
require_command docker

if [[ -z "${DB_PASSWORD:-}" ]]; then
  printf '%s\n' '[release-stack] DB_PASSWORD=empty (secret 값은 출력하지 않았습니다.)' >&2
  exit 1
fi
printf '%s\n' '[release-stack] DB_PASSWORD=set'

if [[ -z "${SESSION_COOKIE_SECURE:-}" ]]; then
  printf '%s\n' '[release-stack] SESSION_COOKIE_SECURE=empty (로컬 HTTP는 false, HTTPS release는 true로 명시하십시오.)' >&2
  exit 1
fi
cookie_secure="$SESSION_COOKIE_SECURE"
case "$cookie_secure" in
  true|false) ;;
  *)
    printf '%s\n' '[release-stack] SESSION_COOKIE_SECURE는 true 또는 false여야 합니다.' >&2
    exit 1
    ;;
esac
printf '[release-stack] SESSION_COOKIE_SECURE=%s\n' "$cookie_secure"

app_port="${APP_PORT:-8080}"
if [[ ! "$app_port" =~ ^[0-9]+$ ]]; then
  printf '%s\n' '[release-stack] APP_PORT는 1..65535 범위의 정수여야 합니다.' >&2
  exit 1
fi
app_port_number=$((10#$app_port))
if (( app_port_number < 1 || app_port_number > 65535 )); then
  printf '%s\n' '[release-stack] APP_PORT는 1..65535 범위의 정수여야 합니다.' >&2
  exit 1
fi
base_url="http://127.0.0.1:${app_port_number}"

printf '%s\n' '[release-stack] Compose 설정 검증'
docker compose config --quiet

printf '%s\n' '[release-stack] backend/frontend image build'
docker compose build

printf '%s\n' '[release-stack] stack start와 container health 대기'
docker compose up --detach --wait --wait-timeout 120

printf '%s\n' '[release-stack] same-origin health와 사용자 흐름 smoke'
health_body="$(curl --fail --silent --show-error "${base_url}/actuator/health")"
if [[ "$health_body" != *'"status":"UP"'* ]]; then
  printf '%s\n' '[release-stack] same-origin health 응답이 UP이 아닙니다.' >&2
  exit 1
fi

session_headers="$(curl --fail --silent --show-error \
  --request POST \
  --dump-header - \
  --output /dev/null \
  "${base_url}/api/v1/session")"
session_cookie=''
while IFS= read -r header; do
  header="${header%$'\r'}"
  case "$header" in
    [Ss]et-[Cc]ookie:\ rq_session=*)
      session_cookie="${header#*: }"
      session_cookie="${session_cookie%%;*}"
      break
      ;;
  esac
done <<< "$session_headers"
unset session_headers
if [[ -z "$session_cookie" ]]; then
  printf '%s\n' '[release-stack] session 응답에 rq_session cookie가 없습니다.' >&2
  exit 1
fi

if command -v uuidgen >/dev/null 2>&1; then
  command_id="$(uuidgen)"
elif [[ -r /proc/sys/kernel/random/uuid ]]; then
  command_id="$(</proc/sys/kernel/random/uuid)"
elif command -v powershell.exe >/dev/null 2>&1; then
  command_id="$(powershell.exe -NoProfile -Command '[guid]::NewGuid().ToString()' | tr -d '\r')"
else
  printf '%s\n' '[release-stack] UUID 생성 수단을 찾을 수 없습니다.' >&2
  exit 1
fi

create_status="$(curl --fail --silent --show-error \
  --request POST \
  --header 'Content-Type: application/json' \
  --cookie "$session_cookie" \
  --data "{\"goalType\":\"JOB_SEARCH\",\"energyLevel\":\"LOW\",\"availableMinutes\":5,\"commandId\":\"${command_id}\"}" \
  --output /dev/null \
  --write-out '%{http_code}' \
  "${base_url}/api/v1/journey")"
if [[ "$create_status" != '201' ]]; then
  printf '%s\n' '[release-stack] journey 생성 응답이 201이 아닙니다.' >&2
  exit 1
fi

journey_body="$(curl --fail --silent --show-error \
  --cookie "$session_cookie" \
  "${base_url}/api/v1/journey")"
unset session_cookie
if [[ "$journey_body" != *'"journeyId"'* ]] || [[ "$journey_body" != *'"currentQuest"'* ]]; then
  printf '%s\n' '[release-stack] journey 조회 응답에 필수 필드가 없습니다.' >&2
  exit 1
fi

route_body="$(curl --fail --silent --show-error "${base_url}/quest")"
if [[ "$route_body" != *'<div id="root"></div>'* ]]; then
  printf '%s\n' '[release-stack] frontend /quest 직접 진입 smoke가 index shell을 반환하지 않았습니다.' >&2
  exit 1
fi

printf '%s\n' '[release-stack] PASS: health, session, journey 생성/조회, frontend route'
