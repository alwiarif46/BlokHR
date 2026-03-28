# BlokHR — Overall Architecture
## Three Codebases · How They Communicate · Project Ara

---

## 1. THE SYSTEM IN ONE PICTURE

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BlokHR v8 "Project Ara"                         │
│                                                                     │
│  ┌─────────────────────────┐        ┌─────────────────────────────┐ │
│  │       FRONTEND          │◄──────►│         BACKEND             │ │
│  │    (HTML/CSS/JS)        │REST+SSE│    (shaavir-server)         │ │
│  │                         │        │    TypeScript/Express        │ │
│  │  setup.html  ← wizard   │        │                             │ │
│  │  shell.html  ← auth+nav │        │    DatabaseEngine           │ │
│  │  horizon.html           │        │    (pluggable adapter)      │ │
│  │  axis.html              │        │         │                   │ │
│  │  apex/nebula/etc.       │        │         ▼                   │ │
│  └────────────┬────────────┘        │  ┌─────────────────────┐   │ │
│               │                     │  │  DATABASE           │   │ │
│    postMessage│CONTEXT(v:1)         │  │                     │   │ │
│               │                     │  │  SQLite             │   │ │
│     shell ────┼──── iframes         │  │  OR Postgres        │   │ │
│               │                     │  │  OR Azure Tables    │   │ │
│               │                     │  │  OR SharePoint      │   │ │
│               │                     │  └─────────────────────┘   │ │
│               │GET /api/profiles     │                             │ │
│               │    /me/prefs ───────►│  All data: clock entries,  │ │
│               │                     │  preferences, themes,       │ │
│               │                     │  departments, shifts,       │ │
│               │                     │  leaves — everything        │ │
└───────────────┼─────────────────────┴─────────────────────────────┘ │
                └─────────────────────────────────────────────────────┘
```

---

## 2. THE FIVE COMMUNICATION CHANNELS

### 2.1 Frontend → Backend: REST

```
Headers always:
  X-User-Email: user@company.com
  X-User-Name:  User Name
  Content-Type: application/json
NEVER:
  Authorization: Bearer ...

Paths always relative:
  /api/clock     ✓
  /api/settings  ✓
  https://server.com/api/clock  ✗
```

### 2.2 Backend → Frontend: SSE

```
GET /api/sse → text/event-stream, heartbeat 30s, auto-reconnect

Events:
  attendance-update → horizon.html refreshes board
  settings-update   → all shells reload settingsCache + re-dispatch CONTEXT
  leave-update      → leave panel refreshes
  notification      → shell shows toast
  approval-update   → approval panel refreshes
```

Note: PUT /api/profiles/me/prefs does NOT trigger SSE. Preferences are private to the user. The change applies immediately on the calling client and persists to DB. Other devices see it on their next session load.

### 2.3 Shell → Iframes: postMessage CONTEXT

```javascript
const CONTEXT = {
  v: 1,                                               // version — iframes reject v≠1
  token: localStorage.getItem(`session_${tenantId}`), // only localStorage value
  user: { email, name, photo },
  isAdmin: ...,
  settings: settingsCache,
  member: currentMemberRecord,
  prefs: memberPrefs    // loaded from member_preferences table at session start
};
iframe.contentWindow.postMessage(JSON.stringify(CONTEXT), SAFE_ORIGIN);
// NEVER: postMessage(payload, "*")
```

### 2.4 User preferences: always round-trip to DB

```
User changes theme in gear panel
  → savePref('theme', 'neural')
  → PUT /api/profiles/me/prefs { theme: 'neural' }
  → member_preferences row upserted
  → Apply to DOM immediately

Next session (same device or different device):
  → GET /api/profiles/me/prefs
  → member_preferences row read
  → Apply theme 'neural' to DOM
  → User sees their theme everywhere, always
```

### 2.5 Admin changes a setting: SSE cascade

```
Admin POSTs to /api/settings
  → tenant_settings updated
  → SSE broadcast: settings-update
  → All shells: GET /api/settings → refresh settingsCache
  → All shells re-dispatch CONTEXT to active iframes
  → All module iframes have fresh settings
  → No page reload required
