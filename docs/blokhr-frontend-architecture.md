# BlokHR Frontend Architecture — Monolith Decomposition & Server Alignment

**Version:** 1.0  
**Date:** 28 March 2026  
**Status:** Ready for Implementation  

---

## Source Materials

The following source files are available and must be consulted during implementation:

| File | Location | Description |
|------|----------|-------------|
| Frontend monolith | `/mnt/user-data/uploads/index__3_.html` | 7,873 lines / 644 KB single HTML file containing all CSS, HTML, and JS for the entire BlokHR frontend |
| Server codebase | `/mnt/user-data/uploads/shaavir-server-production-ready__1__tar.gz` | Complete backend: 35,334 lines of TypeScript, 971 tests across 43 files, 34 SQL migrations, ~332 API endpoint handlers |
| Design reference | `/mnt/user-data/uploads/Shaavir_Horizon___Attendance_Board.html` | Live production design showing employee profile field-level access, 4-theme system, Lottie animations, clock UX, tenant-customizable settings |

---

## §1. Executive Summary

This document defines the architecture for decomposing the BlokHR frontend monolith (a single 7,873-line HTML file containing all CSS, HTML, and JavaScript) into a modular codebase that mirrors the server's 3-layer architecture (Routes → Services → Repositories).

The decomposition covers:

- Breaking the monolith into ~28 standalone frontend modules, each with its own CSS, HTML template, and JS file
- Implementing the Settings Architecture that separates tenant-level admin settings (stored in `tenant_settings` table) from per-user member preferences (stored in `member_preferences` table), eliminating all localStorage usage except session tokens
- Adding 36 admin settings panel sections covering branding, attendance, overtime, shifts, leaves, approvals, digest, analytics, profile requirements, UI defaults, AI chatbot, colour schemes, compliance, auth providers, tabs, Lottie animations, storage provider, notification channels, meeting integrations, security & session, scheduler, regularization rules, BD meetings, data retention, localization, payroll formulas, live chat, training/LMS, workflow defaults, survey defaults, asset config, visitor config, mobile/location, export defaults, email templates, and calendar/time
- Implementing the employee profile with field-level access control (read-only admin-managed fields vs. employee-editable fields with real-time validation)
- Restructuring the personal dashboard as a 6-tab system (Dashboard, Attendance, Leaves, Meetings, Regularization, Profile)
- Building the Lottie animation system for clock event feedback
- Creating ~525 frontend tests across ~36 test files, mirroring the server's test structure
- Enforcing the zero-localStorage rule: all preferences are database-backed and sync across devices

---

## §2. Server Structure Recap

### §2.1 Architecture Pattern

The server follows a clean 3-layer pattern:

- **Routes** (HTTP layer): 36 route files, each exporting a `createXxxRouter()` factory function
- **Services** (business logic): 22 service files handling validation, workflows, notifications
- **Repositories** (database layer): 18 repository files containing all SQL queries

Dependency injection is constructor-based through factory functions. No global state exists.

### §2.2 Scale

| Metric | Count |
|--------|-------|
| Migrations | 34 (001–034) |
| Test files | 43 (3 unit + 40 integration) |
| Tests | 971, all passing |
| API endpoint handlers | ~332 across 36 route files |
| Repository files | 18 |
| Service files | 22 (including template engine, formula engine, accrual engine) |
| Route files | 36 |
| Notification adapters | 8 (Teams, Slack, Google Chat, Discord, Email, ClickUp, WhatsApp, Telegram) |
| Event bus | 28 typed events across 8 services |
| Feature flags | 18 toggleable features |
| AI chatbot tools | 87 (53 employee + 34 admin) |
| Auth providers | 7 (local, magic link, Microsoft, Google, OIDC, SAML, LDAP) |
| Storage providers | 5 (local, Azure Blob, AWS S3, S3-compatible, none) |
| Database engines | 2 (SQLite, PostgreSQL) |

### §2.3 Route Registration

The server's `registerAllRoutes()` function in `src/routes/index.ts` mounts all modules on the Express app in order. The feature flag guard runs before all route handlers, returning 404 for disabled features (invisible, not forbidden).

The frontend's `navigateToModule()` function mirrors this: it lazy-creates module pages by calling dedicated renderer functions (`renderOrgChartPage`, `renderDocumentsPage`, etc.) matching 1:1 with the server's route files.

### §2.4 Complete Module List

| Server Route File | Frontend Module Key | Server Feature Flag |
|-------------------|--------------------|--------------------|
| `routes/clock.ts` | `attendance` | (always on) |
| `routes/leaves.ts` | `leaves` | (always on) |
| `routes/timesheets.ts` | `timesheets` | (always on) |
| `routes/regularizations.ts` | `regularizations` | (always on) |
| `routes/profile.ts` | `profile` | (always on) |
| `routes/settings.ts` | `settings` | (always on) |
| `routes/auth.ts` + `routes/multi-auth.ts` | `auth` | (always on) |
| `routes/setup.ts` | `setup_wizard` | (always on) |
| `routes/sse.ts` | (shared infrastructure) | (always on) |
| `routes/audit.ts` | `audit_trail` | (always on) |
| `routes/feature-flags.ts` | `feature_flags` | (always on) |
| `routes/holidays.ts` | `holidays` | (always on) |
| `routes/leave-policies.ts` | `leave_policies` | (always on) |
| `routes/interactions.ts` | (webhook handler) | (always on) |
| `routes/webhook-receivers.ts` | `webhooks` | (always on) |
| `routes/org-chart.ts` | `org_chart` | `org_chart` |
| `routes/documents.ts` | `documents` | `document_mgmt` |
| `routes/training.ts` | `training` | `training_lms` |
| `routes/workflows.ts` | `workflows` | `workflows` |
| `routes/surveys.ts` | `surveys` | `surveys` |
| `routes/assets.ts` | `assets` | `asset_mgmt` |
| `routes/visitors.ts` | `visitors` | `visitor_mgmt` |
| `routes/iris-scan.ts` | `iris_scan` | `iris_scan` |
| `routes/face-recognition.ts` | `face_recognition` | `face_recognition` |
| `routes/time-tracking.ts` | `time_tracking` | `time_tracking` |
| `routes/overtime.ts` | `overtime` | `overtime` |
| `routes/geo-fencing.ts` | `geo_fencing` | `geo_fencing` |
| `routes/chatbot.ts` | `ai_chatbot` | `ai_chatbot` |
| `routes/analytics.ts` | `analytics` | `analytics` |
| `routes/live-chat.ts` | `live_chat` | `live_chat` |
| `routes/storage.ts` | `file_storage` | `file_storage` |
| `routes/bd-meetings.ts` | `bd_meetings` | `bd_meetings` |
| `routes/meetings.ts` | `tracked_meetings` | `tracked_meetings` |
| `routes/mobile.ts` | `mobile` | (always on) |
| `routes/geo.ts` | (geo utilities) | (always on) |

### §2.5 Test Infrastructure

Server tests use `vitest` + `supertest` with an in-memory SQLite database. The shared test helper (`tests/helpers/setup.ts`) provides:

- `createTestApp()` — fully-wired app with all routes, migrations applied, mock providers injected
- `seedMember()` — creates a member + group for testing
- `testConfig()` — generates test configuration with all optional services disabled
- `testLogger` — silent pino logger

Every integration test file follows the same pattern: create test app → seed data → make HTTP requests → assert responses.

---

## §3. Monolith Anatomy

### §3.1 File Structure

The monolith (`index__3_.html`) is a single 7,873-line / 644 KB HTML file containing everything:

| Section | Lines | Content |
|---------|-------|---------|
| CSS | 1–2135 | 26 block sections covering 4 themes + all module styles |
| HTML | 2137–2433 | 5 screens (Boot, Setup, Login, ChangePassword, App) |
| JavaScript | 2434–7873 | All logic in one IIFE: utilities, modules, boot sequence |

### §3.2 CSS Block Map

| Block | Lines | Module |
|-------|-------|--------|
| Block 3 | 102–252 | Header bar (4 theme variants, timezone clock, notification bell, user dropdown) |
| Blocks 4+5 | 253–369 | Toolbar & attendance grid (stat pills, employee cards, search, column toggle) |
| Block 6 | 370–428 | Detail views (4 patterns per theme: modal, split panel, inline expand, drawer) |
| Block 7 | 429–496 | Personal dashboard (clock card, timeline, week summary, leave bars) |
| Blocks 9+10 | 497–565 | Settings panel & background customization |
| Block 12 | 566–570 | Enhanced toast system |
| Block 13 | 571–615 | Sidebar navigation |
| Block 14 | 2033–2135 | Setup wizard (scoped to `#screenSetup`, own theme variables) |
| Block 15 | 616–696 | Org chart module |
| Block 16 | 697–769 | Document management module |
| Block 17 | 770–855 | Training & LMS module |
| Block 18 | 856–961 | Workflow builder module |
| Block 19 | 962–1057 | Surveys module |
| Block 20 | 1058–1133 | Asset management module |
| Block 21 | 1134–1203 | Visitor management module |
| Block 22 | 1204–1264 | Iris scan module |
| Block 23 | 1265–1326 | Face recognition module |
| Block 24 | 1327–1409 | Expenses & approvals module |
| Block 25 | 1410–1475 | Analytics & reports module |
| Block 26 | 1476–1524 | Timesheets module |
| Block 27 | 1525–1597 | Time tracking module |
| Block 28 | 1598–1667 | Overtime management module |
| Block 29 | 1668–1730 | Leave policies module |
| Block 30 | 1731–1801 | Holiday calendar module |
| Block 31 | 1802–1871 | Geo-fencing module |
| Block 32 | 1872–1904 | AI chatbot module |
| Block 37 | 1905–1973 | Leave applications module |
| Blocks 33–36 | 1974–2032 | Shared admin module CSS (Live Chat, Audit, Flags, Webhooks) |

### §3.3 HTML Screens

| Screen ID | Purpose |
|-----------|---------|
| `screenBoot` | Boot splash with pulsing logo and "Initializing" text |
| `screenSetup` | Setup wizard (dark/light sub-themes, 3-step flow) |
| `screenLogin` | Login with SSO buttons, email/password form, magic link, theme bar |
| `screenChangePassword` | Forced password change after admin reset |
| `screenApp` | Main app: header bar + sidebar (22 nav items) + content area (`pgMy` personal + `pgTeam` team + lazy `mod_*` pages) |

### §3.4 JavaScript Function Map

Every module in the JS section follows the identical pattern:

```
renderXxxPage(container)    → Creates the HTML shell (stats bar + tab/view structure + modal)
xxxLoadData()               → Fetches data from server API endpoints
xxxRenderStats()            → Updates the stats/KPI bar
xxxRender()                 → Renders the main content (cards, tables, lists)
xxxShowForm(item?)          → Opens create/edit modal
xxxDelete(id)               → Deletes an item with confirmation
xxxCloseModal()             → Closes the modal
```

Additional functions per module vary: approval/reject actions, status transitions, detail views, specialized renders.

### §3.5 Key Global Functions

| Function | Purpose |
|----------|---------|
| `api(path, opts)` | HTTP client with auth headers, 401 redirect, MOCK_MODE fallback |
| `toast(msg, type)` | Toast notifications (success/error/info) |
| `showScreen(id)` | Screen transitions with opacity/transform animation |
| `setTheme(t)` | Theme switching (chromium/neural/holodeck/clean) |
| `saveSession(u)` / `loadSession()` / `clearSession()` | Session management via localStorage |
| `navigateToModule(mod)` | Sidebar navigation with lazy module creation |
| `loadFeatureFlags()` / `applyFeatureFlags()` | Hide sidebar items for disabled features |
| `connectSSE()` | SSE connection with reconnect logic |
| `boot()` | Startup sequence: check setup → load branding → load auth providers → session check → enter app |

### §3.6 Module Navigation Flow

```
User clicks sidebar item
  → navigateToModule(mod)
  → If mod === 'attendance': show pgMy or pgTeam based on view switch
  → Else: hide pgMy + pgTeam, create/show mod_{name} page
    → If page doesn't exist: createElement, call renderXxxPage(page)
    → page.classList.add('active')
```

---

## §4. Target File Structure

### §4.1 Directory Layout

