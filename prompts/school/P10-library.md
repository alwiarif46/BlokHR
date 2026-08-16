# P10 — school-library

> Locked packaging (2026-08-15 / README standing gap): **Library is a distinct `school_library` moduleId** (catalogue / ISBN / loans / fines). Do **not** fold this into a generic assets or inventory service — “issuance stays generic” means BlokHR’s HR/assets issuance remains untouched; school book circulation is owned here only.
> Entitlements today list premium `school_operations` as a placeholder umbrella — this phase adds **`school_library`** as the sellable module id. Do not invent `school_operations` routes in these prompts.
> Money is integer **paise**. Students are opaque `student_ref` strings (school-identity owns student rows — never join across DBs).
> Run after F-06 (pack complete). Port **3020**. Gateway + `api.school` maps must grow in P10-01 (files explicitly named below).

Run order: P10-01 → P10-02 → P10-03 → P10-04.

---
## PROMPT P10-01 — Scaffold + catalogue

Read `prompts/school/00-CONVENTIONS.md`, `services/entitlements/src/types.ts` (`SCHOOL_PREMIUM_MODULES`), `services/gateway/src/config.ts` (`SERVICE_MAP`), `frontend/shared/api.js` (`SCHOOL_SERVICES`), `services/school-fees/package.json` (port/env pattern).

Create `services/school-library/`: `@blokhr/school-library`, env `SCHOOL_LIBRARY_DB_PATH`, port **3020**. Copy `events.ts` pattern (do not import across services).

`migrations/001_catalogue.sql`:
- `titles`: id, tenant_id, isbn13 TEXT NULL, title TEXT NOT NULL, authors_json TEXT NOT NULL DEFAULT '[]', publisher NULL, published_year INTEGER NULL, subjects_json TEXT NOT NULL DEFAULT '[]', language TEXT NOT NULL DEFAULT 'en', active INTEGER DEFAULT 1, created_at, updated_at. Unique `(tenant_id, isbn13)` where isbn13 not null.
- `copies`: id, tenant_id, title_id, barcode TEXT NOT NULL, accession_no NULL, condition (`new|good|fair|poor|lost`) DEFAULT 'good', status (`available|on_loan|reserved|withdrawn`) DEFAULT 'available', location_label NULL, acquired_on NULL, created_at, updated_at. Unique `(tenant_id, barcode)`.

Rules:
- ISBN-13: if present, digits-only length 13 + valid check digit (pure helper `isbn.ts`); ISBN-10 input may be normalised to ISBN-13 or rejected with 400 `{error:"isbn_invalid"}` — pick one and test it; document in a one-line comment.
- Copy create requires existing title; cannot delete title while copies exist → 409.
- Withdrawn copies cannot move to `on_loan` (409).

Routes under `/api/library/:tenantId/`:
- CRUD `titles` + list `?q=` (title/author/isbn substring, case-insensitive) + `?subject=`
- CRUD `copies` + list `?title_id=&status=&barcode=`
- `GET .../titles/:id` includes `copy_counts` `{available, on_loan, reserved, withdrawn, total}`

Wiring (explicitly permitted):
1. `SCHOOL_PREMIUM_MODULES` gains `'school_library'` (keep `school_operations` for now — do not remove).
2. Gateway `SERVICE_MAP` + frontend `SCHOOL_SERVICES`: `'school-library': 3020`.
3. Extend gateway / school-api tests that assert the map size/keys so they include the new service.

Tests: CRUD + ISBN check digit + unique barcode/isbn + delete-blocked + copy_counts + tenant isolation. DoD per CONVENTIONS.

---
## PROMPT P10-02 — Circulation (issue / return / renew / hold)

Read CONVENTIONS + school-library catalogue service/routes.

`migrations/002_circulation.sql`:
- `library_settings`: tenant_id PK, loan_days INTEGER NOT NULL DEFAULT 14, renew_limit INTEGER NOT NULL DEFAULT 1, max_open_loans INTEGER NOT NULL DEFAULT 3, hold_days INTEGER NOT NULL DEFAULT 3, updated_at
- `loans`: id, tenant_id, copy_id, student_ref, issued_on TEXT NOT NULL, due_on TEXT NOT NULL, returned_on NULL, renewals INTEGER DEFAULT 0, status (`open|returned|overdue_closed`) DEFAULT 'open', issued_by NULL, created_at, updated_at. Partial unique: one **open** loan per copy_id.
- `holds`: id, tenant_id, title_id, student_ref, position INTEGER NOT NULL, status (`queued|ready|cancelled|fulfilled|expired`) DEFAULT 'queued', ready_copy_id NULL, expires_at NULL, created_at, updated_at. Unique `(tenant_id, title_id, student_ref)` where status in (`queued`,`ready`).

`GET/PUT /api/library/:tenantId/settings` — defaults on first GET; validate positive integers / sane caps (loan_days 1–90, renew_limit 0–5, max_open_loans 1–20, hold_days 1–14).

