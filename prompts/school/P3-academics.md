# P3 — school-academics

---
## PROMPT P3-01 — Scaffold school-academics

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern.

Create `services/school-academics/`: `@blokhr/school-academics`, env `SCHOOL_ACADEMICS_DB_PATH`, port 3014. `migrations/001_outcomes.sql`:
- `learning_outcomes`: id, tenant_id NULL (NULL = global NCERT seed), code TEXT (`<class>.<subject>.LO<n>` e.g. `8.Sc.LO4`), class_label, subject_code, description, framework (`ncert|cbse_cbe|custom`), created_at. Unique (coalesce(tenant_id,'global'), code).
- `outcome_crosswalk`: id, tenant_id, from_outcome_id, to_outcome_id, relation (`equivalent|partial|prerequisite`), note NULL
- Seed 30 sample NCERT rows (classes 1,5,8 × subjects M,Sc,E — realistic codes, generic descriptions) via a seed function called from the migration runner path, marked clearly `SAMPLE SEED — replace with full NCERT import`.

Routes: health; `GET /api/academics/:tenantId/outcomes?class=&subject=&framework=&q=` (returns global + tenant rows); `POST` (tenant custom only, code prefix `CUST.`, enforce); crosswalk CRUD. Tests: seed visible to all tenants; custom code prefix rule; search filters; crosswalk; tenant isolation for custom rows.

---
## PROMPT P3-02 — Curriculum tree

Read CONVENTIONS + school-academics migration 001.

`migrations/002_curriculum.sql`:
- `courses`: id, tenant_id, academic_session_id, board (`cbse|icse|state|ib|cambridge`), subject_code, class_label, label
- `units`: id, tenant_id, course_id, sequence INTEGER, label, planned_weeks REAL, planned_start_week INTEGER NULL, summary NULL
- `topics`: id, tenant_id, unit_id, sequence, label, estimated_periods INTEGER DEFAULT 1
- `unit_outcomes`: unit_id, outcome_id, tenant_id, field (`activity|assessment|resource`) NOT NULL, depth (`introduced|reinforced|mastered`) DEFAULT 'introduced'. PK (unit_id, outcome_id, field).

Routes: courses CRUD; nested `GET /api/academics/:tenantId/courses/:id/tree` (units+topics+outcome tags one call); units/topics CRUD with resequencing (`PUT .../units/reorder {ordered_ids}`); tag/untag outcomes on units with field+depth. Rule: an outcome tagged `assessment` on a unit must also exist tagged `activity` (else 400 — you cannot assess what is never taught). Tests: tree assembly; reorder; the assessment-requires-activity rule; depth values; tenant isolation.

---
## PROMPT P3-03 — Lesson plans + weekly approval

Read CONVENTIONS + school-academics curriculum service.

`migrations/003_lessons.sql`:
- `lesson_plans`: id, tenant_id, course_id, unit_id, topic_id NULL, teacher_member_id, week_start DATE, title, body_json (sections: objectives, activities, materials, assessment_check), kind (`personal|exemplar`), state (`draft|submitted|approved|changes_requested`), reviewed_by NULL, review_note NULL, provenance (`human|ai_assisted|ai_generated`) DEFAULT 'human', created_at, updated_at
- `lesson_outcomes`: lesson_plan_id, outcome_id, tenant_id. PK both.

Routes:
- CRUD `POST/GET/PATCH /api/academics/:tenantId/lessons` (filter teacher/week/state/course). Draft freely editable; submitted/approved not editable by teacher (409) — changes_requested returns to editable.
- **Bulk weekly submit**: `POST /api/academics/:tenantId/lessons/submit-week {teacher_member_id, week_start}` — all drafts that week → submitted, emits ONE `school.lessons.week_submitted`.
- Review: `POST .../lessons/:id/review {decision: approved|changes_requested, review_note?, reviewed_by}`. changes_requested requires note (400).
- QA sampling: `GET /api/academics/:tenantId/lessons/review-sample?week_start=&pct=20` — deterministic pseudo-random 20% of approved lessons (seed = tenantId+week, test stability).
- Stale nudge: `GET .../lessons/stale?days=21` — submitted with no review older than N days.

Tests: state machine incl. illegal edits; bulk submit; note-required rule; deterministic sample; stale list; provenance persisted; tenant isolation.

---
## PROMPT P3-04 — Period-instance completion

Read CONVENTIONS + school-academics curriculum + lessons. This is the W2 foundation — exact semantics.

`migrations/004_delivery.sql`: `topic_delivery`: id, tenant_id, topic_id, period_instance_id TEXT (opaque id from school-timetable — no FK, no join), section_ref TEXT, date, teacher_member_id, source (`asserted|inferred_assessment|inferred_resource`), created_at. Unique (tenant_id, topic_id, period_instance_id).