```

---

## 3. SEQUENCE DIAGRAM: CLOCK IN (INCLUDING BREAK)

```
Employee        horizon.html     shell.html      server         database
    │                │                │              │               │
    │ click Clock In ►│                │              │               │
    │                │── POST /api/clock ───────────►│               │
    │                │   action='in'                 │── INSERT ────►│
    │                │                │              │   clock_entries│
    │                │◄── { ok: true }───────────────│               │
    │                │ show Lottie                   │               │
    │                │                │              │               │
    │                │                │◄── SSE: attendance-update ───│
    │                │◄── postMessage(SSE) ──────────│               │
    │                │ refresh board                 │               │
    │ click Break    ►│                │              │               │
    │                │── POST /api/clock ───────────►│               │
    │                │   action='break'              │── INSERT ────►│
    │                │                │              │   action='break'
    │ click Back     ►│                │              │               │
    │                │── POST /api/clock ───────────►│               │
    │                │   action='back'               │── INSERT ────►│
```

Every single event is a separate immutable row in clock_entries.

---

## 4. SEQUENCE DIAGRAM: USER CHANGES THEME

```
User          gear panel (shell)        server          database
  │                  │                     │                │
  │ click "Neural" ─►│                     │                │
  │                  │── PUT /api/profiles/me/prefs ───────►│
  │                  │   { theme: "neural" }                │── UPSERT ──►│
  │                  │◄── { success: true } ───────────────│  member_prefs│
  │                  │ Apply CSS class                      │                │
  │◄─ theme changes  │                     │                │                │
  │                  │                     │                │                │
  │ next day, phone  │                     │                │                │
  │── GET /api/prefs ─────────────────────►│                │                │
  │◄── { theme: "neural" } ───────────────│── SELECT ─────►│                │
  │ Apply theme                           │◄─ { neural } ───│                │
```

The theme is in the database. The user sees it on every device, every session.

---

## 5. THE PROJECT ARA SWAP POINTS

```
To replace the attendance board:
  Build horizon-v2.html
  POST /api/settings { tabs: [..., { id:'horizon', src:'horizon-v2.html' }] }
  Done. No other files change.

To add a new module tab:
  Build payroll.html
  POST /api/settings { tabs: [..., { id:'payroll', label:'Payroll',
                                     src:'payroll.html', enabled:true }] }
  Done. Shell renders the new tab automatically.

To swap database backend:
  Run the migration tool pointing at the new backend
  Set DATABASE_BACKEND env var on next server restart
  Done. All route files are unchanged — they use DatabaseEngine.

To swap AI provider:
  POST /api/settings { ai: { provider: 'anthropic', anthropic: { model: 'claude-opus-4-5' }}}
  Done. aiEngine.ts picks up the new provider.

To swap storage backend:
  Change DATABASE_BACKEND env var
  Done. DatabaseEngine factory loads the new adapter.

To add an auth provider:
  POST /api/settings { auth: { providers: { github: { enabled:true, clientId:'...' }}}}
  Add the OAuth flow handler to shell.html for 'github'
  Done. Login screen renders the new button automatically.

To disable a feature for all users:
  PUT /api/features/bradford_score { enabled: false }
  Done. Feature guard returns 404. UI hides the section.
```

---

## 6. FILE DEPENDENCY MAP

```
No file imports from another file.
Dependencies flow through: database, REST API, postMessage CONTEXT.

