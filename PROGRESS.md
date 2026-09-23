# PROGRESS

Update this file at the end of every task (`/finish-task` does it). Keep it short. This is the memory Claude Code reads at the start of each session.

## Current phase
Phase 10 — Reports and polish

## In flight
- None. T060–T112 deep review is complete; mentor acceptance and publication readiness remain.

## Done
| Task | Date | Commit | Notes |
|---|---|---|---|
| T001 | 2026-09-14 | `feat(foundation): T001 repository skeleton and Docker Compose` | Compose development stack, Make targets, and minimal backend/frontend bootstraps. |
| T002 | 2026-09-14 | `feat(backend): T002 Django foundation and custom user` | Split environment settings, shared backend primitives, custom role-based user, admin registration, and database-aware health endpoint. |
| T003 | 2026-09-14 | `feat(frontend): T003 React PWA foundation and design tokens` | React PWA shell, accessible UI primitives, theme scaling, aligned locale catalogs, health status, and frontend test tooling. |
| T004 | 2026-09-14 | `ci: T004 mirror local verification in GitHub Actions` | GitHub Actions runs cached backend and frontend verification with PostgreSQL and Redis services on pushes and pull requests. |
| T005 | 2026-09-14 | `feat(api): T005 generate OpenAPI client` | Public OpenAPI schema, deterministic Orval client generation, bearer/refresh mutator, and generated health client integration. |
| T006 | 2026-09-14 | `feat(testing): T006 add reusable care scenario and demo seed` | Minimal patient assignment models, reusable role factories and fixtures, frozen time, and idempotent demo accounts. |
| T010 | 2026-09-14 | `feat(auth): T010 add professional JWT authentication` | Approval-gated professional login, rotating device-bound refresh tokens, logout, self context, preferences, and generated API contracts. |
| T011 | 2026-09-14 | `feat(auth): T011 add patient PIN login and lockout alerts` | Argon2 patient PIN login, 30-day device sessions, timed lockout with deduplicated caregiver alerts, and primary-caregiver PIN reset. |
| T012 | 2026-09-14 | `feat(patients): T012 add assignment-scoped patient reads` | Completed assignment history fields, role-scoped patient selectors, and read-only patient list/detail API contracts. |
| T013 | 2026-09-14 | `test(frontend): complete T013 browser login coverage` | Landing page, professional login, role routing, auth store, professional idle logout, and Playwright role-guard coverage. |
| T014 | 2026-09-14 | `feat(frontend): T014 add patient PIN login and idle prompt` | Remembered patient login ID, large keypad, gentle lock copy, patient shell, and 30-minute presence prompt. |
| T015 | 2026-09-14 | `feat(phase-1): complete T015 language preferences and T016 audit trail` | Native-language tiles, persisted en/as/bn selection, Bengali font bundle, and synchronized account preference support. |
| T016 | 2026-09-14 | `feat(phase-1): complete T015 language preferences and T016 audit trail` | Append-only audit app covers login success/failure and preference updates, with read-only admin visibility. |
| T020 | 2026-09-14 | `feat(patients): T020 add life-history, family, and consent APIs` | Full patient profile fields, role-scoped updates, family CRUD with signed media, consent controls, and audited changes. |
| T021 | 2026-09-14 | `feat(patient-core): complete T021-T024 daily support experience` | Patient home, orientation card, fixed navigation, read-through patient repository, and accessible tile layout. |
| T022 | 2026-09-14 | `feat(patient-core): complete T021-T024 daily support experience` | Encouraging progress summary API and cards with non-clinical completion, points, star streaks, and upcoming activities. |
| T023 | 2026-09-14 | `feat(patient-core): complete T021-T024 daily support experience` | Deterministic routine reminders, responses, medicines, daily materialisation, missed-reminder processing, and permission coverage. |
| T024 | 2026-09-14 | `feat(patient-core): complete T021-T024 daily support experience` | Patient routine and medicine screens with confirmation, snooze, help/call, undo feedback, and local-first response persistence. |
| T025 | 2026-09-14 | `feat(patient-core): complete T025-T029 memories and emergency support` | Consent-scoped memory APIs, offline cache, photo stories, tagged people, and read-aloud detail. |
| T026 | 2026-09-14 | `feat(patient-core): complete T025-T029 memories and emergency support` | Least-recent quiz questions across who/when/where/occasion, five-question repeat guard, family fallback, and idempotent attempts. |
| T027 | 2026-09-14 | `feat(patient-core): complete T025-T029 memories and emergency support` | Large-option memory quiz with supportive feedback, local-first attempts, and repeated-struggle break prompt. |
| T028 | 2026-09-14 | `feat(patient-core): complete T025-T029 memories and emergency support` | Emergency-first family cards with spoken call confirmation and one-tap telephone links. |
| T029 | 2026-09-14 | `feat(patient-core): complete T025-T029 memories and emergency support` | Persistent long-press SOS, idempotent events, in-app caregiver recipients, scoped acknowledgement, and emergency call actions. |
| T030 | 2026-09-14 | `feat(games): complete T030-T034 adaptive games foundation` | Seeded, resumable local-first session engine; metrics, persistence, backend catalog and session contracts. |
| T031 | 2026-09-14 | `feat(games): complete T030-T034 adaptive games foundation` | Pure Python DDA with 20 shared vectors, persisted difficulty state/change history, and 100% branch coverage. |
| T032 | 2026-09-14 | `feat(games): complete T030-T034 adaptive games foundation` | Matching TypeScript DDA, supportive end flow, offline prediction, and authoritative server reconciliation. |
| T033 | 2026-09-14 | `feat(games): complete T030-T034 adaptive games foundation` | Day-scoped challenge toggle raises only the played level while respecting game and doctor caps. |
| T034 | 2026-09-14 | `feat(games): complete T030-T034 adaptive games foundation` | Playable Memory Match and Sequence Recall with deterministic level knobs, hints, and default content assets. |
| T035 | 2026-09-14 | `feat(games): complete T035-T036 fatigue and session resume` | Shared fatigue detector, gentle break flow, session flags, configured play cap, quiz reuse, and DDA fatigue holds. |
| T036 | 2026-09-14 | `feat(games): complete T035-T036 fatigue and session resume` | Patient-scoped resume card restores the exact seeded round; start-over records a recoverable local abandonment. |
| T037 | 2026-09-14 | `feat(games): complete T037-T039 regional games and catalog` | Object Sorting supports tap-tap and drag placement, level-scaled categories/items, and explicit distractors; Tea Garden Attention adds density and a soft timed round at L4+. |
| T038 | 2026-09-14 | `feat(games): complete T037-T039 regional games and catalog` | Bihu Rhythm Recall uses testable audio with audio-only high levels; Daily Life Sequencing provides level-scaled ordering and partial scoring. |
| T039 | 2026-09-14 | `feat(games): complete T037-T039 regional games and catalog` | Six-game regional catalog, day-scoped challenge control, interrupted-game continuation, and Phase 3 mentor demo script. |
| T040 | 2026-09-14 | `feat(caregiver): complete T040-T042 portal and routine editor` | Assignment-scoped patient switcher, Today medicine statuses, response times, seven-day adherence, and device sync recency. |
| T041 | 2026-09-14 | `feat(caregiver): complete T040-T042 portal and routine editor` | Source ownership protection, before/after audit history, scoped history reads, and recoverable routine deletion. |
| T042 | 2026-09-14 | `feat(caregiver): complete T040-T042 portal and routine editor` | Schedule CRUD form with categories, day selection, validation, optimistic creation, and locked doctor items. |
| T043 | 2026-09-15 | `feat(caregiver): add memory upload and people tagging` | Scoped audited multipart creation, validated image uploads, quiz visibility, family tagging, client-side 1600px compression, and upload progress. |
| T044 | 2026-09-15 | `feat(alerts): add nightly caregiver alert rules` | Three boundary-tested rules, evidence refresh deduplication, 02:00 IST evaluation, scoped actions, assigned-doctor forwarding, and audited state changes. |
| T045 | 2026-09-15 | `feat(alerts): add caregiver alerts and urgent email delivery` | Polling caregiver alert groups, SOS banner, evidence links, audited acknowledgement/forwarding, and deduplicated high-severity caregiver email. |
| T046 | 2026-09-15 | `feat(caregiver): add progress trends and care-team notes` | Scoped session/change feeds, 7/30-day accuracy and response-time charts, explanations, disclaimer, and audited caregiver-feedback notes. |
| T050 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Assignment-scoped dashboard, attention flags, engagement status, patient cards, and seven-tab doctor detail shell. |
| T051 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Descriptive 7/30/90-day domain metrics, session table, trend charts, guest exclusion, and non-diagnosis boundary. |
| T052 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Audited doctor prescriptions synchronize per-dose routine items and create caregiver information alerts. |
| T053 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Reasoned level overrides, locks, unlocks and caps with history, audit records, and global-cap enforcement. |
| T054 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Exercise assignments materialize patient routine items, initialize difficulty, track weekly completion, and populate reviews due. |
| T055 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Structured visibility-scoped clinical notes, author-only updates, reply support, and doctor-entered baseline records. |
| T056 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Twelve-character password minimum, verified professional idle security, and Phase 5 mentor demo script. |
| T060 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Audited professional approval and soft deactivation actions with doctor verification status and hidden credential hashes. |
| T061 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Assignment-history inlines, end reasons, transfer action, actor attribution, audit trail, and immediate revocation through active scoping. |
| T062 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Live admin counts, catalog controls and regional scope, read-only patient difficulty, force logout, account lock, and PIN-reset actions. |
| T063 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Immutable searchable/filterable audit browser and audited export action. |
| T064 | 2026-09-15 | `feat(doctor): complete doctor portal and admin phases` | Admin portal uses the later password/CSRF/Admin-role release policy; historical django-otp artifacts remain, but the original TOTP-gating card is superseded. |
| T090–T094 | 2026-09-16 | `feat(regional): complete T090-T094 content packs` | Regional content catalogue/admin workflow, pack endpoint/cache, game integration, caregiver preferences, and regional seeds. |

