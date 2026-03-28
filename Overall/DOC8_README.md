# BlokHR — Start Here
## Every Claude Code session begins with this file

---

## WHAT IS THIS

BlokHR is a multi-tenant HRMS built on the Project Ara principle — every feature is a swappable module. Change a setting, not the code. Three codebases that communicate only through HTTP, SSE, and postMessage.

---

## THE THREE CODEBASES

```
1. shaavir-server/     TypeScript/Express backend
                       DatabaseEngine abstraction (SQLite/Postgres/Azure/SharePoint)
                       Run: PORT=3000 npx tsx src/index.ts
                       Test: npx vitest run

2. frontend/           Pure HTML/CSS/JS files (no build step, no framework)
                       Shell + iframe architecture
                       Served as static files by Express

3. database            One DB — tables for everything
                       Chosen at setup: SQLite / Postgres / Azure Tables / SharePoint
                       Access only via DatabaseEngine interface
```

---

## THE FIVE LAWS

```
1. NEVER send Authorization/Bearer.
   Identity = X-User-Email + X-User-Name headers.

2. NEVER postMessage(payload, "*").
   Always: iframe.contentWindow.postMessage(payload, window.location.origin)

3. NEVER hardcode anything.
   Platform name, logo, colours, timezones — always from the database.

4. NEVER write app data to localStorage.
   Theme? → member_preferences table.
   Colours? → member_preferences table.
   Timezones? → member_preferences table.
   Background image? → member_preferences table.
   The ONLY localStorage value is: session_{tenantId} (auth token).

5. NEVER assume the database backend.
   Always: db.get(), db.all(), db.run() via DatabaseEngine.
   Never: TableClient, fs.writeFileSync, sqlite3 directly.
```

---

## CURRENT STATUS

### Backend (shaavir-server)

| # | Gap | Status |
|---|---|---|
| 1 | NotificationDispatcher null at boot | Fix: wire in routes/index.ts |
| 2 | geo.ts not registered | Fix: replace geo-fencing.ts import |
| 3 | OllamaLlmClient no Authorization header | Fix: add apiKey 4th param |
| 4 | Discord/Telegram/WhatsApp resolvers are stubs | Fix: migration 035 + DB lookup |
| 5 | ClickUp dispatch incomplete | Fix: fetch task, respond 200 first |
| 6 | No export endpoints | Fix: create routes/export.ts |
| 7 | Feature flags no admin enforcement | Fix: migration 036 + guardWithAdmin |

**Tests: 943 existing. Zero regression tolerance. Run `npx vitest run` after every change.**

### Frontend

| File | Status |
|---|---|
| setup.html | Not built — first-run wizard |
| shell.html | Not built (clean version) |
| horizon.html | Source exists — needs cleanup + iframe split |
| axis.html | Not built |
| apex/nebula/meridian/zenith/vector/nova | Not built |
| ai-assistant.html | Not built |
| kiosk.html | Not built |

### New API needed

| Endpoint | Purpose | Status |
|---|---|---|
| GET /api/profiles/me/prefs | Load user preferences from DB | Not built |
| PUT /api/profiles/me/prefs | Save user preferences to DB | Not built |
| GET /setup + POST /setup/init | First-run wizard | Not built |

---

## KEY COMMANDS

```bash
# Start server
PORT=3000 DATABASE_BACKEND=sqlite DATABASE_PATH=./dev.db npx tsx src/index.ts

# All tests (must stay green)
npx vitest run

# TypeScript check (must be clean)
npx tsc --noEmit

# Smoke tests
curl http://localhost:3000/api/settings -H "X-User-Email: admin@test.com"
curl http://localhost:3000/api/profiles/me/prefs -H "X-User-Email: user@test.com"
curl http://localhost:3000/api/features -H "X-User-Email: admin@test.com"
```

---

## THE DATABASE RULE, EXAMPLES

```javascript
// ❌ WRONG — theme in localStorage
localStorage.setItem('theme', 'neural');
setTheme(localStorage.getItem('theme'));

// ✅ CORRECT — theme in database
await httpClient.put('/api/profiles/me/prefs', { theme: 'neural' });
// On load:
const { prefs } = await httpClient.get('/api/profiles/me/prefs');
setTheme(prefs.theme);

// ❌ WRONG — company name hardcoded
document.title = "Shaavir HRMS";

// ✅ CORRECT — company name from database
document.title = settingsCache.tenant.platformName;

// ❌ WRONG — admin hardcoded
if (userEmail === "admin@shaavir.com") { ... }

// ✅ CORRECT — admin from database
if (settingsCache.admins.includes(userEmail)) { ... }

// ❌ WRONG — Azure Tables assumed
const client = new TableClient(process.env.AZURE_STORAGE_CONNECTION, 'Members');
await client.upsertEntity({ ... });

// ✅ CORRECT — DatabaseEngine
await db.run('INSERT INTO members VALUES (?,?,?)', [id, email, name]);
```

---

## ARCHITECTURE DOCUMENTS

| Doc | Read when |
|---|---|
| DOC1_SERVER_ARCHITECTURE.md | Working on backend — routes, middleware, DB schema |
| DOC2_SERVER_FIX_PROMPT.md | Fixing the 7 known server gaps |
| DOC3_UI_ARCHITECTURE.md | Understanding what the frontend has and needs |
| DOC4_UI_INSTRUCTIONS.md | Building any HTML file |
| DOC5_SETTINGS_ARCHITECTURE.md | Understanding settings schema and storage |
| DOC6_SETTINGS_PROMPT.md | Building axis.html and the settings API |
| DOC7_OVERALL_ARCHITECTURE.md | How all three codebases connect |
| DOC8_README.md | This file — start here |

---

## SETUP WIZARD (first-run flow)

```
GET /setup → wizard UI (no auth required)

Step 1: Pick database backend
  SQLite / PostgreSQL / Azure Table Storage / SharePoint / Mirrored

Step 2: Pick auth providers (any combination)
  Microsoft MSAL, Google OAuth, Okta, Teams SSO,
  GitHub OAuth, SAML 2.0, Custom JWT, Magic Link, Local PIN

Step 3: First admin email + name

Step 4: Company name, timezone, logo

Step 5: Test DB connection

Step 6: Done → shell.html

Everything goes to the database. Nothing to .env or JSON files.
```

---

## TELL ME WHAT YOU ARE BUILDING

At the start of each session, say:
- Which codebase: server / frontend / settings
- Which file or endpoint
- What exactly: new feature / bug fix / build from scratch
- Any constraints

Claude Code will read the relevant architecture doc and begin.
