# BlokHR — Server Architecture
## shaavir-server · Node.js/Express + TypeScript · v8 "Project Ara"

---

## 1. THE ONE-LINE SUMMARY

A single Node.js/Express server. Zero HTML. Every piece of application data — from a clock entry to a break event to a user's theme preference — is a database record. The frontend talks to it only through HTTP and SSE.

---

## 2. THE STORAGE PRINCIPLE

**Everything is a database record. No exceptions.**

| Event | Table | Detail |
|---|---|---|
| Clock in | `clock_entries` | action='in' |
| Start break | `clock_entries` | action='break' |
| End break | `clock_entries` | action='back' |
| Clock out | `clock_entries` | action='out' |
| Auto-cutoff | `clock_entries` | status_source='auto-cutoff' |
| New department | `groups` | full row |
| Individual shift | `members` | individual_shift_start/end columns |
| User changes theme | `member_preferences` | theme column |
| User sets timezone | `member_preferences` | timezone_slot_1..4 columns |
| User changes accent colour | `member_preferences` | color_accent column |
| User uploads bg image | `member_preferences` | bg_image_url column |
| Leave request | `leave_requests` | full row |
| Regularization | `regularization_requests` | full row |
| Notification fired | `notification_log` | full row |
| Admin changes logo | `tenant_settings` | logo_data_url column |
| Feature toggled | `feature_flags` | enabled column |

Nothing → JSON file on disk  
Nothing → localStorage (the session token is the only localStorage value — it is an ephemeral auth credential, not application data)  
Nothing → "Azure Tables specifically" — use DatabaseEngine; the backend is configured at deploy time

---

## 3. TECH STACK

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js 20 LTS | Any host — Azure, Render, Railway, self-hosted |
| Framework | Express 5 | native async handlers |
| Language | TypeScript 5 strict | npx tsc --noEmit must pass |
| DB abstraction | DatabaseEngine | wraps any backend |
| Test runner | vitest | 943+ tests, zero regression tolerance |
| HTTP tests | supertest | createTestApp() from tests/helpers/setup.ts |
| Auth incoming | X-User-Email + X-User-Name | NEVER Authorization/Bearer |
| AI layer | OllamaLlmClient / AnthropicLlmClient / MockLlmClient | abstracted behind interface |

---

## 4. DATABASE ENGINE — PLUGGABLE ADAPTERS

DatabaseEngine is the only way any route, service, or cron touches data.

```typescript
interface DatabaseEngine {
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ lastID: number; changes: number }>;
  transaction<T>(fn: (tx: DatabaseEngine) => Promise<T>): Promise<T>;
}
```

### 4.1 Available Adapters

| Adapter | DATABASE_BACKEND | Best for |
|---|---|---|
| SQLite | sqlite (default) | Local dev, single-server |
| PostgreSQL | postgres | Production, multi-server |
| Azure Table Storage | azure-tables | Azure-hosted |
| SharePoint Lists | sharepoint | Microsoft 365 tenants |
| In-memory | memory | Tests / CI only |
| Mirrored | mirrored | Write to two, read from primary |

```bash
# SQLite
DATABASE_BACKEND=sqlite
DATABASE_PATH=./dev.db

# PostgreSQL
DATABASE_BACKEND=postgres
DATABASE_URL=postgresql://user:pass@host:5432/blokhr

# Azure Tables
DATABASE_BACKEND=azure-tables
AZURE_STORAGE_CONNECTION=DefaultEndpointsProtocol=https;AccountName=...

# SharePoint
DATABASE_BACKEND=sharepoint
SHAREPOINT_SITE_HOST=company.sharepoint.com
SHAREPOINT_SITE_PATH=/sites/blokhr

# Mirrored
DATABASE_BACKEND=mirrored
DATABASE_PRIMARY=postgres
DATABASE_MIRROR=azure-tables
```

The setup wizard (§10) writes this during first run.

---

## 5. DATABASE SCHEMA (key tables)

