# P2 — school-attendance

---
## PROMPT P2-00 — Rename the thin capture roll-call service (MUST run before P2-01)

The folder `services/school-attendance/` is already occupied by the thin capture-accelerator package (`@blokhr/school-attendance`, migration `001_school_attendance.sql` with its own classes/students/periods/marks tables). P2-01 scaffolds a new domain service into that same path — the collision must be resolved first.

Read `prompts/school/RECONCILIATION.md` (naming-collision section), `services/school-attendance/package.json`, `services/school-attendance/src/index.ts`.

1. Rename the folder `services/school-attendance/` → `services/capture-rollcall/`. Update its `package.json` name to `@blokhr/capture-rollcall`. Rename exported factory/types from `SchoolAttendance*` to `CaptureRollcall*` (keep old names as deprecated re-export aliases in `src/index.ts` so consumers compile). Env var `SCHOOL_ATTENDANCE_DB_PATH` → `CAPTURE_ROLLCALL_DB_PATH` (read the old var as fallback with a deprecation log line).
2. Search the whole repo (`backend/`, `apps/`, `services/`, `frontend/`) for `@blokhr/school-attendance`, `school-attendance`, and `SCHOOL_ATTENDANCE_DB_PATH`. Update every consumer (likely: `apps/blokhr-capture`, `services/capture`, `frontend/modules/school_register`, any dev scripts / package.json file: deps). List every file you changed in the final message.
3. Do NOT change any table names, route paths (`/api/school-attendance` stays as-is for existing consumers), or behaviour — this is a rename, not a refactor.

DoD: `npx vitest run` + `npx tsc --noEmit` green in `services/capture-rollcall` AND in every consumer package you touched; repo-wide search for `services/school-attendance` returns only prompt/doc files; `services/school-attendance/` no longer exists.

---
## PROMPT P2-01 — Scaffold school-attendance

Read `prompts/school/00-CONVENTIONS.md` + reference files. Copy `events.ts` pattern from school-identity (do not import).

**Precondition: P2-00 merged — `services/school-attendance/` must not exist. If it does, stop and run P2-00.**

Create `services/school-attendance/` per skeleton: `@blokhr/school-attendance`, env `SCHOOL_ATTENDANCE_DB_PATH`, port 3013. `migrations/001_codes.sql`:
- `reason_codes`: id, tenant_id, code, label, bucket (`authorised|unauthorised|medical|school_activity`) NOT NULL, is_active INTEGER DEFAULT 1, sort INTEGER
- Seed per tenant lazily in service code on first read: `SICK/medical`, `FAMILY/authorised`, `MEDICAL_APPT/medical`, `SCHOOL_EVENT/school_activity`, `UNEXPLAINED/unauthorised`.

Routes: health; `GET/POST/PATCH /api/attendance/:tenantId/reason-codes`. Rule: bucket is mandatory and immutable after creation (PATCH bucket → 400); deactivate instead of delete. Tests: seed-on-first-read, CRUD, bucket immutability, tenant isolation.

---
## PROMPT P2-02 — Attendance records schema + settings

Read CONVENTIONS + school-attendance migration 001.

`migrations/002_records.sql`:
- `attendance_records`: id, tenant_id, student_id, date, period_instance_id NULL (NULL = day/session-level), session_part NULL (`am|pm`), status (`present|absent|late|left_early`) NOT NULL, excuse (`excused|unexcused|exempt|unknown`) NOT NULL DEFAULT 'unknown', reason_code_id NULL, late_minutes INTEGER NULL, marked_by TEXT, marked_at, source (`roll_call|nfc|qr|kiosk|import|regularization`), device_id NULL, idempotency_key TEXT, updated_at. Unique (tenant_id, student_id, date, period_instance_id, session_part); unique (tenant_id, idempotency_key) where idempotency_key not null.
- `attendance_audit`: id, tenant_id, record_id, before_json, after_json, actor, at
- `attendance_settings`: tenant_id PK, granularity (`day|session|period`) DEFAULT 'day', edit_window_minutes INTEGER DEFAULT 120, late_threshold_minutes INTEGER DEFAULT 30, half_day_min_minutes INTEGER DEFAULT 180

Routes: `GET/PUT /api/attendance/:tenantId/settings` (validate enums/ranges: edit_window 0–1440, late_threshold 5–120, half_day 60–360). Tests: defaults on first read, update, validation, migration boots. No marking endpoints yet.

---
## PROMPT P2-03 — Bulk marking API (roll call)

Read CONVENTIONS + school-attendance migrations + settings service.

