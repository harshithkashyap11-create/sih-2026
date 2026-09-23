#!/usr/bin/env bash
set -Eeuo pipefail

: "${BACKUP_DIR:?Set BACKUP_DIR to an absolute, dedicated backup directory}"
: "${POSTGRES_HOST:?Set POSTGRES_HOST}"
: "${POSTGRES_PORT:?Set POSTGRES_PORT}"
: "${POSTGRES_DB:?Set POSTGRES_DB}"
: "${POSTGRES_USER:?Set POSTGRES_USER}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"

case "$BACKUP_DIR" in
  /*) ;;
  *) echo "BACKUP_DIR must be absolute" >&2; exit 2 ;;
esac
if [[ "$BACKUP_DIR" == "/" || "$BACKUP_DIR" == "/home" || "$BACKUP_DIR" == "/tmp" ]]; then
  echo "Refusing a broad backup directory: $BACKUP_DIR" >&2
  exit 2
fi
command -v pg_dump >/dev/null || { echo "pg_dump is required" >&2; exit 2; }

umask 077
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_DIR/$stamp"
mkdir -p "$target/media"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="$target/database.dump" \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  "$POSTGRES_DB"
sha256sum "$target/database.dump" > "$target/SHA256SUMS"

if [[ -n "${MINIO_ENDPOINT:-}" ]]; then
  : "${MINIO_BUCKET:?Set MINIO_BUCKET when MINIO_ENDPOINT is configured}"
  : "${MINIO_ROOT_USER:?Set MINIO_ROOT_USER when MINIO_ENDPOINT is configured}"
  : "${MINIO_ROOT_PASSWORD:?Set MINIO_ROOT_PASSWORD when MINIO_ENDPOINT is configured}"
  command -v aws >/dev/null || { echo "aws CLI is required for object-storage backup" >&2; exit 2; }
  AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-$MINIO_ROOT_USER}" \
  AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-$MINIO_ROOT_PASSWORD}" \
  AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${MINIO_REGION:-us-east-1}}" \
  aws s3 sync "s3://$MINIO_BUCKET" "$target/media" \
    --endpoint-url "$MINIO_ENDPOINT" --only-show-errors
fi

printf 'Backup written to %s\n' "$target"
