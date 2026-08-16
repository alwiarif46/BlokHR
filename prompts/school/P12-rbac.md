# P12 — RBAC: principals, roles, and enforcement

Code review findings this phase fixes (verified 16 Aug 2026):
- **Guardian surface is secured** (bearer → identity introspect → allowlist → scoped `X-Blok-*`; guardian principal denied outside `/guardian`; services check internal secret via `internal-auth.ts`). Keep as-is.
- **Staff surface is NOT secured.** `/svc/:service` proxies any request: header hygiene strips inbound `X-Blok-*` and injects the internal secret, but nothing authenticates the caller or resolves a role. Every school-* endpoint (create students, publish marks, read consents, install packs) is callable by anyone who can reach the gateway.
- **Directory's admin check trusts a client header.** `callerEmail()` reads `X-User-Email` straight off the request — spoofable.
- Role data exists twice: monolith `/api/user-roles` (isAdmin/isGlobalManager/isGlobalHR/managerOf/hrOf) and directory `members.role` (free string). Neither reaches school services.
- Frontend gating (`role-gated`/`admin-gated`/`data-flag`) is display-only. That is fine — but it is currently the ONLY staff gating that exists.

## The model (P12-01 writes this into `docs/RBAC.md` verbatim)

**Principals:** `staff` (monolith members: employees, teachers, office, admins) · `guardian` (P9, done) · `internal` (service→service, `X-Blok-Internal`). **No student principal — out of scope; any prompt inventing one is rejected.**

**Staff roles** — stored on `directory.members.role`, formalized enum: `employee | manager | hr | teacher | office | school_admin | admin`. `admin` additionally derives from the monolith admins list (belt-and-braces, matches shell.html today). `manager`/`hr` remain derived in HR-land from managerOf/hrOf (monolith behaviour unchanged).

**Six gating layers** (each check names its layer in code comments):
- L1 entitlements — tenant owns the module (`canUseModule`)
- L2 feature flags — tenant enabled; `admin_only` flags
- L3 principal gate — gateway: guardian vs staff, introspected, never client-asserted
- L4 role policy — per-service route policy table, driven ONLY by gateway-set `X-Blok-*` + internal secret
- L5 record scope — teacher → own allocated sections; guardian → linked students; employee → self
- L6 UI gating — sidebar/buttons; cosmetic only, never the security boundary

## Access matrix (canonical — policy tables in P12-03/04 implement exactly this)

| Capability | guardian | teacher | office | school_admin | admin |
|---|---|---|---|---|---|
| Own children: attendance, published report cards, homework, fees ledger, transport events, threads, surveys, reported absence | ✅ (via /guardian only) | — | — | — | — |
| Roll call mark/edit (own sections), own timetable, cover respond, own staff check-in | — | ✅ | — | ✅ | ✅ |
| Lessons/delivery/homework/HPC teacher-inputs/marks **draft** — own sections only (L5) | — | ✅ | — | ✅ | ✅ |
| Students read (roster fields only — no consents, no aadhaar_last4, no financial) | — | ✅ own sections | ✅ | ✅ | ✅ |
| Students/guardians CRUD, enrolment, consent recording, capture bindings, imports | — | — | ✅ | ✅ | ✅ |
| Absence worklists (unexplained, reported, escalation), payment recording, transport manifests, library circulation | — | — | ✅ | ✅ | ✅ |
| Marks publish/moderate, report-card templates+generate, regularization approve, rollups, staff finalize, cover assign, nudge config/run | — | — | — | ✅ | ✅ |
| School Settings (all F07 tabs), syllabus pack install, fee structures, RTE claims, compliance exports, APAAR readiness, DSR | — | — | — | ✅ | ✅ |
| HR settings, feature flags, directory member management, entitlements | — | — | — | — | ✅ |
| Employee self-service (own attendance/leaves/regularizations/timesheets/profile/prefs) | — | ✅ (as staff) | ✅ | ✅ | ✅ — existing monolith enforcement, untouched |

Run order: P12-01 → P12-06, one Cursor session each. P12-02 depends on 01; 03/04 on 02; 05 on 03; 06 last.

---
## PROMPT P12-01 — Staff session introspection (monolith auth extension)

Read `prompts/school/00-CONVENTIONS.md`, `backend/src/auth/auth-service.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/multi-auth.ts`, `backend/src/services/multi-auth-service.ts`, and `services/school-identity/src/routes/guardian-auth.ts` (the introspect precedent to mirror).