- `POST /api/academics/:tenantId/delivery` `{topic_id, period_instance_id, section_ref, date, teacher_member_id}` — one tap = one row, source `asserted`. Server timestamps; client sends no completion date (anti-fudge: the date field is the period date, but created_at is authoritative for audit).
- `DELETE /api/academics/:tenantId/delivery/:id` — within 48h of created_at only (409 after).
- `GET /api/academics/:tenantId/courses/:courseId/coverage?section_ref=` → per unit: topics_total, topics_delivered, pct, first/last delivery date; per outcome (via unit_outcomes): covered `activity`? covered `assessment`? — the Chalk-style in-use grid data.
- `POST /api/academics/:tenantId/delivery/infer` `{kind: assessment|resource, topic_id, section_ref, date, ref}` — inference hook other services call later; source set accordingly; asserted always wins on conflict (no duplicate row).

Tests: assert/undo/window; coverage math incl. field split; inference + asserted-wins; unique constraint; tenant isolation.

---
## PROMPT P3-05 — Variance & slippage forecast

Read CONVENTIONS + school-academics delivery service. Pure computation over data the caller provides; one route, no new tables.

`src/services/variance.ts` — pure functions, fully unit-tested:
- `computeVariance(units[], topics[], deliveries[], instances[])` where instances = period_instances for the section-subject from school-timetable (passed in by BFF; this service never calls timetable):
  - Planned curve: cumulative topics expected by week from planned_weeks/planned_start_week.
  - Actual curve: cumulative delivered topics by week.
  - Per unit: planned_window, actual_window, slippage_weeks.
  - Lost-period attribution: count instances with status `lost` in the unit's actual window, grouped by lost_reason.
  - Forecast: remaining_topics ÷ trailing-4-week delivery rate ⇒ projected_completion_date; rate 0 ⇒ `projected_completion_date: null, stalled: true`.
- `POST /api/academics/:tenantId/courses/:courseId/variance` body `{section_ref, instances:[...], target_date?}` → full variance report + `days_past_target` when target_date given.

Tests (table-driven, ≥8 cases): on-track; behind with lost-period attribution; stalled; ahead; empty delivery; target comparison producing the "finishes 18 days after pre-board" shape; single-week course; rate window shorter than 4 weeks.

---
## PROMPT P3-06 — Homework & submissions

Read CONVENTIONS + school-academics lessons service.

`migrations/005_homework.sql`:
- `assignments`: id, tenant_id, course_id, section_ref, topic_id NULL, title, instructions, max_points INTEGER NULL (NULL/0 = ungraded), due_at, assigned_by, attachment_refs_json, created_at
- `submissions`: id, tenant_id, assignment_id, student_id, state (`assigned|turned_in|returned|reclaimed`), late INTEGER DEFAULT 0, missing INTEGER DEFAULT 0, excused INTEGER DEFAULT 0, draft_grade REAL NULL, assigned_grade REAL NULL, feedback NULL, attachment_refs_json, turned_in_at NULL, returned_at NULL, updated_at. Unique (assignment_id, student_id).

Google Classroom semantics exactly:
- Creating an assignment with a `student_ids` list fans out `assigned` submissions.
- `POST .../submissions/:id/turn-in` (late flag if past due_at); `POST .../submissions/:id/reclaim` (turned_in→reclaimed).
- Grading: `PATCH .../submissions/:id/grade {draft_grade}` any time; `POST .../submissions/:id/return {feedback?}` copies draft→assigned and state→returned. **Setting assigned_grade directly → 400.** Excused ⇒ excluded from any aggregate (add `GET .../assignments/:id/stats` → mean/median of assigned grades excluding excused, counts by state).
- Due-date pass job route `POST /api/academics/:tenantId/assignments/:id/sweep-missing` — not-turned-in past due ⇒ missing=1, draft_grade=0 if graded assignment.
- Assignment creation on a topic fires the P3-04 inference hook internally (source `inferred_resource`).

Tests: full state machine; draft/assigned separation incl. the 400; late/missing/excused; stats math; sweep; inference row created; tenant isolation.

---
## PROMPT P3-07 — Syllabus import (topic tree from structured input)

Read CONVENTIONS + school-academics curriculum service. **No PDF parsing and no LLM calls in this prompt** — deterministic import only; the AI layer arrives later via the platform agent service.

- `POST /api/academics/:tenantId/courses/:id/import` body `{units: [{label, planned_weeks, topics: [{label, estimated_periods?}], outcome_codes?: string[]}]}`:
  - Validate whole payload first, import atomically (all or nothing, 400 with per-row errors array).
  - outcome_codes resolve against learning_outcomes (global+tenant); unknown codes collected into `warnings`, not errors.
  - Re-import into a non-empty course requires `{mode:"replace"}` and refuses (409) if any topic in the course has delivery rows — protected by data, not a confirm flag.
- `GET /api/academics/:tenantId/courses/:id/export` — same JSON shape back (round-trip: import(export(x)) is identity; test it).

Tests: atomic failure; warnings vs errors; replace guard with delivery rows; round-trip identity; tenant isolation.
