# BlokHR — Frontend Decomposition & Server Alignment

## What's Here

| Path | What |
|------|------|
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

That boots four processes via `concurrently`:

| Prefix | Process | Default port |
|--------|---------|--------------|
| `monolith` | `backend` | 3000 |
| `identity` | `services/school-identity` | 3011 |
| `timetable` | `services/school-timetable` | 3012 |
| `gateway` | `services/gateway` | 8080 |

Open **http://localhost:8080** — everything is proxied; add services to the script as P2+ land.

The gateway serves `frontend/shell.html`, proxies `/api/*` (and SSE at `/api/sse/stream`) to the monolith, and `/svc/<service>/*` to school microservices. Set a real `INTERNAL_SECRET` in production; the script uses a local-only default.