- `POST /api/attendance/:tenantId/mark` body `{context: {date, period_instance_id?|session_part?}, marks: [{student_id, status, excuse?, reason_code_id?, late_minutes?}], marked_by, idempotency_key}`:
  - Context must match tenant granularity setting (period granularity requires period_instance_id; day requires neither) → 400.
  - Upsert per student. Second call with same idempotency_key → 200 replay of first result, zero new writes (test this explicitly).
  - `late` requires late_minutes; ≥ late_threshold does NOT flip status — status stays `late`, we record minutes (statutory bucketing happens at report time).
  - reason_code must belong to tenant and be active.
  - Absent marks emit ONE `school.attendance.marked_absent` event per student `{student_id, date, period_instance_id, reason_bucket|null}`.
- Edits: `PATCH /api/attendance/:tenantId/records/:id` — allowed within `edit_window_minutes` of marked_at; after that 409 `{error:"window_closed", regularization_required:true}`. Every change writes `attendance_audit`.
- `POST /api/attendance/:tenantId/records/:id/regularize {new_status, new_excuse, reason_code_id, approved_by, note}` — bypasses window, source→`regularization`, audit row, emits `school.attendance.regularized`.
- `GET /api/attendance/:tenantId/register?date=&section=` — needs student roster: accept `student_ids` from caller instead of calling identity service (keep services decoupled; the BFF composes). Return records keyed by student_id with `unmarked` for missing.

Tests: mark day + period granularity; wrong-context 400; idempotent replay; late validation; window edit + closed window + regularize; audit rows; absent events (recording publisher); register with unmarked; tenant isolation.

---
## PROMPT P2-04 — Capture events (NFC/QR/kiosk)

Read CONVENTIONS + school-attendance marking service. **Scope guard: no biometrics in this prompt — identifier modalities only.**

`migrations/003_capture.sql`:
- `capture_bindings`: id, tenant_id, subject_type (`student|staff`), subject_id, modality (`nfc|qr`), payload_hash TEXT (sha256 of card UID/QR value — raw value never stored), is_active INTEGER, created_at. Unique (tenant_id, modality, payload_hash).
- `capture_events`: id, tenant_id, device_id, modality, payload_hash, matched_subject_id NULL, decision (`matched|no_match|duplicate`), context_json, at

Routes:
- `POST /api/attendance/:tenantId/bindings` `{subject_type, subject_id, modality, payload_b64}` — hash server-side, store hash only; rebinding a hash already bound → 409 unless previous binding deactivated.
- `POST /api/attendance/:tenantId/capture` `{modality, payload_b64, device_id, context:{gate|period_instance_id, date}, idempotency_key}` — resolve hash→binding; matched student at a gate context ⇒ upsert day-level `present` record (source nfc/qr) and emit `school.attendance.gate_entry` (data: student_id, at, gate); no binding ⇒ decision `no_match`, 200 (never 4xx to a gate device), logged; same hash+context within 120s ⇒ `duplicate`, no second record.
- Anomaly hook: same payload_hash matched at two different device_ids within 60s ⇒ still record but emit `school.attendance.anomaly {kind:"impossible_sequence"}`.
- `GET /api/attendance/:tenantId/capture-events?date=&decision=`.

Tests: bind/rebind rules; capture matched/no_match/duplicate; impossible-sequence anomaly; raw payload never persisted (assert no column contains the b64 value); idempotency; tenant isolation.

---
## PROMPT P2-05 — Staff attendance

Read CONVENTIONS + school-attendance records service. Staff = platform member ids (opaque strings).

`migrations/004_staff.sql`: `staff_attendance`: id, tenant_id, member_id, date, check_in_at NULL, check_out_at NULL, status (`present|absent|on_leave|half_day`), source (`manual|nfc|qr|biometric_device`), minutes_on_premises INTEGER NULL, marked_by, updated_at. Unique (tenant_id, member_id, date).

- `POST /api/attendance/:tenantId/staff/check {member_id, direction: in|out, at, source, device_id?}` — in sets check_in; out requires prior in (400), computes minutes; derived status: minutes ≥ half_day_min ⇒ present else half_day.
- `POST /api/attendance/:tenantId/staff/mark` bulk manual `{date, marks:[{member_id, status}]}` for admin.
- `GET /api/attendance/:tenantId/staff?month=YYYY-MM&member_id=` — monthly grid + totals `{present, absent, on_leave, half_day, total_minutes}` — this is the payroll export shape. Emit `school.staff.attendance_finalized` on `POST .../staff/finalize {month}` (locks the month: further writes 409; store lock in a `staff_locks` table in same migration).