```
blokhr/
├── shell.html                          # Boot → Setup → Login → App chrome (header + sidebar + content)
├── shared/
│   ├── api.js                          # HTTP client, auth headers, 401 redirect, MOCK_MODE
│   ├── session.js                      # Session management (THE ONE localStorage use)
│   ├── sse.js                          # SSE connection, reconnect, event dispatch
│   ├── toast.js                        # Toast notification system
│   ├── modal.js                        # Theme-aware modal/drawer/split-panel/inline-expand
│   ├── themes.js                       # Theme application, CSS variable injection
│   ├── prefs.js                        # Load/save member preferences from DB, apply to DOM
│   ├── router.js                       # Sidebar navigation, lazy module loading, tab switching
│   ├── lottie.js                       # Lottie overlay system for clock events
│   └── shared.css                      # Global CSS: themes, reset, typography, header, sidebar, toasts
├── modules/
│   ├── attendance/
│   │   ├── attendance.css
│   │   ├── attendance.html             # Template fragment
│   │   └── attendance.js               # renderAttendancePage, clock logic, grid, detail views
│   ├── leaves/
│   │   ├── leaves.css
│   │   ├── leaves.html
│   │   └── leaves.js
│   ├── regularizations/
│   │   ├── regularizations.css
│   │   ├── regularizations.html
│   │   └── regularizations.js          # Submit, 2-tier approve/reject, attendance correction
│   ├── timesheets/
│   │   ├── timesheets.css
│   │   ├── timesheets.html
│   │   └── timesheets.js
│   ├── org_chart/
│   │   ├── org_chart.css
│   │   ├── org_chart.html
│   │   └── org_chart.js
│   ├── documents/
│   │   ├── documents.css
│   │   ├── documents.html
│   │   └── documents.js
│   ├── training/
│   │   ├── training.css
│   │   ├── training.html
│   │   └── training.js
│   ├── workflows/
│   │   ├── workflows.css
│   │   ├── workflows.html
│   │   └── workflows.js
│   ├── surveys/
│   │   ├── surveys.css
│   │   ├── surveys.html
│   │   └── surveys.js
│   ├── assets/
│   │   ├── assets.css
│   │   ├── assets.html
│   │   └── assets.js
│   ├── visitors/
│   │   ├── visitors.css
│   │   ├── visitors.html
│   │   └── visitors.js
│   ├── iris_scan/
│   │   ├── iris_scan.css
│   │   ├── iris_scan.html
│   │   └── iris_scan.js
│   ├── face_recognition/
│   │   ├── face_recognition.css
│   │   ├── face_recognition.html
│   │   └── face_recognition.js
│   ├── expenses/
│   │   ├── expenses.css
│   │   ├── expenses.html
│   │   └── expenses.js
│   ├── time_tracking/
│   │   ├── time_tracking.css
│   │   ├── time_tracking.html
│   │   └── time_tracking.js
│   ├── overtime/
│   │   ├── overtime.css
│   │   ├── overtime.html
│   │   └── overtime.js
│   ├── leave_policies/
│   │   ├── leave_policies.css
│   │   ├── leave_policies.html
│   │   └── leave_policies.js
│   ├── holidays/
│   │   ├── holidays.css
│   │   ├── holidays.html
│   │   └── holidays.js
│   ├── geo_fencing/
│   │   ├── geo_fencing.css
│   │   ├── geo_fencing.html
│   │   └── geo_fencing.js
│   ├── ai_chatbot/
│   │   ├── ai_chatbot.css
│   │   ├── ai_chatbot.html
│   │   └── ai_chatbot.js
│   ├── analytics/
│   │   ├── analytics.css
│   │   ├── analytics.html
│   │   └── analytics.js
│   ├── audit_trail/
│   │   ├── audit_trail.css
│   │   ├── audit_trail.html
│   │   └── audit_trail.js
│   ├── feature_flags/
│   │   ├── feature_flags.css
│   │   ├── feature_flags.html
│   │   └── feature_flags.js
│   ├── webhooks/
│   │   ├── webhooks.css
│   │   ├── webhooks.html
│   │   └── webhooks.js
│   ├── settings/
│   │   ├── settings.css
│   │   ├── settings.html
│   │   └── settings.js                 # Admin settings panel with 36 sections
│   ├── profile/
│   │   ├── profile.css
│   │   ├── profile.html
│   │   └── profile.js                  # Employee profile with field-level access control
│   ├── setup_wizard/
│   │   ├── setup_wizard.css
│   │   ├── setup_wizard.html
│   │   └── setup_wizard.js
│   └── dashboard/
│       ├── dashboard.css
│       ├── dashboard.html
│       └── dashboard.js                # Personal dashboard with 6-tab system
├── tests/
│   ├── helpers/
│   │   └── setup.js                    # Mock API, create test DOM, seed data
│   ├── integration/
│   │   ├── attendance.test.js
│   │   ├── leaves.test.js
│   │   ├── regularizations.test.js
│   │   ├── timesheets.test.js
│   │   ├── org_chart.test.js
│   │   ├── documents.test.js
│   │   ├── training.test.js
│   │   ├── workflows.test.js
│   │   ├── surveys.test.js
│   │   ├── assets.test.js
│   │   ├── visitors.test.js
│   │   ├── iris_scan.test.js
│   │   ├── face_recognition.test.js
│   │   ├── expenses.test.js
│   │   ├── time_tracking.test.js
│   │   ├── overtime.test.js
│   │   ├── leave_policies.test.js
│   │   ├── holidays.test.js
│   │   ├── geo_fencing.test.js
│   │   ├── ai_chatbot.test.js
│   │   ├── analytics.test.js
│   │   ├── audit_trail.test.js
│   │   ├── feature_flags.test.js
│   │   ├── webhooks.test.js
│   │   ├── settings.test.js
│   │   ├── profile.test.js
│   │   ├── dashboard.test.js
│   │   ├── setup_wizard.test.js
│   │   ├── auth.test.js
│   │   ├── lottie.test.js
│   │   ├── prefs.test.js
│   │   ├── sse.test.js
│   │   ├── themes.test.js
│   │   ├── api.test.js
│   │   ├── router.test.js
│   │   └── session.test.js
│   └── unit/
│       └── validation.test.js          # PAN, Aadhaar, IFSC, phone validation functions
```

### §4.2 Module Loading Strategy

Shell loads shared infrastructure first, then lazy-loads modules on navigation:

```javascript
// shell.html boot sequence
1. Load shared/api.js, shared/session.js
2. Check setup status: GET /api/setup/status
3. If not complete: load modules/setup_wizard/
4. Load shared/themes.js, shared/prefs.js, shared/sse.js, shared/toast.js, shared/modal.js, shared/router.js, shared/lottie.js
5. Load member prefs from DB: GET /api/profiles/me/prefs → apply to DOM
6. Load tenant settings: GET /api/settings → cache for sidebar flags, branding, lottie data
7. On sidebar click: router.js lazy-loads the target module's CSS + JS + HTML
```

---

## §5. Settings Architecture

### §5.1 Core Principle

There is exactly one authoritative source of configuration: **the database**. Settings are rows and columns, not a JSON file on disk, not localStorage, not environment variables at runtime.

The `DatabaseEngine` abstraction means these settings live in whatever backend is configured — SQLite, Postgres, or any supported engine — but the access pattern is identical.

### §5.2 Two Categories

BlokHR has two categories of configurable data:

**Tenant Settings** (shared, admin-controlled): Apply to every user in the organisation. Stored in `tenant_settings` table with a JSON blob for infrequently-changed fields. Access: `POST /api/settings` (admin only, any change broadcasts SSE `settings-update` to all clients).

**Member Preferences** (per-user, user-controlled): Per-person. Each user gets their own row. Stored in `member_preferences` table. Access: `GET/PUT /api/profiles/me/prefs` (user can only read/write their own row).

**Critical:** These used to be localStorage in the legacy monolith. They are database records now. A user changing their theme on their laptop will see the same theme when they log in from their phone.

### §5.3 Tenant Settings Schema

#### §5.3.1 First-Class Columns

```sql
CREATE TABLE tenant_settings (
  id                  TEXT PRIMARY KEY,
  platform_name       TEXT,          -- displayed everywhere, never hardcoded
  company_legal_name  TEXT,          -- for certifications and exports
  logo_data_url       TEXT,          -- base64 or CDN URL
  login_tagline       TEXT,
  primary_timezone    TEXT,          -- IANA (e.g. "Asia/Kolkata")
  version             TEXT,
  settings_json       TEXT,          -- remaining settings as merged JSON blob
  created_at          TIMESTAMP,
  updated_at          TIMESTAMP
);
```

All of these are admin-controlled. The setup wizard writes the initial values during first-run (platform name, logo, tagline, timezone, first auth provider). After setup, the admin edits them anytime via the settings panel → `POST /api/settings` → SSE broadcasts to all clients. No employee ever touches these.

#### §5.3.2 settings_json Blob — Complete Schema