This is a deliberate, minimal extension of the EXISTING monolith auth domain (allowed under the "bug fixes / extraction out of scope" clause — long-term owner is a future auth service; say so in a file-top comment). **Adapt to how staff sessions actually work in the code you just read — do not invent a session store.** If session tokens are persisted server-side, look them up; if they are validated some other way, reuse that exact mechanism.

Add `POST /api/auth/introspect` to the existing auth router:
- Guarded by `X-Blok-Internal` header equal to env `INTERNAL_SECRET` (401 otherwise; constant name and check style copied from `services/school-identity/src/internal-auth.ts`). Never exposed to browsers (gateway strips inbound X-Blok-*, so only the gateway can call it — note this in a comment).
- Body `{token}` → `{active:boolean}` and, when active: `{email, name, tenantId, isAdmin, isGlobalManager, isGlobalHR, managerOf, hrOf}` — resolve exactly as the existing `/api/user-roles` route resolves them (call the same service functions; do not duplicate logic).
- Invalid/expired/empty token → `{active:false}` with 200 (mirror guardian introspect's shape).
- Also create `docs/RBAC.md` containing, verbatim, the "The model" and "Access matrix" sections from the top of this prompt file.

⚠️ Known exposure handled in P12-02: the gateway injects `X-Blok-Internal` on every proxied request, so without a block a browser could reach this route through the gateway. P12-02 adds the gateway-side 404 for `/api/auth/introspect`; until P12-02 lands this endpoint only leaks a caller's own claims for a token they already hold — acceptable for one session, but run P12-02 immediately after.

Tests (monolith test suite, existing patterns from `tests/integration/auth.test.ts` if present, else follow multi-auth tests): valid token → full claims matching user-roles output; bad token → active:false; missing internal secret → 401; admin vs non-admin claims. DoD: monolith `npx vitest run` and `npx tsc --noEmit` green — zero existing tests broken.

---
## PROMPT P12-02 — Gateway staff guard for school services

Read `services/gateway/src/index.ts`, `src/guards/guardian-introspect.ts` (CachedIntrospect pattern), `src/proxy-headers.ts`, `src/config.ts`, and `services/directory/src/routes/directory.ts`.

1. **Directory lookup route** (in `services/directory`): `GET /api/directory/members/lookup?email=` → `{member: {id, role, active} | null}`, guarded by `requireInternalMatch`-style internal-secret check (copy the helper from school-identity `internal-auth.ts` into directory — copy, never import). Case-insensitive email match, inactive members return `{member:null}`.
2. **Gateway staff introspection** (`src/guards/staff-introspect.ts`): mirror `guardian-introspect.ts` — `createHttpStaffIntrospect` POSTs the monolith `/api/auth/introspect` (env `MONOLITH_URL` already in config) with the internal secret; `CachedStaffIntrospect` with the same TTL/caching semantics as the guardian one; on active, resolve directory role via the lookup route (also cached, same TTL). Role resolution: directory role if member found; else `isAdmin ? 'admin' : 'employee'` (covers pre-directory tenants).
3. **Guard `/svc/*`** — in the `/svc/:service` handler:
   - Parse bearer. No token → 401.
   - Introspect down → **503 fail-closed** (school data; contrast with the documented fail-open on monolith staff paths — leave that behaviour alone).
   - Inactive → 401. Active → set `_blokExtraHeaders` (the existing mechanism): `X-Blok-Principal: staff`, `X-Blok-Email`, `X-Blok-Role`, `X-Blok-Admin: 1|0`, `X-Blok-Tenant`, plus `X-Blok-Member` when directory found. Guardian-principal requests to `/svc/*` stay 403 (existing middleware already does this — do not touch it).
   - Guard ALL proxied services by default (check `config.ts` SERVICE_NAMES), with an explicit `PUBLIC_PATHS` allowlist for device-facing endpoints that cannot authenticate yet — read each service's routes and list them precisely (expected: kiosk device check-in, capture/capture-rollcall device posts, transport `POST .../boarding` and `POST .../pings`). Every PUBLIC_PATHS entry gets a comment `device auth pending — tracked in prompts/school/README.md standing gaps`. List the final guarded set + exemptions in the diff summary.
4. **Block introspect from outside**: before the monolith proxy, return 404 for any method on `/api/auth/introspect` (the gateway would otherwise attach the internal secret to a browser-originated call — closes the P12-01 exposure). Test it.
5. `GET /whoami` on the gateway: bearer → staff introspect → `{principal:'staff', email, role, isAdmin, tenantId, memberId}`; no token → `{principal:'anonymous'}`. Staff-only — guardian tokens return `{principal:'anonymous'}` (the guardian portal has its own session surface). Frontend uses this in P12-06.

Tests (gateway suite, stub introspect fns like existing guardian tests): no token 401; introspect-down 503; active+role headers reach a stub upstream (assert exact header set and that inbound spoofed `X-Blok-Role` was stripped first — the hygiene function already strips, add the assertion); directory-miss fallback role; PUBLIC_PATHS pass without a token, everything else on the same service does not; `/api/auth/introspect` 404 from outside; whoami all three states; guardian token on /svc still 403. DoD per CONVENTIONS.

---
## PROMPT P12-03 — Role-guard middleware + first two policy tables

Read `prompts/school/00-CONVENTIONS.md`, `services/school-identity/src/internal-auth.ts`, `src/routes/identity.ts`, `src/repositories/identity-repository.ts` (for real response field names), and `services/school-attendance/src/routes/*`.

1. Create `src/role-guard.ts` in **school-identity** (≤80 lines; later prompts copy the file per service — never import across services):
```ts
export type Role = 'employee'|'manager'|'hr'|'teacher'|'office'|'school_admin'|'admin';
export interface RoutePolicy { method: string; pattern: RegExp; roles: Role[]; scope?: 'teacher_section'|'self'; }
export function staffFromHeaders(req): {ok:true; email; role: Role; isAdmin; memberId} | {status; error}
  // requires: internal secret match (reuse requireInternalMatch), X-Blok-Principal === 'staff',
  // X-Blok-Role ∈ enum. isAdmin==='1' or role==='admin' ⇒ role 'admin'.
export function guardRoutes(router, policies, opts)  // 403 {error:'role_denied', required:[...]} on miss;
  // unmatched path+method ⇒ 403 {error:'no_policy'} — DENY BY DEFAULT.
```
   Guardian-principal requests bypass `guardRoutes` only on routes already guarded by the P9 guardian checks (identity guardian-auth routes); everywhere else guardian ⇒ 403 (the gateway already blocks this; the service check is defence in depth).
2. **Policy table — school-identity** (apply to the identity router; guardian-auth router untouched): sessions/state-packs GET `[teacher,office,school_admin,admin]` (teacher needs session list for enrol dropdowns — read-only); sessions POST/PUT + state-pack PUT `[school_admin,admin]`; students GET list/detail `[teacher,office,school_admin,admin]` **with field redaction for teacher — strip the Aadhaar-last-4, guardian-contact, and all consent fields from the RESPONSE objects using the exact camelCase keys the repository returns (read `identity-repository.ts` for the real names, e.g. `aadhaarLast4`, `guardianContact`) when role==='teacher'** (test asserts the keys are absent, not empty); students POST/PATCH/enrol/exit/import `[office,school_admin,admin]`; guardians all `[office,school_admin,admin]`; consents GET summary `[office,school_admin,admin]`, consent transitions `[office,school_admin,admin]`; udise preflight `[school_admin,admin]`.
3. **Copy `role-guard.ts` into school-attendance** and apply: reason-codes GET all four staff roles, POST/PATCH `[school_admin,admin]`; settings GET all staff, PUT `[school_admin,admin]`; `/mark` + record PATCH `[teacher,office,school_admin,admin]` with `scope:'teacher_section'` tagged for teacher (enforced in P12-05 — until then the tag is inert; add a comment "scope enforced by P12-05"); regularize `[school_admin,admin]`; capture bindings/capture `[office,school_admin,admin]`; staff check `[teacher,office,school_admin,admin]` (self), staff bulk mark + finalize `[school_admin,admin]`; reported-absences POST `[office,school_admin,admin]` (guardian path comes via P9 headers, keep working — test); unexplained/worklists `[office,school_admin,admin]`; rollups compute + nudge config/run `[school_admin,admin]`; eligibility + rollups GET `[teacher,office,school_admin,admin]`.

Tests per service: allowed/denied per representative route × role (table-driven — iterate the policy table itself so new routes without policy fail the test); deny-by-default on an unregistered path; teacher redaction; guardian bypass on guardian-auth routes only; missing/forged headers (no internal secret; role header without principal) → 401/403. DoD per CONVENTIONS; existing tests updated to send staff headers via a shared test helper `asRole(role)` added to each service's test setup.

---
## PROMPT P12-04 — Policy tables for the remaining services

Read `docs/RBAC.md`, the P12-03 `role-guard.ts` in school-identity, and each target service's routes before writing its table. Copy `role-guard.ts` into each service (copy, never import). Deny-by-default everywhere.

**Cross-cutting rules for this prompt:**
- *memberId checks*: a teacher whose gateway claims carry no `X-Blok-Member` (not in directory) fails every memberId-matched route with 403 `{error:'no_member_binding'}` — teachers must exist in directory; test it once per affected service.
- *internal-only routes* (`delivery/infer`, engagement `ingest`, transport device paths): "internal" = request carries the internal secret and NO `X-Blok-Principal` header (direct service→service). Gateway-proxied staff requests always carry a principal and follow the role table. Consequently: update **school-assessment's `academics-client.ts`** and **every service's `HttpEventPublisher`** to send `X-Blok-Internal` from env `INTERNAL_SECRET` (they currently post bare — this prompt makes bare posts 401).

- **school-timetable**: reads (terms/day-schemes/sections/subjects/allocations/slots/instances) all staff school roles incl. teacher; writes `[school_admin,admin]`; teacher's own `/teachers/:memberId/slots` — teacher allowed only when `:memberId` equals their `X-Blok-Member` (403 otherwise, test); absences POST `[teacher,office,school_admin,admin]` (teachers report own — same memberId check); cover offer/assign/uncovered `[school_admin,admin]`; cover respond `[teacher,...]` with memberId match on the offered teacher.
- **school-academics**: outcomes/curriculum/coverage/variance reads all staff school roles; courses/units/topics/import writes `[school_admin,admin]`; lessons CRUD+submit `[teacher,school_admin,admin]` (teacher rows filtered to own `teacher_member_id` on list, memberId-matched on write); review/sample/stale `[school_admin,admin]`; delivery assert/delete `[teacher,school_admin,admin]` (scope tag); delivery/infer internal-only; homework CRUD `[teacher,school_admin,admin]` (scope tag), submissions grade/return same, sweep `[school_admin,admin]`; packs registry GET all staff school roles; pack install `[school_admin,admin]`.
- **school-assessment**: exam-terms/exams reads all; writes `[school_admin,admin]`; marks PUT draft `[teacher,school_admin,admin]` (scope tag); publish + moderate `[school_admin,admin]`; questions/papers/blueprints `[teacher,school_admin,admin]` reads + question create, paper persist `[school_admin,admin]`; item analysis `[teacher,school_admin,admin]`; HPC inputs POST `[teacher,school_admin,admin]` (scope tag; source 'parent' rows continue arriving via guardian surface — verify the P9 path still passes); HPC reads `[teacher,school_admin,admin]`; report templates/generate `[school_admin,admin]`; report-cards GET `[office,school_admin,admin]`; outcome feedback run `[school_admin,admin]`.
- **school-engagement**: settings/channels PUT `[school_admin,admin]`, reads `[office,school_admin,admin]`; messages queue POST internal + `[office,school_admin,admin]`; ingest = internal-only; digest run + escalation `[office,school_admin,admin]`; threads: list/assign/close `[office,school_admin,admin]`, reply school-side `[teacher,office,school_admin,admin]` (teacher only on threads assigned to them — memberId match), guardian side unchanged via P9.
- **school-fees**: heads/structures/concessions/assignments/generate `[school_admin,admin]`; invoices/outstanding/ledger reads `[office,school_admin,admin]`; payments POST + reconcile `[office,school_admin,admin]`; bounce `[school_admin,admin]`; RTE claims `[school_admin,admin]`.
- **school-transport**: fleet/routes/stops writes `[school_admin,admin]`; reads + manifests `[office,school_admin,admin]`; boarding + pings = device/internal paths — internal-only per the cross-cutting rule (document why); sweep/check-delay `[office,school_admin,admin]`.
- **school-compliance**: everything `[school_admin,admin]`; DSR create additionally `[office]` (front desk receives requests).
- **school-library** and **school-surveys**: read each service's routes first; circulation/desk operations `[office,school_admin,admin]`, catalogue/config writes `[school_admin,admin]`, survey authoring `[school_admin,admin]`, teacher read access to catalogue/search; guardian survey responses stay on the P9 path.
- **directory**: replace the spoofable `callerEmail`/`isAdmin` option with role-guard: reads `[hr,school_admin,admin,manager]`, writes `[admin]`. Delete the `X-User-Email`-based `requireAdmin` (this is the security fix — say so in the diff summary).

Tests: same table-driven pattern as P12-03 per service; every service gains `asRole()` helper; every existing test updated. DoD: all touched services green.

---
## PROMPT P12-05 — Teacher record scope (L5)

Read `services/school-timetable/src/routes/*` (slots, instances, allocations), and the `scope:'teacher_section'` tags left by P12-03/04 in school-attendance, school-academics, school-assessment.

1. **school-timetable** gains one internal route (internal secret only, no staff role — service→service): `POST /api/timetable/:tenantId/internal/verify-teacher` body `{teacher_member_id, period_instance_id?| section_ref?}` → `{allowed:boolean}` — allowed when the teacher has a slot allocation for that period instance's (section, allocation) or any allocation in that section this session. Pure lookup, no writes.
2. Each of the three tagged services gains `src/clients/timetable-client.ts` (env `TIMETABLE_URL`; stub-tested; **fail-closed**: client error ⇒ `{allowed:false}` and the route 403s `{error:'scope_unverifiable'}` — scope checks are security, the opposite of the fail-open notification clients; put this contrast in a comment).
3. Enforcement, only when `X-Blok-Role === 'teacher'` (office/school_admin/admin skip): attendance `/mark` verifies `context.period_instance_id`; attendance record PATCH verifies the period_instance_id **read from the stored record**, not the body; academics delivery + homework writes verify `section_ref`; assessment marks-draft + HPC inputs verify the exam's/activity's `section_ref` **read from the stored exam row**, not the request body — test a forged-body attempt on both. Cache verify results per request only (no TTL cache — allocations change).
4. Lessons/threads memberId self-checks from P12-04 stay as they are (no timetable call needed).

Tests per service: teacher allowed on own section; denied on another section; forged body section vs stored exam section; timetable down ⇒ 403 scope_unverifiable (never 500); non-teacher roles bypass (no client call — assert stub not invoked). DoD per CONVENTIONS.

---
## PROMPT P12-06 — Frontend role awareness (L6, cosmetic)

Read `frontend/shell.html` (applyRoleGates ~line 1000, sidebar ~450–600), `frontend/shared/router.js`, `frontend/shared/session.js`, `frontend/shared/api.js`, and `docs/RBAC.md`.

1. On login (where `loadUserRoles` runs), also call gateway `GET /whoami` (via `shared/api.js`; if it 404s — older gateway — degrade silently to current behaviour). Store `schoolRole` in the session via `updateSession('schoolRole', ...)`.
2. Sidebar: add `data-school-roles="teacher,office,school_admin"` attributes to the school sb-items in shell.html per the matrix: roll_call+academics+hpc → `teacher,school_admin` (office excluded); students+attendance_admin+library → `office,school_admin`; surveys → `school_admin`; school_settings keeps admin-gated+flag (unchanged). Extend `applyRoleGates()` to intersect: item visible iff (existing flag/admin logic) AND (no `data-school-roles` OR schoolRole/admin matches). `admin` and `is_admin` always pass.
3. Module-level action hiding (display only — the server already enforces): school_attendance_admin hides Regularize-approve, Settings, Nudge tabs for role teacher/office per matrix; school_academics hides review queue + course/import writes for teacher (keeps lessons+delivery); school_students is hidden for teacher entirely (remove any teacher path assumptions); school_settings unchanged (admin only already). Each hidden control gets a one-line comment `L6 cosmetic — enforced server-side by P12-0x`.
4. Add a `403 role_denied / scope_unverifiable` toast mapping in `shared/api.js` error handling: "You don't have access to do this" (single generic string — no role leakage).

Tests: whoami wiring + degrade path; sidebar intersection per role (table-driven over the four roles); tab/action hiding per module; 403 toast mapping. DoD: frontend tests green; grep confirms no new localStorage keys.
