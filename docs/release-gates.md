# Release gate execution

The repository now contains executable checks for the external gates that a
local unit-test run cannot certify. Use fictional records in staging and record
the output and reviewer/date in the release ticket.

## Production dependencies

After migrations and before admitting users, run from `backend/`:

```sh
DJANGO_SETTINGS_MODULE=config.settings.prod \
  python manage.py verify_production --storage --smtp
```

This checks Django deployment errors, PostgreSQL, Redis, and a write/read/delete
round trip against the private S3-compatible bucket. The SMTP option opens and
closes the configured connection without sending mail. To explicitly send one
test message to an authorized mailbox, add `--send-test-email recipient@example.com`.

The production settings now fail closed unless the S3 endpoint is HTTPS, the
bucket is non-default, the proxy is trusted, CSRF origins are HTTPS, and the
mail transport has a valid mutually exclusive TLS/SSL configuration.

## Backups and restore

Install `pg_dump`, `pg_restore`, and the AWS CLI in the operations image. Run the
backup script with a dedicated absolute directory:

```sh
BACKUP_DIR=/srv/smarana-backups \
  bash scripts/backup-production.sh
```

The script creates a mode-700 timestamped directory, a custom-format PostgreSQL
dump, a SHA-256 manifest, and (when `MINIO_ENDPOINT` is set) an object-storage
mirror. Restore only into an isolated target after checking the manifest and
setting the exact confirmation value:

```sh
RESTORE_CONFIRM=I_UNDERSTAND_THIS_REPLACES_TARGET_DATA \
  BACKUP_FILE=/srv/smarana-backups/20260923T000000Z/database.dump \
  bash scripts/restore-production.sh
```

The restore command is intentionally destructive to its explicitly named target;
it must never be pointed at the live database during a release smoke test.

## HTTPS ingress and devices

Run the ingress smoke test against the real staging host:

```sh
STAGING_BASE_URL=https://staging.example.com \
STAGING_HTTP_URL=http://staging.example.com \
  bash scripts/staging-smoke.sh
```

Then use [the voice/device worksheet](voice-device-and-content-review.md) on one
Android and one iOS device over HTTPS. Record microphone permission, an actual
utterance, the transcript, selected locale, audible response, interruption
recovery, and the typed fallback. Browser mocks cannot substitute for this test.

## Native-language and clinical review

Only content marked reviewed by an appropriately qualified native speaker and
clinical reviewer may be published. The current bundled material remains English
demo content and is deliberately not promoted by the application as translated
or culturally authentic. Complete the sign-off worksheet before changing the
review status or enabling a non-English public pack.

After the reviewers have recorded approval in `src/shared/i18n/review-status.json`,
run the release gate with the exact languages being shipped:

```sh
RELEASE_LANGUAGES=en,as RELEASE_REGIONAL_CONTENT=1 \
  npm run content:release-check
```

The command intentionally fails today because those human approvals have not
been recorded; that failure is the protection against shipping provisional copy.
