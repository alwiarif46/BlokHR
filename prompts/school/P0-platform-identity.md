# P0 — Platform & school-identity

---
## PROMPT P0-01 — School module IDs in entitlements

Read `prompts/school/00-CONVENTIONS.md`, `services/entitlements/src/types.ts`, `services/entitlements/src/entitlements-service.ts`, `services/entitlements/tests/entitlements.test.ts`.

In `services/entitlements` only:
1. In `src/types.ts` add:
   - `DEFAULT_SCHOOL_MODULES = ['school_identity','school_timetable','school_attendance','school_academics','school_engagement']`
   - `SCHOOL_PREMIUM_MODULES = [...DEFAULT_SCHOOL_MODULES,'school_assessment','school_fees','school_transport','school_compliance','school_operations','school_nudge']`
   - `GATED_MODULES = ['school_biometrics']` (never in any default set)
   - `EntitlementVertical = 'hr' | 'school'`; add optional `vertical` field to `Entitlement` (default `'hr'` for existing rows — handle undefined in reads, no migration of old data).
2. `startCloudTrial` gains optional `vertical` param: `'school'` → modules = DEFAULT_SCHOOL_MODULES, else current behaviour. Persist vertical.
3. `POST /api/entitlements/:tenantId/trial` accepts `{vertical}` in body.
4. `canUseModule` unchanged, but add explicit test: school-trial tenant allowed `school_attendance`, denied `school_biometrics`, denied `attendance` (HR module).

Tests (extend existing file): school trial modules/vertical; gated module denied; HR trial unchanged (regression). DoD: `npx vitest run` and `npx tsc --noEmit` green in `services/entitlements`.

---
## PROMPT P0-02 — Scaffold school-identity

Read `prompts/school/00-CONVENTIONS.md` and every file it names in `services/entitlements/`.

Create `services/school-identity/` exactly per the skeleton in CONVENTIONS: package `@blokhr/school-identity`, env `SCHOOL_IDENTITY_DB_PATH`, default port 3011. Also create `src/events.ts` with the `EventPublisher` interface + `LogEventPublisher` + `HttpEventPublisher` exactly as specified in CONVENTIONS. `createSchoolIdentityApp` accepts optional `eventPublisher` (default LogEventPublisher).

`migrations/001_identity.sql` — empty placeholder tables are forbidden; create only `schema_migrations` bootstrap happens in code, so migration 001 creates ONE table: `academic_sessions (id, tenant_id, label, starts_on, ends_on, is_current INTEGER, created_at, updated_at)`.

Routes: `GET /health` → `{ok:true}`; `GET/POST /api/identity/:tenantId/sessions` (list, create with label+starts_on+ends_on validation: dates ISO, ends>starts; creating with `is_current:true` unsets previous current in same tenant).

Tests: health; create/list session; is_current exclusivity; date validation 400; tenant isolation. DoD per CONVENTIONS.

---
## PROMPT P0-03 — Students & guardians schema

Read `prompts/school/00-CONVENTIONS.md`, `services/school-identity/src/db.ts`, `migrations/001_identity.sql`.

Add `migrations/002_students.sql` to school-identity — nothing else in this prompt, plus `src/types.ts` interfaces mirroring it:

- `students`: id, tenant_id, admission_number (unique per tenant), first_name, last_name, dob, gender (`male|female|other`), admission_date, status (`enquiry|admitted|active|transferred|alumni|withdrawn`), category (`GEN|EWS|OBC|SC|ST|OTHER_STATE`), state_category_code TEXT NULL (state-pack code, free), mother_name, father_name, guardian_contact, aadhaar_last4 TEXT NULL (never full Aadhaar), apaar_id TEXT NULL, pen_id TEXT NULL, udise_export_ok INTEGER DEFAULT 0, is_cwsn INTEGER DEFAULT 0, cwsn_category TEXT NULL, cwsn_severity TEXT NULL, cwsn_certificate INTEGER DEFAULT 0, is_rte INTEGER DEFAULT 0, photo_ref TEXT NULL (storage-service reference only), created_at, updated_at
- `guardians`: id, tenant_id, first_name, last_name, relation (`father|mother|guardian|other`), phone, email NULL, preferred_language TEXT DEFAULT 'en', created_at, updated_at
- `student_guardians`: student_id, guardian_id, tenant_id, is_primary INTEGER, PRIMARY KEY (student_id, guardian_id)
- `enrolments`: id, tenant_id, student_id, academic_session_id, class_label, section, roll_number, house NULL, enrolled_on, exited_on NULL, exit_reason NULL — one active enrolment per student per session (partial uniqueness enforced in service code later, note it in a SQL comment)
- Indexes: students(tenant_id,status), students(tenant_id,admission_number), enrolments(tenant_id,academic_session_id,class_label,section)

DoD: migration applies on fresh `:memory:` db (add one test that boots the app and asserts `SELECT count(*) FROM students` works); typecheck green. **No routes in this prompt.**

---
## PROMPT P0-04 — Student CRUD + enrolment

Read `prompts/school/00-CONVENTIONS.md`, school-identity `src/types.ts`, `migrations/002_students.sql`, existing routes file.

Add repository + service + routes for students and enrolments:
- `POST /api/identity/:tenantId/students` — validate: names non-empty; dob ISO and age 2–25 at admission; gender/category/status enums; admission_number unique per tenant (409); full Aadhaar anywhere in payload → 400 with `{error:"aadhaar_not_accepted"}` (accept only aadhaar_last4, exactly 4 digits).
- `GET /api/identity/:tenantId/students?status=&class=&section=&q=` — q matches name/admission_number, paginate `?limit=50&offset=0`, return `{items,total}`.
- `GET /api/identity/:tenantId/students/:id`, `PATCH` (same validations; admission_number immutable → 400).
- `POST /api/identity/:tenantId/students/:id/enrol` `{academic_session_id, class_label, section, roll_number}` — reject second active enrolment same session (409); emits `school.student.enrolled`.
- `POST .../students/:id/exit` `{exited_on, exit_reason, new_status}` — closes active enrolment, sets status, emits `school.student.exited`.

Tests: create/read/patch; enum + aadhaar rejections; duplicate admission_number; enrol + duplicate enrol; exit; pagination; tenant isolation; event published (inject a recording EventPublisher). DoD per CONVENTIONS.

---
## PROMPT P0-05 — Guardians + linking

Read CONVENTIONS + school-identity students routes/service/repository.

Add guardians CRUD and linking, same layering:
- `POST/GET/PATCH /api/identity/:tenantId/guardians` — phone mandatory, validated as Indian mobile (10 digits, first digit 6–9) OR E.164 with `+`; email optional format-checked; preferred_language 2–5 char code.
- `POST /api/identity/:tenantId/students/:id/guardians` `{guardian_id, is_primary}` — link; setting is_primary unsets others for that student; max 4 guardians per student (400).
- `DELETE .../students/:id/guardians/:guardianId` — unlink; refuse removing the last guardian of an `active` student (409 `{error:"last_guardian"}`).
- `GET .../students/:id/guardians` and `GET .../guardians/:id/students` (multi-sibling view — this powers the parent app later).

Tests: CRUD, phone/email validation, primary exclusivity, max-4, last-guardian refusal, sibling listing, tenant isolation.

---
## PROMPT P0-06 — Consent engine (APAAR + DPDP)

Read CONVENTIONS + school-identity types + students service. This is compliance-critical: implement exactly, no creative additions.

`migrations/003_consent.sql`:
- `consents`: id, tenant_id, student_id, kind (`apaar|dpdp_processing|biometric|photo|transport_gps`), state (`granted|refused|withdrawn|not_sought`), granted_by_guardian_id NULL, artefact_ref TEXT NULL (storage reference to signed form), verification_method TEXT NULL (`existing_records|id_details|virtual_token|digilocker`), noted_by TEXT (user id), state_changed_at, created_at, updated_at
- `consent_audit`: id, tenant_id, consent_id, from_state, to_state, actor, reason NULL, at

