# BlokHR Settings Architecture
## The Single Source of Truth · Database-Agnostic · Everything Persisted

---

## 1. THE CORE PRINCIPLE

There is exactly one authoritative source of configuration: the database. Settings are rows and columns, not a JSON file on disk, not localStorage, not environment variables at runtime.

The DatabaseEngine abstraction means these settings live in whatever backend is configured — SQLite, Postgres, Azure Tables, or SharePoint — but the access pattern is identical regardless.

---

## 2. WHAT "SETTINGS" MEANS IN BLOKHR

BlokHR has two categories of configurable data:

### 2.1 Tenant Settings (shared, admin-controlled)

These apply to every user in the organisation. Stored in `tenant_settings` table plus a JSON blob for infrequently-changed fields.

Examples: platform name, logo, auth providers, tabs, attendance rules, leave types, notification routing, AI provider.

Access: POST /api/settings (admin only, any change broadcasts SSE settings-update to all clients)

### 2.2 Member Preferences (per-user, user-controlled)

These are per-person. Each user gets their own row. Stored in `member_preferences` table.

Examples: theme, dark mode, colour overrides, background image, timezone slots.

Access: GET/PUT /api/profiles/me/prefs (user can only read/write their own row)

**Critical:** These used to be localStorage in the legacy code. They are database records now. A user changing their theme on their laptop will see the same theme when they log in from their phone.

---

## 3. STORAGE BACKENDS

The admin selects this during the setup wizard. It determines which adapter the DatabaseEngine uses. After selection it does not change without a re-migration.

| Backend | Best for | Notes |
|---|---|---|
| SQLite | Dev, single-server | file at DATABASE_PATH |
| PostgreSQL | Production | DATABASE_URL connection string |
| Azure Table Storage | Azure hosting | AZURE_STORAGE_CONNECTION |
| SharePoint | Microsoft 365 tenants | SHAREPOINT_SITE_HOST + SHAREPOINT_SITE_PATH |
| Mirrored | Redundancy | writes to two, reads from primary |

---

## 4. THE 3-TIER RESOLUTION CHAIN

For any configurable value that can be overridden at different levels:

```
Priority order (highest first):
  1. members table (per-person columns)
  2. groups table (per-department columns)
  3. tenant_settings (global default)

Example — auto-cutoff minutes:
  members.individual_cutoff_minutes   = 90  → USE 90
  if NULL: groups.auto_cutoff_minutes = 120 → USE 120
  if NULL: settings.autoCutoffMinutes = 60  → USE 60

Example — shift start time for alice@co.com:
  members.individual_shift_start = "08:00" → USE 08:00
  if NULL: groups.shift_start    = "09:00" → USE 09:00
  if NULL: settings.shifts.default.start = "09:30" → USE 09:30
```

---

## 5. TENANT SETTINGS SCHEMA (what lives in tenant_settings)

### 5.1 Columns (first-class fields)

```sql
id                  TEXT PRIMARY KEY
platform_name       TEXT     -- displayed everywhere, never hardcoded
company_legal_name  TEXT     -- for certifications and exports
logo_data_url       TEXT     -- base64 or CDN URL
favicon_url         TEXT
login_tagline       TEXT
primary_timezone    TEXT     -- IANA (e.g. "Asia/Kolkata")
version             TEXT
settings_json       TEXT     -- remaining settings as merged JSON blob
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

### 5.2 settings_json blob — complete schema

```typescript
interface SettingsJson {
  auth: {
    providers: {
      // Any combination — not limited to 4
      msal?:     { enabled: boolean; clientId: string; tenantId: string; redirectUri: string };
      google?:   { enabled: boolean; clientId: string };
      okta?:     { enabled: boolean; domain: string; clientId: string };
      teamsSso?: { enabled: boolean; clientId: string };
      github?:   { enabled: boolean; clientId: string };
      saml?:     { enabled: boolean; metadataUrl: string; entityId: string };
      customJwt?:{ enabled: boolean; jwksUri: string; issuer: string; audience: string };
      magicLink?:{ enabled: boolean; fromEmail: string };
      localPin?: { enabled: boolean };  // for kiosk mode
    };
  };

  tabs: Array<{
    id: string;
    label: string;
    src: string;          // e.g. "horizon.html"
    enabled: boolean;
    icon?: string;
    visibleToGroups?: string[];
  }>;