```sql
-- Tenant (one row per customer)
CREATE TABLE tenant_settings (
  id                  TEXT PRIMARY KEY,
  platform_name       TEXT NOT NULL DEFAULT 'BlokHR',
  company_legal_name  TEXT NOT NULL DEFAULT '',
  logo_data_url       TEXT,
  favicon_url         TEXT,
  login_tagline       TEXT,
  primary_timezone    TEXT NOT NULL DEFAULT 'UTC',
  version             TEXT,
  settings_json       TEXT,       -- large/infrequent settings as JSON blob
  created_at          TIMESTAMP,
  updated_at          TIMESTAMP
);

-- Admins (from settings.admins[] moved to proper table)
CREATE TABLE admins (
  email       TEXT NOT NULL,
  tenant_id   TEXT NOT NULL,
  PRIMARY KEY (email, tenant_id)
);

-- Members
CREATE TABLE members (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  email                     TEXT NOT NULL,
  name                      TEXT NOT NULL,
  group_id                  TEXT,
  designation               TEXT,
  employee_id               TEXT,
  join_date                 DATE,
  active                    INTEGER NOT NULL DEFAULT 1,
  google_email              TEXT,   -- linked Google account email
  phone                     TEXT,
  emergency_contact         TEXT,
  parentage                 TEXT,
  pan                       TEXT,   -- encrypted
  aadhaar                   TEXT,   -- encrypted
  uan                       TEXT,
  bank_account              TEXT,   -- encrypted
  ifsc                      TEXT,
  bank_name                 TEXT,
  shift_id                  TEXT,   -- FK → shifts (named shift, takes priority over start/end if set)
  individual_shift_start    TEXT,   -- "HH:MM" or NULL (inherit from group; ignored if shift_id set)
  individual_shift_end      TEXT,
  individual_cutoff_minutes INTEGER, -- NULL = inherit from group → global
  individual_manager_email  TEXT,   -- NULL = inherit manager from group
  individual_hr_email       TEXT,   -- NULL = inherit HR from group
  profile_locked            INTEGER NOT NULL DEFAULT 0,
  discord_id                TEXT NOT NULL DEFAULT '',
  telegram_id               TEXT NOT NULL DEFAULT '',
  photo_url                 TEXT,
  created_at                TIMESTAMP,
  updated_at                TIMESTAMP,
  UNIQUE (email, tenant_id)
);

-- Groups (departments)
CREATE TABLE groups (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  name                  TEXT NOT NULL,
  shift_start           TEXT,   -- "HH:MM" or NULL (inherit from global)
  shift_end             TEXT,
  auto_cutoff_minutes   INTEGER, -- NULL = inherit from global
  manager_email         TEXT,
  hr_email              TEXT,
  created_at            TIMESTAMP,
  updated_at            TIMESTAMP
);

-- Per-user preferences — EVERYTHING personalisation lives here, not localStorage
CREATE TABLE member_preferences (
  member_id           TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  theme               TEXT NOT NULL DEFAULT 'chromium',
  dark_mode           TEXT NOT NULL DEFAULT 'system',
  color_accent        TEXT,
  color_status_in     TEXT,
  color_status_break  TEXT,
  color_status_absent TEXT,
  color_bg0           TEXT,
  color_tx            TEXT,
  bg_image_url        TEXT,
  bg_opacity          INTEGER NOT NULL DEFAULT 30,
  bg_blur             INTEGER NOT NULL DEFAULT 0,
  bg_darken           INTEGER NOT NULL DEFAULT 70,
  timezone_slot_1     TEXT,
  timezone_slot_2     TEXT,
  timezone_slot_3     TEXT,
  timezone_slot_4     TEXT,
  notification_prefs  TEXT,   -- JSON
  updated_at          TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Named shift definitions
CREATE TABLE shifts (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  start_time      TEXT NOT NULL,  -- "HH:MM"
  end_time        TEXT NOT NULL,
  is_overnight    INTEGER NOT NULL DEFAULT 0,
  grace_minutes   INTEGER NOT NULL DEFAULT 15,
  cutoff_minutes  INTEGER,
  work_days       TEXT,           -- JSON [1,2,3,4,5]
  created_at      TIMESTAMP
);

-- Clock entries — every event, immutable log
CREATE TABLE clock_entries (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  action          TEXT NOT NULL,  -- 'in' | 'out' | 'break' | 'back'
  timestamp       TIMESTAMP NOT NULL,
  status_source   TEXT NOT NULL DEFAULT 'manual', -- 'auto-cutoff' | 'kiosk' | etc.
  latitude        REAL,
  longitude       REAL,
  accuracy_meters REAL,
  ip_address      TEXT,
  selfie_url      TEXT,
  shift_id        TEXT,
  group_id        TEXT,
  created_at      TIMESTAMP NOT NULL
);

-- Attendance daily (computed aggregate, rebuilt nightly)
CREATE TABLE attendance_daily (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  name                  TEXT NOT NULL,
  group_id              TEXT,
  date                  DATE NOT NULL,
  status                TEXT,
  first_in              TIMESTAMP,
  last_out              TIMESTAMP,
  total_worked_minutes  INTEGER NOT NULL DEFAULT 0,
  total_break_minutes   INTEGER NOT NULL DEFAULT 0,
  is_late               INTEGER NOT NULL DEFAULT 0,
  late_minutes          INTEGER NOT NULL DEFAULT 0,
  overtime_minutes      INTEGER NOT NULL DEFAULT 0,
  carried_over          INTEGER NOT NULL DEFAULT 0,
  UNIQUE (email, date, tenant_id)
);

-- Leave requests, regularizations, comp-off, approvals,
-- notification_channels, notification_matrix, notification_log,
-- feature_flags, admins, geo_zones, geo_logs,
-- monthly_late_counts, audit_trail, ai_conversation_log
-- (full SQL in migrations/*)
```

