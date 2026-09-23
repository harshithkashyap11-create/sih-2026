# SMARANA deep predeployment audit — 18 September 2026

Repair follow-up: [predeployment fixes](predeployment-fixes-2026-09-18.md). This audit describes the pre-repair checkout; retain it as historical evidence. Refer to the follow-up for current code changes and verification limits.

**Recommendation: hold deployment for real patient use until the high-priority findings are fixed and staging gates pass.** Local browser checks, API probes, existing tests, and additional regression tests found defects despite a green baseline suite.

This is an audit of the checked-out code and local synthetic environment. No deployment was performed. Application code was not repaired. Audit tests and evidence were added; the temporary frontend container was stopped and the viewport override restored.

## Evidence and coverage

| Check | Result | Scope |
|---|---|---|
| Existing backend suite | 265 passed | Fresh run against local PostgreSQL test database |
| Existing frontend suite | 789 passed, 63 files | Fresh run; component/unit coverage |
| Targeted release invariants | 5 backend failures + 3 frontend failures | Reproductions for the findings below; isolated test data |
| Live API probes | 121 requests | Anonymous, patient, assigned/unassigned caregiver and doctor, admin; read access, PDFs and malformed dates/IDs |
| Frontend build, lint, copy, i18n | Passed | i18n checker nevertheless misses referenced game-description keys |
| Browser navigation | Patient game catalogue: 21 unique routes; caregiver 11 sections; doctor 8 tabs | Opened shells and selected interactions; **not completion of every game at every level** |
| PDF inspection | Actual caregiver/doctor reports and emergency cards retrieved | All 13 caregiver-report pages visually checked; doctor pages 1 and 11–13 checked; emergency card checked |
| Production Docker builds | Both built | Packaged backend PDF renderer also produced valid PDF bytes |
| Packaged nginx HTTP check | Failed security-header expectations | Local container response evidence saved |
| Actual microphone | Incomplete | Brave reached Listening; no verified recognized spoken command or spoken reply |
| Fresh browser upload | Incomplete | File picker stalled; session expired before save; not evidence of an application upload defect |

Evidence is in [.local/deep-audit](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit>). Baseline logs are [.local/deep-audit-backend-tests.log](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit-backend-tests.log>) and [.local/deep-audit-frontend-tests.log](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit-frontend-tests.log>). PDF outputs are [caregiver report](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit/caregiver-report.pdf>), [doctor report](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit/doctor-report.pdf>), and [emergency card](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit/caregiver-emergency-card.pdf>).

## Confirmed defects

### H1. Patient medicines do not consistently respect prescription status and dates

**Priority: high. Evidence: failing backend/frontend regressions plus repository review.**

An active prescription ending yesterday remains in the patient medications endpoint. The endpoint filters only active=true, whereas the emergency PDF correctly checks start/end dates. Future-start prescriptions have the same missing date restriction.

Offline, the routine repository returns every cached medicine. Sync preserves active=false records and the Medicines page does not filter them. The regression renders a stopped medicine as current medicine. Online bulkPut also does not remove older cached rows omitted by the active-only response, so a previously cached stopped prescription can remain available offline.

Fix current-prescription filtering consistently across API, cache, patient display and next-dose calculation. Include stop/start/end transitions and offline reconnect in acceptance tests.

Sources: [patient medication endpoint](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/patients/views.py:298>), [offline repository](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/db/repo/routine.ts:77>), [Medicines page](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/patient/medicines/MedicinesPage.tsx:18>), [sync](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/db/sync.ts:170>).

### H2. Clinician difficulty caps are not hard bounds throughout the system

**Priority: high. Evidence: three failing backend regressions and frontend source review.**

Three reproduced cases:
1. Lock level 5 while an existing per-game cap is 2: persisted state becomes level 5 above cap 2.
2. Save baseline maximum 2 while an existing game state is level 5: the existing state remains level 5.
3. Submit a round checkpoint at level 5 with global maximum 2: the backend recommends level 4, still above the maximum, because its one-level adjustment restriction runs after clamping.

