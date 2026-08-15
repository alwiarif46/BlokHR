# P9 — Guardian auth + parent surface

> Locked decision (2026-08-15): guardians are a separate auth principal — never rows in `members`, never platform sessions. Deferred past P5 by design, but it must exist before any parent-facing surface ships. Run after P5 (engagement threads exist) and after G (gateway is the enforcement point).
> Trust model: school-identity owns guardian credentials and sessions and exposes token introspection; the gateway validates every `/guardian/*` request against it and injects `X-Blok-Guardian`; downstream services trust that header only when `X-Blok-Internal` matches (G-02). A guardian request must NEVER reach any non-guardian route — enforcement lives in the gateway, not in each service's goodwill.

Run order: P9-01 → P9-02 → P9-03 → P9-04.

---
## PROMPT P9-01 — Guardian credentials + sessions (school-identity)

Read `prompts/school/00-CONVENTIONS.md`, `services/school-identity/src/*` (guardians repository/service/routes), `migrations/002_students.sql`.

`migrations/005_guardian_auth.sql` in school-identity:
- `guardian_credentials`: guardian_id PK, tenant_id, phone TEXT NOT NULL (login identifier — must equal the guardian row's phone; enforce in service), password_hash TEXT NULL, otp_hash TEXT NULL, otp_expires_at NULL, failed_attempts INTEGER DEFAULT 0, locked_until NULL, created_at, updated_at
- `guardian_sessions`: token_hash TEXT PK (sha256 of the opaque token — raw token never stored), tenant_id, guardian_id, created_at, expires_at, revoked INTEGER DEFAULT 0

New npm dependency allowed and named: `bcryptjs` (hashing). Token = 48 random bytes hex via node `crypto` — no JWT, no new signing keys.

Routes (NOT tenant-path-scoped — login precedes tenancy knowledge; tenant resolves from the credential row):
- `POST /api/identity/guardian-auth/set-password {tenant_id, guardian_id, password}` — admin/onboarding call (gateway-internal only later; for now standard route): min 8 chars, bcrypt cost 10.
- `POST /api/identity/guardian-auth/login {phone, password}` — resolve credential by phone across tenants; >1 tenant match → 409 `{error:"ambiguous_phone"}` (v1 limitation, documented); 5 failed attempts → lock 15 min (423). Success → create session (30-day expiry), return `{token, tenant_id, guardian_id, expires_at}` — the ONLY response that ever contains the raw token.
- `POST /api/identity/guardian-auth/introspect {token}` — hash, look up: valid+unexpired+unrevoked → `{active:true, tenant_id, guardian_id}` else `{active:false}`. Always 200.
- `POST /api/identity/guardian-auth/logout {token}` — revoke.

Tests: set/login happy path; wrong password + lockout + unlock-after-expiry; ambiguous phone; introspect all four states (valid/expired/revoked/unknown); raw token absent from DB (assert stored value ≠ token); logout; tenant isolation on set-password. DoD per CONVENTIONS.

---
## PROMPT P9-02 — Gateway guardian principal guard

Read `services/gateway/src/*` (G-01..G-03 merged), `prompts/school/G-gateway.md` trust model note, P9-01's introspect contract.

1. Config gains `IDENTITY_URL` (defaults to the school-identity entry in SERVICE_MAP).
2. New middleware, ordered BEFORE proxying: any request whose path starts with `/guardian/` (the parent surface namespace) must carry `Authorization: Bearer <token>`; the gateway calls identity introspect (in-memory cache 60s per token hash, never cache negatives), and on `active:true` injects `X-Blok-Principal: guardian`, `X-Blok-Guardian: <guardian_id>`, `X-Blok-Tenant: <tenant_id>` and rewrites the request onto the allowlist below. `active:false` → 401. Introspection service down → 503 (never fail-open).
3. **Allowlist — a guardian request can reach exactly these upstream paths and nothing else** (map table in one file, `src/guards/guardian-allowlist.ts`):
   - `GET  /guardian/me/students`        → identity `GET /api/identity/:tenantId/guardians/:guardianId/students`
   - `GET  /guardian/students/:id/attendance` → attendance `GET /api/attendance/:tenantId/guardian/students/:id/summary`
   - `POST /guardian/reported-absences`  → attendance `POST /api/attendance/:tenantId/reported-absences` (guardian id forced from header — see P9-03)
   - `GET/POST /guardian/threads...`     → engagement thread routes (guardian side only)
   Path params substitute from the introspected identity — the client-supplied tenant or guardian id is NEVER used.
4. Requests with `X-Blok-Principal: guardian` (or a guardian bearer token) targeting ANY path outside `/guardian/*` → 403 `{error:"guardian_scope"}` — including `/api/*` and every other `/svc/*` path. Test the deny matrix explicitly: `/api/members`, `/svc/school-identity/api/identity/t1/students`, `/api/settings`.

Tests (stub upstreams + stub introspect): allowlist happy paths with header injection verified at the stub; deny matrix; expired token 401; introspect-down 503; cache hit skips second introspect call; client-supplied X-Blok-Guardian stripped (G-02 regression). DoD per G-01.

---
## PROMPT P9-03 — Guardian-scoped endpoints in school services

Read CONVENTIONS + `services/school-identity/src/routes` + `services/school-attendance/src` (P2-03/P2-06/P2-07 merged) + `services/school-engagement/src` (P5-04 merged).

Server-side scoping — every route below reads guardian identity ONLY from `X-Blok-Guardian` + `X-Blok-Internal` headers (reject with 401 when the internal secret header is absent or wrong; never trust a body/query guardian id):
1. school-identity: `GET /api/identity/:tenantId/guardians/:guardianId/students` already exists (P0-05) — add the internal-secret + header-match check when `X-Blok-Principal: guardian` (guardian may only fetch their own id → 403 otherwise). Response gains per-student `photo_ref`, class/section from active enrolment.
2. school-attendance: new `GET /api/attendance/:tenantId/guardian/students/:studentId/summary?from=&to=` → `{records:[{date, status, excuse, reason_bucket}], monthly:[rollups], eligibility_pct}` — but ONLY when a guardian-student link exists: the service cannot see identity's link table, so the gateway passes `X-Blok-Students: <csv of linked student ids>` (P9-02 amendment: fetch the student list during introspection and inject it — update the gateway allowlist middleware and its tests in THIS prompt, gateway files explicitly permitted here). Requested student not in the header list → 403.
3. school-attendance: `POST /api/attendance/:tenantId/reported-absences` — when `X-Blok-Principal: guardian`, force `reported_by_guardian_id` from the header (body value ignored) and require the student in `X-Blok-Students` (403 otherwise). Existing non-guardian behaviour unchanged (regression test).
4. school-engagement: thread create/reply — when guardian principal, force `guardian_ref` from header; guardian may list/read only own threads (403 on another guardian's thread id).

Tests per service: header-forced identity (body spoof ignored); unlinked-student 403; internal-secret absent 401; non-guardian paths unchanged; tenant isolation. DoD per CONVENTIONS in each touched service.

---
## PROMPT P9-04 — Parent surface (frontend, minimal)

Read `prompts/school/F-frontend.md` header rules, `frontend/shared/api.js`, `frontend/shared/toast.js`, `frontend/shared/themes.js`, `frontend/shared/brand.js` (W-03).

Create `frontend/guardian.html` + `frontend/modules/guardian_portal/` (css/html/js) — a separate minimal entry served by the gateway static handler at `/guardian` (add the static route mapping in `services/gateway` — explicitly permitted, one file). No sidebar, no HR chrome, BlokSchool brand applied via `brand.js('school')`.

Screens (single module, internal view switch):
1. **Login** — phone + password → `POST /guardian/login` (add this one path to the gateway allowlist proxying to identity login — gateway file change permitted). Token held in memory + the existing `shared/session.js` mechanism under a distinct key shape `guardian_session` (this is the approved localStorage surface — session.js only; nothing else stores anything).
2. **Children** — cards from `/guardian/me/students`; multi-sibling switch is one tap (the market-leader defect this exists to beat — instant context switch, no reload, no stale state; test switching updates every pane).
3. **Attendance** — per child: month grid from the summary endpoint, YTD %, eligibility chip; plain CSS, no chart lib.
4. **Report absence** — date-range picker (server rules mirrored client-side: today+, ≤15 dates), reason picker, optional note → `POST /guardian/reported-absences`; success state says the school has been notified.
5. **Messages** — thread list + reply via the guardian thread paths.

Test file `frontend/tests/integration/guardian_portal.test.js`: login flow incl. 423 lockout message; sibling switch refreshes all panes; absence form validation; thread reply; zero localStorage outside session.js (grep assertion in DoD); zero raw fetch. DoD: suite green; `grep -rn "localStorage" frontend/modules/guardian_portal/` returns nothing.
