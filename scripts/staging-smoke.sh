#!/usr/bin/env bash
set -Eeuo pipefail

: "${STAGING_BASE_URL:?Set STAGING_BASE_URL, including https:// and no trailing slash}"
case "$STAGING_BASE_URL" in
  https://*) ;;
  *) echo "STAGING_BASE_URL must use HTTPS" >&2; exit 2 ;;
esac

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

status="$(curl --fail --silent --show-error --output "$tmp/health.json" --write-out '%{http_code}' "$STAGING_BASE_URL/api/v1/health/")"
[[ "$status" == "200" ]] || { echo "health returned HTTP $status" >&2; exit 1; }
grep -Eq '"status"[[:space:]]*:[[:space:]]*"ok"' "$tmp/health.json" || {
  echo "health did not report status=ok" >&2
  exit 1
}

curl --fail --silent --show-error --dump-header "$tmp/headers" --output /dev/null "$STAGING_BASE_URL/"
for header in strict-transport-security x-content-type-options referrer-policy x-frame-options; do
  grep -Eiq "^$header:" "$tmp/headers" || {
    echo "missing HTTPS security header: $header" >&2
    exit 1
  }
done

if [[ -n "${STAGING_HTTP_URL:-}" ]]; then
  redirect="$(curl --silent --show-error --output /dev/null --write-out '%{http_code} %{redirect_url}' "$STAGING_HTTP_URL/")"
  [[ "$redirect" =~ ^(301|302|307|308)[[:space:]]https:// ]] || {
    echo "HTTP endpoint did not redirect to HTTPS: $redirect" >&2
    exit 1
  }
fi

printf 'Staging HTTPS smoke checks passed for %s\n' "$STAGING_BASE_URL"