---

## 6. ENTRY POINT & BOOT SEQUENCE

```
src/index.ts
  1. Read DATABASE_BACKEND → instantiate DatabaseEngine adapter
  2. Run pending migrations
  3. createApp(deps)
     a. Middleware: COOP → identity → tenant → CORS
     b. Feature flag guard (guardWithAdmin)
     c. All route files
     d. Setup wizard routes (if FIRST_RUN=true)
  4. Start cron jobs
  5. listen(PORT)
```

---

## 7. ROUTE FILES

| File | Prefix | Purpose |
|---|---|---|
| routes/clock.ts | /api/clock | clock_entries writes |
| routes/attendance.ts | /api/attendance | attendance_daily reads |
| routes/leaves.ts | /api/leaves | leave_requests CRUD |
| routes/regularization.ts | /api/regularizations | regularization_requests |
| routes/shifts.ts | /api/shifts | shifts table CRUD |
| routes/approvals.ts | /api/approvals | approval_instances flow |
| routes/notifications.ts | /api/notifications | notification_channels + matrix + log |
| routes/analytics.ts | /api/analytics | Bradford Score, reports — admin-only |
| routes/profiles.ts | /api/profiles | members + member_preferences |
| routes/settings.ts | /api/settings, /api/groups, /api/members | tenant_settings |
| routes/digest.ts | /api/digest | daily/weekly summaries |
| routes/export.ts | /api/export | CSV downloads — admin-only |
| routes/bot.ts | /api/bot | Teams bot, Adaptive Cards |
| routes/sse.ts | /api/sse | SSE connections, heartbeat |
| routes/ai.ts | /api/ai | multi-model engine |
| routes/copilot.ts | /api/copilot | conversational HR agent |
| routes/integrations.ts | /api/integrations | Okta, biometric, calendar |
| routes/geo.ts | /api/geo | geo_zones + geo_logs |
| routes/interactions.ts | /api/interactions | Discord/Telegram/WhatsApp/ClickUp |
| routes/feature-flags.ts | /api/features | feature_flags table |
| routes/setup.ts | /setup | first-run wizard |

