# BACKLOG

Ordered list of every task card. Work top to bottom unless the mentor reorders. Mark done by changing `[ ]` to `[x]` (the `/finish-task` skill does this in PROGRESS.md; keep this file in sync weekly).

| Phase | Tasks | Exit demo |
|---|---|---|
| 0 — Foundation | 6 | see docs/06-roadmap.md |
| 1 — Auth, roles & assignments | 7 | see docs/06-roadmap.md |
| 2 — Patient core | 11 | see docs/06-roadmap.md |
| 3 — Games & DDA | 10 | see docs/06-roadmap.md |
| 4 — Caregiver portal | 7 | see docs/06-roadmap.md |
| 5 — Doctor portal | 7 | see docs/06-roadmap.md |
| 6 — Admin (Django Admin) | 5 | see docs/06-roadmap.md |
| 7 — Offline & PWA | 7 | see docs/06-roadmap.md |
| 8 — Voice | 5 | see docs/06-roadmap.md |
| 9 — Regional content | 5 | see docs/06-roadmap.md |
| 10 — Reports, polish, remaining games | 13 | see docs/06-roadmap.md |

## Phase 0 — Foundation

- [ ] **T001** Repository skeleton and Docker Compose — M
- [ ] **T002** Django project skeleton with custom User and settings split — M (after T001)
- [ ] **T003** React + TypeScript + Vite + PWA skeleton with design tokens — M (after T001)
- [ ] **T004** CI pipeline (GitHub Actions) mirroring local verification — S (after T002, T003)
- [ ] **T005** OpenAPI schema generation and typed frontend client — S (after T002, T003)
- [ ] **T006** Test scaffolding: factories, care_scenario fixture, seed command — M (after T002)

## Phase 1 — Auth, roles & assignments

- [ ] **T010** JWT auth: professional login, refresh, logout, /auth/me — M (after T006)
- [ ] **T011** Patient PIN login with lockout and caregiver notification — M (after T010)
- [ ] **T012** Assignment models, scoping selector, and patient list/detail endpoints — M (after T010)
- [ ] **T013** Frontend auth: landing page, professional login, role routing, auth store — L (after T003, T005, T010)
- [ ] **T014** Patient PIN screen and gentle idle prompt — M (after T011, T013)
- [ ] **T015** Language switching (en/as/bn) with persistence and Bengali-script font — S (after T013)
- [ ] **T016** Backend preferences and audit app — S (after T010)

## Phase 2 — Patient core

- [ ] **T020** PatientProfile full fields, FamilyMember, ConsentSettings + caregiver/doctor edit endpoints — L (after T012, T016)
- [ ] **T021** Patient Home: tiles, bottom nav, and Daily Orientation Card (online) — L (after T014, T020)
- [ ] **T022** My Progress summary (encouraging, no clinical numbers) — S (after T021)
- [ ] **T023** Routine items, reminders generation, and patient responses (backend) — L (after T020)
- [ ] **T023b** Calm Time: guided breathing with slow voice — S (after T021)
- [ ] **T024** Today's Routine and Medicines pages (patient, online) — M (after T023, T021)
- [ ] **T025** Memories: backend models + patient memory page with Read-to-me — M (after T020, T023b)
- [ ] **T026** Memory quiz question generation (backend) — M (after T025)
- [ ] **T027** Memory quiz patient UI with supportive feedback — M (after T026, T024)
- [ ] **T028** My People page with one-tap call and confirmation — S (after T020, T021)
- [ ] **T029** Emergency SOS: patient long-press + backend event + caregiver in-app notification — M (after T011, T021)

## Phase 3 — Games & DDA

- [x] **T030** Game engine: session lifecycle, seeded RNG, metrics, persistence, resume — L (after T021, T023)
- [x] **T031** DDA pure function in Python + shared test vectors — M (after T030)
- [x] **T032** DDA TypeScript port + client-side end-of-session flow + supportive messages — M (after T031)
- [x] **T033** 'Looking for a challenge today?' toggle and level caps in the engine — S (after T032)
- [x] **T034** Game 1 & 2: Memory Match and Sequence Recall — L (after T032)
- [ ] **T035** Fatigue detection and Break Prompt in the engine — M (after T032)
- [ ] **T036** Resume-where-you-left-off for games and quiz — S (after T030, T027)
- [ ] **T037** Game 3 & 4: Object Sorting and Tea Garden Attention — L (after T034)
- [ ] **T038** Game 5 & 6: Bihu Rhythm Recall and Daily Life Sequencing — L (after T034)
- [ ] **T039** Games list page, favourites stub, and Phase 3 exit demo script — S (after T034, T037, T038, T035, T036)

## Phase 4 — Caregiver portal

