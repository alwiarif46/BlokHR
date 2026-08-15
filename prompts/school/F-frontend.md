# F — Frontend modules (school shell)

**Read before every prompt in this file:** `prompts/school/00-CONVENTIONS.md`, `docs/INSTRUCTIONS.md` (module pattern + critical rules), `frontend/shared/api.js`, `frontend/shared/router.js`, `frontend/modules/attendance/attendance.js` (as the pattern reference).

Frontend rules recap (violations = rejected diff): zero localStorage outside `shared/session.js`; all HTTP via `shared/api.js`; all toasts via `shared/toast.js`; CSS custom properties only, 4 themes; module pattern `renderXxxPage(container)` → `xxxLoadData()` → `xxxRenderStats()` → `xxxRender()` → CRUD → `xxxCloseModal()`; self-contained HTML template; feature-flag gated. School modules call school services through the same `api` client with a base-path prefix per service (add `api.school(serviceName)` helper in prompt F-01 — DO NOT create per-module fetch wrappers).

**Approved storage exception (one, exactly one):** the roll-call offline queue in F-03 uses **IndexedDB**, database `blokhr_rollcall_{tenantId}`, sole object store `pending_marks`. Nothing else in the frontend may use IndexedDB, and localStorage remains forbidden everywhere outside `shared/session.js`. Preferences still go to the server via `shared/prefs.js` — this exception is for the unsent attendance queue only.

---
## PROMPT F-01 — School API helper + module registration

In `frontend/shared/api.js` add `api.school(service, tenantScoped=true)` returning a scoped client `{get, post, put, patch, del}` that prefixes `/svc/{service}/api/{domain}/{tenantId}` (the gateway/dev proxy maps `/svc/school-attendance` → its port; add the mapping table as an exported const `SCHOOL_SERVICES` with the 9 service names and dev ports 3011–3019). Reuse the existing auth-header and 401-redirect logic — do not duplicate it.

In `frontend/shared/router.js` register a `school` module group (visible only when feature flag `school_vertical` is on) with placeholder routes for: students, roll_call, attendance_admin, academics, hpc, school_settings.

Tests (follow existing shared test pattern if present; else create `frontend/tests/school-api.test.js` matching `docs/blokhr-frontend-architecture.md` §13 conventions): prefixing, tenant scoping, 401 passthrough, flag-gated visibility.

---
## PROMPT F-02 — Students module

Create `frontend/modules/school_students/` (css/html/js) following the attendance module pattern exactly.

Features: paginated searchable student list (status/class/section filters); create/edit modal with client-side validation mirroring the server rules (names, dob, enums, aadhaar_last4 only — show helper text "full Aadhaar is never stored"); enrolment action; guardian panel per student (link/unlink, primary toggle, max-4 message); consent panel showing per-kind state chips (granted/refused/not_sought/withdrawn) with transition buttons that require guardian + method + artefact upload ref for granted — and a visible note "Refusal does not block any service". Stats bar: total, active, by-class counts, consent summary.

CSS: variables only. Test file `frontend/tests/integration/school_students.test.js`: render, load (mock api), create validation, guardian max-4, consent transition UI states, error toasts.

---
## PROMPT F-03 — Roll call module (offline-first, durable queue)

Create `frontend/modules/school_roll_call/`. This is the flagship teacher surface — implement the spec exactly, nothing extra.

**Marking UI**
- Photo grid 4×5 tiles (photo_ref or initials), tap cycles Present→Absent→Late (Late opens minutes stepper defaulting 10); **all tiles default Present on open**; live counter chip "38 present · 2 absent"; single always-visible Submit; bulk bar: mark-rest-present, multi-select.
- Absent tap opens inline reason-code picker (loaded from reason-codes endpoint, cached in memory for the session).
- Period picker from timetable instances for the logged-in teacher (today, status scheduled/held); marking a period sets instance → held via timetable PATCH.
- Seating-chart alternative view: same data, CSS grid by stored seat order (drag to reorder, order saved via member prefs endpoint `PUT /api/profiles/me/prefs` — NOT localStorage, NOT IndexedDB).

