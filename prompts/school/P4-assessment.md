# P4 — school-assessment

---
## PROMPT P4-01 — Scaffold school-assessment

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern.

Create `services/school-assessment/`: `@blokhr/school-assessment`, env `SCHOOL_ASSESSMENT_DB_PATH`, port 3015. `migrations/001_exams.sql`:
- `exam_terms`: id, tenant_id, academic_session_id, label (`PT1|HY|PT2|Annual|custom`), starts_on, ends_on, weightage_pct REAL
- `exams`: id, tenant_id, exam_term_id, course_ref TEXT (opaque school-academics course id), section_ref, subject_code, class_label, date, max_marks INTEGER, kind (`formative|summative`), created_at

Routes: health; CRUD both. Rule: sum of weightage_pct across terms in one session ≤ 100 (400 on breach). Tests: CRUD, weightage cap, tenant isolation.

---
## PROMPT P4-02 — Marks with draft/assigned split

Read CONVENTIONS + school-assessment migration 001; re-read the draft/assigned rules in `services/school-academics/src` submissions service and mirror them.

`migrations/002_marks.sql`: `marks`: id, tenant_id, exam_id, student_id, draft_marks REAL NULL, assigned_marks REAL NULL, is_absent INTEGER DEFAULT 0, is_exempt INTEGER DEFAULT 0, entered_by, moderated_by NULL, published_at NULL, updated_at. Unique (exam_id, student_id).

- `PUT /api/assessment/:tenantId/exams/:examId/marks` bulk `{marks:[{student_id, draft_marks?|is_absent|is_exempt}]}` — draft only; range 0..max_marks (400); absent/exempt mutually exclusive with marks.
- `POST /api/assessment/:tenantId/exams/:examId/publish {published_by}` — copies draft→assigned for ALL rows atomically, stamps published_at, emits `school.marks.published {exam_id, count}`. Publishing with any student missing both a draft and a flag → 400 listing student_ids (nothing published).
- After publish, draft edits allowed but assigned only changes via `POST .../marks/:id/moderate {assigned_marks, moderated_by, reason}` (audit table `marks_audit` in same migration).
- `GET .../exams/:examId/marks` — includes derived pct; exempt excluded from class stats block `{mean, median, high, low, absent_count}`.

Tests: bulk entry validation; atomic publish incl. missing-row failure; direct assigned write rejected; moderation + audit; stats exclude exempt; event; tenant isolation.

---
## PROMPT P4-03 — Question bank + blueprint conformance

Read CONVENTIONS + school-assessment src.

`migrations/003_questions.sql`:
- `questions`: id, tenant_id, subject_code, class_label, outcome_code TEXT NULL, kind (`mcq|vsa|sa|la|case_based|source_based`), competency_style INTEGER DEFAULT 0, marks INTEGER, body_json, answer_json NULL, provenance (`human|ai_assisted|ai_generated`) DEFAULT 'human', times_used INTEGER DEFAULT 0, created_at
- `blueprints`: id, tenant_id, label, class_label, subject_code, total_marks, rules_json — array `{bucket: competency|objective|short_long, pct}` (e.g. CBSE X: 40/20/40)
- `papers`: id, tenant_id, blueprint_id, exam_ref NULL, question_ids_json, generated_variant_of NULL, created_at

- Questions CRUD with filters (subject/class/kind/outcome/competency_style).
- `POST /api/assessment/:tenantId/papers/check` `{blueprint_id, question_ids}` → conformance report: total marks vs blueprint; per-bucket pct (mcq⇒objective; case_based/source_based/competency_style⇒competency; rest⇒short_long) with pass/fail per rule ±2pct tolerance; duplicate question detection; outcome coverage list.
- `POST /api/assessment/:tenantId/papers` — persist only if check passes (else 400 with the report).
- Item analysis: `POST .../questions/analysis` body `{results:[{question_id, scores:[...] , max}]}` → per question difficulty p-value, discrimination (point-biserial vs total), flag `{review: p<0.2 || p>0.9 || discrimination<0.15}`. Pure function + route, table-driven tests.

Tests: CRUD; conformance pass/fail/tolerance; paper persist guard; analysis math on fixed vectors (hand-computed expectations); provenance; tenant isolation.

---
## PROMPT P4-04 — HPC evidence store

Read CONVENTIONS + school-assessment src. This implements the PARAKH model — schema exactly as specified, no simplification.