```typescript
interface SettingsJson {
  auth: {
    providers: {
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
    src: string;
    enabled: boolean;
    icon?: string;
    visibleToGroups?: string[];
  }>;

  attendance: {
    autoCutoffMinutes: number;                   // 15–180
    autoCutoffNotify: boolean;
    autoCutoffGraceWarningMinutes: number;
    clockOutShowMinutes: number;                 // 0 = always show
    clockInEarlyMinutes: number;
    dayBoundaryHour: number;                     // 1–8 (midnight partition)
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
    workDays: number[];                          // [1,2,3,4,5]
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
    dailyTime: string;                           // "HH:MM"
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
    photoMaxKB: number;                          // 50–5120
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
    accent: string;
    statusIn: string;
    statusBreak: string;
    statusAbsent: string;
    bg0: string;
    tx: string;
  }>;  // Up to 3 preset schemes; admin picks one to apply globally

  storage: {
    provider: 'local' | 'azure_blob' | 'aws_s3' | 's3_compatible' | 'none';
    local?: { basePath: string };
    azureBlob?: { connectionString: string; container: string };
    awsS3?: { region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
    s3Compatible?: { endpoint: string; bucket: string; accessKeyId: string; secretAccessKey: string; pathStyle: boolean };
    maxFileSizeMB: number;
  };

  notifications: {
    channels: {
      teams?:      { enabled: boolean; appId: string; appPassword: string };
      slack?:      { enabled: boolean; botToken: string; signingSecret: string };
      googleChat?: { enabled: boolean; serviceAccountJson: string };
      discord?:    { enabled: boolean; botToken: string; appId: string };
      telegram?:   { enabled: boolean; botToken: string };
      whatsapp?:   { enabled: boolean; phoneId: string; token: string };
      clickup?:    { enabled: boolean; apiToken: string };
      email?:      { enabled: boolean; host: string; port: number; user: string; pass: string; from: string; actionLinkSecret: string; serverBaseUrl: string };
    };
  };

  meetings: {
    zoom?:     { enabled: boolean; accountId: string; clientId: string; clientSecret: string };
    webex?:    { enabled: boolean; botToken: string };
    goto?:     { enabled: boolean; clientId: string; clientSecret: string };
    bluejeans?:{ enabled: boolean; apiKey: string };
  };

  security: {
    sessionTimeoutMinutes: number;           // 15–1440
    passwordMinLength: number;               // 6–32
    maxLoginAttempts: number;                 // 3–20
    lockoutDurationMinutes: number;          // 5–120
    magicLinkExpiryMinutes: number;          // 5–60
    actionLinkExpiryHours: number;           // 1–168
    rateLimitGlobal: number;                 // requests per minute per IP
    rateLimitAuth: number;                   // auth attempts per 15 min per IP
    mfaEnabled: boolean;
    mfaProvider?: 'totp' | 'sms';
  };

  scheduler: {
    autoCutoffIntervalMinutes: number;       // 5–60
    absenceMarkingIntervalMinutes: number;   // 15–120
    ptoAccrualIntervalHours: number;         // 1–24
    reminderIntervalHours: number;           // 1–12
  };

  regularization: {
    maxDaysBack: number;                     // 1–90 (how far back can employee request)
    maxPerMonth: number;                     // 0 = unlimited
    autoApproveMinorCorrections: boolean;
    minorCorrectionThresholdMinutes: number; // difference < this = auto-approve
  };

  bdMeetings: {
    departmentId: string;                    // which group ID is "Business Development"
    requireQualification: boolean;
    qualificationFields: string[];
  };

  dataRetention: {
    auditLogDays: number;                    // 30–3650
    chatMessageDays: number;                 // 30–3650
    clockEventDays: number;                  // 90–3650
    notificationQueueDays: number;           // 7–365
    webhookLogDays: number;                  // 7–365
    eventBusRetentionDays: number;           // 7–365
  };

  localization: {
    dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0=Sun, 1=Mon
    currencyCode: string;                    // ISO 4217 (INR, USD, EUR, etc.)
    currencySymbol: string;                  // ₹, $, €, etc.
    numberLocale: string;                    // en-IN, en-US, de-DE, etc.
  };

  payroll: {
    epfEmployeeRate: number;                 // default 12
    epfEmployerRate: number;                 // default 3.67
    epsRate: number;                         // default 8.33
    epfSalaryCap: number;                    // default 15000
    esiEmployeeRate: number;                 // default 0.75
    esiEmployerRate: number;                 // default 3.25
    esiThreshold: number;                    // default 21000
    gratuityTaxExemptCap: number;            // default 2000000
    bonusMinRate: number;                    // default 8.33
    bonusMaxRate: number;                    // default 20
    bonusSalaryCap: number;                  // default 21000
    professionalTaxState?: string;
    professionalTaxSlabs?: Array<{ min: number; max: number; tax: number }>;
    tdsEnabled: boolean;
    customFormulas?: Array<{ id: string; name: string; formula: string; enabled: boolean }>;
  };

  liveChat: {
    maxMessageLength: number;                // 100–5000
    fileSharingEnabled: boolean;
    autoCreateDepartmentChannels: boolean;
    messageEditWindowMinutes: number;        // 0 = no edit, 5–1440
    messageDeleteEnabled: boolean;
    typingIndicatorEnabled: boolean;
  };

  trainingLms: {
    externalLmsWebhooks: Array<{ provider: string; webhookUrl: string; apiKey: string; enabled: boolean }>;
    defaultBudgetPerDepartment: number;
    perEmployeeBudgetCap: number;
    certificateTemplateId: string;
    mandatoryOnNewHire: boolean;
    autoAssignCourseIds: string[];
    recertificationMonths: number;           // 0 = no recertification
  };

  workflowDefaults: {
    defaultSlaHours: number;                 // 24–720
    maxStepsPerWorkflow: number;             // 2–20
    maxActiveInstances: number;              // 10–10000
    enablePrebuiltTemplates: boolean;
  };

  surveyDefaults: {
    defaultAnonymous: boolean;
    maxQuestionsPerSurvey: number;           // 5–100
    responseDeadlineDays: number;            // 0 = no deadline
    minResponseRateForResults: number;       // 0–100 percentage
  };

  assetConfig: {
    assetTypes: Array<{ id: string; name: string; enabled: boolean }>;
    defaultDepreciationMethod: 'straight_line' | 'declining_balance';
    defaultUsefulLifeYears: Record<string, number>;  // per asset type
    warrantyAlertDays: number;               // days before expiry
    customFields: Array<{ id: string; name: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] }>;
  };

  visitorConfig: {
    autoCheckoutReminderHours: number;       // 1–24
    ndaTemplateText: string;
    badgePrinterUrl: string;
    preRegistrationLeadTimeDays: number;     // 0–30
    maxVisitDurationHours: number;           // 1–48, alert after this
    photoRequired: boolean;
    hostApprovalRequired: boolean;
  };

  mobileConfig: {
    locationTrackingIntervalSeconds: number; // 60–3600
    pushBatchSize: number;                   // 10–1000
    deepLinkWebBaseUrl: string;
    biometricAuthEnabled: boolean;
    offlineRegularizationPrompt: boolean;    // prompt user to submit regularization when back online
  };

  exportConfig: {
    defaultDateRangeDays: number;            // 7–365
    maxRowsPerExport: number;                // 1000–100000
    scheduledExportEnabled: boolean;
    scheduledExportTime: string;             // HH:MM
    scheduledExportRecipients: string[];     // email addresses
    scheduledExportFormat: 'csv' | 'xlsx';
    exportRetentionDays: number;             // 7–365
  };

  emailTemplates: {
    logoInHeader: boolean;
    footerText: string;
    customCss: string;
    replyToAddress: string;
    companyAddress: string;
  };

  calendar: {
    fiscalYearStartMonth: number;            // 1–12 (1=Jan, 4=Apr for India)
    payPeriodType: 'monthly' | 'biweekly' | 'weekly';
    payDayOfMonth: number;                   // 1–28
    holidayImportSourceUrl: string;          // URL for auto-importing holidays
  };

  uiBehavior: {
    idleTimeoutMinutes: number;              // 0 = disabled, 5–1440
    autoRefreshOnFocus: boolean;
    soundNotifications: boolean;
    cardViewDensity: 'compact' | 'comfortable' | 'spacious';
    dashboardWidgets: Array<{ id: string; enabled: boolean; position: number }>;
    showWelcomeMessage: boolean;
  };
}
```

### §5.4 Member Preferences Schema

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
  notification_prefs  TEXT,          -- JSON: which events this user wants alerts for
  updated_at          TIMESTAMP
);
```

**API:**

```
GET  /api/profiles/me/prefs   → returns prefs row for the calling user
PUT  /api/profiles/me/prefs   → upserts prefs row for the calling user
                                Body: any subset of the columns above
                                All fields optional — unset fields unchanged
```

**On session start (frontend):**

```javascript
// After auth, load and apply prefs from server
const { prefs } = await httpClient.get('/api/profiles/me/prefs');
applyPrefsToDOM(prefs);
// No localStorage.getItem for any preference. Zero.
```

**On preference change (frontend):**

```javascript
// User changes theme in gear panel
await httpClient.put('/api/profiles/me/prefs', { theme: 'neural' });
// No localStorage.setItem. Zero.
```

### §5.5 3-Tier Resolution Chain

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

### §5.6 SSE Settings Propagation

```
Admin changes a setting:
  POST /api/settings
  → tenant_settings updated
  → SSE broadcast: { type: "settings-update" }
  → all clients: GET /api/settings → refresh settingsCache
  → UI updates immediately

User changes a preference:
  PUT /api/profiles/me/prefs
  → member_preferences upserted
  → No SSE broadcast needed (private to this user)
  → Frontend applies change immediately to DOM
  → Next session on any device: GET /api/profiles/me/prefs restores the pref
