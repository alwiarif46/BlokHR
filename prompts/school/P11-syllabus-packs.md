# P11 — Syllabus packs (CBSE / ICSE / state boards; IB excluded by policy)

Board syllabi as versioned, installable seed data. Legal position (do not deviate): we never redistribute board PDFs; packs are OUR structured topic trees derived from official syllabi. **IB is contractually excluded — IB guides are licensed to authorized schools only; IB schools use the existing course import with their own material. The pack system must refuse `board: 'ib'` in code.**

Order: P11-01 → P11-04. Each prompt = one Cursor session.

---
## PROMPT P11-01 — Pack format + registry (school-academics)

Read `prompts/school/00-CONVENTIONS.md`, `services/school-academics/src/index.ts`, `src/routes/*`, `src/services/*` (especially the course import service from P3-07 — you will reuse its types), `migrations/002_curriculum.sql`, and the non-tenant-scoped route precedent `GET /api/identity/state-packs` in `services/school-identity`.

In `services/school-academics` only:

1. `src/packs/types.ts`:
```ts
export interface SyllabusPack {
  id: string;                 // '<family>-<year>' e.g. 'cbse-2026-27'
  family: 'cbse' | 'icse' | 'state';
  state_code?: string;        // required when family='state', e.g. 'MH'
  board: 'cbse' | 'icse' | 'state';   // NEVER 'ib' | 'cambridge'
  academic_year: string;      // '2026-27'
  label: string;
  status: 'sample' | 'official';
  source_note: string;        // which official document this was derived from
  courses: Array<{
    subject_code: string; class_label: string; label: string;
    units: ImportUnit[];      // EXACTLY the P3-07 import unit type — import it from the existing import service types, do not redeclare
  }>;
}
```
2. `src/packs/registry.ts` — loads every `*.json` in `services/school-academics/packs/` at app-factory time (synchronous fs read, same style as migrations loading). Validation on load, fail-fast at boot with the filename in the error: id matches `family(-state)?-year` shape; `board` ∈ {cbse, icse, state} — **a file with `board:'ib'` or `'cambridge'` throws** `pack <file>: board '<b>' is not distributable`; state family requires state_code; every course's units payload passes the SAME validator P3-07's import uses (call it, don't copy it); duplicate pack ids throw.
3. Routes (NOT tenant-scoped, mirroring state-packs): `GET /api/academics/packs` → `[{id, family, state_code, academic_year, label, status, course_count, classes:[], subjects:[]}]`; `GET /api/academics/packs/:id` → full pack. Unknown id 404.
4. `createSchoolAcademicsApp` gains optional `packsDir` (default `path.resolve(__dirname,'../packs')`) so tests point at fixture dirs.

Tests (fixture packs under `tests/fixtures/packs-*`): valid pack loads + list/detail shapes; ib pack boot failure with filename; bad units payload boot failure; duplicate id failure; state without state_code failure; empty dir = empty registry, app still boots. DoD per CONVENTIONS.

---
## PROMPT P11-02 — Install endpoint

Read CONVENTIONS + school-academics packs registry (P11-01), the P3-07 import SERVICE function (its atomic-import internals), courses repository, `migrations/002_curriculum.sql`.

`migrations/006_packs.sql` (check the migrations dir first — if 006 is taken, use the next free number and say so in the diff summary): `installed_packs`: id, tenant_id, pack_id, pack_status_at_install, academic_session_id, course_ids_json, installed_by, installed_at.

`POST /api/academics/:tenantId/packs/:packId/install` body `{academic_session_id, installed_by, classes?: string[], subjects?: string[]}`:
1. 404 unknown pack. Filter pack courses by optional classes/subjects subsets (empty result → 400 `{error:"selection_empty"}`).
2. For each selected pack course: if a course with same (tenant, academic_session_id, board, subject_code, class_label) already exists → **skip** (never touch existing courses — the P3-07 delivery-row guard stays the authority on replacement); else create the course row then load its units via the EXISTING import service function (not the HTTP route, the service function — single validation path). All creations in one pass; a validation failure on any course aborts the whole install with per-course errors (the import function is already atomic per course; wrap course creation + import so a failure rolls back that course row too).
3. Write one `installed_packs` row with the created course ids. Emit `school.pack.installed {pack_id, courses_created, courses_skipped}`.
4. Response `{courses_created, courses_skipped:[{class_label, subject_code, existing_course_id}], installed_pack_id}`.

`GET /api/academics/:tenantId/packs/installed` → installed rows + per-row `update_available: <newest registry pack id in same family(+state_code) with academic_year > installed pack's>` (string compare on year is fine for 'YYYY-YY'; test '2026-27' < '2027-28'). Installing the newer pack for a new session is the upgrade path — no in-place mutation, state this in a code comment.

Tests: install full + subset; skip-existing (counts + existing ids); abort-on-invalid leaves zero new courses (fixture pack with one bad course); installed list + update_available true/false; selection_empty; event; tenant isolation. DoD per CONVENTIONS.

---
## PROMPT P11-03 — Starter pack files (SAMPLE content only)

Read CONVENTIONS + P11-01 types + one passing registry fixture.

**Anti-hallucination rule, absolute: you must NOT write real board syllabus content. You do not have the official documents; anything you produce from memory will be wrong and shipped to schools. Every pack you create is `status:'sample'` with obviously-generic topic labels.** Real content is authored later by humans from the official PDFs and dropped into the same files.

Create in `services/school-academics/packs/`:
- `cbse-2026-27.json` — family cbse; courses: Science 8/9/10 + Mathematics 8/9/10; each course 4 units × 3 topics, labels like "Sample Unit 1 (replace from official CBSE 2026-27 curriculum)"; `source_note: "SAMPLE ONLY — derive from cbseacademic.nic.in Secondary Curriculum 2026-27 before marking official"`.
- `icse-2027.json` — family icse; Physics 9/10 + Mathematics 9/10, same sample shape; source_note pointing at CISCE Regulations & Syllabuses 2027.
- `mh-ssc-2026-27.json` — family state, state_code MH; Science-I 9/10 + Mathematics-I 9/10; source_note pointing at Balbharati/MSBSHSE; topic labels in English with a `// Marathi labels required before official` note in source_note.
- `packs/README.md` — 15 lines: what a pack is, sample→official promotion checklist (verify against named official PDF, fill real units, set status official, bump nothing — id stays), the IB prohibition, and the annual process (new year = new file, old file stays).

No code changes. Tests: extend the registry test to load the real `packs/` dir and assert: 3 packs, all `status:'sample'`, every course's units pass validation, every source_note contains "SAMPLE". DoD: vitest + tsc green.

---
## PROMPT P11-04 — School Settings "Syllabus Packs" tab

Read `prompts/school/F07-school-settings.md` §3 boundaries, `frontend/modules/school_settings/school_settings.js` (as built by F07), `frontend/modules/school_students/school_students.css` class vocabulary, `frontend/shared/api.js` (`api.school`).

Add a fifth tab **Syllabus Packs** to the existing school_settings module (do not restructure the other four tabs):
- Registry list from `GET /api/academics/packs` (non-tenant call — check how `api.school` handles non-tenant paths; state-pack precedent exists in this same module's Tab 3, follow it): board badge, year, classes, subjects, and a prominent `SAMPLE` badge when status is sample with tooltip "Placeholder structure — not official board content".
- Install dialog: pick academic session (reuse the sessions list already loaded for Tab 2), optional class/subject checkboxes (from pack detail), confirm → install endpoint. Result panel: created count + skipped table (class, subject, "already exists" link that navigates to school_academics). Surface `selection_empty` and per-course install errors in the panel, not just a toast.
- Installed list from `/packs/installed`: pack, session, course count, `Update available → <id>` chip when flagged (chip opens the install dialog pre-filtered to the newer pack).
- A fixed note in the tab footer: "IB and Cambridge programmes: import your school's own units via Academics → course import. Board packs are not available for licensed curricula."

Tests (extend `frontend/tests/integration/school_settings.test.js`): tab renders registry with SAMPLE badge; install dialog subset selection + result panel incl. skipped rows; error panel path; installed list + update chip; IB footer note present. DoD: frontend tests green, no localStorage, no new deps.
