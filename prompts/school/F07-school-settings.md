# F-07 — School Settings module (replaces placeholder)

One Cursor session. Read first: `prompts/school/00-CONVENTIONS.md`, `docs/INSTRUCTIONS.md`, `frontend/shared/router.js`, `frontend/shared/api.js`, `frontend/shared/labels.js`, `frontend/modules/school_settings/school_settings.js` (current placeholder), `frontend/modules/school_students/school_students.js` (you will MOVE code out of it), `frontend/modules/school_attendance_admin/school_attendance_admin.js` (to avoid duplicating its Settings tab), and `frontend/shell.html` sidebar block (lines ~455–600).

This prompt does three things: (1) relocates the sidebar entry, (2) moves bulk import out of Students into School Settings, (3) builds the real School Settings module. Nothing else.

---

## 1. Sidebar relocation

In `frontend/shell.html`: the school group currently sits at lines ~530–552 with `school_settings` last inside it. **Move ONLY the `school_settings` sb-item** down into the bottom admin block, placing it immediately BEFORE the `data-module="settings"` item (line ~594). It must carry BOTH gates: keep `data-flag="school_vertical"` AND add class `admin-gated` (mirror the markup of the adjacent admin items exactly, including `style="display: none"`). The other seven school items stay where they are.

In `frontend/shared/router.js`: `SCHOOL_MODULE_GROUP` keeps `school_settings` as a member (it is still a school module) — no change needed there; do not reorder or rename anything in the map.

Verify: with `school_vertical` on + admin role, School Settings renders at the bottom next to Settings; with the flag off it is hidden even for admins; for non-admins it is hidden even with the flag on.

## 2. Move import out of Students

In `frontend/modules/school_students/school_students.js`:
- **Remove** from the toolbar: `#ssTemplateBtn`, `#ssImportBtn`, `#ssImportFile`, and their bindings in `_bindEvents`.
- **Move** (do not rewrite — cut/paste and adjust names only) `ssDownloadTemplate`, `ssImportFile`, `_readFileAsBase64`, `_csvEscape` into the new School Settings module, renamed `scsDownloadTemplate`, `scsImportFile`, etc. Their behaviour is already correct (identity `POST /students/import` then, when `sessionId` is returned, timetable `POST /import` with the same base64) — keep it byte-for-byte apart from renames and toast wording.
- Leave a single toolbar affordance in Students: a ghost button `Import…` that calls `navigateToModule('school_settings')` (import lives in School Settings now; the button is a pointer, not a feature).
- Update `frontend/tests/integration/school_students.test.js`: delete/adjust import-button tests; add one asserting the pointer button navigates.

## 3. Build the module

Rewrite `frontend/modules/school_settings/` (css/html/js) as a real module following the standard pattern (`renderSchoolSettingsPage` → `scsLoadData` → `scsRenderStats` → `scsRender` → actions → `scsCloseModal`), internal tab switch like `school_attendance_admin`. Delete the `_school_placeholder.js` usage from this module (leave the helper file itself — other placeholders may still use it).

**Tab 1 — Data Import** (the moved feature, now with a proper surface)
- Template download button (moved `scsDownloadTemplate`, unchanged CSV columns).
- Drop zone + file picker for `.xlsx/.xls/.csv` → moved `scsImportFile`.
- Result panel instead of a single toast: after import render counts (students created / enrolled / skipped, day schemes, classes created/skipped) and, when `errors[]` arrays come back, a table of row-level errors (row, field, message) — the arrays are already in the responses; today they are discarded into a count. Toast stays for the summary line.
- Import history is out of scope — do not invent an endpoint for it.

**Tab 2 — Academic Sessions**
- List sessions (`school-identity` `GET /sessions`), create form (label, starts_on, ends_on, is_current checkbox) → `POST /sessions`. Surface the is_current exclusivity plainly ("marking this current unmarks the previous session"). This currently exists nowhere in the UI (Students only reads sessions for the enrol dropdown).

**Tab 3 — State Pack**
- `GET /api/identity/state-packs` list → detail of selected pack (categories, id field pattern, grade schemes); current tenant pack via `GET`/`PUT /state-pack` on `school-identity`. Changing pack shows a confirm modal: "New students will be validated against <pack> categories and ID format. Existing records are not revalidated."

**Tab 4 — Consent Overview**
- Read-only: `GET /consents/summary` rendered as a per-kind table (granted/refused/withdrawn/not_sought) with the standing note "Refusal does not block any service". Link per row → navigates to Students filtered view (just `navigateToModule('school_students')` — deep filter linking is out of scope).

**Boundaries (state these in code comments):** attendance thresholds/granularity stay in `school_attendance_admin` → Settings tab; nudge config stays in its Nudge tab; HR tenant settings stay in `settings`. School Settings must not duplicate any of them — if a future section is wanted, it gets its own prompt.

**Stats bar:** sessions count (current highlighted), tenant state pack code or "not set", students total (reuse identity `GET /students?limit=1`), consent granted % for dpdp_processing.

**CSS:** variables only, reuse the `ss-*` visual vocabulary (copy class patterns from `school_students.css`, prefix `scs-`).

**Tests** — `frontend/tests/integration/school_settings.test.js`: tab switching; template download triggers (mock anchor click); import happy path renders counts; import with `errors[]` renders the error table rows; session create validation + is_current note; state-pack change confirm flow; consent table rendering; stats bar values; and in `school_students.test.js` the removal assertions from §2.

**DoD:** all frontend tests green; grep confirms `localStorage` absent from both touched modules; no new dependencies; `shell.html` diff touches only the moved sb-item block.