The integrated frontend clamps per-game cap, but does not apply the patient's global baseline maximum. Sync drops that maximum from gamePatient. Thus a global cap cannot be relied on to bound the next integrated game. The per-game frontend clamp does mitigate the first case at initial render, but does not make the backend invariant correct.

Sources: [overrides](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/clinical/services.py:45>), [baseline save](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/clinical/views.py:105>), [round adaptation](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/games/performance.py:112>), [integrated game host](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/patient/games/IntegratedGamePage.tsx:43>), [game profile cache](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/db/sync.ts:100>).

### M1. Signed URL rotation breaks previously cached offline images

**Priority: medium. Evidence: failing encrypted-cache regression.**

Cache an image under a signed URL, replace its signature, then go offline. Looking up the new URL returns undefined instead of the previously cached image. Cache identity hashes the entire URL, including expiring signature parameters. This test simulates URL rotation; it does not claim actual S3 expiry was tested.

Use stable asset identity and versioning, with signed URLs treated as temporary fetch locations. Test renewal, offline transitions and deletion.

Source: [private media cache](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/db/media.ts:54>).

### M2. Caregiver practice advertises unavailable games

**Priority: medium. Evidence: browser reproduction plus registry review.**

Caregiver → Practice → Pattern Completion displays “This game is unavailable.” Practice lists the 21 server game definitions but resolves them through the legacy gameByKey registry, which contains only 12 modules. Integrated-only games are advertised without a compatible practice renderer. Practice also gives no working dashboard link on this route; browser Back is needed.

Sources: [practice page](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/caregiver/PracticePage.tsx>), [registry](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/games/registry.ts>).

### M3. Nine enabled game descriptions lack English translations

**Priority: medium. Evidence: frontend regression and browser catalogue.**

Missing description keys: tea_garden_attention, bihu_rhythm_recall, daily_life_sequencing, familiar_place_recall, who_is_this, word_pairs, festival_calendar, sound_match, spot_the_change. Translation lookup returns the raw key. The existing i18n check passes because it does not catch these referenced missing keys.

Source: [registry](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/games/registry.ts>). Extend checks to validate every referenced catalogue description against each supported locale and its explicit fallback.

### M4. Doctor Alerts cannot show or act on alert details

**Priority: medium. Evidence: browser reproduction and source.**

The patient Alerts tab contains only “Open patient alerts are shown on the doctor dashboard.” The dashboard supplies counts and links back to this tab. The browser flow does not provide the actual alert list/details or doctor dismissal controls, despite backend alert endpoints.

Sources: [patient Alerts tab](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/doctor/DoctorPatientPage.tsx:69>), [dashboard link](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/doctor/DoctorDashboard.tsx:60>).

### M5. Validating edge inputs can cause HTTP 500

**Priority: medium. Evidence: live probes and isolated backend regression.**

- report/?from=9999-12-31&to=9999-12-31 → 500 from adding one day beyond the date range.
- alerts/?patient=not-a-uuid → 500 from uncaught UUID parsing.
- Game-session metrics with mistakes=10**1000 → 500 during numeric validation instead of 400.

Malformed ordinary dates and reversed ranges correctly returned 400. Add explicit representable range and numeric bounds, and safe UUID validation.

Sources: [PDF date bound](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/reports/services.py:66>), [alert query parsing](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/apps/alerts/views.py:85>), backend regression evidence.

### M6. Production nginx drops its declared security headers

**Priority: medium. Evidence: actual built-container responses.**

GET / and GET /sw.js returned 200 with Cache-Control, but without X-Content-Type-Options, Referrer-Policy or X-Frame-Options. Location-level add_header directives replace inherited server headers in this configuration. Assets use the same problematic pattern. Check final ingress responses too; an ingress could independently add protection.

Source: [nginx configuration](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/deploy/nginx.conf>). Evidence: [index headers](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit/production-index-headers.txt>), [service-worker headers](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.local/deep-audit/production-sw-headers.txt>).

### M7. Caregiver times and report dates can shift with device timezone

