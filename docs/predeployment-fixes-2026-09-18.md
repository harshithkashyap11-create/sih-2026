# Predeployment repair follow-up — 18 September 2026

This follows `deep-predeployment-audit-2026-09-18.md`. The original audit remains historical evidence; its deliberately failing checks now serve as release regressions. No production deployment or production data change was performed.

## Confirmed findings repaired

| Finding | Change |
| --- | --- |
| H1: expired/future/stopped medicines | Patient API checks active status and inclusive prescription dates. Offline records retain dates, the repository and patient page filter current prescriptions, and an online medication refresh atomically replaces the patient's cached list. Next-dose calculation uses the care clock. |
| H2: clinician difficulty caps | Override, baseline and profile saves, assignment initialization, round recommendations and final session persistence respect caps. Baseline saves lock the patient atomically and immediately bound existing game states. The cached game profile retains the global maximum. Both integrated controllers and the legacy host bound local changes, requested levels and resumed levels. |
| M1: rotating signed photo links | Cache identity excludes temporary signing credentials and retains object version parameters. Owned legacy cache entries are migrated using known metadata URLs. |
| M2: caregiver practice | Practice advertises only games supported by its renderer. Unsupported direct routes have a working return link. Integrated-only caregiver practice has not been implemented. |
| M3: missing descriptions | Added all nine missing descriptions in English, Assamese, Bengali and Hindi. The locale checker validates registry description references and every supported language's review provenance. |
| M4: Doctor Alerts | Added real patient-scoped alert details, evidence, status, review notes and doctor dismissal, with pending/error states and cache refresh. |
| M5: malformed inputs | Invalid alert UUIDs and unrepresentable report bounds return 400. Numeric metrics are bounded before conversion, preventing oversized-integer overflow. |
| M6: production headers | Locations declaring cache headers explicitly retain nosniff, same-origin referrer policy and frame protection, including error responses. |
| M7: device timezone | Shared Asia/Kolkata care-clock helpers govern schedules, next doses, report defaults, offline orientation and related care displays. |
| M8: invalid medicine contact button | Replaced the empty telephone destination and hardcoded person with a scoped primary-contact endpoint. The button uses the assigned caregiver's name/number and is omitted without a usable number or online refresh. |

## Additional source gaps addressed

- Integrated games enforce the session duration limit even before the first checkpoint, persist fatigue flags, prevent fatigue-driven promotion, and stop after four consecutive errorful round checkpoints. This is round-level detection; identical per-tap fatigue behavior across all engines still needs acceptance testing.
- Reset PIN recovery displays an explicit previous-device-PIN recovery path and rewraps the existing data key without deleting encrypted or unsynced records. If the old PIN is unknown, the app explains that another device or caregiver help is needed; encrypted records are not silently overwritten.
- Doctor baseline save updates the cached response immediately and invalidates related queries. Ideal session duration is explicitly advisory; the separately configured gameplay time limit remains enforced.
- Uncached object-storage authorization failures attempt to obtain a renewed URL from patient-scoped metadata. Missing photos have a retry control. Online memory details refresh signed URLs instead of always returning cached metadata.
- Authoritative family/memory reads replace stale metadata. Removed metadata triggers cleanup of unreferenced owned encrypted photo blobs. Server photos are not deleted by this cache cleanup.
- Local virtual environments are excluded from backend Docker context.
- CI includes both audit regression suites and the real-backend release browser scenarios without dropping configuration tests.

## Regional language options

Added Bodo (`brx`), Khasi (`kha`), Garo (`grt`), Nepali (`ne`) and Kokborok (`trp`) alongside existing Assamese, Bengali, Manipuri and Mizo options. Options are wired through preferences, content language records, voice locale configuration and command validation. Display names contain no substitution notices. This does not certify complete native-language translations, content packs or browser speech support. Native-speaker and clinical review remain required.

Apply the new account and content migrations before serving the updated release: `python manage.py migrate`. No production migrations were run here.

## Verification

- Complete backend run: 278 passed, including configuration tests and 13 audit regressions.
- Complete frontend run: 799 passed; separate audit suite: 6 passed, including medicine-cache replacement, signed-link rotation, renewal and deletion coverage.
- Final affected-suite reruns: 158 backend tests and 449 frontend tests passed after the remaining safety and language-routing changes.
- TypeScript, ESLint, locale checks and checker regressions, patient-copy checks, production frontend build, Ruff and strict backend mypy passed.
- Migration generation check found no missing model migrations.
- A temporary localhost-only production nginx container using the corrected configuration returned the declared security headers on HTML, service-worker and asset 404 responses. It was stopped and removed.
- Existing user changes to repository ignore files were preserved.

## Remaining release gates

These changes are not production certification. The original audit's staging gates still apply: actual ingress/HTTPS, secrets and allowlists, SMTP, real S3 expiry and deletion/consent behavior, backups and restore, mobile microphones and language quality, true disconnect/reconnect and reassignment races, and every game's completion/fatigue/resume flows. New release browser scenarios were added to CI but were not executed as a real-browser staging run in this repair pass. The build still reports large-bundle/code-splitting warnings.
