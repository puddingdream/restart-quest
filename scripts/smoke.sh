#!/usr/bin/env bash
set -Eeuo pipefail

base_url="${BASE_URL:-http://localhost:8080}"
compose_file="${COMPOSE_FILE:-compose.yaml}"
curl_bin="${CURL_BIN:-curl}"
smoke_tmp="$(mktemp -d)"

cleanup() {
  rm -f -- "$smoke_tmp/health.json" "$smoke_tmp/landing.html" \
    "$smoke_tmp/route.html" "$smoke_tmp/csrf.json" "$smoke_tmp/api-error.json" \
    "$smoke_tmp/missing-asset.txt"
  rmdir -- "$smoke_tmp"
}
trap cleanup EXIT
umask 077

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail 'docker 명령을 찾을 수 없습니다.'
command -v "$curl_bin" >/dev/null 2>&1 || fail 'curl 명령을 찾을 수 없습니다.'

running_services="$(docker compose -f "$compose_file" ps --status running --services)"
for service in database backend web; do
  grep -Fxq "$service" <<<"$running_services" || fail "$service 서비스가 running 상태가 아닙니다."
done

request() {
  local path="$1"
  local output="$2"
  "$curl_bin" --silent --show-error \
    --connect-timeout 5 --max-time 15 \
    --output "$output" --write-out '%{http_code}' \
    "${base_url}${path}"
}

status="$(request '/actuator/health' "$smoke_tmp/health.json")"
[[ "$status" == '200' ]] || fail "public health가 HTTP 200이 아닙니다: $status"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' "$smoke_tmp/health.json" \
  || fail 'public health 본문이 UP이 아닙니다.'

status="$(request '/' "$smoke_tmp/landing.html")"
[[ "$status" == '200' ]] || fail "landing이 HTTP 200이 아닙니다: $status"
grep -Fq '<div id="root"></div>' "$smoke_tmp/landing.html" \
  || fail 'landing에서 SPA root를 찾지 못했습니다.'

status="$(request '/today' "$smoke_tmp/route.html")"
[[ "$status" == '200' ]] || fail "SPA 직접 진입이 HTTP 200이 아닙니다: $status"
grep -Fq '<div id="root"></div>' "$smoke_tmp/route.html" \
  || fail 'SPA 직접 진입이 index.html로 복구되지 않았습니다.'

status="$(request '/assets/agentflow-smoke-missing.js' "$smoke_tmp/missing-asset.txt")"
[[ "$status" == '404' ]] || fail "없는 asset이 HTTP 404가 아닙니다: $status"

status="$(request '/api/v1/auth/csrf' "$smoke_tmp/csrf.json")"
[[ "$status" == '200' ]] || fail "CSRF API가 HTTP 200이 아닙니다: $status"
grep -Eq '"headerName"[[:space:]]*:[[:space:]]*"[^"]+"' "$smoke_tmp/csrf.json" \
  || fail 'CSRF API에 headerName이 없습니다.'
grep -Eq '"token"[[:space:]]*:[[:space:]]*"[^"]+"' "$smoke_tmp/csrf.json" \
  || fail 'CSRF API에 token이 없습니다.'

status="$(request '/api/v1/today' "$smoke_tmp/api-error.json")"
[[ "$status" == '401' ]] || fail "비인증 API가 HTTP 401을 보존하지 않았습니다: $status"

printf '[PASS] compose services, same-origin health, SPA fallback, asset 404, API proxy를 확인했습니다.\n'