```

### §5.7 What Lives Where — Complete Reference

| Data | Table / Location | API |
|------|-----------------|-----|
| Platform name | `tenant_settings.platform_name` | `POST /api/settings` |
| Logo | `tenant_settings.logo_data_url` | `POST /api/settings` |
| Login tagline | `tenant_settings.login_tagline` | `POST /api/settings` |
| Primary timezone | `tenant_settings.primary_timezone` | `POST /api/settings` |
| Auth providers | `tenant_settings.settings_json.auth` | `POST /api/settings` |
| Tab configuration | `tenant_settings.settings_json.tabs` | `POST /api/settings` |
| Attendance rules | `tenant_settings.settings_json.attendance` | `POST /api/settings` |
| Shift defaults | `tenant_settings.settings_json.shifts` | `POST /api/settings` |
| Leave types & config | `tenant_settings.settings_json.leaves` | `POST /api/settings` |
| Approval flows | `tenant_settings.settings_json.approvals` | `POST /api/settings` |
| Digest config | `tenant_settings.settings_json.digest` | `POST /api/settings` |
| Analytics config | `tenant_settings.settings_json.analytics` | `POST /api/settings` |
| Profile requirements | `tenant_settings.settings_json.profiles` | `POST /api/settings` |
| UI defaults | `tenant_settings.settings_json.ui` | `POST /api/settings` |
| Lottie animations | `tenant_settings.settings_json.lottie` | `POST /api/settings` |
| AI configuration | `tenant_settings.settings_json.ai` | `POST /api/settings` |
| Compliance | `tenant_settings.settings_json.compliance` | `POST /api/settings` |
| Colour schemes (3 presets) | `tenant_settings.settings_json.colourSchemes` | `POST /api/settings` |
| Storage provider config | `tenant_settings.settings_json.storage` | `POST /api/settings` |
| Notification channel creds | `tenant_settings.settings_json.notifications` | `POST /api/settings` |
| Meeting platform creds | `tenant_settings.settings_json.meetings` | `POST /api/settings` |
| Security & session config | `tenant_settings.settings_json.security` | `POST /api/settings` |
| Scheduler intervals | `tenant_settings.settings_json.scheduler` | `POST /api/settings` |
| Regularization rules | `tenant_settings.settings_json.regularization` | `POST /api/settings` |
| BD meeting config | `tenant_settings.settings_json.bdMeetings` | `POST /api/settings` |
| Data retention policies | `tenant_settings.settings_json.dataRetention` | `POST /api/settings` |
| Localization & formatting | `tenant_settings.settings_json.localization` | `POST /api/settings` |
| Payroll formula params | `tenant_settings.settings_json.payroll` | `POST /api/settings` |
| Live chat config | `tenant_settings.settings_json.liveChat` | `POST /api/settings` |
| Training / LMS config | `tenant_settings.settings_json.trainingLms` | `POST /api/settings` |
| Workflow defaults | `tenant_settings.settings_json.workflowDefaults` | `POST /api/settings` |
| Survey defaults | `tenant_settings.settings_json.surveyDefaults` | `POST /api/settings` |
| Asset configuration | `tenant_settings.settings_json.assetConfig` | `POST /api/settings` |
| Visitor configuration | `tenant_settings.settings_json.visitorConfig` | `POST /api/settings` |
| Mobile / location config | `tenant_settings.settings_json.mobileConfig` | `POST /api/settings` |
| Export defaults | `tenant_settings.settings_json.exportConfig` | `POST /api/settings` |
| Email templates | `tenant_settings.settings_json.emailTemplates` | `POST /api/settings` |
| Calendar & time config | `tenant_settings.settings_json.calendar` | `POST /api/settings` |
| UI behavior config | `tenant_settings.settings_json.uiBehavior` | `POST /api/settings` |
| Lottie animation data | `lottie_animations` table | `GET/PUT/DELETE /api/settings/lottie/:action` |
| Admin list | `admins` table | `POST /api/settings/admins` |
| Employee records | `members` table | `GET/POST/PUT /api/members` |
| Departments | `groups` table | `GET/POST/PUT /api/groups` |
| Individual shift override | `members.individual_shift_start/end` | `PUT /api/members/:email` |
| Per-dept shift | `groups.shift_start/end` | `PUT /api/groups/:id` |
| Individual manager override | `members.individual_manager_email` | `PUT /api/members/:email` |
| User theme | `member_preferences.theme` | `PUT /api/profiles/me/prefs` |
| User dark mode | `member_preferences.dark_mode` | `PUT /api/profiles/me/prefs` |
| User colour overrides | `member_preferences.color_*` | `PUT /api/profiles/me/prefs` |
| User background image | `member_preferences.bg_image_url` | `PUT /api/profiles/me/prefs` |
| User bg settings | `member_preferences.bg_opacity/blur/darken` | `PUT /api/profiles/me/prefs` |
| User timezone slots | `member_preferences.timezone_slot_1..4` | `PUT /api/profiles/me/prefs` |
| User notification prefs | `member_preferences.notification_prefs` | `PUT /api/profiles/me/prefs` |
| Clock entries | `clock_entries` | `POST /api/clock` |
| Leave requests | `leave_requests` | `POST /api/leaves` |
| Feature flags | `feature_flags` | `PUT /api/features/:key` |
| Geo zones | `geo_zones` | `POST /api/geo/zones` |
| Audit trail | `audit_trail` | `GET /api/analytics/audit` |
| Session token | `localStorage: session_{tenantId}` | **shell.html ONLY** |

### §5.8 Setup Wizard Writes

The setup wizard runs once. It writes:

```sql
-- Steps 1-3: Everything goes to the DB
INSERT INTO tenant_settings ...;       -- platform name, timezone, logo, tagline
INSERT INTO admins ...;                -- first admin email
-- settings_json gets auth providers, tabs, and all defaults
```

After the wizard completes, `setup_complete = 1` is set on the branding/tenant_settings row. Subsequent visits skip the wizard and go to login.

---

## §6. Admin Settings Panel — Module Breakdown

The admin settings panel is a dedicated module (`modules/settings/`) accessible only to users with admin role. It renders 16 collapsible sections, each mapping to a specific part of `tenant_settings`. Every save action calls `POST /api/settings` with the updated fields, which triggers an SSE `settings-update` broadcast to all connected clients.

### §6.1 Branding

| Field | Type | Validation | Server Location |
|-------|------|-----------|----------------|
| Logo | File upload (base64) or URL | Max 500 KB, image/* MIME types | `tenant_settings.logo_data_url` |
| Login tagline | Text | Max 200 chars | `tenant_settings.login_tagline` |

API: `POST /api/settings` with `{ logo_data_url, login_tagline }`

### §6.2 Attendance Rules

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Auto-cutoff minutes | Number input | 15–180 | `attendance.autoCutoffMinutes` |
| Auto-cutoff notify | Toggle | boolean | `attendance.autoCutoffNotify` |
| Cutoff grace warning minutes | Number input | 0–60 | `attendance.autoCutoffGraceWarningMinutes` |
| Clock-out show minutes | Number input | 0 = always show | `attendance.clockOutShowMinutes` |
| Clock-in early minutes | Number input | 0–120 | `attendance.clockInEarlyMinutes` |
| Day boundary hour | Number input | 1–8 | `attendance.dayBoundaryHour` |
| Grace period minutes | Number input | 0–60 | `attendance.gracePeriodMinutes` |
| Rounding rules | Select | none / 5 / 10 / 15 | `attendance.roundingRules` |
| Geofence enabled | Toggle | boolean | `attendance.geofenceEnabled` |
| Geofence strict | Toggle | boolean (only if geofence enabled) | `attendance.geofenceStrict` |
| IP restriction enabled | Toggle | boolean | `attendance.ipRestrictionEnabled` |
| Allowed IPs | Textarea (one per line) | Valid IPv4/IPv6 | `attendance.allowedIPs` |
| Kiosk mode | Toggle | boolean | `attendance.kioskEnabled` |

API: `POST /api/settings` with `{ settings_json: { attendance: { ... } } }`

### §6.3 Overtime

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Overtime enabled | Toggle | boolean | `attendance.overtimeEnabled` |
| Daily threshold minutes | Number input | 0–720 | `attendance.overtimeDailyThresholdMinutes` |
| Weekly threshold minutes | Number input | 0–3600 | `attendance.overtimeWeeklyThresholdMinutes` |
| Multiplier | Number input | 1.0–4.0 (step 0.25) | `attendance.overtimeMultiplier` |

API: `POST /api/settings` with `{ settings_json: { attendance: { overtimeEnabled, ... } } }`

### §6.4 Shifts

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Default shift start | Time input | HH:MM | `shifts.default.start` |
| Default shift end | Time input | HH:MM | `shifts.default.end` |
| Overnight shift | Toggle | boolean | `shifts.default.overnight` |
| Work days | Checkbox group | 0–6 (Sun–Sat) | `shifts.workDays` |

API: `POST /api/settings` with `{ settings_json: { shifts: { ... } } }`

### §6.5 Leave Configuration

**Leave Types (CRUD list):**

| Field | Type | Validation |
|-------|------|-----------|
| Type ID | Auto-generated | UUID |
| Name | Text | Required, max 50 chars |
| Paid | Toggle | boolean |
| Max per year | Number | 0–365 |
| Can accrue | Toggle | boolean |

**Accrual Engine:**

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Enabled | Toggle | boolean | `leaves.accrualEngine.enabled` |
| Period | Select | monthly / quarterly / annually | `leaves.accrualEngine.period` |
| Rate | Number | 0.0–10.0 | `leaves.accrualEngine.rate` |

**Policies:**

| Field | Type | JSON Path |
|-------|------|-----------|
| Sandwich policy | Toggle | `leaves.sandwichPolicy` |
| Encashment enabled | Toggle | `leaves.encashmentEnabled` |
| Max encash per year | Number | `leaves.maxEncashPerYear` |
| Year-end carryover days | Number | `leaves.yearEndCarryover` |
| Comp-off enabled | Toggle | `leaves.compOffEnabled` |
| Comp-off expiry days | Number | `leaves.compOffExpiryDays` |

API: `POST /api/settings` with `{ settings_json: { leaves: { ... } } }`

### §6.6 Approval Flows

Dynamic form for defining multi-step approval workflows per entity type:

| Field | Type | Validation |
|-------|------|-----------|
| Entity type | Select | leave / regularization / overtime / expense / training |
| Steps (repeatable) | Row: level (auto), role (select: manager/HR/admin/custom), escalate after hours (number) | At least 1 step |
| Auto-escalation enabled | Toggle | boolean |
| Auto-escalation hours | Number | 1–168 |

API: `POST /api/settings` with `{ settings_json: { approvals: { ... } } }`

### §6.7 Digest / Notifications

| Field | Type | JSON Path |
|-------|------|-----------|
| Daily digest enabled | Toggle | `digest.dailyEnabled` |
| Daily time | Time input | `digest.dailyTime` |
| Show present | Toggle | `digest.dailySections.present` |
| Show absent | Toggle | `digest.dailySections.absent` |
| Show late | Toggle | `digest.dailySections.late` |
| Show on leave | Toggle | `digest.dailySections.onLeave` |
| Weekly digest enabled | Toggle | `digest.weeklyEnabled` |
| Weekly day | Select (Mon–Sun) | `digest.weeklyDay` |
| Weekly time | Time input | `digest.weeklyTime` |

API: `POST /api/settings` with `{ settings_json: { digest: { ... } } }`

### §6.8 Analytics

| Field | Type | JSON Path |
|-------|------|-----------|
| Bradford score enabled | Toggle | `analytics.bradfordScoreEnabled` |
| Bradford alert threshold | Number (0–1000) | `analytics.bradfordAlertThreshold` |
| Point system enabled | Toggle | `analytics.pointSystemEnabled` |
| Audit trail enabled | Toggle | `analytics.auditTrailEnabled` |

API: `POST /api/settings` with `{ settings_json: { analytics: { ... } } }`

### §6.9 Profile Requirements

| Field | Type | JSON Path |
|-------|------|-----------|
| Required fields | Multi-select checklist | `profiles.requiredFields` |
| Photo max KB | Number (50–5120) | `profiles.photoMaxKB` |
| Face recognition enabled | Toggle | `profiles.faceRecognitionEnabled` |
| Iris scan enabled | Toggle | `profiles.irisEnabled` |

Available required fields: `name`, `phone`, `emergency_contact`, `parentage`, `pan`, `aadhaar`, `uan`, `bank_account`, `ifsc`, `bank_name`

API: `POST /api/settings` with `{ settings_json: { profiles: { ... } } }`

### §6.10 UI Defaults

| Field | Type | JSON Path |
|-------|------|-----------|
| Grid columns (desktop) | Number (2–6) | `ui.gridColumns.desktop` |
| Grid columns (tablet) | Number (1–4) | `ui.gridColumns.tablet` |
| Grid columns (mobile) | Number (1–2) | `ui.gridColumns.mobile` |
| Status sort order | Drag-and-drop list | `ui.statusSortOrder` |
| Toast duration ms | Number (1000–10000) | `ui.toastDurationMs` |
| Board refresh interval ms | Number (5000–120000) | `ui.boardRefreshMs` |

API: `POST /api/settings` with `{ settings_json: { ui: { ... } } }`

### §6.11 AI Chatbot

| Field | Type | JSON Path |
|-------|------|-----------|
| Provider | Select (ollama / anthropic / gemini / mock) | `ai.provider` |
| Assistant name | Text | `ai.assistantName` |
| Welcome message | Textarea | `ai.welcomeMessage` |
| System prompt prefix | Textarea | `ai.systemPromptPrefix` |
| Visibility | Select (off / admin-only / all / specific-roles) | `ai.visibility` |
| Visible to roles | Multi-select (if specific-roles) | `ai.visibleToRoles` |
| Position | Select (bottom-left / bottom-right) | `ai.position` |
| Rate limit (requests/min) | Number | `ai.rateLimit` |

**Per-provider config (shown conditionally based on provider selection):**

| Provider | Fields |
|----------|--------|
| Ollama | Model name, Base URL, API key (optional) |
| Anthropic | Model name, API key |
| Gemini | Model name, API key |
| Mock | (no config needed) |

API: `POST /api/settings` with `{ settings_json: { ai: { ... } } }`

### §6.12 Colour Schemes

Admin creates up to 3 named preset colour schemes. Each scheme defines:

| Field | Type |
|-------|------|
| Scheme name | Text |
| Accent colour | Colour picker (hex) |
| Status In colour | Colour picker (hex) |
| Status Break colour | Colour picker (hex) |
| Status Absent colour | Colour picker (hex) |
| Background colour | Colour picker (hex) |
| Text colour | Colour picker (hex) |

The admin selects one scheme as the global default. Users can further override individual colours via their member preferences.

API: `POST /api/settings` with `{ settings_json: { colourSchemes: [...] } }`

### §6.13 Compliance

| Field | Type | JSON Path |
|-------|------|-----------|
| Country | Select (country list) | `compliance.country` |
| State | Select (conditional on country) | `compliance.state` |
| Labour law template | Select | `compliance.labourLawTemplate` |

API: `POST /api/settings` with `{ settings_json: { compliance: { ... } } }`

### §6.14 Auth Providers

Editable post-setup (not just in the wizard). Each provider has an enabled toggle plus provider-specific configuration fields:

| Provider | Config Fields |
|----------|---------------|
| MSAL (Microsoft) | Client ID, Tenant ID, Redirect URI |
| Google | Client ID |
| Okta | Domain, Client ID |
| Teams SSO | Client ID |
| GitHub | Client ID |
| SAML | Metadata URL, Entity ID |
| Custom JWT | JWKS URI, Issuer, Audience |
| Magic Link | From email address |
| Local PIN | (no config, kiosk mode) |

API: `POST /api/settings` with `{ settings_json: { auth: { providers: { ... } } } }`

### §6.15 Tabs

CRUD list for configuring application tabs/sections:

| Field | Type | Validation |
|-------|------|-----------|
| Tab ID | Auto-generated | UUID |
| Label | Text | Required, max 30 chars |
| Source | Text | URL or filename |
| Enabled | Toggle | boolean |
| Icon | Text (optional) | Icon name or emoji |
| Visible to groups | Multi-select (optional) | Group IDs from `groups` table |

API: `POST /api/settings` with `{ settings_json: { tabs: [...] } }`

### §6.16 Lottie Animations

Per clock-action animation configuration. Admin uploads Lottie JSON files; all users see the animations.

| Action | Upload Zone | Preview | Controls |
|--------|------------|---------|----------|
| Clock In | Drag/drop `.json` file, max 2 MB | Inline Lottie player | Test, Remove |
| Clock Out | Drag/drop `.json` file, max 2 MB | Inline Lottie player | Test, Remove |
| Break | Drag/drop `.json` file, max 2 MB | Inline Lottie player | Test, Remove |
| Back | Drag/drop `.json` file, max 2 MB | Inline Lottie player | Test, Remove |

Each action also has a configurable display duration (seconds).

API: `POST /api/settings` with `{ settings_json: { lottie: { 'clock-in': { data, duration }, ... } } }`

### §6.17 Storage Provider

| Field | Type | JSON Path |
|-------|------|-----------|
| Provider | Select (local / azure_blob / aws_s3 / s3_compatible / none) | `storage.provider` |
| Max file size MB | Number (1–100) | `storage.maxFileSizeMB` |

**Per-provider config (shown conditionally):**

| Provider | Fields |
|----------|--------|
| Local | Base path |
| Azure Blob | Connection string (secret, masked), Container name |
| AWS S3 | Region, Bucket, Access key ID (secret), Secret access key (secret) |
| S3 Compatible | Endpoint URL, Bucket, Access key ID (secret), Secret access key (secret), Path style toggle |

Secrets are masked in GET responses (show only last 4 chars). Full value sent on PUT.

Env var fallback: `AZURE_BLOB_CONNECTION_STRING`, `AWS_REGION`, `AWS_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_PATH_STYLE`.

API: `POST /api/settings` with `{ settings_json: { storage: { ... } } }`

### §6.18 Notification Channels

Each channel gets a card with: **enabled toggle**, credential fields, **Test Connection button**, connection status indicator (connected / not configured / error).

| Channel | Config Fields | Env Var Fallback |
|---------|---------------|-----------------|
| Teams | App ID, App Password (secret) | `AZURE_BOT_APP_ID`, `AZURE_BOT_APP_PASSWORD` |
| Slack | Bot Token (secret), Signing Secret (secret) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` |
| Google Chat | Service Account JSON (secret) | `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` |
| Discord | Bot Token (secret), App ID | `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID` |
| Telegram | Bot Token (secret) | `TELEGRAM_BOT_TOKEN` |
| WhatsApp | Phone ID, Token (secret) | `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN` |
| ClickUp | API Token (secret) | `CLICKUP_API_TOKEN` |
| Email/SMTP | Host, Port, User, Password (secret), From address, Action Link Secret (secret), Server Base URL | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ACTION_LINK_SECRET`, `SERVER_BASE_URL` |

**Resolution:** Env var wins if set. Otherwise DB value. If neither, channel disabled.

```typescript
// In tenant-settings-service.ts
getSlackBotToken(): string {
  if (process.env.SLACK_BOT_TOKEN) return process.env.SLACK_BOT_TOKEN;
  return this.settingsJson?.notifications?.channels?.slack?.botToken ?? '';
}
```

API: `POST /api/settings` with `{ settings_json: { notifications: { channels: { ... } } } }`

### §6.19 Meeting Integrations

| Platform | Config Fields | Env Var Fallback |
|----------|---------------|-----------------|
| Zoom | Account ID, Client ID (secret), Client Secret (secret) | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` |
| Webex | Bot Token (secret) | `WEBEX_BOT_TOKEN` |
| GoToMeeting | Client ID (secret), Client Secret (secret) | `GOTO_CLIENT_ID`, `GOTO_CLIENT_SECRET` |
| BlueJeans | API Key (secret) | `BLUEJEANS_API_KEY` |