Service rules (enforce in code, test each):
1. Every student gets an implicit `not_sought` state for every kind when queried — absence of a row means `not_sought`.
2. Transitions: not_sought→granted|refused; granted→withdrawn; refused→granted. Anything else 409. Every transition writes `consent_audit`.
3. `granted` for `apaar|biometric|dpdp_processing` REQUIRES guardian id + verification_method + artefact_ref (400 otherwise).
4. **Refusal blocks nothing**: no other endpoint in this service may read consent state to deny service. Add a test proving a student with apaar=refused can still be enrolled.
5. `GET /api/identity/:tenantId/consents/summary` → per-kind counts (granted/refused/not_sought/withdrawn) — the school dashboard number.

Routes: `GET/POST /api/identity/:tenantId/students/:id/consents`, plus summary. Events: `school.consent.changed`. Tests: all transitions incl. invalid, requirement rule, non-blocking rule, audit rows written, summary counts, tenant isolation.

---
## PROMPT P0-07 — UDISE field validation module

Read CONVENTIONS + school-identity types + students repository.

Create `src/services/udise-validator.ts` — pure functions, no HTTP, no DB writes:
- `validateStudentForUdise(student, enrolment) → {ok: boolean, errors: {field, code, message}[]}` checking: name present; dob valid + age plausible for class; gender enum; admission number+date present; class/section present; category enum; mother_name present; guardian_contact present; apaar: if state is `granted` then apaar_id must match `/^\d{12}$/`, if `refused` then apaar_id must be empty and this is NOT an error (emit info-level entry `{code:"apaar_refused"}` instead); CWSN students require cwsn_category+severity.
- `validateTenantForUdise(tenantId) → per-student results + totals` in the service layer, exposed as `GET /api/identity/:tenantId/udise/preflight?session_id=` returning `{total, passing, failing, results:[...]}` (paginated).
- Gaming warnings (warning, not error): admission_date after session start but student has enrolment in a previous session with no exit (`code:"progression_before_admission"`).

Tests: each rule pass+fail; apaar refused is not an error; preflight aggregation; pagination. No new tables.

---
## PROMPT P0-08 — State packs

Read CONVENTIONS + school-identity types.

Create `src/state-packs/` with `types.ts` (`StatePack {code, label, categories: {code,label}[], studentIdField?: {label, pattern}, gradeSchemes: {board, labels[]}[], scripts: string[]}`), `mh.ts`, `tn.ts`, `ka.ts`, `index.ts` registry:
- MH: categories GEN, SC, ST, VJNT-A, NT-B, NT-C, NT-D, OBC, SBC, EWS; gradeScheme MSBSHSE SSC 6 grades + HSC 5 bands; scripts ['deva'].
- TN: 8 categories OC, BC, BCM, MBC, DNC, SC, SCA, ST; studentIdField EMIS `/^\d{8}$/`; scripts ['taml'].
- KA: categories GEN, SC, ST, OBC-1, OBC-2A, OBC-2B, OBC-3A, OBC-3B, EWS; studentIdField SATS; scripts ['knda'].

Routes: `GET /api/identity/state-packs` (list codes+labels, not tenant-scoped), `GET /api/identity/state-packs/:code`. Student PATCH/POST accept `state_student_id`; when the tenant has a configured pack (new nullable `tenant_state_pack` table: tenant_id PK, pack_code — with `PUT /api/identity/:tenantId/state-pack`), validate `state_student_id` against the pack pattern and `state_category_code` against pack categories.

Migration `004_state_pack.sql` (tenant_state_pack + `state_student_id` column on students via ALTER TABLE). Tests: registry contents; set pack; EMIS pattern enforcement for TN tenant; category validation; tenant without pack skips validation.