| T070–T094 follow-up | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Offline sync/replay and account isolation, voice routing/settings, content import/admin hardening, regional demo media, real-backend offline regression and persistent local startup. |
| T100–T104 | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Five remaining game modules and catalogue seeds; validated scene variants and demo content; patient-scoped synced favourites and home suggestions; once-per-section walkthroughs and replay instructions. |
| T105 | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Patient and caregiver practice entry; stored guest sessions leave difficulty, analytics, charts, engagement and progress unchanged. |
| T106 | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Offline sleep/mood entry and sync; audited caregiver corrections; consent-gated doctor reads and latest-daily low_mood_3d rule. |
| T107 | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Persistent calming break overlay with familiar photo, paused game rendering/timers, dimmed visuals, reduced motion and slow speech; caregiver contact requires explicit confirmation. |
| T108 | 2026-09-16 | `feat(care): complete T100-T108 and offline content hardening` | Date-filtered caregiver timeline, routine conflict preflight/confirmation, and active care-team call/email contacts. |

| T109 | 2026-09-16 | `feat(care): complete T109-T112 alerts reports and accessibility` | Boundary-tested response-time/engagement rules, audited channel preferences, caregiver check-ins and idempotent offline patient replies. |
| T110 | 2026-09-16 | `feat(care): complete T109-T112 alerts reports and accessibility` | Scoped clinical/caregiver PDF reports with domain charts, shared-note filtering, descriptive disclaimer and export audit. |
| T111 | 2026-09-16 | `feat(care): complete T109-T112 alerts reports and accessibility` | Emergency PDF with current medications, baseline allergies and contacts; caregiver print styles. |
| T112 | 2026-09-16 | `feat(care): complete T109-T112 alerts reports and accessibility` | 360px / 1.6 font / both-theme axe sweep across all patient routes and twelve games; keyboard dialogs and demo replays. |