Each platform: enabled toggle + credential fields + Test Connection button.

API: `POST /api/settings` with `{ settings_json: { meetings: { ... } } }`

### §6.20 Security & Session

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Session timeout minutes | Number | 15–1440 | `security.sessionTimeoutMinutes` |
| Password min length | Number | 6–32 | `security.passwordMinLength` |
| Max login attempts | Number | 3–20 | `security.maxLoginAttempts` |
| Lockout duration minutes | Number | 5–120 | `security.lockoutDurationMinutes` |
| Magic link expiry minutes | Number | 5–60 | `security.magicLinkExpiryMinutes` |
| Action link expiry hours | Number | 1–168 | `security.actionLinkExpiryHours` |
| Rate limit (global req/min/IP) | Number | 10–1000 | `security.rateLimitGlobal` |
| Rate limit (auth attempts/15min/IP) | Number | 5–100 | `security.rateLimitAuth` |
| MFA enabled | Toggle | boolean | `security.mfaEnabled` |
| MFA provider | Select (totp / sms) | if MFA enabled | `security.mfaProvider` |

API: `POST /api/settings` with `{ settings_json: { security: { ... } } }`

### §6.21 Scheduler

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Auto-cutoff check interval (min) | Number | 5–60 | `scheduler.autoCutoffIntervalMinutes` |
| Absence marking interval (min) | Number | 15–120 | `scheduler.absenceMarkingIntervalMinutes` |
| PTO accrual interval (hours) | Number | 1–24 | `scheduler.ptoAccrualIntervalHours` |
| Reminder interval (hours) | Number | 1–12 | `scheduler.reminderIntervalHours` |

API: `POST /api/settings` with `{ settings_json: { scheduler: { ... } } }`

### §6.22 Regularization Rules

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Max days back | Number | 1–90 | `regularization.maxDaysBack` |
| Max per month | Number | 0 = unlimited | `regularization.maxPerMonth` |
| Auto-approve minor corrections | Toggle | boolean | `regularization.autoApproveMinorCorrections` |
| Minor correction threshold (min) | Number | 1–60 (if auto-approve on) | `regularization.minorCorrectionThresholdMinutes` |

API: `POST /api/settings` with `{ settings_json: { regularization: { ... } } }`

### §6.23 BD Meetings

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| BD Department ID | Select (from groups) | Must exist in groups table | `bdMeetings.departmentId` |
| Require qualification step | Toggle | boolean | `bdMeetings.requireQualification` |
| Qualification fields | Multi-select | client, location, budget, etc. | `bdMeetings.qualificationFields` |

API: `POST /api/settings` with `{ settings_json: { bdMeetings: { ... } } }`

### §6.24 Data Retention

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Audit log retention (days) | Number | 30–3650 | `dataRetention.auditLogDays` |
| Chat message retention (days) | Number | 30–3650 | `dataRetention.chatMessageDays` |
| Clock event retention (days) | Number | 90–3650 | `dataRetention.clockEventDays` |
| Notification queue cleanup (days) | Number | 7–365 | `dataRetention.notificationQueueDays` |
| Webhook log retention (days) | Number | 7–365 | `dataRetention.webhookLogDays` |
| Event bus retention (days) | Number | 7–365 | `dataRetention.eventBusRetentionDays` |

API: `POST /api/settings` with `{ settings_json: { dataRetention: { ... } } }`

### §6.25 Localization & Formatting

| Field | Type | JSON Path |
|-------|------|-----------|
| Date format | Select (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD) | `localization.dateFormat` |
| Time format | Select (12h, 24h) | `localization.timeFormat` |
| Week start day | Select (Sunday–Saturday) | `localization.weekStartDay` |
| Currency code | Text (ISO 4217: INR, USD, EUR) | `localization.currencyCode` |
| Currency symbol | Text (₹, $, €) | `localization.currencySymbol` |
| Number locale | Text (en-IN, en-US, de-DE) | `localization.numberLocale` |

API: `POST /api/settings` with `{ settings_json: { localization: { ... } } }`

### §6.26 Payroll / Formula Parameters

| Field | Type | Default | JSON Path |
|-------|------|---------|-----------|
| EPF employee rate (%) | Number | 12 | `payroll.epfEmployeeRate` |
| EPF employer rate (%) | Number | 3.67 | `payroll.epfEmployerRate` |
| EPS rate (%) | Number | 8.33 | `payroll.epsRate` |
| EPF salary cap (₹) | Number | 15000 | `payroll.epfSalaryCap` |
| ESI employee rate (%) | Number | 0.75 | `payroll.esiEmployeeRate` |
| ESI employer rate (%) | Number | 3.25 | `payroll.esiEmployerRate` |
| ESI threshold (₹) | Number | 21000 | `payroll.esiThreshold` |
| Gratuity tax-exempt cap (₹) | Number | 2000000 | `payroll.gratuityTaxExemptCap` |
| Bonus min rate (%) | Number | 8.33 | `payroll.bonusMinRate` |
| Bonus max rate (%) | Number | 20 | `payroll.bonusMaxRate` |
| Bonus salary cap (₹) | Number | 21000 | `payroll.bonusSalaryCap` |
| Professional tax state | Select | — | `payroll.professionalTaxState` |
| TDS enabled | Toggle | false | `payroll.tdsEnabled` |

All rates change with government policy — must be admin-configurable, not hardcoded.

API: `POST /api/settings` with `{ settings_json: { payroll: { ... } } }`

### §6.27 Live Chat

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Max message length | Number | 100–5000 | `liveChat.maxMessageLength` |
| File sharing enabled | Toggle | boolean | `liveChat.fileSharingEnabled` |
| Auto-create dept channels | Toggle | boolean | `liveChat.autoCreateDepartmentChannels` |
| Message edit window (min) | Number | 0 = no edit, 5–1440 | `liveChat.messageEditWindowMinutes` |
| Message delete enabled | Toggle | boolean | `liveChat.messageDeleteEnabled` |
| Typing indicator | Toggle | boolean | `liveChat.typingIndicatorEnabled` |

API: `POST /api/settings` with `{ settings_json: { liveChat: { ... } } }`

### §6.28 Training / LMS

| Field | Type | JSON Path |
|-------|------|-----------|
| External LMS webhooks | CRUD list (provider, webhook URL, API key, enabled) | `trainingLms.externalLmsWebhooks` |
| Default budget per department | Number | `trainingLms.defaultBudgetPerDepartment` |
| Per-employee budget cap | Number | `trainingLms.perEmployeeBudgetCap` |
| Certificate template ID | Text | `trainingLms.certificateTemplateId` |
| Mandatory on new hire | Toggle | `trainingLms.mandatoryOnNewHire` |
| Auto-assign course IDs | Multi-select | `trainingLms.autoAssignCourseIds` |
| Recertification months | Number (0 = off) | `trainingLms.recertificationMonths` |

API: `POST /api/settings` with `{ settings_json: { trainingLms: { ... } } }`

### §6.29 Workflow Defaults

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Default SLA hours | Number | 24–720 | `workflowDefaults.defaultSlaHours` |
| Max steps per workflow | Number | 2–20 | `workflowDefaults.maxStepsPerWorkflow` |
| Max active instances | Number | 10–10000 | `workflowDefaults.maxActiveInstances` |
| Enable pre-built templates | Toggle | boolean | `workflowDefaults.enablePrebuiltTemplates` |

API: `POST /api/settings` with `{ settings_json: { workflowDefaults: { ... } } }`

### §6.30 Survey Defaults

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Default anonymous | Toggle | boolean | `surveyDefaults.defaultAnonymous` |
| Max questions per survey | Number | 5–100 | `surveyDefaults.maxQuestionsPerSurvey` |
| Response deadline days | Number | 0 = no deadline | `surveyDefaults.responseDeadlineDays` |
| Min response rate for results (%) | Number | 0–100 | `surveyDefaults.minResponseRateForResults` |

API: `POST /api/settings` with `{ settings_json: { surveyDefaults: { ... } } }`

### §6.31 Asset Configuration

| Field | Type | JSON Path |
|-------|------|-----------|
| Asset types | CRUD list (id, name, enabled) | `assetConfig.assetTypes` |
| Default depreciation method | Select (straight_line / declining_balance) | `assetConfig.defaultDepreciationMethod` |
| Default useful life per type | Key-value (type → years) | `assetConfig.defaultUsefulLifeYears` |
| Warranty alert days | Number (days before expiry) | `assetConfig.warrantyAlertDays` |
| Custom fields | CRUD list (id, name, type, options) | `assetConfig.customFields` |

API: `POST /api/settings` with `{ settings_json: { assetConfig: { ... } } }`

### §6.32 Visitor Configuration

| Field | Type | JSON Path |
|-------|------|-----------|
| Auto-checkout reminder hours | Number (1–24) | `visitorConfig.autoCheckoutReminderHours` |
| NDA template text | Textarea | `visitorConfig.ndaTemplateText` |
| Badge printer URL | Text | `visitorConfig.badgePrinterUrl` |
| Pre-registration lead time days | Number (0–30) | `visitorConfig.preRegistrationLeadTimeDays` |
| Max visit duration hours | Number (1–48) | `visitorConfig.maxVisitDurationHours` |
| Photo required | Toggle | `visitorConfig.photoRequired` |
| Host approval required | Toggle | `visitorConfig.hostApprovalRequired` |

API: `POST /api/settings` with `{ settings_json: { visitorConfig: { ... } } }`

### §6.33 Mobile / Location

| Field | Type | JSON Path |
|-------|------|-----------|
| Location tracking interval (sec) | Number (60–3600) | `mobileConfig.locationTrackingIntervalSeconds` |
| Push notification batch size | Number (10–1000) | `mobileConfig.pushBatchSize` |
| Deep link web base URL | Text | `mobileConfig.deepLinkWebBaseUrl` |
| Biometric auth enabled | Toggle | `mobileConfig.biometricAuthEnabled` |
| Offline regularization prompt | Toggle | `mobileConfig.offlineRegularizationPrompt` |

API: `POST /api/settings` with `{ settings_json: { mobileConfig: { ... } } }`

### §6.34 Export Defaults

| Field | Type | JSON Path |
|-------|------|-----------|
| Default date range days | Number (7–365) | `exportConfig.defaultDateRangeDays` |
| Max rows per export | Number (1000–100000) | `exportConfig.maxRowsPerExport` |
| Scheduled export enabled | Toggle | `exportConfig.scheduledExportEnabled` |
| Scheduled export time | Time input (HH:MM) | `exportConfig.scheduledExportTime` |
| Scheduled export recipients | Email list | `exportConfig.scheduledExportRecipients` |
| Scheduled export format | Select (csv / xlsx) | `exportConfig.scheduledExportFormat` |
| Export retention days | Number (7–365) | `exportConfig.exportRetentionDays` |

API: `POST /api/settings` with `{ settings_json: { exportConfig: { ... } } }`

### §6.35 Email Templates

| Field | Type | JSON Path |
|-------|------|-----------|
| Logo in email headers | Toggle | `emailTemplates.logoInHeader` |
| Footer text | Textarea | `emailTemplates.footerText` |
| Custom CSS | Code editor / textarea | `emailTemplates.customCss` |
| Reply-to address | Email input | `emailTemplates.replyToAddress` |
| Company address | Textarea | `emailTemplates.companyAddress` |

API: `POST /api/settings` with `{ settings_json: { emailTemplates: { ... } } }`

### §6.36 Calendar & Time

| Field | Type | Validation | JSON Path |
|-------|------|-----------|-----------|
| Fiscal year start month | Select (Jan–Dec) | 1–12 | `calendar.fiscalYearStartMonth` |
| Pay period type | Select (monthly / biweekly / weekly) | — | `calendar.payPeriodType` |
| Pay day of month | Number | 1–28 | `calendar.payDayOfMonth` |
| Holiday import source URL | Text | Valid URL | `calendar.holidayImportSourceUrl` |

API: `POST /api/settings` with `{ settings_json: { calendar: { ... } } }`

**Note:** All 36 admin settings sections are visible only to admin users. The settings panel itself checks admin status on load and the `POST /api/settings` endpoint enforces admin-only access. Every section is independently collapsible and every feature within each section is toggleable.

---

## §7. Employee Profile — Field-Level Access Control

