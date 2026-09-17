# BlokHR deployment — Vercel (frontend) + Railway (backend)

## Account ownership (required reading)

| Layer | Platform | Account owner | Notes |
|-------|----------|---------------|--------|
| **Frontend** | [Vercel](https://vercel.com) | **Arif** — team `arifalwi-2069's projects` (Hobby) | GitHub app / repo access via `alwiarif46` |
| **Backend** | [Railway](https://railway.app) | **Ubaid** | Gateway, monolith, and microservices; secrets live here |

Do **not** mix accounts:

- Do not deploy the frontend project under Ubaid’s Vercel (if any).
- Do not put production API secrets or Railway services under Arif’s Vercel team.
- Share only **public URLs** and **non-secret** contract docs between owners. Secrets stay in each platform’s env UI for that owner.

GitHub source of truth for this product line: `https://github.com/alwiarif46/BlokHR` (branch `school-platform-wip` unless noted otherwise).

### Live Vercel frontend (Arif)

| Item | Value |
|------|--------|
| Team | `arifalwi-2069's projects` (`arifalwi-2069`) |
| Project | `blokhr` |
| Production | **https://blokhr.vercel.app** |
| Root | `frontend/` (static) |
| Git | Connected to `alwiarif46/BlokHR` (push on `school-platform-wip` builds previews; production branch defaults to `main` — promote or change in Vercel settings) |
| API proxy | `vercel.json` rewrites `/api/*`, `/svc/*`, `/healthz` → Railway gateway |

### Live Railway project (Ubaid — bootstrapped)

| Item | Value |
|------|--------|
| Workspace | `ubaidmir-crypto's Projects` (`ubaidmir@shaavir.com`) |
| Project | `blokhr` (`13d0674e-9f17-4ebe-b536-f651f489691b`) |
| Environment | `production` |
| Public gateway | **https://gateway-production-5a5f.up.railway.app** |
| Services up | `gateway` (public), `backend` (private + `/data` volume) |
| Git | Both services connected to `alwiarif46/BlokHR` @ `school-platform-wip` |
| Health | `GET /healthz` → gateway; `GET /api/health` → monolith via gateway |
| `SERVER_BASE_URL` | `https://blokhr.vercel.app` (email / reset links) |

### Multi-tenant Host resolution (required for shared gateway)

BlokHR resolves tenant from **request Host** (not client-chosen IDs). Set the same values on **gateway** and **backend**:

| Env | Example | Purpose |
|-----|---------|---------|
| `TENANT_SUBDOMAIN_BASE` | `13blok.com` | `{slug}.13blok.com` → tenant `slug` (self-serve SaaS) |
| `TENANT_APEX_HOSTS` | `www.13blok.com,13blok.com` | Apex signup portal Hosts (no wizard; Create workspace UI) |
| `TENANT_RESERVED_SLUGS` | `www,api,admin,...` | Extra reserved labels (merged with built-in defaults) |
| `TENANT_HOST_MAP` | `{"blokhr.vercel.app":"default","custom.acme.com":"acme"}` | Exact Host overrides (preview + custom domains) |
| `DEFAULT_TENANT_ID` | `default` | Fallback when Host is unmapped (local/dev only) |

**Self-serve flow:** visitor opens `www.13blok.com` → picks slug → `POST /api/tenants` claims branding row → redirect to `https://{slug}.13blok.com` → setup wizard. Setup POSTs on apex Hosts return `400 use_workspace_subdomain`. Completed workspaces return `409 already_configured` on that slug only.

**DNS / Vercel:** add wildcard `*.13blok.com` (plus apex/`www`) on the `13blok` project so every slug resolves without per-tenant DNS.

**Ops rule:** do **not** map apex/`www` to `default` in `TENANT_HOST_MAP` when subdomain SaaS is enabled — that recreates the shared-tenant deadlock. Keep preview (`blokhr.vercel.app`) on `default` or a dedicated `demo` slug.

School microservices are **not** deployed yet — gateway lists them in `/healthz` config but upstreams still point at localhost defaults until those Railway services are added.

Docker build context: monorepo root. Paths:

- Gateway: [`services/gateway/Dockerfile`](../services/gateway/Dockerfile) (`RAILWAY_DOCKERFILE_PATH=services/gateway/Dockerfile`)
- Backend: [`backend/Dockerfile`](../backend/Dockerfile) (`RAILWAY_DOCKERFILE_PATH=backend/Dockerfile`)
- IaC stub: [`.railway/railway.ts`](../.railway/railway.ts)

Redeploy from repo root (Ubaid CLI session):

```powershell
railway link --project 13d0674e-9f17-4ebe-b536-f651f489691b
railway up --service backend --detach --yes
railway up --service gateway --detach --yes
```

---

## Target architecture

```text
Browser
  │
  ├─ static UI ──► Vercel (Arif)
  │                 frontend/shell.html, guardian.html, assets, modules
  │
  └─ /api/*  /svc/* ──► Railway public gateway URL (Ubaid)
                          │
                          ├─ services/gateway     (public HTTPS)
                          ├─ backend (monolith)   (private)
                          └─ school-* / time-tracking / overtime / … (private)
```

- **Vercel** serves HTML/JS/CSS only. It does not run Fastify or SQLite.
- **Railway** runs the Node API stack. The **gateway** is the only service that must be publicly reachable.
- Locally, one origin (`http://127.0.0.1:8080`) serves UI + API. In this split deploy, UI and API are **different origins**, so the frontend must call the Railway gateway explicitly (see [Frontend ↔ API wiring](#frontend--api-wiring)).

---

## What runs where

### Vercel (Arif) — frontend

| Item | Value |
|------|--------|
| Root / output | `frontend/` (static: `shell.html`, `guardian.html`, `shared/`, `modules/`, `assets/`) |
| Framework | None — static site (or “Other”) |
| Build | Usually none; optional `echo ok` if Vercel requires a command |
| Publish directory | `frontend` |
| Rewrites (recommended) | SPA-style fallback to `shell.html` for app paths; keep `/guardian` → `guardian.html` |

Do **not** set Vercel Serverless Functions as the BlokHR API. All `/api` and `/svc` traffic goes to Railway.

### Railway (Ubaid) — backend

BlokHR is a **multi-process** stack (see root `npm run dev:school`). On Railway, prefer one of:

1. **Recommended for first prod:** one Railway **project**, multiple **services** (or one service per process), private networking between them, **only gateway** has a public domain.
2. **Later:** compress into fewer containers once service maps and health checks are stable.

| Process | Repo path | Default local port | Railway role |
|---------|-----------|--------------------|--------------|
| Gateway | `services/gateway` | 8080 | **Public** HTTPS |
| Monolith | `backend` | 3000 | Private |
| school-identity | `services/school-identity` | 3011 | Private |
| school-timetable | `services/school-timetable` | 3012 | Private |
| school-attendance | `services/school-attendance` | 3013 | Private |
| school-academics | `services/school-academics` | 3014 | Private |
| school-assessment | `services/school-assessment` | 3015 | Private |
| school-engagement | `services/school-engagement` | 3016 | Private |
| school-fees | `services/school-fees` | 3017 | Private |
| school-transport | `services/school-transport` | 3018 | Private |
| school-compliance | `services/school-compliance` | 3019 | Private |
| school-library | `services/school-library` | 3020 | Private |
| learning | `services/learning` | 3021 | Private |
| school-surveys | `services/school-surveys` | 3022 | Private |
| school-family-ops | `services/school-family-ops` | 3023 | Private |
| time-tracking | `services/time-tracking` | 3030 | Private |
| overtime | `services/overtime` | 3031 | Private |

Gateway `SERVICE_MAP` / `SVC_*_URL` overrides: [`services/gateway/src/config.ts`](../services/gateway/src/config.ts).

On Railway, set each private service URL for the gateway, for example:

```text
MONOLITH_URL=http://backend.railway.internal:3000
SVC_SCHOOL_IDENTITY_URL=http://school-identity.railway.internal:3011
…
```

(Exact private hostnames follow Railway’s private networking naming for that project.)

Persistent volumes (or managed Postgres later) are required for SQLite/DB files; ephemeral disks lose data on redeploy.

### Per-tenant SQLite layout (Phase 2)

When `TENANT_DB_SPLIT=1`, school and directory services open **one file per tenant** on the shared Railway volume instead of a single shared SQLite file:

```text
/data/tenants/{tenantId}/directory.db
/data/tenants/{tenantId}/school-identity.db
/data/tenants/{tenantId}/school-attendance.db
/data/tenants/{tenantId}/school-fees.db
…
```

| Env | Example | Purpose |
|-----|---------|---------|
| `TENANT_DATA_ROOT` | `/data/tenants` | Root for per-tenant DB files (local default `./data/tenants`) |
| `TENANT_DB_SPLIT` | `1` | Enable per-tenant files; omit/false keeps legacy single-file path |

**Cutover** (once per legacy DB, with volume mounted):

```bash
node scripts/split-tenant-dbs.mjs \
  --legacy /data/school-identity.db \
  --service-file school-identity.db \
  --root /data/tenants
```

Repeat for `directory.db`, `school-attendance.db`, and other school `*.db` files. Legacy files stay as read-only backup for one release. Backup/restore a single school by copying `tenants/{tenantId}/`.

Gateway path checks (Phase 1) still apply: Host-resolved tenant must match `:tenantId` in `/svc/...` paths (`tenant_mismatch` → 403).

### Fact-table tenant migration (required)

Deploy includes migrations that add `tenant_id` across operational and domain tables:

- `058_fact_tables_tenant_scope.sql` — attendance_daily, clock_events, monthly_late_counts, leave_requests, pto_balances
- `059_domain_tables_tenant_scope.sql` — groups, role_assignments, regularizations, overtime_records, timesheets, time_entries, holidays
- `060_pii_domain_tenant_scope.sql` — bd_meetings, documents, visitors, assets, expense_receipts, surveys, face/iris enrollments, clients/projects, chat_sessions
- `061_rehome_default_setup_to_si.sql` / `062_force_default_wizard.sql` — historical repairs for default vs `si`
- `063_wipe_all_tenants.sql` — **factory reset**: empties all org/tenant data and reopens the wizard on `default` (one-shot via `full_tenant_wipe_v1`)

Run backend migrations **before** serving traffic from this release.

### Self-serve subdomain checklist (second company and beyond)

Tenant = **subdomain slug** under `TENANT_SUBDOMAIN_BASE` (plus exact `TENANT_HOST_MAP` overrides for custom domains).

1. **DNS / Vercel:** wildcard `*.13blok.com` (+ apex/`www`) on project `13blok`.
2. **Railway env (gateway + backend, same values):**

```text
TENANT_SUBDOMAIN_BASE=13blok.com
TENANT_APEX_HOSTS=www.13blok.com,13blok.com
TENANT_HOST_MAP={"blokhr.vercel.app":"default"}
DEFAULT_TENANT_ID=default
```

Do **not** map `www.13blok.com` / `13blok.com` → `default` when self-serve is on.

3. Redeploy gateway + backend (config is read at process start).
4. Open `https://www.13blok.com` → Create workspace → redirect to `https://{slug}.13blok.com` → wizard.
5. Smoke:
   - `curl -sS -H "Host: acme.13blok.com" https://<gateway>/api/setup/status` → `tenantId: "acme"`, `signupPortal: false`
   - `curl -sS -H "Host: www.13blok.com" https://<gateway>/api/setup/status` → `signupPortal: true`
   - `curl -sS -X POST -H "Host: www.13blok.com" -H "Content-Type: application/json" -d '{"slug":"si"}' https://<gateway>/api/tenants` against an existing slug → `409 slug_taken`

Setup POSTs on a completed slug still return `409 already_configured`. Apex setup POSTs return `400 use_workspace_subdomain`.

**Wipe note:** migration 063 + wipe helper delete all members/branding (except empty `default`). Snapshot the Railway volume first if you need a backup.

### Identity / tenant trust (production)

| Env | Purpose |
|-----|---------|
| `INTERNAL_SECRET` | **Required** in production. Gateway must send `X-Blok-Internal` matching this value. Backend only trusts inbound `X-Blok-Tenant` when the secret matches. |
| `ALLOW_HEADER_IDENTITY` | Defaults off outside `NODE_ENV=test`. When off, identity comes from Bearer `auth_sessions` tokens only (not spoofable `X-User-Email`). |
| `TENANT_HOST_MAP` | Hostname → tenant_id for N tenants (not a two-tenant special case). |

Direct hits to the backend URL without the gateway cannot select another tenant via `X-Blok-Tenant`. Session tokens are bound to the issuing tenant; using a token on a different Host returns `403 tenant_mismatch`.

Arif Vercel / Ubaid Railway ownership is **unchanged**.

---

## Frontend ↔ API wiring

[`frontend/shared/api.js`](../frontend/shared/api.js) resolves the API base from `location.origin` (with a localhost:3000 → :8080 exception for local monolith).

On Vercel production that default would call Vercel for `/api` and break the app. Production must use the **Railway gateway origin**, for example:

- Env at build/runtime: `API_BASE_URL=https://<gateway>.up.railway.app` (or custom API domain), **or**
- Vercel rewrites that proxy `/api` and `/svc` to the Railway gateway (same-origin from the browser’s perspective).

Until one of those is implemented in code/config, a Vercel-only UI deploy will load chrome but fail login and data calls.

Also configure:

| Concern | Owner | Action |
|---------|--------|--------|
| CORS | Ubaid (gateway / monolith) | Allow Vercel origins (`*.vercel.app` + production custom domain) |
| Cookies / auth | Both | Prefer Bearer tokens already used by the shell; if cookies are used, set `SameSite`/`Secure` for cross-site |
| Password-reset / magic links | Ubaid | `SERVER_BASE_URL` = **public site users open** (usually the Vercel URL or custom domain), not the Railway internal URL |
| SMTP | Ubaid | `SMTP_*` on monolith (see `backend/.env.example`) |

---

## Environment checklist

### Shared contract (both owners)

| Variable / value | Who sets it | Where |
|------------------|-------------|--------|
| Public frontend URL | Arif | Vercel project domains → share with Ubaid |
| Public gateway URL | Ubaid | Railway gateway domain → share with Arif |
| Git branch to deploy | Both | Agree (e.g. `school-platform-wip` or `main`) |

### Railway (Ubaid) — minimum secrets

| Variable | Purpose |
|----------|---------|
| `INTERNAL_SECRET` | Shared by gateway + all services (`X-Blok-Internal`) — strong random, never commit |
| `ACTION_LINK_SECRET` | Signed action / auth links |
| `LICENSE_SIGNING_SECRET` | Commercial / entitlements |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email (forgot-password, magic links) |
| `SERVER_BASE_URL` | Absolute links in email — **frontend public URL** |
| `DEPLOYMENT_MODE` | Usually `cloud` for hosted SaaS |
| Per-service `PORT`, `IDENTITY_URL`, DB paths / `DB_ENGINE`+`DB_URL` | As required by each service |

Never commit `backend/.env` or App Passwords. Local SMTP helper: `scripts/apply-smtp-secret.mjs` (secrets outside the repo).

### Vercel (Arif) — minimum

| Variable | Purpose |
|----------|---------|
| `API_BASE_URL` (once wired in frontend) | Railway gateway HTTPS origin |
| Domain | Production hostname for the shell |

---

## Suggested rollout order

1. **Ubaid:** Create Railway project; deploy gateway + monolith first; prove `GET /health` (or gateway listen) on the public URL.
2. **Ubaid:** Add remaining services; point gateway `SVC_*_URL` / `MONOLITH_URL` at private hosts; verify `/api/auth` and one `/svc/...` path.
3. **Arif:** Import `alwiarif46/BlokHR` into Vercel team `arifalwi-2069`; set root `frontend`; deploy preview.
4. **Both:** Wire API base or rewrites; set CORS + `SERVER_BASE_URL`; smoke-test login, forgot-password email link, one school and one HR screen.
5. **Custom domains:** frontend on Arif’s DNS → Vercel; API subdomain → Railway gateway (optional but cleaner).

---

## Local vs cloud quick map

| Concern | Local (`npm run dev:school`) | Cloud (this doc) |
|---------|------------------------------|------------------|
| UI | Gateway serves `frontend/` on `:8080` | Vercel (Arif) |
| API | Same origin `:8080` | Railway gateway (Ubaid) |
| Secrets | Local `.env` / `INTERNAL_SECRET=dev-internal-secret` | Platform env UIs only |
| DB | SQLite files on disk | Volumes or Postgres (future) on Railway |

---

## Out of scope / non-goals

- Running the full Node microservices stack **on Vercel** (not supported).
- Replacing the Node API with Supabase Edge Functions in this phase (Postgres-on-Supabase can be a later Railway `DB_URL` change).
- Putting production secrets in GitHub Actions logs or the Vercel project belonging to the wrong owner.

---

## Contacts

| Role | Owner | Platform |
|------|--------|----------|
| Frontend deploy, Vercel domains, preview URLs | **Arif** | Vercel `arifalwi-2069` |
| Gateway, services, SMTP, `INTERNAL_SECRET`, Railway domains | **Ubaid** | Railway |

When in doubt: **UI = Arif / Vercel**, **API = Ubaid / Railway**.