FRONTEND:
  shell.html
    ├── reads:  GET /api/settings          (settingsCache)
    ├── reads:  GET /api/profiles/me/prefs (memberPrefs)
    ├── reads:  SSE /api/sse
    ├── holds:  localStorage session_{tenantId}  (only localStorage value)
    └── sends:  postMessage CONTEXT to active iframe

  module iframes (horizon, axis, apex, etc.)
    ├── receives: postMessage CONTEXT from shell
    ├── reads:    REST /api/* directly
    ├── writes:   PUT /api/profiles/me/prefs (for preference changes)
    └── uses:     settingsCache + memberPrefs from CONTEXT

BACKEND:
  Every route
    ├── reads:  req.identity.email (from identity middleware)
    ├── reads:  req.tenant.id (from tenant middleware)
    ├── reads:  database via DatabaseEngine (db.get/all/run)
    └── reads:  settings from tenant_settings (via settingsResolver)

  notificationDispatcher
    ├── reads:  notification_channels table
    └── reads:  notification_matrix table
```

---

## 7. TENANT ISOLATION

Every database query includes tenant_id. This is enforced by:

1. Middleware: `tenant.ts` resolves tenantId from email domain or X-Tenant-Id header, attaches to `req.tenant.id`
2. Every DB query: `WHERE tenant_id = ?` with `req.tenant.id`
3. AI context: assembled per-tenant only — no cross-tenant data ever reaches the LLM
4. member_preferences: every row has tenant_id — users from different tenants never see each other's prefs

---

## 8. DEPLOYMENT OPTIONS

```
Any of these work because DatabaseEngine is pluggable:

Azure App Service + Azure Table Storage
  DATABASE_BACKEND=azure-tables
  AZURE_STORAGE_CONNECTION=...

Railway + PostgreSQL
  DATABASE_BACKEND=postgres
  DATABASE_URL=postgresql://...

Self-hosted VPS + SQLite
  DATABASE_BACKEND=sqlite
  DATABASE_PATH=/data/blokhr.db

Microsoft 365 stack + SharePoint
  DATABASE_BACKEND=sharepoint
  SHAREPOINT_SITE_HOST=company.sharepoint.com

Hybrid (Postgres primary + Azure Tables mirror)
  DATABASE_BACKEND=mirrored
  DATABASE_PRIMARY=postgres
  DATABASE_MIRROR=azure-tables
```

---

## 9. COMPLETE QUICK REFERENCE

| Thing | Table/Location | API |
|---|---|---|
| Tenant identity | tenant_settings | POST /api/settings |
| Auth provider config | tenant_settings.settings_json | POST /api/settings |
| Admin list | admins | POST /api/admins |
| Employee records | members | GET/POST/PUT /api/members |
| Departments | groups | GET/POST/PUT /api/groups |
| Named shifts | shifts | GET/POST/PUT /api/shifts |
| Individual shift (named) | members.shift_id | PUT /api/members/:email |
| Individual shift (raw times) | members.individual_shift_start/end | PUT /api/members/:email |
| Per-dept shift | groups.shift_start/end | PUT /api/groups/:id |
| Individual manager override | members.individual_manager_email | PUT /api/members/:email |
| Clock in/out/break/back | clock_entries | POST /api/clock |
| Auto-cutoff events | clock_entries (status_source='auto-cutoff') | cron |
| Daily attendance | attendance_daily | GET /api/attendance |
| Leave requests | leave_requests | POST /api/leaves |
| Regularization | regularization_requests | POST /api/regularizations |
| Comp-off balance | comp_off_balances | GET /api/leaves/comp-off |
| Approval flow state | approval_instances + approval_steps | POST /api/approvals |
| Notification channels | notification_channels | GET/POST/PUT /api/notifications/channels |
| Notification routing | notification_matrix | GET/POST /api/notifications/matrix |
| Notification log | notification_log | GET /api/notifications/log |
| Feature flags | feature_flags | PUT /api/features/:key |
| Module on/off | tenant_settings.settings_json → tabs[].enabled | POST /api/settings |
| User theme | member_preferences.theme | PUT /api/profiles/me/prefs |
| User dark/light | member_preferences.dark_mode | PUT /api/profiles/me/prefs |
| User colour overrides | member_preferences.color_* | PUT /api/profiles/me/prefs |
| User background image | member_preferences.bg_image_url | PUT /api/profiles/me/prefs |
| User background settings | member_preferences.bg_opacity/blur/darken | PUT /api/profiles/me/prefs |
| User timezone slots | member_preferences.timezone_slot_1..4 | PUT /api/profiles/me/prefs |
| User notification prefs | member_preferences.notification_prefs | PUT /api/profiles/me/prefs |
| Geo zones | geo_zones | POST /api/geo/zones |
| Geo event log | geo_logs | GET /api/geo/logs |
| Audit trail | audit_trail | GET /api/analytics/audit |
| AI chat history | ai_conversation_log | GET /api/copilot/history |
| Session token | localStorage: session_{tenantId} | shell.html ONLY — auth artifact |

**One entry in this table has localStorage. Everything else is a database record.**

---

## 10. WHAT EACH CODEBASE KNOWS ABOUT THE OTHERS

```
Frontend knows about backend:
  ✓ API endpoint paths
  ✓ Response shapes (JSON contracts)
  ✗ Database schema (never)
  ✗ Which DB adapter is running (never)

Backend knows about frontend:
  ✓ Static file paths to serve
  ✗ HTML structure (never)
  ✗ CSS variables (never)
  ✗ Which theme a user has (it reads the database, not the DOM)

Database knows about both:
  ← It doesn't. It just stores data.

The contract between all three is:
  1. The REST API shapes (JSON in, JSON out)
  2. The settings schema (TypeScript interface)
  3. The CONTEXT protocol (v:1, defined by shell, consumed by iframes)
```