### §7.1 Profile Sections & Fields

The employee profile form is organized into 5 sections with strict field-level access control. The `pf-readonly` CSS class and `disabled` attribute enforce read-only fields visually and functionally.

#### Section: Organization

| Field | ID | Editable By | Source | Validation |
|-------|----|-------------|--------|-----------|
| Name | `pf-name` | Employee | Employee input | Required, no digits allowed |
| Email | `pf-email` | System (read-only) | Auto-fetched from SSO login (preferred_username / upn / email claims) | RFC 5322, displayed as disabled |
| Department | `pf-dept` | Admin (read-only) | `members.group_id` → `groups.name` | Displayed as disabled |
| Designation | `pf-desg` | Admin (read-only) | `members.designation` | Displayed as disabled |
| Employee ID | `pf-empId` | Admin (read-only) | `members.id` | Displayed as disabled |
| Joining Date | `pf-joinDate` | Admin (read-only) | `members.joining_date` | Displayed as disabled |
| Google Email | `pf-gEmail` | Admin (read-only) | `members.google_email` (if Google auth configured) | Displayed as disabled |

#### Section: Shift

| Field | ID | Editable By | Source |
|-------|----|-------------|--------|
| Shift Start | `pf-shiftStart` | Admin (read-only) | 3-tier resolution: individual → group → tenant default |
| Shift End | `pf-shiftEnd` | Admin (read-only) | 3-tier resolution: individual → group → tenant default |

#### Section: Contact

| Field | ID | Editable By | Validation |
|-------|----|-------------|-----------|
| Phone | `pf-phone` | Employee | Required*, Indian mobile format (TRAI rules), +91-XXXXXXXXXX, maxlength 15 |
| Emergency Contact | `pf-emergency` | Employee | Phone number format |
| Parentage / Spouse | `pf-parentage` | Employee | Name (no digits) |

#### Section: Financial & Identity

| Field | ID | Editable By | Validation |
|-------|----|-------------|-----------|
| PAN | `pf-pan` | Employee | Required*, Income Tax format ABCDE1234F, maxlength 10 |
| Aadhaar | `pf-aadhaar` | Employee | Required*, UIDAI 12-digit + Verhoeff checksum, format XXXX XXXX XXXX, maxlength 14 |
| UAN | `pf-uan` | Employee | EPFO 12-digit format, maxlength 12 |
| Bank Account | `pf-bankAcc` | Employee | Required*, 9–18 digits, maxlength 18 |
| IFSC | `pf-ifsc` | Employee | Required*, RBI format ABCD0123456, maxlength 11, live Razorpay lookup |
| Bank Name & Branch | `pf-bankName` | Employee | Required*, auto-filled from IFSC Razorpay lookup |

#### Section: Account

| Field | ID | Editable By | Source |
|-------|----|-------------|--------|
| Member ID | `pf-memberId` | System (read-only) | `members.id` |
| Updated | `pf-updatedAt` | System (read-only) | `members.updated_at` |

(*) Required fields are configurable by admin via `settings_json.profiles.requiredFields`

### §7.2 Real-Time Validation

Each field has a `pf-field-icon` span and `pf-field-error` div for inline validation feedback:

- **Green tick icon** — field passes validation
- **Red cross icon** — field fails validation
- **Error message** — displayed in `pf-field-error` below the input

Validation triggers on `blur` and `input` events. IFSC validation makes an async call to the Razorpay IFSC API and auto-fills Bank Name & Branch on success.

### §7.3 Certification Flow

1. **Missing fields bar** (`pf-missing`): Dynamically lists unfilled required fields. Example: "Missing: Phone, PAN, Aadhaar, Bank Account, IFSC, Bank Name"
2. **Certification checkbox** (`pf-cert`): "I hereby certify that all information provided above is true and correct to the best of my knowledge and belief."
3. **Save button** (`pf-save`): Stays `disabled` until:
   - All required fields pass validation
   - Certification checkbox is checked
   - `checkProfileSaveable()` returns true
4. **Save action**: `POST /api/profiles/me` → locks profile (certified_at timestamp set)

### §7.4 Lock/Unlock Cycle

```
Employee fills all required fields → checks certification → saves
  → Profile is LOCKED (certified_at is set)
  → All employee-editable fields become read-only
  → Admin can UNLOCK via POST /api/profiles/:email/unlock
  → Employee can edit again → must re-certify → saves → locked again
```

### §7.5 Server Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/profiles/me` | `GET` | Get own profile data |
| `/api/profiles/me` | `PUT` | Update editable fields |
| `/api/profiles/me/certify` | `POST` | Certify profile (locks it) |
| `/api/profiles/me/validate` | `POST` | Validate a single field |
| `/api/profiles/:email/unlock` | `POST` | Admin unlocks certified profile |
| `/api/profiles/me/status` | `GET` | Get certification status |

---

## §8. Personal Dashboard Tab System

### §8.1 Tab Structure

The personal dashboard (`pgMy`) contains a tab bar with 6 tabs. This replaces the current sidebar-driven navigation for personal views, consolidating the employee's own data into a single tabbed interface.

| Tab | Key | Data Source (API Endpoints) |
|-----|-----|---------------------------|
| Dashboard | `dashboard` | `GET /api/attendance?date=today`, `GET /api/leaves/balances`, `GET /api/analytics/trends` |
| Attendance | `attendance` | `GET /api/attendance?date=YYYY-MM-DD`, `GET /api/clock` (clock events) |
| Leaves | `leaves` | `GET /api/leaves`, `GET /api/leaves/balances`, `POST /api/leaves` |
| Meetings | `meetings` | `GET /api/meetings`, `GET /api/meetings/discover` |
| Regularization | `regularization` | `GET /api/regularizations`, `POST /api/regularizations` |
| Profile | `profile` | `GET /api/profiles/me`, `PUT /api/profiles/me`, `POST /api/profiles/me/certify` |

### §8.2 Tab Switching

```javascript
function switchDashTab(tabKey) {
  // 1. Update active tab button
  document.querySelectorAll('.dash-tab').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.tab === tabKey));
  // 2. Render tab content into #dashTabContent
  const renderers = {
    dashboard: renderDashboardTab,
    attendance: renderAttendanceTab,
    leaves: renderLeavesTab,
    meetings: renderMeetingsTab,
    regularization: renderRegularizationTab,
    profile: renderProfileTab
  };
  renderers[tabKey]();
}
```

### §8.3 Dashboard Tab Content

The Dashboard tab (default active) contains:
- **Clock card**: Clock in/out/break/back button with status, timer, and actions
- **Today's timeline**: Chronological list of clock events for today
- **This week**: 7-day summary row (Mon–Sun) with worked hours per day
- **Leave balance**: Bar visualization per leave type showing used/remaining

---

## §9. Theme & Personalization System

### §9.1 Four Themes

| Theme | CSS Class | Font Family | Character |
|-------|-----------|-------------|-----------|
| Chromium | `theme-chromium` | Rajdhani + Orbitron + Share Tech Mono | Dark metallic, green accent, subtle vertical scanlines |
| Neural | `theme-neural` | Exo 2 + Fira Code | Deep green matrix, grid overlay, neon green accent |
| Holodeck | `theme-holodeck` | Oxanium + Source Code Pro | Deep blue sci-fi, horizontal scanlines with animation |
| Clean | `theme-clean` | DM Sans + DM Mono | Light mode, white backgrounds, indigo accent, rounded corners |

Each theme defines CSS custom properties: `--bg0` through `--bg4`, `--accent`, `--accent-dim`, `--accent-glow`, `--tx` through `--tx4`, `--bd`, `--bd2`, `--metal1`, `--metal2`, `--r` (border radius), `--status-in`, `--status-break`, `--status-out`, `--status-absent`.

### §9.2 User Theme Selection

```
User clicks theme button in header or preferences panel
  → PUT /api/profiles/me/prefs { theme: 'neural' }
  → Frontend: document.body.className = 'theme-neural'
  → No localStorage involved
  → Next login on any device: GET /api/profiles/me/prefs → theme restored
```

### §9.3 Colour Overrides (Per-User)

Users can override individual colours from the admin's colour scheme presets:

```
User changes accent colour in preferences panel
  → PUT /api/profiles/me/prefs { color_accent: '#ff6b35' }
  → Frontend: document.documentElement.style.setProperty('--accent', '#ff6b35')
  → Persisted to member_preferences.color_accent
```

### §9.4 Background Image (Per-User)

Users upload a custom background image with opacity, blur, and darken controls:

| Setting | Column | Default | Range |
|---------|--------|---------|-------|
| Image URL | `bg_image_url` | null | base64 or URL |
| Opacity | `bg_opacity` | 30 | 0–100 |
| Blur | `bg_blur` | 0 | 0–30 px |
| Darken | `bg_darken` | 70 | 0–95% |

All persisted to `member_preferences` via `PUT /api/profiles/me/prefs`.

### §9.5 Timezone Selector

Users can configure up to 4 timezone slots, displayed in the header clock dropdown:

```sql
timezone_slot_1   TEXT,  -- e.g. "Asia/Kolkata"
timezone_slot_2   TEXT,  -- e.g. "America/New_York"
timezone_slot_3   TEXT,  -- e.g. "Europe/London"
timezone_slot_4   TEXT,  -- e.g. "Australia/Sydney"
```

The header clock component shows the primary timezone with a dropdown for switching between configured slots. Timezone data is grouped by region (Asia, Americas, Europe, etc.) with UTC offset display and search functionality.

---

## §10. Lottie Animation System

### §10.1 Architecture

Lottie animations provide full-screen visual feedback on clock events. The system has two halves:

**Admin side** (settings panel, §6.16): Upload `.json` Lottie files per clock action, configure duration, test/preview/remove. Stored in `tenant_settings.settings_json.lottie`.

**User side** (shared infrastructure, `shared/lottie.js`): On any clock action, check if a Lottie animation is configured for that action. If yes, display the full-screen overlay with the animation for the configured duration.

### §10.2 Overlay Structure

```html
<div id="lottieOverlay" class="lottie-overlay hidden">
  <div id="lottieAnimContainer" class="lottie-anim-container"></div>
  <div id="lottieAnimLabel" class="lottie-anim-label"></div>
  <button type="button" class="lottie-dismiss-btn" onclick="dismissLottieOverlay()">Dismiss</button>
</div>
```

- Full-screen fixed overlay with backdrop blur
- 280×280 px animation container
- Action label (e.g. "CLOCKED IN")
- Dismiss button (user can close early)
- Auto-dismiss after configured duration

### §10.3 Trigger Flow

```
User clicks Clock In button
  → POST /api/clock { action: 'in', email, name }
  → On success response:
    → Check settingsCache.lottie['clock-in']
    → If data exists: show overlay, play animation, auto-dismiss after duration
    → Update clock card UI
```

### §10.4 Admin Configuration

Each clock action has:

| Control | Purpose |
|---------|---------|
| File upload zone | Drag/drop `.json` file, max 2 MB, validates JSON structure |
| Preview | Inline Lottie player showing the uploaded animation |
| Test button | Triggers the full-screen overlay as users would see it |
| Remove button | Clears the animation data for this action |
| Duration slider | Controls auto-dismiss time (1–10 seconds, default 3) |

---

## §11. Module Decomposition Plan

### §11.1 Decomposition Table

Each row maps a frontend module to its server counterpart, the CSS/JS/HTML being extracted from the monolith, and the test file to be created.

