# P13 — Daily diary (teacher → guardian)

The Indian school diary: teachers write dated entries per class or per student (homework reminders, notes, remarks); guardians read them per child and acknowledge. Owner: **school-engagement** (it is guardian-facing communication, digest-integrated). Three sessions, run after P12 (policy tables exist) and P9 (guardian surface exists).

Matrix delta (add to `docs/RBAC.md` in P13-01): guardian row gains "daily diary (read + acknowledge)"; teacher gains "diary write — own sections only (L5)"; office/school_admin read all + write any section.

---
## PROMPT P13-01 — Diary in school-engagement

Read `prompts/school/00-CONVENTIONS.md`, `services/school-engagement/src/routes/*`, its `role-guard.ts` + policy table (P12-04), its `internal-auth.ts`/guardian header helpers (P9 pattern — see how guardian-scoped reads are done in this service or in school-attendance reported-absences), the digest service (P5-03), and `docs/RBAC.md`.

Migration (next free number) `NNN_diary.sql`:
- `diary_entries`: id, tenant_id, section_ref TEXT NOT NULL, student_ref TEXT NULL (NULL = whole-class entry), entry_date TEXT NOT NULL, kind (`homework|note|remark|reminder`) NOT NULL, body TEXT NOT NULL (≤2000 chars, service-enforced), attachment_refs_json TEXT NULL (storage refs only), author_member_id TEXT NOT NULL, created_at, updated_at. Index (tenant_id, section_ref, entry_date); index (tenant_id, student_ref, entry_date).
- `diary_acks`: id, tenant_id, entry_id, guardian_ref, student_ref, at. Unique (entry_id, guardian_ref, student_ref).