**Priority: medium. Evidence: browser observation and source review.**

A reminder labelled 08:00 appeared as 02:30 on this UTC laptop while the backend uses Asia/Kolkata. ReportsTab defaults dates using UTC ISO strings, so its default end day differed from the backend care day after midnight in India. Medicines next-dose comparison uses the device's local clock.

Define a care timezone and use it consistently for schedules, next dose, reports and displayed dates. Test devices outside the patient's timezone and daylight-saving boundaries.

Sources: [Medicines clock](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/patient/medicines/MedicinesPage.tsx:24>), [report dates](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/caregiver/ReportsTab.tsx:12>).

### M8. “Ask Priya” has no telephone destination

**Priority: medium. Evidence: source-confirmed; no phone call placed.**

The medicine-page contact button is hardcoded to Priya and assigns tel: with no number. It cannot reliably call the assigned caregiver and becomes incorrect after caregiver changes.

Source: [contact button](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/patient/medicines/MedicinesPage.tsx:49>).

## Further source-confirmed gaps requiring focused acceptance tests

These are separated from runtime reproductions to avoid claiming more coverage than was achieved.

| Priority | Gap | Evidence and next test |
|---|---|---|
| High | Integrated games bypass the legacy session-duration/fatigue safeguards | IntegratedGamePage does not pass sessionCapMinutes; integrated transport always emits fatigue_flags=[]; round backend forces fatigueFlagged=False. Verify long play, repeated struggles, early exits, pause/resume and clinician limits across both engines. |
| High | Reset PIN recovery can block login on a previously used device | storeOfflineSecrets decrypts the old verifier using the new PIN; failed decryption makes authStore clear even a successful online session. changeOfflinePin requires old PIN and has no product UI caller. Provide an explicit recovery path that preserves unsynced records; test a real reset with queued data. |
| Medium | Baseline save does not refresh the doctor query cache | OverviewTab mutation has no invalidation/cache update; quick navigation can repopulate older baseline data. Test save → leave → return → save another field without overwriting the first change. |
| Medium | “Ideal session minutes” is stored without updating the gameplay session cap | Baseline save updates max_difficulty_level only on PatientProfile. Decide whether ideal duration is advisory or enforced; label it and test accordingly. |
| Medium | Expired uncached signed media has no clear renewal path | Cached-first memory metadata may retain old signed URLs; unsuccessful media fetch hides the image. Test an uncached asset after expiry, with online renewal and understandable retry UI. |
| Medium | Deleted media retention needs a defined purge policy | Metadata tombstones do not identify/purge URL-hashed encrypted media blobs. Check asset deletion, consent revocation, caregiver reassignment and local retention expectations. |
| Medium | Local virtualenv is included in backend Docker context | backend/.dockerignore excludes .venv/ but not .venv-dda/; this workspace's .venv-dda is 609 MB. Exclude all local environments before release packaging. |
| Medium | Important release browser tests are absent from CI's real-backend job | CI executes offline-real and reports-real, but not release-real, which includes uploads and admin/role flows. Add those scenarios and the new invariants to release gates after fixes. |

Relevant sources: [integrated transport](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/games/engine/integratedTransport.ts:18>), [offline PIN storage](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/db/crypto.ts:63>), [patient login](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/auth/authStore.ts:138>), [baseline form](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/src/features/doctor/PatientTabs.tsx:102>), [Docker ignore](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/.dockerignore>), [CI](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/.github/workflows/ci.yml>).

## What passed, and what remains unproven

Role probes did not reveal cross-patient reads in the tested patient-scoped APIs: unrelated caregiver/doctor accounts received 404; anonymous calls received 401. Patient clinical/report access was restricted. Actual alerts were probed at /api/v1/alerts/?patient=…, not an invented patient subroute. These are read-access checks; full write permissions, doctor transfer during an active offline session and revocation races require additional acceptance scenarios.