Circulation:
- `POST .../loans` `{copy_id|barcode, student_ref, issued_on?}` — copy must be `available` (or `reserved` **and** this student holds `ready` for that title); enforce `max_open_loans`; set copy → `on_loan`; due = issued_on + loan_days (date-only ISO `YYYY-MM-DD`); emit `school.library.loan_issued`.
- `POST .../loans/:id/return` `{returned_on?, condition?}` — close loan; copy → `available` unless a queued hold exists for the title → then mark next hold `ready`, set `ready_copy_id`, `expires_at = today+hold_days`, copy → `reserved`, emit `school.library.hold_ready`; else emit `school.library.loan_returned`.
- `POST .../loans/:id/renew` — only if `renewals < renew_limit`, not past due (400 `overdue_cannot_renew`), no other student has `queued|ready` hold on that title (409 `hold_pending`); extend due_on by loan_days from today; increment renewals; emit `school.library.loan_renewed`.
- `POST .../holds` `{title_id, student_ref}` — reject if an available copy exists and student could borrow now? **No** — allow holds only when `available` count is 0 (400 `copies_available`); append queue position; emit `school.library.hold_placed`.
- `POST .../holds/:id/cancel` — reorder remaining queue positions; if `ready`, release copy to `available` (or next queued).
- `POST .../holds/:id/fulfill` `{copy_id|barcode}` — only `ready` hold for that student; creates loan (same rules as issue); hold → `fulfilled`.
- `POST .../loans/mark-overdue {as_of?}` — open loans with due_on < as_of → leave status `open` but endpoint returns count; **do not** invent a separate overdue status on open loans (fines own that in P10-03). Idempotent scan OK.
- Lists: `GET .../loans?student_ref=&status=open|returned&overdue=1`, `GET .../holds?title_id=&student_ref=&status=`

Tests: issue/return happy path; max loans; barcode issue; renew limits + overdue block + hold_pending; hold queue only when zero available; return → hold_ready; fulfill; cancel reorders; tenant isolation; events published (assert via test publisher or log spy used elsewhere in school services).

---
## PROMPT P10-03 — Fines + overdue ledger

Read CONVENTIONS + circulation service.

`migrations/003_fines.sql`:
- Extend `library_settings` (new migration ALTER/replace pattern matching other school services): `fine_paise_per_day INTEGER NOT NULL DEFAULT 500`, `fine_cap_paise INTEGER NOT NULL DEFAULT 20000`, `grace_days INTEGER NOT NULL DEFAULT 0`
- `fines`: id, tenant_id, loan_id, student_ref, days_overdue INTEGER NOT NULL, amount_paise INTEGER NOT NULL, status (`open|paid|waived`) DEFAULT 'open', waived_reason NULL, paid_on NULL, created_at, updated_at. Unique `(tenant_id, loan_id)` for the assessed fine row (one fine record per loan; amount may be recomputed while `open`).

Rules (pure helpers in `fine-math.ts`, table-driven tests):
- Overdue days = max(0, calendar days from due_on to `as_of` − grace_days).
- Amount = min(days * fine_paise_per_day, fine_cap_paise). Never floats.
- Return of an overdue loan **assesses/updates** the open fine before closing (P10-02 return path calls into fine service — keep in school-library only).

Routes:
- `POST .../fines/assess {as_of?}` — for every open loan overdue as_of, upsert open fine; return `{assessed, total_paise}`.
- `GET .../fines?student_ref=&status=`
- `POST .../fines/:id/pay` `{received_on?}` — open → paid (400 if already paid/waived). Emit `school.library.fine_paid {amount_paise, student_ref}` (engagement may notify; do not call engagement).
- `POST .../fines/:id/waive` `{reason}` — reason required min 3 chars; admin path; emit `school.library.fine_waived`.
- `GET .../students/:studentRef/library-summary` → `{open_loans, overdue_loans, open_fines_paise, holds}` (counts + paise only — no identity PII).

Block issue when student has `open` fines totaling > 0? **Yes** — `POST .../loans` returns 409 `{error:"fines_outstanding", open_fines_paise}` (commercial norm for school libraries; waiver/pay clears). Add regression: waive then issue succeeds.

Tests: fine math incl. grace + cap; assess idempotency; pay/waive; issue blocked on outstanding fines; summary shape; tenant isolation. DoD per CONVENTIONS.

---
## PROMPT P10-04 — Library module (frontend)

Read `prompts/school/F-frontend.md` header rules, `frontend/shared/api.js`, `frontend/shared/router.js`, `frontend/modules/school_students/school_students.js` (pattern), `frontend/shell.html` school nav block.

Create `frontend/modules/school_library/` (css/html/js) + register route `school_library` under the school group (`school_vertical` flag). Nav label: Library. Calls only `api.school('school-library')`.

Views (internal tab switch):
1. **Catalogue** — search titles; create/edit title (ISBN field with client-side length hint only — server validates); list copies with status chips; add copy (barcode).
2. **Issue / Return** — barcode or copy picker + student_ref text field (paste id from students module; no cross-service student typeahead required in v1); show due date from settings; return + renew actions; surface `fines_outstanding` / `hold_pending` errors via toast.
3. **Holds** — queue per title; cancel; fulfill when ready.
4. **Fines** — open fines list; pay / waive (waive prompts reason via `shared/modal.js`); settings sub-panel for loan_days / renew_limit / max_open_loans / fine rates (paise inputs as integers).

Tests: `frontend/tests/integration/school_library.test.js` — catalogue render; issue posts body; fines_outstanding toast; settings save; zero `localStorage` / raw `fetch` in the module (grep assertion). DoD: suite green.

After P10-04: add `'school-library'` expectations to any gateway map-size tests still hardcoding 9 services; update `prompts/school/README.md` status row for P10 to ✅.