Tests: check in/out + minutes + derived status; out-before-in; bulk mark; monthly totals; finalize lock; tenant isolation.

---
## PROMPT P2-06 — Parent-reported absence + dedupe

Read CONVENTIONS + school-attendance marking service + capture service.

`migrations/005_reported.sql`: `reported_absences`: id, tenant_id, student_id, reported_by_guardian_id, dates_json (array of ISO dates), reason_code_id, note NULL, attachment_ref NULL (storage reference; never file bytes), channel (`app|web|ivr|whatsapp`), created_at.

- `POST /api/attendance/:tenantId/reported-absences` — validate dates (today or future, max 30 days ahead, max 15 dates); reason_code required; idempotent per (student, date, guardian) — resubmission merges, no duplicates.
- **The suppression rule (the load-bearing behaviour):** when marking produces an absent record, the `school.attendance.marked_absent` event must carry `explained:true` if a reported absence covers that student+date. Modify the marking service accordingly. Explained absences also auto-set excuse from the reported reason bucket (medical/authorised ⇒ excused).
- `GET /api/attendance/:tenantId/unexplained?date=` → absent records with `explained:false` — the office worklist.
- `POST /api/attendance/:tenantId/reported-absences/:id/attach {attachment_ref}` — for medical certificates; metadata only.

Tests: report validation + merge idempotency; absent event explained:true/false both ways (report-then-mark AND mark-then-report — the second must retro-update the record's excuse and emit `school.attendance.explained`); worklist; tenant isolation.

---
## PROMPT P2-07 — Statutory computations

Read CONVENTIONS + school-attendance all services. Pure computation + read routes; one new table.

`migrations/006_stats.sql`: `attendance_monthly_rollups`: tenant_id, student_id, month, working_days, present_days, absent_days, late_count, pct REAL, computed_at. PK (tenant_id, student_id, month).

- `src/services/attendance-stats.ts`: `computeMonth(tenantId, month, workingDayCount, records)` — pure; day counts derive: any absent period ⇒ configurable day rule (`any_absent|majority|half_day_minutes` — add `day_derivation` column to attendance_settings, default `majority`); document each rule in code comments and test all three.
- `POST /api/attendance/:tenantId/rollups/compute {month, working_days}` — recompute+upsert all students with records that month.
- `GET /api/attendance/:tenantId/students/:id/eligibility?session_from=&session_to=&threshold=75` → `{pct, threshold, eligible, projected_pct_if_no_more_absences}` — the CBSE 75% surface.
- `GET /api/attendance/:tenantId/rollups?month=` and `GET .../students/:id/rollups` (year view — feeds HPC Part A and the nudge).

Tests: each derivation rule; rollup compute/idempotent recompute; eligibility math incl. projection; tenant isolation.

---
## PROMPT P2-08 — Attendance Nudge

Read CONVENTIONS + school-attendance rollups service. Rule-based only; no ML, no risk scores exposed per student to anyone but staff.

`migrations/007_nudge.sql`:
- `nudge_config`: tenant_id PK, enabled INTEGER DEFAULT 0, at_risk_pct REAL DEFAULT 10, chronic_days INTEGER DEFAULT 18, holdout_pct INTEGER DEFAULT 10, max_messages_per_term INTEGER DEFAULT 6
- `nudge_assignments`: tenant_id, student_id, cohort (`treatment|holdout`), assigned_at. PK (tenant_id, student_id).
- `nudge_messages`: id, tenant_id, student_id, tier (`at_risk|chronic`), ytd_absent_days, class_percentile REAL, rendered_vars_json, created_at

- `POST /api/attendance/:tenantId/nudge/run {as_of}` — for each student with rollups: compute YTD absences + percentile within class (caller passes `class_map` {student_id: section} — no cross-service call); tier by config; skip if: holdout cohort (first-touch assignment via deterministic hash of student_id, stable across runs — test stability), improving (last-30d pct better than YTD pct), term cap reached. For selected: insert nudge_message and emit `school.nudge.send {student_id, template:"attendance_nudge", vars:{days_missed, percentile, precise_dates:[last 3 absent dates]}}` — engagement service does delivery.
- `GET /api/attendance/:tenantId/nudge/report` → treatment vs holdout mean absence pct, message counts — the tenant-facing effect report.
- Message vars only; NO message copy in this service.

Tests: tiering; deterministic stable holdout; improving suppression; cap; event vars include precise dates; report math; disabled config = no-op; tenant isolation.