- [ ] **T040** Caregiver portal shell: patient switcher, Today tab with routine + medicine adherence — L (after T013, T023, T024)
- [ ] **T041** Routine editor backend hardening: doctor-source protection and change history — S (after T023)
- [ ] **T042** Routine editor UI (caregiver) — M (after T040, T041)
- [ ] **T043** Memory upload (caregiver) with client-side image compression and people tagging — M (after T025, T040)
- [ ] **T044** Alert rules engine (Celery) with three MVP rules and explanations — M (after T011, T023, T030)
- [ ] **T045** Alerts tab (caregiver) + email delivery for SOS and high-severity alerts — M (after T044, T029, T040)
- [ ] **T046** Caregiver notes and Progress tab with session table and simple trend charts — M (after T040, T031)

## Phase 5 — Doctor portal

- [ ] **T050** Doctor dashboard endpoint and patient cards — M (after T012, T044)
- [ ] **T051** Cognitive metrics summary endpoint (7/30/90d) + doctor Metrics tab — L (after T031, T050)
- [ ] **T052** Medications: doctor create/update → routine items + caregiver flag — M (after T023, T050)
- [ ] **T053** DDA overrides: set level, lock/unlock, cap + difficulty history UI — M (after T031, T050)
- [ ] **T054** Exercise assignments → patient routine, completion tracking, reviews due — M (after T052, T053)
- [ ] **T055** Clinical notes with visibility + baseline record — M (after T046, T050)
- [ ] **T056** Phase 5 exit demo script and doctor session security (timeouts, password rules) — S (after T050, T051, T052, T053, T054, T055)

## Phase 6 — Admin (Django Admin)

- [x] **T060** Django Admin: approval workflow for doctors and caregivers — M (after T010, T016)
- [x] **T061** Django Admin: doctor/caregiver ↔ patient assignments with reason and history; instant access revocation — M (after T012, T060)
- [x] **T062** Django Admin: dashboard counts, game catalog management, security actions — M (after T060, T030)
- [x] **T063** Audit history admin view + export log entries — S (after T016, T060)
- [ ] **T064** Admin MFA (django-otp) and Phase 6 demo script — S (after T060)

## Phase 7 — Offline & PWA

- [x] **T070** Dexie schema, outbox, and repo migration for all patient features — L (after T024, T027, T030)
- [x] **T071** Sync endpoints (push/pull) with idempotency and DDA reconciliation + client sync engine — L (after T070, T031)
- [x] **T072** Service worker precache/runtime caching and offline orientation/home — M (after T071)
- [x] **T073** Offline PIN unlock and encrypted refresh token — M (after T071, T014)
- [x] **T074** Offline UX copy audit and caregiver sync status — S (after T071, T040)
- [x] **T075** Device-offline alert rule and sync error alerts — S (after T044, T071)
- [x] **T076** Playwright offline round-trip test + CI — M (after T072, T073, T074)

## Phase 8 — Voice

- [x] **T080** Speech wrappers (STT/TTS) with fakes and mic indicator — M (after T023b)
- [x] **T081** Intent router (rule-based) with shared utterance cases — M (after T080)
- [x] **T082** Wire intents to actions: navigation, medicines summary, next activity, read-this, slow speech toggle — M (after T081)
- [x] **T083** Language lock and voice settings — S (after T082, T015)
- [x] **T084** Optional LLM fallback endpoint behind a flag — S (after T081)

## Phase 9 — Regional content

- [x] **T090** Region, Language, ContentItem models + Django Admin curation with review workflow — M (after T060)
- [x] **T091** Content pack endpoint (versioned, cacheable) and client loader — M (after T090, T072)
- [x] **T092** Games consume regional packs; Familiar Place Recall uses known_places — M (after T091, T038)
- [x] **T093** Patient setup: region, language, cultural background selection (caregiver + first-run) — S (after T091, T020)
- [x] **T094** Seed two complete state packs (Assam, Meghalaya) and scaffolds for six — M (after T090)

## Phase 10 — Reports, polish, remaining games

- [x] **T100** Games 8 & 9: Who Is This (family) and Word Pairs — L (after T092)
- [x] **T101** Games 10 & 11: Spot the Change and Festival Match — L (after T092)
- [x] **T102** Game 12: Sound Match — M (after T092)
- [x] **T103** Favourites and suggested activities — S (after T100)
- [x] **T104** Walkthrough mode and Replay Instructions — M (after T082)
- [x] **T105** Guest practice mode — S (after T032)
- [x] **T106** Sleep and mood logs (patient + caregiver) and doctor visibility by consent — M (after T070, T046)
- [x] **T107** 'I feel confused / I need a break' mode — M (after T023b, T104)
- [x] **T108** Caregiver Timeline tab, routine conflict detection, Care Team tab — M (after T046, T042)
- [x] **T109** Remaining alert rules and notification preferences — M (after T044, T106)
- [x] **T110** PDF clinical report and caregiver report (WeasyPrint) with disclaimer + export audit — L (after T051, T055, T044)
- [x] **T111** Printable emergency card and print styles — S (after T110)
- [x] **T112** Final accessibility and copy pass, walkthrough of all demo scripts — M (after T104, T107, T110)
