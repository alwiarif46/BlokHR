# BlokHR School — Cursor Prompt Pack

Execution playbook for building the school vertical. Source plan: `BLOKHR-SCHOOL-PLAN.md` (project doc).

## How to use

1. **One prompt = one Cursor session.** Never paste two prompts at once. Never say "continue with the next phase".
2. Run prompts **in file order, block order** (P0-01 → P0-02 → …). Later prompts assume earlier ones are merged and green.
3. Every prompt starts by telling Cursor to read `prompts/school/00-CONVENTIONS.md` and named existing files. Do not skip that line — it is what stops hallucinated APIs.
4. After each prompt, run the **Definition of Done** commands yourself before starting the next prompt. If red, fix in the same session with a short follow-up ("test X fails with Y, fix it"), not a new feature prompt.
5. If Cursor invents an endpoint, table, or helper that a prompt did not name → reject the diff and re-run the single prompt. Do not patch hallucinations forward.

## Hard rules (repeated in every prompt; also enforced by .cursor/rules)

- All school code lives in `services/school-*` packages. **Never** add routes/services/repositories to `backend/src/*`.
- Each service owns its own `migrations/`. No cross-service DB access, no imports from another service's `src/`.
- Cross-service communication: HTTP + the `EventPublisher` interface (defined in P0-02). Never direct DB reads.
- Tenant-scoped paths: `/api/<domain>/:tenantId/...` (same shape as entitlements).
- Students/guardians are `school-identity` data. Never rows in the monolith `members` table.
- No localStorage in frontend modules except `shared/session.js`. No raw fetch. CSS variables only.
- No student biometrics, no emotion/engagement detection, no Aadhaar authentication — anywhere, in any prompt.
- **No real board syllabus content authored by Cursor** — packs ship as marked samples; official content is a human content task (see P11).
- **RBAC (P12 onward): server-side is the boundary.** Frontend gating is cosmetic; every new route ships with a policy-table entry (deny-by-default) or its prompt is incomplete. No student principal exists — reject any prompt inventing one.

## Order

Read `RECONCILIATION.md` once before P0-01 (capture vs school-* boundaries). Then:

| File | Prompts | Builds | Status |
|---|---|---|---|
| P0-platform-identity.md | 8 | entitlements modules, service scaffold pattern, school-identity, consent, UDISE enums, state packs | ✅ done |
| P1-timetable.md | 5 | school-timetable | ✅ done |
| W-wizard-vertical.md | 5 | setup-wizard step 0 (Company/School), vertical plumbing via entitlements, BlokSchool brand assets + preset, terminology section + labels.js | ✅ done |
| G-gateway.md | 3 | `services/gateway` — one port, `/svc/<name>` proxy, static frontend, SSE passthrough, `dev:school` script | ✅ done |
| P2-attendance.md | 10 (P2-00 rename first) | rename thin capture package → `capture-rollcall`, then real school-attendance + nudge + native staff leave (P2-09) | ✅ done |
| P3-academics.md | 7 | school-academics + variance | ✅ done |
| P4-assessment.md | 6 | school-assessment + HPC store | ✅ done |
| P5-engagement.md | 4 | school-engagement | ✅ done |
| P6-fees.md | 3 | school-fees | ✅ done |
| P7-transport.md | 3 | school-transport | ✅ done |
| P8-compliance.md | 4 | school-compliance (UDISE export, APAAR, OASIS/LOC calendars) | ✅ done |
| P9-guardian-auth.md | 4 | guardian credentials + sessions (school-identity), gateway guardian guard + allowlist, guardian-scoped service endpoints, parent portal frontend | ✅ done |
| F-frontend.md | 6 | frontend modules for the school shell | ✅ done (ends at F-06 HPC) |
| **P10-library.md** | 4 | `school-library` (port 3020) — catalogue/ISBN, circulation, fines (paise), frontend module | ✅ done |
| **F07-school-settings.md** | 1 | School Settings real module: sidebar moved to bottom admin block (before Settings, dual-gated admin+flag); Excel/CSV import + template MOVED here from Students (pointer button left behind); tabs: Data Import (with row-level error table), Academic Sessions, State Pack, Consent Overview | ✅ done |
| **P11-syllabus-packs.md** | 4 | Versioned board syllabus packs in school-academics: pack format + fail-fast registry (IB/Cambridge refused in code), install endpoint reusing the P3-07 import service (skip-existing, atomic, update-available), 3 SAMPLE starter packs (cbse-2026-27, icse-2027, mh-ssc-2026-27) + promotion checklist, School Settings fifth tab "Syllabus Packs" | ✅ done |
| **P12-rbac.md** | 6 | **Security phase — run before any real deployment.** Staff introspect (monolith auth extension) + `docs/RBAC.md`; gateway staff guard on `/svc/*` with role headers, whoami, introspect blocked from outside, PUBLIC_PATHS device exemptions; role-guard middleware + deny-by-default policy tables in every school service + directory (kills the spoofable X-User-Email admin check); teacher record-scope via timetable verify (fail-closed); frontend role awareness (cosmetic). Roles: employee/manager/hr/teacher/office/school_admin/admin; principals: staff/guardian/internal, no student | ✅ done — P12-01 ✅ · P12-02 ✅ · P12-03 ✅ · P12-04 ✅ · P12-05 ✅ · P12-06 ✅ |
| **P13-diary.md** | 3 | Daily diary (teacher → guardian): entries in school-engagement (class-wide + per-student; homework/note/remark/reminder; 24h author edit window; teacher limited to today/yesterday; L5 section scope via timetable verify); guardian read + ack via P9 allowlist with **server-side section resolution** (one new identity internal route); parent portal Diary feed with Seen ✓; teacher Diary view inside school_roll_call (online-only — never the IndexedDB queue) | ✅ P13-01 · P13-02 · P13-03 done |

Roughly 86 sessions. **Prompt pack complete** (P0–P13, F07, W, G). Ordering notes for history: P12-01→06 sequential; P13 required P12 + P9; P11-04 needed F07.

## Standing gaps (tracked, not yet prompted)
- **Device authentication** for PUBLIC_PATHS (kiosk check-in, capture posts, transport boarding/pings): P12-02 exempts them with a marker comment. Needs per-device keys — new prompt file when hardware rollout starts.
- Premium umbrella module id `school_operations` remains in entitlements for future non-library ops — do not implement it without a new prompt file.
- HR tenant settings stay in `settings` (not School Settings). New School Settings sections get their own prompt.
- **Official pack content**: the three P11 packs ship as `status:'sample'`. Promoting to `official` = a human derives real topic trees from the named official PDFs (cbseacademic.nic.in, CISCE Regulations & Syllabuses, Balbharati/MSBSHSE) per `packs/README.md`. IB/Cambridge are permanently excluded — licensed curricula, school-uploaded only.
- Diary class-wide **digest** enumeration is a documented no-op in P13-01 (engagement cannot enumerate a section's guardians without a second identity call) — revisit alongside any future guardian-directory sync. Student-specific diary ingest queues `digest` urgency when `guardian_ref` is on the event (same path as `marked_absent`).

## Resolved (2026-08-15/16)
- Git initialised at root — baseline commit `3091c37` on `main`. Commit after every green prompt session.
- Teacher leave → **P2-09** (thin, native in school-attendance; monolith `leaves` untouched).
- Guardian login → **P9** (deferred past P5 by design, prompts ready).
- School Settings placeholder → **F07** ✅ (import/template relocation + real module; later extended with Syllabus Packs + Attendance Policy / Eligibility / Nudge).
- Board syllabi seeding → **P11** ✅ (packs = our derived structures, never board PDFs; IB refused in code).
- Who-sees-what → **P12** ✅ (`docs/RBAC.md` canonical matrix).
- Daily diary → **P13** ✅ (guardian surface row extended).
