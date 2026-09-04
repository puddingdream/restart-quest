#!/bin/sh
set -eu

required_names="DB_URL DB_USERNAME DB_PASSWORD RQ_ALLOWED_ORIGINS RQ_COOKIE_SECURE"

for name in $required_names; do
    eval "value=\${$name-}"
    if [ -n "$value" ]; then
        printf '%s=set\n' "$name"
    else
        printf '%s=empty\n' "$name" >&2
        exit 1
    fi
done

case "$RQ_ALLOWED_ORIGINS" in
    *\**|*,*)
        printf '%s\n' 'RQ_ALLOWED_ORIGINS must be one explicit origin; wildcard and origin lists are not allowed.' >&2
        exit 1
        ;;
    http://*|https://*) ;;
    *)
        printf '%s\n' 'RQ_ALLOWED_ORIGINS must be an explicit http(s) origin.' >&2
        exit 1
        ;;
esac

case "$RQ_COOKIE_SECURE" in
    true|false) ;;
    *)
        printf '%s\n' 'RQ_COOKIE_SECURE must be true or false.' >&2
        exit 1
        ;;
esac

exec java -jar /app/app.jar --app.security.cookie-secure="$RQ_COOKIE_SECURE"

