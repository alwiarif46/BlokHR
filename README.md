# BlokHR — Frontend Decomposition & Server Alignment

## What's Here

| Path | What |
|------|------|
| `docs/DEPLOYMENT-VERCEL-RAILWAY.md` | Cloud deploy: **Vercel frontend (Arif)** + **Railway backend (Ubaid)** |
| `docs/INSTRUCTIONS.md` | Implementation prompt for Claude Code — read this first |
| `docs/blokhr-frontend-architecture.md` | 2,221-line architecture spec (36 admin sections, 28 modules, ~525 tests) |
| `docs/SERVER-CHANGES.md` | 11 server gaps + 4 migrations + ~100 new tests |
| `source-files/index__3_.html` | Frontend monolith (7,873 lines) to decompose |
| `source-files/Shaavir_Horizon___Attendance_Board.html` | Design reference (live production) |
| `source-files/shaavir-server-production-ready__1__tar.gz` | Server codebase (971 tests, 34 migrations) |

## For Claude Code

Start by reading `docs/INSTRUCTIONS.md`. It points to everything else.

## School local stack (`dev:school`)

From the repo root:

```bash
npm install
npm run dev:school
```

That boots the **full** school stack via `concurrently` — every service in the gateway `SERVICE_MAP` plus the monolith and gateway:

| Prefix | Process | Default port |
|--------|---------|--------------|
| `monolith` | `backend` | 3000 |
| `identity` | `services/school-identity` | 3011 |
| `timetable` | `services/school-timetable` | 3012 |
| `attendance` | `services/school-attendance` | 3013 |
| `academics` | `services/school-academics` | 3014 |
| `assessment` | `services/school-assessment` | 3015 |
| `engagement` | `services/school-engagement` | 3016 |
| `fees` | `services/school-fees` | 3017 |
| `transport` | `services/school-transport` | 3018 |
| `compliance` | `services/school-compliance` | 3019 |
| `library` | `services/school-library` | 3020 |
| `learning` | `services/learning` | 3021 |
| `surveys` | `services/school-surveys` | 3022 |
| `family-ops` | `services/school-family-ops` | 3023 |
| `time-tracking` | `services/time-tracking` | 3030 |
| `overtime` | `services/overtime` | 3031 |
| `gateway` | `services/gateway` | 8080 |

Cross-service callers that need guardians/students (timetable, academics, engagement, compliance) get `IDENTITY_URL=http://localhost:3011`. The script sets a local-only `INTERNAL_SECRET`; use a real secret in production.

Open **http://127.0.0.1:8080** — the gateway serves `frontend/shell.html`, proxies `/api/*` (and SSE at `/api/sse/stream`) to the monolith, `/svc/<service>/*` to microservices, and legacy HR paths (`/api/clients`, `/api/projects`, `/api/time-entries`, `/api/time-summary`, `/api/overtime/*`) to the time-tracking and overtime services.

To copy legacy monolith rows into the new service databases (idempotent, never drops source tables):

```bash
npm run migrate:hr-time
```

### Readiness check

After the stack is up (give processes a few seconds to bind ports):

```bash
npm run check:school
```

This probes gateway `/healthz`, monolith `/api/health`, and each service `/health`. If anything is missing you will see the service name and port — restart with `npm run dev:school` and re-check.

If Attendance Admin (or other modules) show “service is unavailable”, the usual cause is an incomplete stack: run `check:school`, then restart `dev:school`.

**Academics:** Curriculum needs courses. After the stack is up, sign in as admin → **School Settings → Syllabus Packs** → install a sample pack (or upload a custom syllabus). Then **Academics** shows the course tree.

### Feature flags (sidebar modularity)

Every sidebar module has a matching L2 feature flag. Admins manage them under **Admin → Features** (`feature_flags` module).

- **Core HR** — `dashboard`, `attendance`, `holidays`, `meetings`, `leaves`, etc.
- **Add-ons** — `org_chart`, `training_lms`, `time_tracking`, `overtime`, biometrics, and the rest.
- **School** — master switch `school_vertical` (derived from tenant vertical) plus per-module flags (`school_students`, `school_academics`, …).

Toggling a flag hides the sidebar item and returns **404** for that module’s API routes (monolith guard + gateway cache for `/svc/*` and HR compat paths). The Features admin page itself cannot be disabled from the UI to avoid lockout.

### Multi-tenant (Host map)

Production resolves tenant from **Host** via `TENANT_HOST_MAP` on gateway + backend (see `docs/DEPLOYMENT-VERCEL-RAILWAY.md`). Do not point two organizations at one Railway backend without separate Host → tenant entries. Branding/setup/admins/credentials are per `tenant_id` (migration `055_tenant_isolation`).