T105–T108 verification: backend Ruff and 137 PostgreSQL tests passed; migrations clean. Frontend lint, typecheck and 189 tests passed; locale and patient-copy checks passed; production PWA build passed. Existing bundler chunk warnings remain. All completed work through T108 is recorded in the implementation commit above.

T109–T112 verification: backend Ruff and 146 PostgreSQL tests passed; migrations clean. Frontend lint, typecheck and 193 tests passed; 272 locale keys and patient-copy checks passed; production PWA build passed. Browser checks cover both-theme patient accessibility, role guards, mocked and real offline replay, check-in delivery/reply, PDF downloads in both portals, and caregiver print visibility. PDF extraction and visual rendering confirmed readable report pages and a one-page emergency card for the representative fixture. Review evidence: `docs/reviews/T109-T112.md`.

T112 fixes found during the screen/demo sweep:
- Walkthrough dismissal now closes immediately; dialogs trap keyboard focus, close with Escape and restore focus.
- Keyboard/screen-reader SOS uses explicit confirmation; pointer long-press remains available.
- Primary buttons use matching theme text colors; patient game instructions and action hints use locale keys; family/place image alternatives are meaningful.
- Large-font narrow screens use one-column cards and two-column game boards; Tea Garden targets remain visible; fixed navigation and floating help buttons have physical 64px targets with reserved space.
- Offline status occupies its own header row, keeping Back/Talk usable; break text fits the small screen.
- Patient orientation reads include the metadata store in the transaction, preserving cached orientation.
- Caregiver patient pagination is normalized across pages, fixing the real portal's false empty state. Role-guard tests now use the current portal headings and realistic API fixtures.
- Phase 3 demo instructions now describe the actual three-session / response-time threshold; phase 3/5/6 outcomes are replayed by existing domain suites and new demo tests, including assignment revocation and TOTP enforcement.