| # | Module Name | Server Route File | CSS Block(s) Extracted | Key JS Functions Extracted | API Endpoints Consumed | Test File |
|---|-------------|-------------------|----------------------|---------------------------|----------------------|-----------|
| 1 | `attendance` | `routes/clock.ts` | Blocks 4+5, Block 6, Block 7 | `loadTeamGrid`, `renderGridCards`, `openDetail`, `closeDetail`, `buildDetailHTML`, `initMyDashboard`, `loadMyAttendance`, `setMyClockState`, `updateMyClockTimer`, `doClock`, `renderMyTimeline`, `renderWeekView`, `showView`, `switchAppView` | `POST /api/clock`, `GET /api/attendance` | `attendance.test.js` |
| 2 | `leaves` | `routes/leaves.ts` | Block 37 | `renderLeavesPage`, `lvLoadData`, `lvRenderBalances`, `lvRender`, `lvApprove`, `lvReject`, `lvCancel`, `lvShowForm`, `lvCloseModal` | `GET /api/leaves`, `POST /api/leaves`, `PUT /api/leaves/:id/*` | `leaves.test.js` |
| 3 | `regularizations` | `routes/regularizations.ts` | (new CSS — no existing block in monolith) | `renderRegularizationsPage`, `regLoadData`, `regRenderStats`, `regRender`, `regRenderPending`, `regShowForm`, `regApprove`, `regReject`, `regCloseModal` | `GET /api/regularizations`, `POST /api/regularizations`, `PUT /api/regularizations/:id/approve`, `PUT /api/regularizations/:id/reject` | `regularizations.test.js` |
| 4 | `timesheets` | `routes/timesheets.ts` | Block 26 | `renderTimesheetsPage`, `tsLoadData`, `tsRenderStats`, `tsRender`, `getWeekDates`, `fmtWeekLabel`, `isoWeek` | `GET /api/timesheets`, `POST /api/timesheets/*` | `timesheets.test.js` |
| 5 | `org_chart` | `routes/org-chart.ts` | Block 15 | `renderOrgChartPage`, `ocLoadData`, `ocRenderStats`, `ocRender`, `ocRenderTree`, `ocRenderDepts`, `ocRenderPositions`, `ocShowDeptForm`, `ocShowPositionForm`, `ocDeleteDept`, `ocDeletePosition`, `ocCloseModal` | `GET/POST/PUT/DELETE /api/org/*` | `org_chart.test.js` |
| 6 | `documents` | `routes/documents.ts` | Block 16 | `renderDocumentsPage`, `docLoadData`, `docRenderStats`, `docRender`, `docRenderDocs`, `docRenderTemplates`, `docRenderGenerated`, `docShowUploadForm`, `docMockUpload`, `docShowTemplateForm`, `docShowGenerateForm`, `docDownload`, `docDelete`, `docDeleteGenerated`, `docCloseModal` | `GET/POST/PUT/DELETE /api/documents/*` | `documents.test.js` |
| 7 | `training` | `routes/training.ts` | Block 17 | `renderTrainingPage`, `trnLoadData`, `trnRenderStats`, `trnRender`, `trnRenderCourses`, `trnRenderMyCourses`, `trnRenderCertificates`, `trnShowCourseDetail`, `trnToggleModule`, `trnEnroll`, `trnShowCourseForm`, `trnDeleteCourse`, `trnDownloadCert`, `trnCloseModal` | `GET/POST/PUT/DELETE /api/training/*` | `training.test.js` |
| 8 | `workflows` | `routes/workflows.ts` | Block 18 | `renderWorkflowsPage`, `wfLoadData`, `wfRenderStats`, `wfRender`, `wfRenderList`, `wfRenderInstances`, `wfShowInstanceDetail`, `wfAdvanceStep`, `wfRejectStep`, `wfCancelInstance`, `wfShowForm`, `wfStepItemHTML`, `wfRenumberSteps`, `wfShowStartInstance`, `wfDeleteWorkflow`, `wfCloseModal` | `GET/POST/PUT/DELETE /api/workflows/*` | `workflows.test.js` |
| 9 | `surveys` | `routes/surveys.ts` | Block 19 | `renderSurveysPage`, `svLoadData`, `svRenderStats`, `svRender`, `svRenderList`, `svRenderResults`, `svTakeSurvey`, `svShowResults`, `svShowForm`, `svQItemHTML`, `svRenumberQs`, `svPublish`, `svCloseSurvey`, `svDelete`, `svCloseModal` | `GET/POST/PUT/DELETE /api/surveys/*` | `surveys.test.js` |
| 10 | `assets` | `routes/assets.ts` | Block 20 | `renderAssetsPage`, `astLoadData`, `astRenderStats`, `astRender`, `astAssign`, `astReturn`, `astMaintenance`, `astShowDetail`, `astShowForm`, `astDelete`, `astCloseModal` | `GET/POST/PUT/DELETE /api/assets/*` | `assets.test.js` |
| 11 | `visitors` | `routes/visitors.ts` | Block 21 | `renderVisitorsPage`, `visLoadData`, `visRenderStats`, `visRender`, `visCheckIn`, `visCheckOut`, `visCancel`, `visShowDetail`, `visShowForm`, `visCloseModal` | `GET/POST/PUT/DELETE /api/visitors/*` | `visitors.test.js` |
| 12 | `iris_scan` | `routes/iris-scan.ts` | Block 22 | `renderIrisScanPage`, `irisLoadData`, `irisRenderStats`, `irisRender`, `irisShowEnroll`, `irisShowScanTest`, `irisDelete`, `irisCloseModal` | `POST /api/clock/iris`, `POST /api/iris/enroll`, `GET /api/iris/status/:email`, `DELETE /api/iris/enrollment/:email` | `iris_scan.test.js` |
| 13 | `face_recognition` | `routes/face-recognition.ts` | Block 23 | `renderFaceRecPage`, `frLoadData`, `frRenderStats`, `frRender`, `frShowEnroll`, `frShowEnrollFor`, `frShowScanTest`, `frDelete`, `frCloseModal` | `POST /api/clock/face`, `POST /api/face/enroll`, `GET /api/face/status/:email`, `DELETE /api/face/enrollment/:email` | `face_recognition.test.js` |
| 14 | `expenses` | `routes/mobile.ts` (expense receipts) | Block 24 | `renderExpensesPage`, `expLoadData`, `expRenderStats`, `expRender`, `expRenderCards`, `expRenderMy`, `expRenderAll`, `expRenderApprovals`, `expSubmit`, `expApprove`, `expReject`, `expShowDetail`, `expShowForm`, `expSaveExpense`, `expDelete`, `expCloseModal` | `GET/POST /api/expenses/*`, `POST /api/approvals/batch` | `expenses.test.js` |
| 15 | `time_tracking` | `routes/time-tracking.ts` | Block 27 | `renderTimeTrackingPage`, `ttLoadData`, `ttRenderStats`, `ttRenderActiveTimer`, `ttRenderContent`, `ttRenderEntries`, `ttRenderProjects`, `ttShowStartTimer`, `ttStopTimer`, `ttShowEntryForm`, `ttShowProjectForm`, `ttDeleteEntry`, `ttDeleteProject`, `ttCloseModal` | `GET/POST/PUT/DELETE /api/time-tracking/*` | `time_tracking.test.js` |
| 16 | `overtime` | `routes/overtime.ts` | Block 28 | `renderOvertimePage`, `otLoadData`, `otRenderStats`, `otRender`, `otRenderRequests`, `otRenderRules`, `otApprove`, `otReject`, `otShowForm`, `otCloseModal` | `GET/POST/PUT /api/overtime/*` | `overtime.test.js` |
| 17 | `leave_policies` | `routes/leave-policies.ts` | Block 29 | `renderLeavePoliciesPage`, `lpLoadData`, `lpRenderStats`, `lpRender`, `lpRenderPolicies`, `lpRenderAccrual`, `lpToggle`, `lpDelete`, `lpShowForm`, `lpCloseModal` | `GET/POST/PUT/DELETE /api/leave-policies/*` | `leave_policies.test.js` |
| 18 | `holidays` | `routes/holidays.ts` | Block 30 | `renderHolidaysPage`, `holLoadData`, `holRenderStats`, `holRenderCalendar`, `holRenderList`, `holShowForm`, `holDelete`, `holCloseModal` | `GET/POST/PUT/DELETE /api/holidays/*` | `holidays.test.js` |
| 19 | `geo_fencing` | `routes/geo-fencing.ts` | Block 31 | `renderGeoFencingPage`, `geoLoadData`, `geoRenderStats`, `geoRender`, `geoRenderZones`, `geoRenderViolations`, `geoToggle`, `geoResolve`, `geoDelete`, `geoShowForm`, `geoCloseModal` | `GET/POST/PUT/DELETE /api/geo/*`, `POST /api/clock/geo` | `geo_fencing.test.js` |
| 20 | `ai_chatbot` | `routes/chatbot.ts` | Block 32 | `renderAIChatbotPage`, `chatLoadHistory`, `chatRenderMessages`, `chatRenderSuggestions`, `chatSendMessage` | `POST /api/chat`, `GET /api/chat/sessions`, `GET /api/chat/tools` | `ai_chatbot.test.js` |
| 21 | `analytics` | `routes/analytics.ts` | Block 25 | `renderAnalyticsPage`, `anlLoadData`, `anlRenderKpis`, `anlRenderCharts` | `GET /api/analytics/attendance`, `/leaves`, `/overtime`, `/departments`, `/utilization`, `/trends` | `analytics.test.js` |
| 22 | `audit_trail` | `routes/audit.ts` | Blocks 33–36 (shared) | `renderAuditTrailPage`, `auditLoadData`, `auditRenderStats`, `auditRender` | `GET /api/audit/*` | `audit_trail.test.js` |
| 23 | `feature_flags` | `routes/feature-flags.ts` | Blocks 33–36 (shared) | `renderFeatureFlagsPage`, `ffLoadData`, `ffRenderStats`, `ffRender`, `ffToggle` | `GET /api/features`, `PUT /api/features/:key`, `PUT /api/features` | `feature_flags.test.js` |
| 24 | `webhooks` | `routes/webhook-receivers.ts` | Blocks 33–36 (shared) | `renderWebhooksPage`, `whLoadData`, `whRenderStats`, `whRender`, `whTest`, `whDelete`, `whShowForm`, `whCloseModal` | `GET/POST /api/webhooks/*` | `webhooks.test.js` |
| 25 | `settings` | `routes/settings.ts` | Blocks 9+10 (restructured) | All 36 admin sections (§6.1–§6.36) | `GET/POST /api/settings` | `settings.test.js` |
| 26 | `profile` | `routes/profile.ts` | (new CSS) | `renderProfileTab`, profile validation, certification flow | `GET/PUT /api/profiles/me`, `POST /api/profiles/me/certify`, `POST /api/profiles/me/validate` | `profile.test.js` |
| 27 | `setup_wizard` | `routes/setup.ts` | Block 14 | `initWizard`, `wzApplyAccent`, `wzValidate1/2/3`, `wzGoTo`, `wzUpdateIndicator`, `wzSetLoading`, `wzShowErr`, `wzClearErr`, `wzApi`, `wzMockApi`, `wzShowSuccess`, `wzConfetti` | `GET /api/setup/status`, `POST /api/setup/step1/step2/step3` | `setup_wizard.test.js` |
| 28 | `dashboard` | (composite) | Block 7 (restructured) | `switchDashTab`, tab renderers, clock card logic | Multiple endpoints per tab (see §8.1) | `dashboard.test.js` |

---

## §12. Shared Infrastructure

### §12.1 `shared/api.js` — HTTP Client

Extracted from the monolith's `api(path, opts)` function.