`migrations/004_hpc.sql`:
- `competencies`: id, tenant_id NULL (NULL=global seed), stage (`foundational|preparatory|middle|secondary`), ability (`awareness|sensitivity|creativity`), subject_area NULL, label. Seed 27 sample rows (3 stages × 3 abilities × 3) marked `SAMPLE SEED`.
- `assessment_inputs`: id, tenant_id, student_id, competency_id, activity_ref NULL, source (`self|peer|teacher|parent`) NOT NULL, level (`beginner|proficient|advanced`) NULL, statements_circled INTEGER NULL, observational_challenge TEXT NULL, observational_resolution TEXT NULL, evidence_ref NULL, academic_session_ref, recorded_by, at
- Rule (service-enforced): middle-stage inputs use statements_circled 0–6 and level is DERIVED (0–2 beginner, 3–4 proficient, 5–6 advanced) — sending both circled and level → 400; other stages send level directly.

Routes:
- `POST /api/assessment/:tenantId/hpc/inputs` single + `POST .../hpc/inputs/bulk` (peer-capture batches; max 200/call).
- `GET /api/assessment/:tenantId/hpc/students/:id?session=` → grouped by competency: latest level per source (the four-voice view) + input counts.
- `GET .../hpc/students/:id/matrix` → secondary-stage longitudinal: competency × session → derived overall level (majority of teacher inputs; tie ⇒ higher).
- `GET .../hpc/coverage?section_students=[ids]&stage=` → per competency: % of students with ≥1 teacher input + ≥1 self input — the "is the HPC actually being filled" dashboard.

Tests: circled→level derivation incl. the 400; four-voice grouping; matrix majority + tie; bulk cap; coverage math; tenant isolation.

---
## PROMPT P4-05 — Report card templates (sandbox → promote)

Read CONVENTIONS + school-assessment marks + HPC services.

`migrations/005_reportcards.sql`:
- `report_templates`: id, tenant_id, label, board_format (`cbse_9pt|msbshse_ssc|msbshse_hsc|icse|custom`), state (`sandbox|live|retired`), definition_json (ordered blocks: `{type: marks_table|attendance|hpc_summary|remarks|custom_text, config}` with aggregation per marks block: `sum|avg|weighted_by_term`), version INTEGER, promoted_at NULL, created_at
- `report_cards`: id, tenant_id, student_id, template_id, template_version, academic_session_ref, payload_json (fully resolved data snapshot), generated_at, generated_by

Rules:
- Templates edit only in `sandbox`. `POST .../templates/:id/promote` → live, bumps version, retires previous live template of same label. Editing live → 409 `{error:"promote_a_sandbox_copy"}`; `POST .../templates/:id/clone` → new sandbox copy.
- `POST /api/assessment/:tenantId/report-cards/generate` `{template_id, students:[{student_id, attendance?, remarks?}], session}` — resolves marks (published only — draft marks never appear; test this) + HPC latest levels into payload_json snapshots. Regeneration creates a new row (history preserved), emits `school.reportcard.generated`.
- CBSE 9-point mapping function (A1≥91 … E<33 fail) as a pure exported function with boundary tests; MSBSHSE SSC 6-grade mapping likewise.
- `GET .../report-cards?student_id=&session=`.

Tests: sandbox/promote/clone lifecycle incl. 409; published-marks-only; snapshot immutability across template edits; grade-boundary tables; tenant isolation.

---
## PROMPT P4-06 — Assessment→coverage feedback

Read CONVENTIONS + school-assessment marks + questions services, and the P3-04 inference contract in `services/school-academics` (read its delivery routes — you will CALL it over HTTP, not import).

- On `school.marks.published`, for each exam whose paper has outcome-tagged questions: compute per-outcome mean pct across students.
- New table `outcome_performance` (`migrations/006_feedback.sql`): tenant_id, exam_id, outcome_code, mean_pct, n_students, computed_at.
- `GET /api/assessment/:tenantId/outcomes/weak?threshold=50&session=` → outcomes with mean_pct < threshold + the exams evidencing it — the data behind "cohort under-performed on 8.Sc.LO4".
- HTTP client `src/clients/academics-client.ts` (base URL env `ACADEMICS_URL`, optional): after computing, POST each exam's outcome-tagged topics to academics `/delivery/infer` (kind `assessment`). Failures logged, never thrown (test with a failing stub server).
- Trigger endpoint (since services don't share a bus broker yet): `POST /api/assessment/:tenantId/feedback/run {exam_id}` — idempotent per exam.

Tests: per-outcome math; weak list; idempotent rerun; client failure swallowed; no cross-service import (assert nothing under `services/school-academics` is imported); tenant isolation.