## Assumptions made (review with mentor)
- T109 compares adjacent seven-day windows: response time needs three completed non-guest sessions per game in each window and a 30% increase; engagement needs at least four prior sessions and a fall of at least half. Email retains urgent-only delivery.
- T106 uses the existing `share_mood_with_doctor` consent flag for both sleep and mood; there is no separate sleep-sharing flag in the specified data model.
- PostgreSQL and Redis are internal-only Compose services to avoid conflicting with host development databases; application and MinIO ports remain exposed.
- Assamese and Bengali catalogs mirror the English keys with `TODO:` values until translated content is supplied.
- T012 returns nullable patient-card age and language until T020 adds date of birth and the later preferences/content work establishes the persisted language source.
- Patient region remains a stable state code in the existing patient profile while the content app owns authoritative region metadata.
- SOS uses one open patient alert whose evidence lists every active caregiver recipient; each emergency event remains separately idempotent and auditable.

## Known issues / tech debt
- Strict backend mypy is not clean: the repository lacks Django/DRF typing stubs and contains existing untyped endpoint/service code. Required task verification passes; typing cleanup remains separate.
- Very large medication/contact records can expand an emergency card beyond one page; representative records fit one readable page without truncating essentials.
- WeasyPrint currently warns about its legacy dictionary URL-fetcher response; generated embedded charts and PDFs pass verification.
- Pin container and language dependency versions with lock files as the backend/frontend toolchains are completed in later foundation tasks.
- React Router remains on the project-mandated v6 line; npm reports two moderate advisories whose available fix upgrades to v7, so migration should be handled as a separate compatibility task.
- Replace the placeholder SVG PWA artwork with final install icons before release.
- `renderWithProviders` currently accepts a generic repository map; tighten it to concrete repository interfaces as offline repositories are introduced.
- T014's minimal Dexie `meta` store now also persists the language selection. IndexedDB is deliberately treated as optional during SSR and unit tests.
- The local database may retain the removed pre-commit T021 prototype reminder table; it is unreferenced and fresh installations do not create it.

## Next up
- All Phase 10 cards through T112 are complete. Mentor acceptance and publication readiness are next; older backlog entries remain as recorded before this task.
- Run the local website with `make local`. Authentic regional content and native-language editorial review remain publication requirements.

## T113 — generated game integration repair (2026-09-17)

Preserved the existing unfinished integration and unrelated voice work. The patient
library now includes all supplied games and domain-balanced daily suggestions.
Added authenticated, idempotent round checkpoints; connected next-round decisions
to the existing conservative DDA; kept final sessions on encrypted Dexie/outbox
and existing Django sync. Fixed Personal Memory imports, actual photo fields,
consent/visibility, place-only modes, root item translations, timer cleanup,
serialized exit/completion and interrupted-checkpoint recovery. Added supplied
logic tests, 60 level/launch/exit cases, representative complete-session flows,
transport and PostgreSQL API/fallback tests, and reusable caregiver summaries.

See docs/game-integration.md and docs/dda-notebook-review.md for accurate evidence
and remaining manual/model validation. The notebook's RF is not enabled: no
trained artifact was supplied, and its feature/export contract has critical
inconsistencies. A corrected optional offline export/runtime boundary is provided;
missing/incompatible model dependencies/artifacts hold difficulty. No claim of
validated RF inference or clinical benefit is made.

## T060–T112 deep review (2026-09-23)

Reviewed 35 task cards across T060–T064, T070–T076, T080–T084, T090–T094, and T100–T112. No cards exist for T065–T069, T077–T079, or T085–T089. The implementation is ready for mentor acceptance on synthetic data. Review evidence: [docs/reviews/T060-T112.md](docs/reviews/T060-T112.md).

Verification: Ruff, CI-scoped strict mypy (248 files), migration check, 258 PostgreSQL tests plus 1 skip, 800 frontend tests, 13 backend deployment-audit tests, 6 frontend deployment-audit tests, frontend lint/typecheck, locale/review-provenance and patient-copy checks, and production PWA build passed. Remaining release gates are native-language/content approval, real S3/SMTP/mobile speech/HTTPS staging, backups/restore, and privacy/security review.