Staff routes (add to the existing policy table — deny-by-default stays):
- `POST /api/engagement/:tenantId/diary` `{section_ref, student_ref?, entry_date, kind, body, attachment_refs?}` — roles `[teacher,office,school_admin,admin]`, `scope:'teacher_section'` for teacher: copy the P12-05 `timetable-client.ts` (this service does not have one yet — copy from school-attendance, never import; env `TIMETABLE_URL`, fail-closed 403 `scope_unverifiable`) and verify `section_ref`; office/admin skip. entry_date today or yesterday only for teachers (back-dating beyond that is `[school_admin,admin]`) — test both.
- `PATCH /api/engagement/:tenantId/diary/:id` — author only (memberId match) within 24h of created_at; after that `[school_admin,admin]`. Body/kind editable; section/student/date immutable (400).
- `DELETE .../diary/:id` — `[school_admin,admin]` only (audit row in existing pattern if the service has one; else log via pino at warn).
- `GET /api/engagement/:tenantId/diary?section_ref=&date=&student_ref=` — `[teacher,office,school_admin,admin]`; teacher results filtered to their verified sections (same scope check on the query's section_ref; a teacher query without section_ref → 400 `{error:"section_required"}`).
- Per-entry ack summary on the GET: `{acks: n, guardians_total: null}` — guardians_total is null here (engagement doesn't know guardian counts; the BFF/frontend composes — comment this).

Guardian path (P9 headers `X-Blok-Guardian` + `X-Blok-Students`):
- **Section resolution must be server-side — the guardian client is never trusted for section membership.** Add ONE internal route to `services/school-identity` (mirror its existing internal-auth style): `GET /api/identity/:tenantId/internal/students/:id/section` → `{section_ref: "<class_label>|<section>", academic_session_id}` from the student's active enrolment (404 if none). Internal secret + no principal, per the P12-04 internal-only rule. Then in school-engagement add `src/clients/identity-client.ts` (env `IDENTITY_URL`, stub-tested, **fail-closed**: error ⇒ 503 `{error:'section_unresolvable'}` — never silently return an empty feed).
- `GET /api/engagement/:tenantId/guardian/diary?student_ref=&from=&to=` — student_ref must be in the `X-Blok-Students` header (403 otherwise); resolve the child's section via the identity client; return class-wide entries (student_ref NULL, matching resolved section) + student-specific entries (student_ref = child), newest first, paginated. Cache the section per request only.
- `POST .../guardian/diary/:id/ack {student_ref}` — student in header list; idempotent (repeat ack = 200, no duplicate row).

Digest integration: on diary create, emit `school.diary.created {section_ref, student_ref, entry_date, kind}` via the existing EventPublisher; the ingest handler (same service) maps it to a `digest`-urgency line. Recipient resolution: read how `school.attendance.marked_absent` ingest resolves recipients today and follow the identical path; if that path lacks guardian enumeration for class-wide entries, handle only student-specific entries (student_ref present) and leave class-wide digest wiring as a documented no-op with the event logged — do not add a second identity call for enumeration in this prompt. Diary is never `interrupt` urgency.

Tests: entry CRUD + immutables + author window + teacher back-date rule; teacher scope verify (own/other section, stub client); teacher list without section 400; guardian list scoping (child in header, child not in header, class-wide vs student-specific); ack idempotency; digest/no-op handler path; deny-by-default intact (policy-table iteration test updated); tenant isolation. DoD per CONVENTIONS.

---
## PROMPT P13-02 — Gateway allowlist + parent portal Diary

Read `services/gateway/src/guards/guardian-allowlist.ts` (P9 allowlist format), gateway tests for guardian paths, and the parent portal frontend (`frontend/modules/guardian_portal/` + `guardian.html`).

1. Allowlist: add `GET /guardian/diary` → school-engagement `/api/engagement/{tenantId}/guardian/diary` and `POST /guardian/diary/:id/ack` → the ack route, following the exact rewrite/param conventions of the existing entries (study two current entries first; copy their shape).
2. Parent portal: add a **Diary** section to the guardian portal module: per-child feed (child switcher already exists — reuse it), grouped by date, kind badge (homework/note/remark/reminder), attachment links (storage refs → existing download pattern if one exists, else plain link), unread-style dot until acknowledged, one-tap "Seen ✓" per entry (optimistic, idempotent). Date-range paging (default last 14 days, "load earlier").
3. Keep portal conventions: whatever CSS/vocabulary and rendering pattern the portal already uses (read it first) — do not import shell module CSS.

Tests: allowlist unit tests for both new entries (allowed for own child, 403 for other student_ref — same style as existing allowlist tests); portal render, child switch, ack optimistic flow + idempotent re-tap, paging. DoD: gateway + frontend suites green.

---
## PROMPT P13-03 — Teacher diary UI (roll-call module)

Read `frontend/modules/school_roll_call/school_roll_call.js` (view structure, period/section picker, offline queue boundaries) and `frontend/modules/school_attendance_admin/*` (tab pattern), `docs/RBAC.md`.

Add a **Diary** view to `school_roll_call` (teachers live here daily; do not create a new module):
- Toggle between Roll call / Diary views for the currently selected section (reuse the existing section/period context — no second picker).
- Compose: kind selector (homework default), body (2000-char counter), optional per-student targeting (photo-grid multi-select reusing the existing grid component in read-only select mode; none selected = whole class), attachment ref field only if the module already has an upload pattern — otherwise omit attachments in this UI (do not build an uploader here).
- Today's entries list for the section with edit (within the 24h/author window — surface the 403 as "editing window closed"), ack counts ("Seen by 12"), and yesterday via a single back toggle (teacher back-date limit mirrors server: today/yesterday only).
- **Diary posts are online-only**: do NOT route through the roll-call offline queue (IndexedDB store is for attendance marks only — the F-03 exception is scoped; add the comment). Offline → disable compose with "Diary needs a connection".
- L6 comment on any hidden/disabled control.

Tests: view toggle preserving section context; whole-class vs targeted compose payloads; char limit; edit-window 403 surfacing; offline compose disabled; ack count render; no writes to the IndexedDB store (assert store untouched). DoD: frontend tests green; no new localStorage/IndexedDB usage.