  attendance: {
    autoCutoffMinutes: number;         // 15-180
    autoCutoffNotify: boolean;
    autoCutoffGraceWarningMinutes: number;
    clockOutShowMinutes: number;       // 0 = always show
    clockInEarlyMinutes: number;
    dayBoundaryHour: number;           // 1-8 (midnight partition)
    gracePeriodMinutes: number;
    roundingRules: 'none' | '5' | '10' | '15';
    overtimeEnabled: boolean;
    overtimeDailyThresholdMinutes: number;
    overtimeWeeklyThresholdMinutes: number;
    overtimeMultiplier: number;
    geofenceEnabled: boolean;
    geofenceStrict: boolean;
    ipRestrictionEnabled: boolean;
    allowedIPs: string[];
    kioskEnabled: boolean;
  };

  shifts: {
    default: { start: string; end: string; overnight: boolean };
    workDays: number[];                // [1,2,3,4,5]
  };

  leaves: {
    types: Array<{
      id: string; name: string; paid: boolean;
      maxPerYear: number; canAccrue: boolean;
    }>;
    accrualEngine: { enabled: boolean; period: string; rate: number };
    sandwichPolicy: boolean;
    encashmentEnabled: boolean;
    maxEncashPerYear: number;
    yearEndCarryover: number;
    compOffEnabled: boolean;
    compOffExpiryDays: number;
  };

  approvals: {
    flows: Record<string, {
      steps: Array<{ level: number; role: string; escalateAfterHours: number }>;
    }>;
    autoEscalationEnabled: boolean;
    autoEscalationHours: number;
  };

  digest: {
    dailyEnabled: boolean;
    dailyTime: string;            // "HH:MM"
    dailySections: { present: boolean; absent: boolean; late: boolean; onLeave: boolean };
    weeklyEnabled: boolean;
    weeklyDay: number;
    weeklyTime: string;
  };

  analytics: {
    bradfordScoreEnabled: boolean;
    bradfordAlertThreshold: number;
    pointSystemEnabled: boolean;
    auditTrailEnabled: boolean;
  };

  profiles: {
    requiredFields: string[];
    photoMaxKB: number;           // 50-5120
    faceRecognitionEnabled: boolean;
    irisEnabled: boolean;
  };

  ui: {
    gridColumns: { desktop: number; tablet: number; mobile: number };
    statusSortOrder: string[];
    toastDurationMs: number;
    boardRefreshMs: number;
  };

  lottie: {
    'clock-in':  { data: object | null; duration: number };
    'clock-out': { data: object | null; duration: number };
    break:       { data: object | null; duration: number };
    back:        { data: object | null; duration: number };
  };

  ai: {
    provider: 'ollama' | 'anthropic' | 'gemini' | 'mock';
    assistantName: string;
    welcomeMessage: string;
    systemPromptPrefix: string;
    visibility: 'off' | 'admin-only' | 'all' | 'specific-roles';
    visibleToRoles?: string[];
    position: 'bottom-left' | 'bottom-right';
    rateLimit: number;
    copilotVisibility: string;
    ollama:    { model: string; baseUrl: string; apiKey?: string };
    anthropic: { model: string; apiKey?: string };
    gemini:    { model: string; apiKey?: string };
  };

  compliance: {
    country: string;
    state?: string;
    labourLawTemplate?: string;
  };

  colourSchemes: Array<{
    name: string;
    accent: string;       // hex
    statusIn: string;     // hex
    statusBreak: string;  // hex
    statusAbsent: string; // hex
    bg0: string;          // hex
    tx: string;           // hex
  }>;                     // 3 preset schemes (Feature #71); admin picks one to apply globally
}
```

---

## 6. MEMBER PREFERENCES SCHEMA

```sql
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
  notification_prefs  TEXT,   -- JSON: which events this user wants alerts for
  updated_at          TIMESTAMP
);
```

### 6.1 API

```
GET  /api/profiles/me/prefs   → returns prefs row for the calling user
PUT  /api/profiles/me/prefs   → upserts prefs row for the calling user
                                Body: any subset of the columns above
                                All fields optional — unset fields unchanged