---

## 8. SERVICES LAYER

```
src/services/
├── db/
│   ├── engine.ts          interface
│   ├── sqlite.ts          adapter
│   ├── postgres.ts        adapter
│   ├── azure-tables.ts    adapter
│   ├── sharepoint.ts      adapter
│   └── factory.ts         picks adapter from DATABASE_BACKEND
├── settingsResolver.ts    3-tier resolution (member → group → global)
├── notification/
│   ├── dispatcher.ts      reads notification_channels + notification_matrix
│   └── adapters/          teams-bot, slack, google-chat, whatsapp, email, discord
├── accrual.ts             leave accrual
├── bradfordScore.ts       S² × D formula
├── aiEngine.ts            multi-model orchestration
└── feature-flags.ts       FeatureFlagService + guardWithAdmin
```

---

## 9. CRON JOBS

| File | Schedule | Purpose |
|---|---|---|
| crons/autoCutoff.ts | Every 5 min | Insert clock_entries for auto-cutoff |
| crons/dailyAggregate.ts | Nightly | Rebuild attendance_daily from clock_entries |
| crons/dailySummary.ts | Configurable | Compile and dispatch digest |
| crons/weeklyDigest.ts | Configurable | Weekly summary |
| crons/compOffExpiry.ts | Daily | Expire comp-off balances |
| crons/autoEscalation.ts | Every 30 min | Escalate stale approvals |
| crons/bradfordScore.ts | Weekly | Recompute scores |

---

## 10. SETUP WIZARD

Runs once on first boot (FIRST_RUN=true env var). Served at `/setup`.

```
Wizard steps:
  1. Database backend     — SQLite / Postgres / Azure Tables / SharePoint / Mirrored
  2. Auth providers       — pick any combination:
                             Microsoft MSAL
                             Google OAuth
                             Okta
                             Teams SSO
                             GitHub OAuth
                             SAML 2.0
                             Custom JWT endpoint
                             Magic Link (passwordless email)
                             Local PIN (kiosk mode)
  3. First admin          — email + name
  4. Company identity     — platform name, legal name, timezone, logo
  5. Connection test      — ping the selected DB, confirm write/read works
  6. Done                 — writes all config to tenant_settings + admins tables
                            sets FIRST_RUN=false in tenant_settings
                            redirects to shell.html
```

Everything the wizard collects is written to the database. Nothing goes to .env or JSON files.

---

## 11. THE 3-TIER RESOLVER

```
For any configurable value, resolution order (highest priority first):
  1. members.individual_*           — per-person override
  2. groups.* columns               — per-department default
  3. tenant_settings.settings_json  — tenant-wide global

Example: auto-cutoff minutes for alice@co.com
  → check members WHERE email='alice' → individual_cutoff_minutes = 90  → USE 90
  → if NULL: check groups WHERE id=alice.group_id → auto_cutoff_minutes = 120  → USE 120
  → if NULL: read settings.attendance.autoCutoffMinutes = 60  → USE 60

Example: shift for alice@co.com
  → check members WHERE email='alice' → shift_id = 'sh_morning' → load that shift row → USE it
  → if shift_id NULL: check individual_shift_start/end → USE if set
  → if NULL: check groups WHERE id=alice.group_id → shift_start/end → USE if set
  → if NULL: read settings.shifts.default.start/end → USE

Example: manager for alice@co.com
  → check members WHERE email='alice' → individual_manager_email = 'mgr@co.com' → USE
  → if NULL: check groups WHERE id=alice.group_id → manager_email → USE if set
  → if NULL: check tenant_settings.settings_json → managerAssignment.global → USE
```

---

## 12. KNOWN GAPS

| # | Problem | Fix |
|---|---|---|
| 1 | NotificationDispatcher null at boot | Wire in routes/index.ts |
| 2 | geo.ts not registered | Replace geo-fencing.ts import |
| 3 | OllamaLlmClient missing auth header | Add apiKey 4th constructor param |
| 4 | Discord/Telegram/WhatsApp resolvers are stubs | migration 035 + DB lookup |
| 5 | ClickUp dispatch incomplete | Fetch task from ClickUp API |
| 6 | No export endpoints | Create routes/export.ts |
| 7 | Feature flags no admin enforcement | migration 036 + guardWithAdmin |

