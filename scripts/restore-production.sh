#!/usr/bin/env bash
set -Eeuo pipefail

: "${BACKUP_FILE:?Set BACKUP_FILE to a specific database.dump file}"
: "${RESTORE_CONFIRM:?Set RESTORE_CONFIRM=I_UNDERSTAND_THIS_REPLACES_TARGET_DATA}"
: "${POSTGRES_HOST:?Set POSTGRES_HOST}"
: "${POSTGRES_PORT:?Set POSTGRES_PORT}"
: "${POSTGRES_DB:?Set POSTGRES_DB}"
: "${POSTGRES_USER:?Set POSTGRES_USER}"
: "${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD}"

if [[ "$RESTORE_CONFIRM" != "I_UNDERSTAND_THIS_REPLACES_TARGET_DATA" ]]; then
  echo "Restore confirmation did not match; no data was changed" >&2
  exit 2
fi
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file does not exist: $BACKUP_FILE" >&2
  exit 2
fi
command -v pg_restore >/dev/null || { echo "pg_restore is required" >&2; exit 2; }

PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
  --clean --if-exists --exit-on-error --no-owner --no-privileges \
  --host="$POSTGRES_HOST" \
  --port="$POSTGRES_PORT" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  "$BACKUP_FILE"

printf 'Database restore completed for %s@%s:%s/%s\n' "$POSTGRES_USER" "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_DB"
