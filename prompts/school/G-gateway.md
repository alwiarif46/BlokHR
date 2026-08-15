# G — Gateway (one port, everything proxied)

> Locked decision (2026-08-15): dev and prod run behind one gateway port. The frontend is served from the gateway origin; every service is reached via `/svc/<service-name>/...`; everything else falls through to the monolith. F-01's `api.school(service)` helper and its `SCHOOL_SERVICES` port table assume exactly this mapping — G must merge before F-01 runs.
> Deliberately thin: no rate limiting, no caching, no auth verification in v1 (the monolith and services keep authenticating as they do today). Guardian-principal deny rules land here later, when guardian login exists (post-P5).

Run order: G-01 → G-02 → G-03. No dependency on P2+.

---
## PROMPT G-01 — Scaffold + /svc proxy + static frontend

Read `prompts/school/00-CONVENTIONS.md`, `services/entitlements/package.json`, `services/entitlements/src/server.ts`, `services/entitlements/tests/entitlements.test.ts`.

Create `services/gateway/` following the entitlements package pattern but with **no database** (no sql.js, no migrations): `@blokhr/gateway`, deps limited to express, cors, dotenv, pino, `http-proxy-middleware` (new dependency — explicitly named and allowed), plus the entitlements devDependency set.

`src/config.ts` — env-driven, fail fast on malformed values, defaults for dev:
- `PORT` (default 8080)
- `MONOLITH_URL` (default `http://localhost:3000`)
- `FRONTEND_DIR` (default `../../frontend` resolved from the package root)
- `SERVICE_MAP` — hardcoded exported const, single source of truth:
  `school-identity:3011, school-timetable:3012, school-attendance:3013, school-academics:3014, school-assessment:3015, school-engagement:3016, school-fees:3017, school-transport:3018, school-compliance:3019`
  each overridable via env `SVC_<NAME>_URL` (e.g. `SVC_SCHOOL_IDENTITY_URL`).

`src/index.ts` — `createGatewayApp({config, logger})` → `{app}`; `src/server.ts` — bootstrap per the entitlements pattern. Routes, in order:
1. `GET /healthz` → `{ok:true, services:<map keys>}`.
2. `/svc/:service/*` → proxy to the mapped upstream, path rewritten to strip `/svc/:service` (so `/svc/school-identity/api/identity/t1/students` hits the service at `/api/identity/t1/students`). Unknown service name → 404 `{error:"unknown_service"}` without proxying.
3. `/api/*` → proxy to `MONOLITH_URL` unchanged.
4. Everything else → static from `FRONTEND_DIR`, `shell.html` as the index and the history-mode fallback for extensionless paths.
Proxy errors (upstream down) → 502 `{error:"upstream_unavailable", service}` — never a hung request (set proxy timeout 30s).

Tests (vitest + supertest; stub upstreams with in-process `http.createServer` on ephemeral ports injected via config override — do NOT bind the real 3011+): healthz; /svc path rewrite verified by echoing stub; unknown service 404; /api fallthrough to monolith stub; static shell.html served at `/`; 502 on dead upstream. DoD: `npx vitest run` + `npx tsc --noEmit` green in `services/gateway`.

---
## PROMPT G-02 — Header hygiene + internal secret

Read `services/gateway/src/*` from G-01.

1. Strip every inbound `X-Blok-*` header from client requests before proxying (spoof protection — a client must never be able to assert internal identity headers).
2. Inject `X-Blok-Internal: <INTERNAL_SECRET>` (new required env in config — fail fast when missing outside `NODE_ENV=test`) on every proxied request, both `/svc/*` and `/api/*`.
3. Forward `Authorization`, `X-User-Email`, `X-User-Name` untouched (the monolith's current auth contract — read `frontend/shared/api.js` header section to confirm the exact names, do not guess).
4. Structured request log per proxied call: method, path, upstream, status, duration. pino, one line, no bodies, no headers logged.

Tests: inbound `X-Blok-Tenant` spoof is absent at the stub upstream; `X-Blok-Internal` present with configured value; auth headers pass through byte-identical; missing `INTERNAL_SECRET` crashes boot outside test env. DoD per G-01.

---
## PROMPT G-03 — SSE passthrough + single-command dev

Read `services/gateway/src/*`, `frontend/shared/sse.js` (the endpoint path it connects to), root `package.json`.

1. SSE: the monolith's SSE endpoint(s) (confirm exact path from `frontend/shared/sse.js` — do not guess) must stream through the gateway unbuffered: disable proxy buffering for that path, set `Connection: keep-alive`, flush headers immediately, no timeout kill on the streaming response. Add a test with a stub upstream that emits two SSE events 100ms apart and asserts both arrive incrementally (read the response as a stream, not a body).
2. Root `package.json`: add `dev:school` script using `concurrently` (add as root devDependency) that boots: monolith (`backend`), `school-identity` (3011), `school-timetable` (3012), and the gateway (8080), each with its dev command and a distinct prefix colour. Document in a root-README section: "open http://localhost:8080 — everything is proxied; add services to the script as P2+ land."
3. `frontend/shared/api.js` needs no change for the monolith (`location.origin` already resolves to the gateway once the app is served from it) — verify and state so; the `/svc/` prefixing helper itself is F-01's job, not this prompt's. Change nothing in `frontend/`.

Tests: SSE streaming test above; script exists and names the four processes (assert via reading package.json in a unit test or skip scripting test and verify manually — state which). DoD: gateway suite green; `npm run dev:school` from the root serves shell.html on :8080 with login working against the monolith (manual check, listed in the final message).