---

## 13. COMPLETE QUICK REFERENCE — WHAT LIVES WHERE

| Thing | Table | Access |
|---|---|---|
| Tenant identity (name, logo, timezone) | tenant_settings | POST /api/settings |
| Auth provider credentials | tenant_settings.settings_json | POST /api/settings |
| Admin email list | admins table | POST /api/admins |
| Employee records | members table | GET/POST/PUT /api/members |
| Department records | groups table | GET/POST/PUT /api/groups |
| Named shift definitions | shifts table | GET/POST/PUT /api/shifts |
| Individual shift (named) | members.shift_id | PUT /api/members/:email |
| Individual shift (raw times) | members.individual_shift_start/end | PUT /api/members/:email |
| Per-dept shift | groups.shift_start/end | PUT /api/groups/:id |
| Individual manager override | members.individual_manager_email | PUT /api/members/:email |
| Individual HR override | members.individual_hr_email | PUT /api/members/:email |
| Clock in | clock_entries (action='in') | POST /api/clock |
| Break start | clock_entries (action='break') | POST /api/clock |
| Break end | clock_entries (action='back') | POST /api/clock |
| Clock out | clock_entries (action='out') | POST /api/clock |
| Auto-cutoff event | clock_entries (status_source='auto-cutoff') | cron |
| Daily attendance summary | attendance_daily | GET /api/attendance |
| Leave requests | leave_requests | POST /api/leaves |
| Regularization requests | regularization_requests | POST /api/regularizations |
| Comp-off balance | comp_off_balances | GET /api/leaves/comp-off |
| Approval state | approval_instances + approval_steps | POST /api/approvals |
| Notification channels | notification_channels | GET/POST/PUT /api/notifications/channels |
| Notification routing | notification_matrix | GET/POST /api/notifications/matrix |
| Notification log | notification_log | GET /api/notifications/log |
| Feature flags | feature_flags | PUT /api/features/:key |
| Module enabled/disabled | tenant_settings.settings_json → tabs[].enabled | POST /api/settings |
| User theme | member_preferences.theme | PUT /api/profiles/me/prefs |
| User dark/light mode | member_preferences.dark_mode | PUT /api/profiles/me/prefs |
| User colour overrides | member_preferences.color_* | PUT /api/profiles/me/prefs |
| User background image | member_preferences.bg_image_url | PUT /api/profiles/me/prefs |
| User bg opacity/blur/darken | member_preferences.bg_* | PUT /api/profiles/me/prefs |
| User timezone slots | member_preferences.timezone_slot_1..4 | PUT /api/profiles/me/prefs |
| User notification prefs | member_preferences.notification_prefs | PUT /api/profiles/me/prefs |
| Geo zones | geo_zones | POST /api/geo/zones |
| Geo logs | geo_logs | GET /api/geo/logs |
| Bradford Score data | monthly_late_counts | computed by cron |
| Audit trail | audit_trail | GET /api/analytics/audit |
| AI conversation log | ai_conversation_log | GET /api/copilot/history |
| Session token | localStorage: session_{tenantId} | shell.html ONLY — auth artifact |

**The session token is the only value in localStorage. Everything else is a database record.**

---

## 14. ZERO-HARDCODING RULES

```
✗ No email addresses in any condition or comparison
✗ No company names in any response body
✗ No Authorization/Bearer headers accepted
✗ No JSON files for any list or entity
✗ No timezone literals — read from member_preferences or tenant_settings
✗ No "Azure Tables" assumptions — always use DatabaseEngine
✓ All config via tenant_settings + database tables
✓ All admin checks via admins table
✓ All tenant isolation via tenant_id on every query
✓ All user preferences via member_preferences table
```