**Durable offline queue — `school_roll_call/queue.js` (IndexedDB, per the approved exception above)**
- Database `blokhr_rollcall_{tenantId}`, version 1, single object store `pending_marks`, keyPath `idempotency_key`. Raw `indexedDB` API wrapped in small promise helpers — **no new npm dependency**.
- Record shape: `{idempotency_key (client uuid), tenant_id, context, marks, marked_by, created_at, attempts, last_error}`. Only unsent submissions live here; on server 2xx the record is deleted. Nothing else is ever stored (no rosters, no photos, no prefs — enforce by module review, note in code comment).
- Submit flow: write record → optimistic "Saved ✓" → flush attempt. Flush walks records oldest-first via `shared/api.js`; 2xx (including the P2-03 idempotent replay) deletes the record; failure increments `attempts`, sets `last_error`, exponential backoff (30s·2^attempts, cap 10 min). A failed flush never blocks marking the next period.
- **Startup recovery:** module init opens the store and resumes flushing pending records from a previous session/reload; "pending sync: N periods" chip visible whenever count > 0, tap shows per-record status incl. last_error.
- Multi-tab safety: flush guarded by a `navigator.locks.request('rollcall-flush-{tenantId}', …)` exclusive lock so two tabs never double-flush (server idempotency remains the backstop — comment referencing P2-03).
- Hygiene: on successful full flush, delete DB if empty is NOT required — but records older than 7 days are surfaced in the chip as "stale — review before sync" and require an explicit user tap to flush (guards against submitting week-old marks silently). On logout: attempt one final flush; if records remain, warn "N unsent periods will sync on next login" — do NOT delete them.

**Test file** (mock IndexedDB with a minimal in-memory shim in the test file itself — no new dependency): default-present; cycle states; late minutes required; reason picker; counter math; idempotency key stability across retries; queue write→flush→delete on 2xx; retry/backoff on failure; startup recovery resumes pending; stale-record gate; logout warning path; seating order persistence call; nothing but pending marks ever written to the store.

---
## PROMPT F-04 — Attendance admin + registers

Create `frontend/modules/school_attendance_admin/`.

Tabs (single module, internal tab switch like dashboard): **Registers** (date+section register grid incl. unmarked; edit within window; regularize dialog after — surfaces the 409 correctly); **Unexplained** (worklist from `/unexplained?date=`, ack + call-log note, link to reported-absence detail incl. certificate ref); **Settings** (granularity/day-derivation/thresholds form → PUT settings, with plain-language explanation strings per option); **Eligibility** (75% report: student list with pct, projection, eligible flag, threshold input); **Nudge** (config form, run button, treatment-vs-holdout report card — render the effect numbers plainly, no chart library).

Stats bar per tab. Test file: each tab render, window-closed 409 → regularize path, settings validation, eligibility rendering, nudge report numbers.

---
## PROMPT F-05 — Academics module

Create `frontend/modules/school_academics/`.

Tabs: **Curriculum** (course list → tree view units/topics, inline reorder, outcome tag chips with field badge A/AS/R and depth I/R/M; the assessment-requires-activity 400 surfaced inline); **Coverage** (per course-section: unit progress bars, the outcome in-use grid — outcomes × {activity, assessment} filled/grey cells, hover shows units — plain CSS grid, no chart lib); **Variance** (per course-section: planned vs actual weekly cumulative as a CSS-rendered bar pair per week, slippage weeks, lost-period attribution list, projected completion date with target-date comparison highlighted when past target); **Lessons** (teacher week list, draft editor with the 4 body sections, submit-week button, reviewer queue with approve/changes+note, provenance badge).

Variance tab composes data client-side: fetch instances from timetable service + call academics variance endpoint with them (the documented BFF-in-frontend composition; add a code comment referencing P3-05).

Test file: tree render+reorder, tag rules, coverage grid cells, variance composition call chain, lesson review note-required, provenance badge.

---
## PROMPT F-06 — HPC module

Create `frontend/modules/school_hpc/`.

- **Capture** view: class list → student → competency grid by stage; middle-stage input = 18-statement checklist (6×3 abilities) with live derived level chip (0–2 B, 3–4 P, 5–6 A — mirror server rule, server remains authority); other stages = B/P/A segmented control; observational note dialog with the two structured fields (challenge / how resolved); source selector locked to `teacher` in this view.
- **Peer capture** view: rapid mode — one competency, iterate students, two peer entries each, large touch targets, auto-advance (the 30-second interaction). Bulk-submits via the bulk endpoint in batches ≤200.
- **Four-voice** student view: per competency, latest level chips per source (self/peer/teacher/parent), input counts, evidence refs.
- **Coverage** dashboard: per competency % with teacher+self input; secondary matrix view (competency × grade B/P/A cells).

Test file: derived-level mirror both boundaries, peer batch cap, four-voice grouping render, coverage percentages, matrix cells.
