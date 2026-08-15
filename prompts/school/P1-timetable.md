# P1 — school-timetable

---
## PROMPT P1-01 — Scaffold school-timetable

Read `prompts/school/00-CONVENTIONS.md` + all reference files it names. Also read `services/school-identity/src/events.ts` and copy that file into this service (do not import it).

Create `services/school-timetable/` per skeleton: `@blokhr/school-timetable`, env `SCHOOL_TIMETABLE_DB_PATH`, port 3012. `migrations/001_calendar.sql`:
- `terms`: id, tenant_id, academic_session_id, label, starts_on, ends_on
- `day_schemes`: id, tenant_id, label, kind (`weekly|cyclic`), cycle_length INTEGER NULL, periods_json TEXT (ordered array `{index, label, start_time, end_time, is_teaching INTEGER}`)
- `exclusions`: id, tenant_id, date, scope (`school|class`), class_label NULL, reason (`holiday|exam|event|other`), label

Routes: health; CRUD `GET/POST /api/timetable/:tenantId/terms`, `/day-schemes` (validate periods_json: ordered, non-overlapping times, ≥1 teaching period), `/exclusions` (+ `GET ?from=&to=` range query).
Tests: CRUD each; overlapping-period rejection; exclusion range query; tenant isolation.

---
## PROMPT P1-02 — Sections, subjects, allocations

Read CONVENTIONS + school-timetable src + migration 001.

`migrations/002_allocation.sql`:
- `sections`: id, tenant_id, academic_session_id, class_label, section, day_scheme_id, class_teacher_member_id TEXT NULL (platform member id, opaque string — never joined)
- `subjects`: id, tenant_id, code, label, is_elective INTEGER DEFAULT 0
- `allocations`: id, tenant_id, section_id, subject_id, teacher_member_id, periods_per_week INTEGER, room NULL

Routes: CRUD for all three under `/api/timetable/:tenantId/...`. Rules: (section, subject) allocation unique (409); subject code unique per tenant; deleting a subject with allocations → 409. Tests: CRUD, uniqueness, delete guard, tenant isolation.

---
## PROMPT P1-03 — Slot grid

Read CONVENTIONS + school-timetable migrations 001–002 + services.

`migrations/003_slots.sql`: `slots`: id, tenant_id, section_id, day_ref TEXT (weekday `mon..sat` or cycle day `d1..dN` matching the section's day_scheme kind), period_index INTEGER, allocation_id, created_at.

Routes:
- `PUT /api/timetable/:tenantId/sections/:sectionId/slots` — full replace of the section grid, body `[{day_ref, period_index, allocation_id}]`. Validate: day_ref legal for scheme; period_index exists and `is_teaching`; no duplicate (day_ref, period_index); allocation belongs to section; **teacher clash check** — same teacher_member_id in the same (day_ref, period_index) in another section of the same session → 409 listing clashes.
- `GET .../sections/:sectionId/slots` — grid, joined with subject+teacher ids.
- `GET /api/timetable/:tenantId/teachers/:memberId/slots` — a teacher's week.

Tests: replace+read; each validation; the clash case and clash listing; teacher-week view; tenant isolation.

---
## PROMPT P1-04 — Period instances

Read CONVENTIONS + school-timetable all src. This is the load-bearing feature for attendance and academics — exact behaviour required.

`migrations/004_instances.sql`: `period_instances`: id, tenant_id, section_id, date, period_index, allocation_id, status (`scheduled|held|lost`), lost_reason NULL (`holiday|exam|event|teacher_absent_uncovered|other`), source (`generated|manual`), created_at, updated_at. Unique (tenant_id, section_id, date, period_index).

Service `instance-generator.ts`:
- `generateInstances(tenantId, sectionId, from, to)`: walk dates; resolve day_ref (weekly = weekday; cyclic = rolling cycle counter that **skips fully-excluded dates without advancing**); skip Sundays; for each slot create `scheduled` instance; dates covered by a school-scope exclusion (or class-scope matching the section's class_label) create instances with status `lost` + mapped lost_reason. Idempotent: re-running never duplicates and never overwrites `held` rows.
- Route `POST /api/timetable/:tenantId/sections/:sectionId/instances/generate {from,to}` → `{created, lost, skipped}`.
- `PATCH /api/timetable/:tenantId/instances/:id` — status transitions: scheduled→held, scheduled→lost(+reason), lost→scheduled (exclusion removed). held is terminal (409). Emits `school.period.lost` when →lost.
- `GET /api/timetable/:tenantId/sections/:sectionId/instances?from=&to=&status=`.

Tests: weekly + cyclic generation; cyclic counter not consumed by excluded day; idempotent re-run; held preserved; exclusion→lost mapping; transitions incl. illegal; event emitted; tenant isolation.

---
## PROMPT P1-05 — Substitute cover

Read CONVENTIONS + school-timetable src (instances, slots, allocations).

`migrations/005_cover.sql`:
- `teacher_absences`: id, tenant_id, teacher_member_id, date, period_indexes_json (NULL = full day), reason, created_at
- `cover_assignments`: id, tenant_id, absence_id, period_instance_id, cover_teacher_member_id NULL, state (`open|offered|accepted|declined|uncovered`), offered_at NULL, responded_at NULL, notes NULL

Service:
- `POST /api/timetable/:tenantId/absences` — creates absence, finds the teacher's affected period_instances in range, creates `open` cover_assignments, emits `school.cover.needed` per assignment (data includes section, subject, period, date).
- `POST /api/timetable/:tenantId/cover/:id/offer {cover_teacher_member_id}` — only if that teacher is free in that (date, period_index) per slots+existing accepted covers (409 otherwise); → `offered`, emits `school.cover.offered`.
- `POST /api/timetable/:tenantId/cover/:id/respond {accept: boolean}` — offered→accepted|declined (declined reverts to open). Accepted emits `school.cover.assigned`.
- `POST /api/timetable/:tenantId/cover/:id/mark-uncovered` — open→uncovered, sets the period_instance to `lost/teacher_absent_uncovered`.
- `GET /api/timetable/:tenantId/cover?date=&state=` and `GET .../cover/fairness?from=&to=` → covers accepted per teacher (fair-distribution report).

Tests: absence fan-out full-day + specific periods; free-teacher check; state machine incl. illegal transitions; uncovered→lost instance; fairness counts; events; tenant isolation.
