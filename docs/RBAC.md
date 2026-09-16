# School RBAC

## The model

**Principals:** `staff` (monolith members: employees, teachers, office, admins) · `guardian` (P9, done) · `internal` (service→service, `X-Blok-Internal`). **No student principal — out of scope; any prompt inventing one is rejected.**

**Staff roles** — stored on `directory.members.role`, formalized enum: `employee | manager | hr | teacher | office | school_admin | admin | parent`. Assigned by **login email** (directory lookup on staff introspect / `/whoami`). `admin` additionally derives from the monolith admins list (belt-and-braces, matches shell.html today). `manager`/`hr` remain derived in HR-land from managerOf/hrOf (monolith behaviour unchanged).

**`parent` role (L6 parent gate)** — members whose email maps to `role=parent` only see the **Parent Portal** shell module (`parent_hub`). They do **not** get staff school APIs (L4 policies never list `parent`). Family data remains on the dedicated `/guardian` guardian principal; Parent Portal deep-links there. Do not conflate with staff **Parents & Guardians** console (`school_surveys`, `school_admin` only).

**Six gating layers** (each check names its layer in code comments):
- L1 entitlements — tenant owns the module (`canUseModule`)
- L2 feature flags — tenant enabled; `admin_only` flags
- L3 principal gate — gateway: guardian vs staff, introspected, never client-asserted
- L4 role policy — per-service route policy table, driven ONLY by gateway-set `X-Blok-*` + internal secret
- L5 record scope — teacher → own allocated sections; guardian → linked students; employee → self
- L6 UI gating — sidebar/buttons (`data-school-roles` / parent-only gate); cosmetic only, never the security boundary

## Access matrix (canonical — policy tables in P12-03/04 implement exactly this)

| Capability | guardian | parent (staff email) | teacher | office | school_admin | admin |
|---|---|---|---|---|---|---|
| Own children: attendance, published report cards, homework, fees ledger, transport events, threads, surveys, reported absence | ✅ (via /guardian only) | ✅ via Parent Portal → /guardian | — | — | — | — |
| Staff shell Parent Portal module only | — | ✅ | — | — | — | — |
| Parents & Guardians staff console | — | — | — | — | ✅ | ✅ |
| Roll call mark/edit (own sections), own timetable, cover respond, own staff check-in | — | ✅ | — | ✅ | ✅ |
| Lessons/delivery/homework/HPC teacher-inputs/marks **draft** — own sections only (L5) | — | ✅ | — | ✅ | ✅ |
| Students read (roster fields only — no consents, no aadhaar_last4, no financial) | — | ✅ own sections | ✅ | ✅ | ✅ |
| Students/guardians CRUD, enrolment, consent recording, capture bindings, imports | — | — | ✅ | ✅ | ✅ |
| Absence worklists (unexplained, reported, escalation), payment recording, transport manifests, library circulation | — | — | ✅ | ✅ | ✅ |
| Marks publish/moderate, report-card templates+generate, regularization approve, rollups, staff finalize, cover assign, nudge config/run | — | — | — | ✅ | ✅ |
| School Settings (all F07 tabs), syllabus pack install, fee structures, RTE claims, compliance exports, APAAR readiness, DSR | — | — | — | ✅ | ✅ |
| HR settings, feature flags, directory member management, entitlements | — | — | — | — | ✅ |
| Employee self-service (own attendance/leaves/regularizations/timesheets/profile/prefs) | — | ✅ (as staff) | ✅ | ✅ | ✅ — existing monolith enforcement, untouched |

## Deltas (later prompts)

### P13-01 — Daily diary

| Principal / role | Diary capability |
|---|---|
| teacher | Write/list own sections only (L5 `teacher_section`); today/yesterday dates; author edit within 24h |
| office | Write/list any section; cannot back-date beyond yesterday; no DELETE |
| school_admin / admin | Full write/list/delete; back-date; edit after 24h window |
| guardian | Read class-wide + child-specific entries for children in `X-Blok-Students`; acknowledge (idempotent) |

`guardians_total` on staff GET is always `null` in school-engagement — BFF/frontend composes counts from identity.

### Campus Academic Consoles — Timetable, Homework, Circulars

| Principal / role | Capability |
|---|---|
| office / school_admin / admin | Timetable **Classes / Grid / Cover** (flag `school_timetable`) |
| teacher / school_admin / admin | Academics **Homework** tab — assignments create/grade/return (own sections L5) |
| office / school_admin / admin | **Circulars** compose + fan-out (flag `school_circulars`; engagement `POST /circulars`) |
| teacher | No circulars write; no timetable Classes/Grid/Cover write in MVP |

Diary digest (engagement ingest): student-specific entries resolve guardians via identity `listGuardiansForStudent`; class-wide via `listGuardiansForSection`; template key `general`.