PDF files were retrieved independently of the browser download mechanism. Tables, chart, footer pagination and emergency-card content were readable in inspected renders. Arbitrary very long text, multiple scripts/fonts, every role-specific note visibility combination and maximum data volume were not exhaustively rendered. The packaged PDF renderer also works, resolving the basic container-library concern.

Real Brave was used for the microphone attempt. Listening UI alone proves neither audio capture nor transcription. No verified spoken phrase/response was obtained; an enabled real microphone plus an actual utterance is still needed. The local assistant readiness response reported local/cloud assistant disabled. Browser-provider recognition, language quality, denied permissions, mobile voice behavior and offline speech support remain separate gates. Explicit English fallback labels for Telugu/Manipuri/Mizo and the native/clinical review notice mean full language support must not be advertised as verified.

The browser upload picker stalled and returned after the session had expired. No fresh upload was saved in that attempt; existing upload tests and source review are useful but do not replace a completed real-browser upload test. Use a fictional image to verify successful upload, wrong MIME, oversized input, multiple images, cancellation, forbidden cross-patient media access and S3 expiry.

A Brave visit to localhost initially displayed a different blank-app title; 127.0.0.1 loaded SMARANA correctly. The cause was not established. Include PWA upgrade/cache migration and origin consistency in staging tests; this observation is not sufficient to assert a service-worker defect.

## Production gates that cannot be certified from this checkout

No real target domain or completed production environment configuration was available. The production example is a template. Local Docker builds cannot certify the actual ingress, external services or operational policies.

Before release, verify on the intended staging deployment:

1. HTTPS certificate/redirect, HSTS and security headers on final HTML/API responses; backend isolation and trusted forwarded headers.
2. Complete secrets/config validation, DEBUG=false, host/CORS/CSRF allowlists, production database credentials, admin access and MFA policy.
3. SMTP delivery and failures using authorized test recipients; retries and alert-job scheduling. No messages were sent to other people in this audit.
4. Private S3 access, unauthorized access denial, signed-link expiry/refresh, storage CORS and encrypted offline media behavior.
5. Scheduled PostgreSQL and object-storage backups, a timed restore into an isolated environment, integrity checks and recovery ownership. No production backup or restore was performed.
6. Real mobile devices: Android/iOS speech capture, transcription in supported languages, audio playback, denied mic permissions and interruption recovery.
7. Genuine disconnect/reconnect: queued game/reminder writes, duplicate delivery, partial sync, deletion, consent changes, PIN resets and doctor/caregiver reassignment while offline.
8. All 21 games at supported levels: complete rounds, incorrect answers, hints, fatigue, early exit, resume and replay; compare both legacy and integrated engines.
9. Rate limits under actual ingress IP forwarding, Redis TLS/access, database certificate verification and admin-login abuse controls.
10. Monitoring for queue/job failures, SMTP errors, PDF failures, signed-media failures, backups, server exceptions and service health.

Production settings include useful safeguards (strong secret checks, explicit hosts, secure cookies, SSL redirect and HSTS), but their effective deployment behavior remains unverified. Postgres sslmode=require encrypts traffic without a full certificate/hostname verification policy; Redis TLS is not enforced merely by having a URL. Inspect these against the actual service configuration.

## Reproduce the new failing checks

Backend, from backend/:

```bash
POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55440 POSTGRES_USER=smarana POSTGRES_DB=smarana_local DJANGO_SETTINGS_MODULE=config.settings.test .venv-dda/bin/pytest -q audit_tests/test_deployment_audit.py
```

Frontend, from frontend/:

```bash
./node_modules/.bin/vitest run --config e2e/deployment.audit.config.ts --maxWorkers=2
```

These checks intentionally remain failing as defect evidence. They are outside the normal test-selection patterns; the audit frontend files are type-aware-lint compatible. No app-source fixes were mixed into this audit.

[Backend audit tests](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/backend/audit_tests/test_deployment_audit.py>), [frontend audit tests](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/frontend/e2e/deployment.audit.tsx>), [live API probe script](</home/harshithkashyap/Downloads/smarana-kit (1)/SMARANA/scripts/deep-audit-api.py>).