```

### 6.2 On session start (frontend)

```javascript
// After auth, load and apply prefs from server
const { prefs } = await httpClient.get('/api/profiles/me/prefs');
applyPrefsToDOM(prefs);
// No localStorage.getItem for any preference. Zero.
```

### 6.3 On preference change (frontend)

```javascript
// User changes theme in gear panel
await httpClient.put('/api/profiles/me/prefs', { theme: 'neural' });
// No localStorage.setItem. Zero.
```

---

## 7. WHAT LIVES WHERE — COMPLETE REFERENCE

| Data | Table / Location | API |
|---|---|---|
| Platform name | tenant_settings.platform_name | POST /api/settings |
| Logo | tenant_settings.logo_data_url | POST /api/settings |
| Favicon | tenant_settings.favicon_url | POST /api/settings |
| Auth providers | tenant_settings.settings_json.auth | POST /api/settings |
| Tab configuration | tenant_settings.settings_json.tabs | POST /api/settings |
| Attendance rules | tenant_settings.settings_json.attendance | POST /api/settings |
| Leave types | tenant_settings.settings_json.leaves | POST /api/settings |
| AI configuration | tenant_settings.settings_json.ai | POST /api/settings |
| Colour schemes (3 presets) | tenant_settings.settings_json.colourSchemes | POST /api/settings |
| Admin list | admins table | POST /api/settings/admins (or via setup wizard) |
| Employee records | members table | GET/POST/PUT /api/members |
| Departments | groups table | GET/POST/PUT /api/groups |
| Named shifts | shifts table | GET/POST/PUT /api/shifts |
| Individual shift (named) | members.shift_id | PUT /api/members/:email |
| Individual shift (raw times) | members.individual_shift_start/end | PUT /api/members/:email |
| Per-dept shift | groups.shift_start/end | PUT /api/groups/:id |
| Individual manager override | members.individual_manager_email | PUT /api/members/:email |
| User theme | member_preferences.theme | PUT /api/profiles/me/prefs |
| User dark mode | member_preferences.dark_mode | PUT /api/profiles/me/prefs |
| User colour overrides | member_preferences.color_* | PUT /api/profiles/me/prefs |
| User background image | member_preferences.bg_image_url | PUT /api/profiles/me/prefs |
| User bg settings | member_preferences.bg_opacity/blur/darken | PUT /api/profiles/me/prefs |
| User timezone slots | member_preferences.timezone_slot_1..4 | PUT /api/profiles/me/prefs |
| User notification prefs | member_preferences.notification_prefs | PUT /api/profiles/me/prefs |
| Clock entries (all) | clock_entries | POST /api/clock |
| Leave requests | leave_requests | POST /api/leaves |
| Notification channels | notification_channels | GET/POST/PUT /api/notifications/channels |
| Notification matrix | notification_matrix | GET/POST /api/notifications/matrix |
| Feature flags | feature_flags | PUT /api/features/:key |
| Geo zones | geo_zones | POST /api/geo/zones |
| Audit trail | audit_trail | GET /api/analytics/audit |
| Session token | localStorage: session_{tenantId} | shell.html ONLY |

---

## 8. SSE SETTINGS PROPAGATION

```
Admin changes a setting:
  POST /api/settings
  → tenant_settings updated
  → SSE broadcast: { type: "settings-update" }
  → all shells: GET /api/settings → refresh settingsCache
  → all shells re-dispatch CONTEXT to active iframe
  → UI updates immediately

User changes a preference:
  PUT /api/profiles/me/prefs
  → member_preferences upserted
  → No SSE broadcast needed (private to this user)
  → Frontend applies change immediately to DOM
  → Next session on any device: GET /api/profiles/me/prefs restores the pref
```

---

## 9. SETUP WIZARD WRITES

The setup wizard runs once. It writes:

```sql
-- Step 1: DB backend
-- Stored as env var or in a bootstrap config file (not application data)
-- The wizard itself cannot store its own config in a DB it hasn't set up yet
-- Solution: wizard writes DATABASE_BACKEND to a startup config file,
--           then all subsequent data goes to the configured DB

-- Steps 2-5: Everything else goes to the DB
INSERT INTO tenant_settings ...;       -- platform name, timezone, logo
INSERT INTO admins ...;                -- first admin email
-- settings_json gets auth providers, tabs, and all defaults
```

---

## 10. MIGRATION CONVENTIONS

- Files: migrations/001_initial.sql, 002_*.sql, etc.
- Each migration is idempotent (IF NOT EXISTS, etc.)
- Never rename existing columns — add new ones with sensible defaults
- Never remove columns without a deprecation period
- The DatabaseEngine factory runs pending migrations on every startup