**Responsibilities:**
- Base URL resolution from `location.origin`
- MOCK_MODE detection (file:// or sandboxed origin)
- Auth headers injection (`x-user-email`, `x-user-name` from session)
- 401 response handling → clear session → redirect to login
- JSON request/response handling
- Error wrapping (returns `{ _error: true, status, message }` on failure)

**API:**
```javascript
api(path, opts?)           // General HTTP request
api.get(path)              // GET shorthand
api.post(path, body)       // POST shorthand
api.put(path, body)        // PUT shorthand
api.delete(path)           // DELETE shorthand
```

### §12.2 `shared/session.js` — Session Management

The ONE piece of data that stays in localStorage.

**Responsibilities:**
- `saveSession(user)` — stores `{ name, email, source, sessionToken, mustChangePassword }` to `localStorage: session_{tenantId}`
- `loadSession()` — retrieves and validates session from localStorage
- `clearSession()` — removes session from localStorage
- `getSession()` — returns current in-memory session object

### §12.3 `shared/sse.js` — Server-Sent Events

Extracted from the monolith's `connectSSE()` function.

**Responsibilities:**
- Establish SSE connection to `GET /api/sse`
- Automatic reconnection with backoff on disconnect
- Event dispatch to registered listeners
- Sync status indicator (live/offline dot + label in header)

**Events:**
- `attendance-update` — reload attendance grid
- `settings-update` — reload tenant settings, re-apply branding/flags
- `leave-update` — reload leave data
- `meeting-update` — reload meeting data
- `chat-message` — new live chat message
- `chat-dm` — new direct message
- `chat-channel-update` — channel created/updated

### §12.4 `shared/toast.js` — Toast Notifications

Extracted from the monolith's `toast(msg, type)` function.

**Responsibilities:**
- Create toast DOM element with type class (success/error/info)
- Auto-dismiss after configurable duration (from `settings_json.ui.toastDurationMs`, default 3500ms)
- Fade-out animation before removal
- Stack multiple toasts vertically

### §12.5 `shared/modal.js` — Theme-Aware Overlays

The monolith implements 4 different detail view patterns depending on theme:

| Theme | Pattern | Implementation |
|-------|---------|---------------|
| Chromium | Modal overlay | `#modalOverlay` + `#modalBox` centered |
| Neural | Split panel | `#splitPanel` sidebar alongside grid |
| Holodeck | Inline expand | Card expands in-place within grid |
| Clean | Drawer | `#drawerPanel` slides from right |

**Responsibilities:**
- Detect current theme
- Open appropriate container with content
- Close/dismiss handling (click outside, ESC key, close button)
- Shared detail HTML builder (`buildDetailHTML`)

### §12.6 `shared/themes.js` — Theme Application

**Responsibilities:**
- `setTheme(themeName)` — applies theme class to body, updates theme toggle buttons
- `applyColourOverrides(prefs)` — applies per-user colour overrides via CSS custom properties
- `applyBranding(branding)` — applies tenant branding (logo, name, tagline)
- `syncThemeDots()` — updates header theme indicator dots

### §12.7 `shared/prefs.js` — Member Preferences

**Responsibilities:**
- `loadPrefs()` — `GET /api/profiles/me/prefs`, caches in memory
- `savePrefs(partial)` — `PUT /api/profiles/me/prefs`, merges with cache, applies to DOM
- `applyPrefsToDOM(prefs)` — applies all visual preferences (theme, colours, background)
- No localStorage reads or writes

**DOM Application Flow:**
```javascript
function applyPrefsToDOM(prefs) {
  // 1. Theme
  setTheme(prefs.theme || 'chromium');
  // 2. Colour overrides
  if (prefs.color_accent) document.documentElement.style.setProperty('--accent', prefs.color_accent);
  if (prefs.color_status_in) document.documentElement.style.setProperty('--status-in', prefs.color_status_in);
  // ... etc for all color_ fields
  // 3. Background image
  if (prefs.bg_image_url) applyBackgroundImage(prefs);
  // 4. Timezone
  if (prefs.timezone_slot_1) setActiveTimezone(prefs.timezone_slot_1);
}
```

### §12.8 `shared/router.js` — Navigation

Extracted from the monolith's `navigateToModule()` and sidebar event handling.

**Responsibilities:**
- Sidebar click handling
- Lazy module loading (CSS + JS + HTML template)
- Module activation/deactivation
- View switching (personal `pgMy` vs. team `pgTeam` for attendance)
- Feature flag-based sidebar item visibility
- Mobile sidebar collapse/expand

### §12.9 `shared/lottie.js` — Lottie Overlay

**Responsibilities:**
- `triggerLottie(action)` — checks settings cache for Lottie data, shows overlay if configured
- `dismissLottieOverlay()` — closes overlay
- `loadLottiePlayer()` — lazy-loads lottie-web library
- Animation playback, auto-dismiss timer, dismiss button

---

## §13. Test Structure

### §13.1 Test Counts by Category

| Category | Files | Tests | Focus |
|----------|-------|-------|-------|
| Module integration tests | 24 | ~325 | Render, API calls, CRUD, modals, error states |
| Settings panel tests | 1 | ~80 | 36 sections render/save/validate, SSE refresh |
| Profile tests | 1 | ~30 | Read-only vs editable, validation (PAN/Aadhaar/IFSC/phone), certification flow, lock/unlock |
| Dashboard tab tests | 1 | ~15 | 6 tabs render, tab switching, API data loading |
| Shared infrastructure tests | 8 | ~50 | api.js, sse.js, prefs.js, themes.js, session.js, router.js, modal.js, toast.js |
| Lottie system tests | 1 | ~10 | Upload, preview, test, remove, overlay trigger, duration |
| Auth tests | 1 | ~15 | Provider rendering, SSO flows, local login, magic link, change password |
| **Total** | **~36** | **~525** | |

### §13.2 Test Helpers (`tests/helpers/setup.js`)

Mirrors the server's `tests/helpers/setup.ts`:

```javascript
// Mock API — intercepts api() calls, returns configured responses
function createMockApi(responses = {}) { ... }

// Create test DOM — minimal HTML with required containers
function createTestDOM() { ... }

// Seed member data — populates mock API with a test member
function seedMember(opts = {}) { ... }

// Seed settings — populates mock API with test tenant settings
function seedSettings(overrides = {}) { ... }

// Seed prefs — populates mock API with test member preferences
function seedPrefs(overrides = {}) { ... }

// Assert toast — checks a toast was displayed with expected message/type
function assertToast(msg, type) { ... }

// Assert API called — checks a specific API endpoint was called
function assertApiCalled(path, method, body?) { ... }
```

### §13.3 Module Test Pattern

Every module integration test follows the same pattern (mirroring the server's test structure):

```javascript
describe('ModuleName module', () => {
  let mockApi, dom;

  beforeEach(() => {
    mockApi = createMockApi({ /* module-specific mock responses */ });
    dom = createTestDOM();
    seedMember();
    seedSettings();
  });

  describe('rendering', () => {
    it('renders page with stats bar');
    it('renders empty state when no data');
    it('renders error state on API failure');
  });

  describe('data loading', () => {
    it('calls correct API endpoint on load');
    it('renders loaded data correctly');
    it('handles pagination');
  });

  describe('CRUD operations', () => {
    it('opens create form');
    it('validates required fields');
    it('submits create form with correct payload');
    it('opens edit form with existing data');
    it('submits edit form with correct payload');
    it('confirms and executes delete');
    it('shows success toast after create/edit/delete');
    it('shows error toast on failure');
  });

  describe('modals', () => {
    it('opens modal with correct content');
    it('closes modal on dismiss');
    it('closes modal on outside click');
  });

  describe('module-specific', () => {
    // Approval/reject flows, status transitions, etc.
  });
});
```

### §13.4 Validation Tests (`tests/unit/validation.test.js`)

Standalone unit tests for profile validation functions:

```javascript
describe('PAN validation', () => {
  it('accepts valid PAN: ABCDE1234F');
  it('rejects PAN with lowercase');
  it('rejects PAN with wrong length');
  it('rejects PAN with wrong pattern');
});

describe('Aadhaar validation', () => {
  it('accepts valid 12-digit Aadhaar');
  it('validates Verhoeff checksum');
  it('rejects Aadhaar starting with 0 or 1');
  it('formats as XXXX XXXX XXXX');
});

describe('IFSC validation', () => {
  it('accepts valid IFSC format: SBIN0001234');
  it('rejects IFSC with wrong length');
  it('rejects IFSC with wrong 5th character (must be 0)');
  it('auto-fills bank name on valid IFSC (async)');
});

describe('Phone validation', () => {
  it('accepts Indian mobile: +91-9876543210');
  it('accepts 10-digit without prefix');
  it('rejects numbers starting with 0-5 (TRAI)');
  it('rejects wrong length');
});

describe('Name validation', () => {
  it('accepts alphabetic name');
  it('rejects name with digits');
});

describe('Bank Account validation', () => {
  it('accepts 9-18 digit account number');
  it('rejects too short');
  it('rejects too long');
  it('rejects non-numeric');
});

describe('UAN validation', () => {
  it('accepts 12-digit UAN');
  it('rejects wrong length');
});

describe('Email validation', () => {
  it('accepts standard email');
  it('rejects missing @');
  it('rejects missing domain');
});
```

---

## §14. Migration Plan

### §14.1 New Database Migrations Required

```sql
-- Migration 035: tenant_settings + member_preferences

CREATE TABLE IF NOT EXISTS tenant_settings (
  id                  TEXT PRIMARY KEY DEFAULT 'default',
  platform_name       TEXT NOT NULL DEFAULT 'BlokHR',
  company_legal_name  TEXT,
  logo_data_url       TEXT,
  login_tagline       TEXT,
  primary_timezone    TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  version             TEXT,
  settings_json       TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_preferences (
  member_id           TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL DEFAULT 'default',
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
  notification_prefs  TEXT,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default settings_json with full schema and sensible defaults
INSERT OR IGNORE INTO tenant_settings (id, settings_json) VALUES ('default', '{ ... }');
```

### §14.2 Server-Side Changes Required

| Change | File(s) | Description |
|--------|---------|-------------|
| Member preferences repository | `src/repositories/member-preferences-repository.ts` (new) | CRUD for `member_preferences` table |
| Member preferences service | `src/services/member-preferences-service.ts` (new) | Business logic: get/upsert prefs per user |
| Member preferences routes | `src/routes/member-preferences.ts` (new) | `GET /api/profiles/me/prefs`, `PUT /api/profiles/me/prefs` |
| Tenant settings repository | `src/repositories/tenant-settings-repository.ts` (new or extend `settings-repository.ts`) | CRUD for `tenant_settings` table with `settings_json` merge |
| Tenant settings service | `src/services/tenant-settings-service.ts` (new or extend `settings-service.ts`) | Full settings bundle with JSON blob merge, SSE broadcast on update |
| Tenant settings routes | Extend `src/routes/settings.ts` | `GET /api/settings` returns full bundle, `POST /api/settings` updates with SSE broadcast |
| Migration 035 | `migrations/035_tenant_settings_prefs.sql` | Create tables, seed defaults |
| Test file | `tests/integration/member-preferences.test.ts` | Test prefs CRUD, isolation per user |
| Test file | `tests/integration/tenant-settings.test.ts` | Test settings CRUD, JSON merge, SSE broadcast |

### §14.3 Frontend Extraction Order

Extract modules in dependency order (shared infrastructure first, then leaf modules):

```
Phase 1: Shared Infrastructure
  1. shared/api.js (everything depends on this)
  2. shared/session.js
  3. shared/toast.js
  4. shared/themes.js
  5. shared/prefs.js
  6. shared/sse.js
  7. shared/modal.js
  8. shared/router.js
  9. shared/lottie.js
  10. shared/shared.css

Phase 2: Shell & Auth
  11. shell.html (boot → setup → login → app chrome)
  12. modules/setup_wizard/
  13. Auth flows (login, change password)

Phase 3: Core Modules (always on)
  14. modules/dashboard/ (personal dashboard with 6 tabs)
  15. modules/attendance/ (clock + team grid)
  16. modules/profile/ (field-level access control)
  17. modules/leaves/
  18. modules/regularizations/ (submit, 2-tier approve/reject)
  19. modules/timesheets/
  20. modules/settings/ (admin panel with 36 sections)

Phase 4: Phase 1 Server Modules
  21. modules/holidays/
  22. modules/leave_policies/
  23. modules/time_tracking/
  24. modules/overtime/
  25. modules/analytics/
  26. modules/audit_trail/
  27. modules/feature_flags/
  28. modules/webhooks/
  29. modules/expenses/

Phase 5: Phase 2 Server Modules
  30. modules/org_chart/
  31. modules/documents/
  32. modules/training/
  33. modules/workflows/
  34. modules/surveys/
  35. modules/assets/
  36. modules/visitors/
  37. modules/iris_scan/
  38. modules/face_recognition/
  39. modules/geo_fencing/
  40. modules/ai_chatbot/
```

### §14.4 Backward Compatibility

During transition, the old single-file monolith (`index__3_.html`) continues to work unchanged. The new modular codebase is built alongside it. Once all modules are extracted and tested, the monolith is retired.

No breaking changes to API contracts — all new endpoints (prefs, tenant settings) are additive. Existing endpoints remain unchanged.

---

## §15. Build Rules

1. **No placeholders, no TODOs** — every module is complete and functional when delivered
2. **Every module**: standalone CSS + JS + HTML template
3. **Every module**: matching test file in `tests/integration/`
4. **Zero localStorage** (except session token in `shared/session.js`)
5. **All preferences DB-backed** — theme, colours, background, timezones all persist to `member_preferences` via `PUT /api/profiles/me/prefs`
6. **All admin settings** via `POST /api/settings` — branding, attendance rules, leave config, AI, Lottie, auth providers, colour schemes, compliance, tabs, approval flows, digest, analytics, profile requirements, UI defaults
7. **All user prefs** via `PUT /api/profiles/me/prefs`
8. **SSE propagation**: admin setting changes broadcast to all clients, user pref changes apply immediately and persist for cross-device sync
9. **3-tier resolution**: member → group → tenant_settings for any overridable value
10. **Profile field-level access**: read-only fields (admin-set) are disabled inputs with `pf-readonly` class; editable fields have real-time validation with tick/cross icons
11. **Certification flow**: missing fields bar → certification checkbox → save enable/disable → lock on certify → admin unlock → re-edit
12. **4-theme support**: every module's CSS uses CSS custom properties, never hardcoded colours
13. **Module pattern consistency**: every module follows `renderXxxPage()` → `xxxLoadData()` → `xxxRenderStats()` → `xxxRender()` → CRUD functions → `xxxCloseModal()`
14. **Test pattern consistency**: every test file follows describe/beforeEach/it pattern mirroring the server's test structure
