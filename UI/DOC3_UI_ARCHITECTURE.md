# BlokHR UI Architecture
## What Exists · What Is Missing · What Must Be Built
### shell + iframe · postMessage CONTEXT v:1 · Project Ara

---

## 1. THE ARCHITECTURE IN ONE PARAGRAPH

BlokHR's frontend is a shell (shell.html) that owns authentication, the header, the tab bar, the gear panel, and the SSE connection. Every functional module is a separate HTML file loaded inside an iframe. The shell passes identity and settings to each iframe using postMessage with a versioned CONTEXT payload (v:1). Iframes talk back to the server directly via REST. There is no shared DOM — only settings and identity pass through the message bus.

This is Project Ara: swap any module by replacing a single HTML file and updating one settings record.

---

## 2. THE STORAGE RULE FOR THE FRONTEND

The frontend does **not store application data**. It reads everything from the server and displays it.

```
User changes theme?            → PUT /api/profiles/me/prefs  { theme: "neural" }
User sets timezone?            → PUT /api/profiles/me/prefs  { timezone_slot_1: "UTC" }
User changes accent colour?    → PUT /api/profiles/me/prefs  { color_accent: "#6366f1" }
User uploads background image? → PUT /api/profiles/me/prefs  { bg_image_url: "..." }
User sets dark mode?           → PUT /api/profiles/me/prefs  { dark_mode: "system" }

On load:  GET /api/profiles/me/prefs → apply all preferences to DOM

localStorage holds:  session_{tenantId}  ← the ONLY localStorage value
localStorage does NOT hold: theme, colours, bg image, timezone, any preference
```

When the page loads, the frontend fetches preferences from the server and applies them. When the user changes a preference, it saves to the server. A user switching devices sees all their preferences because they live in the database.

---

## 3. FILE INVENTORY

### 3.1 Exists (needs refactoring)

| File | Status |
|---|---|
| Shaavir_Horizon___Attendance_Board.html | Source of horizon.html patterns. Must be split into clean files. |
| server.js | Old monolith backend. Being replaced by shaavir-server. |

### 3.2 Must be built

| File | Purpose | Target Lines | Priority |
|---|---|---|---|
| shell.html | Auth, header, tabs, gear, SSE, postMessage host | ~400 | P0 |
| horizon.html | Attendance board — clean production version | ~2000 | P0 |
| axis.html | All settings UI | ~2500 | P0 |
| apex.html | BD Tracker | ~1500 | P1 |
| nebula.html | PD Tracker | ~1200 | P1 |
| meridian.html | RD Tracker | ~1000 | P1 |
| zenith.html | Live Platform View | ~800 | P1 |
| vector.html | Task Tracker | ~1000 | P1 |
| nova.html | Software Dev Tracker | ~800 | P1 |
| ai-assistant.html | AI chat widget | ~600 | P1 |
| kiosk.html | Shared tablet clock-in | ~300 | P2 |
| setup.html | First-run wizard | ~500 | P0 |

---

## 4. SHELL.HTML

Shell is the permanent frame. It never unloads.

### 4.1 Responsibilities

```
shell.html owns:
├── Authentication
│   ├── Renders login buttons for enabled providers ONLY (from DB settings)
│   └── Providers available (any combination): MSAL, Google, Okta, Teams SSO,
│       GitHub OAuth, SAML 2.0, Custom JWT, Magic Link, Local PIN
├── Header bar
│   ├── Logo (from tenant_settings.logo_data_url — never hardcoded)
│   ├── Platform name (from tenant_settings.platform_name — never hardcoded)
│   ├── 4 timezone clocks (from member_preferences.timezone_slot_1..4)
│   └── User avatar + name
├── Tab bar
│   └── Rendered from settings.tabs[] array — never hardcoded tab names
├── Gear panel (320px slide-out)
│   ├── Admin-only: Logo upload, Favicon, Lottie animations, Platform name
│   └── All users: Theme, Colours, Background, Timezone, Notifications, Session
│   NOTE: Every change in gear panel calls PUT /api/profiles/me/prefs or POST /api/settings
│   NOTE: Nothing is saved to localStorage
├── SSE client → /api/sse with auto-reconnect
├── postMessage dispatcher → sends CONTEXT to active iframe
├── Hash-based routing → #horizon, #apex, #axis, etc.
└── Global loading state
```

### 4.2 On Load Sequence

```
1. GET /api/settings              → settingsCache
2. GET /api/profiles/me/prefs     → memberPrefs
3. Apply memberPrefs to DOM       → theme, colours, bg, timezones
4. Show login screen (if not authenticated)
5. After auth: GET /api/members/me → currentMemberRecord
6. Render header, tabs from settingsCache
7. Load first tab iframe
8. Connect SSE
9. Send CONTEXT to iframe
```

### 4.3 CONTEXT Protocol (v:1)

```javascript
const CONTEXT = {
  v: 1,
  token: localStorage.getItem(`session_${settingsCache.tenant.id}`), // auth only
  user: { email, name, photo },
  isAdmin: ...,        // from settingsCache + admins table check
  settings: settingsCache,
  member: currentMemberRecord,
  prefs: memberPrefs   // from member_preferences table
};
iframe.contentWindow.postMessage(JSON.stringify(CONTEXT), SAFE_ORIGIN);
```

---

## 5. HORIZON.HTML

### 5.1 What exists in source file (Shaavir_Horizon___)

- 4 CSS themes (chromium/neural/holodeck/clean) with full variable sets
- Employee card grid with status colour-coding
- Clock-in/out/break state machine UI
- Employee modal (myDash) with 6 tabs: Dashboard, Attendance, Leaves, Meetings, Regularization, Profile
- Profile form: PAN regex, Aadhaar auto-format, IFSC → Razorpay auto-fill, bank validation
- Certification checkbox before save
- Profile lock/unlock mechanism
- Lottie animation overlay for clock events (in/out/break/back)
- Lottie admin upload cards in settings panel
- Background image upload + opacity/blur/darken sliders (saves to server, not localStorage)
- Logo/favicon upload (admin-only, saves to server)
- Settings gear panel (needs to move to shell.html)
- Theme toggle bar (chromium/neural/holodeck/clean)
- Colour pickers for CSS variable overrides (saves to server via /api/profiles/me/prefs)

### 5.2 What needs to change in horizon.html

| Item | Issue | Fix |
|---|---|---|
| Test mode banner | testModeBanner div exists | Delete (Feature #116) |
| _testMode variable | Referenced in initApp | Delete all references (Feature #118) |
| Test mode API call | initApp calls test-mode endpoint | Delete (Feature #117) |
| Settings panel | Mixed into board code | Move to shell.html |
| Theme save | May write to localStorage | Change to PUT /api/profiles/me/prefs |
| Colour overrides | May write to localStorage | Change to PUT /api/profiles/me/prefs |
| Background image | May write to localStorage | Change to PUT /api/profiles/me/prefs |
| On load | May read theme from localStorage | Change to GET /api/profiles/me/prefs |
| CONTEXT receiver | Needs postMessage listener v:1 | Add |
| Board refresh interval | May be hardcoded | Read from settingsCache.ui.boardRefreshMs |
| Toast duration | May be hardcoded | Read from settingsCache.ui.toastDurationMs |
| Leave types dropdown | May be hardcoded | Read from settingsCache.leaves.types |
| Employee sort order | May be hardcoded | Read from settingsCache.ui.statusSortOrder |
| Grid columns | May be hardcoded | Read from settingsCache.ui.gridColumns |
| Clock-out threshold | May be hardcoded | Read from settingsCache.attendance.clockOutShowMinutes |

### 5.3 Preference apply-on-load pattern

```javascript
// Called after CONTEXT received or after direct GET /api/profiles/me/prefs
function applyPrefs(prefs) {
  // Theme
  setTheme(prefs.theme || 'chromium');
  setDarkMode(prefs.dark_mode || 'system');
  // Colour overrides
  if (prefs.color_accent)
    document.documentElement.style.setProperty('--accent', prefs.color_accent);
  // ... all other color_* columns
  // Background image
  if (prefs.bg_image_url) {
    document.body.style.setProperty('--bg-image', `url(${prefs.bg_image_url})`);
    document.body.style.setProperty('--bg-opacity', prefs.bg_opacity / 100);
  }
}
```

### 5.4 Preference save pattern

```javascript
// Every time user changes something in the gear panel
async function savePref(key, value) {
  await httpClient.put('/api/profiles/me/prefs', { [key]: value });
  // No localStorage write. Period.
}
```

---

## 6. AXIS.HTML

Axis is the admin control panel. Entirely new — not started.

Section structure:
```
Modules (master toggles)
Attendance (cutoff, grace, overtime, geo-fence, IP restriction)
Members (CRUD table, overrides)
Departments (CRUD, shift defaults)
Shifts (named definitions)
Leaves (types, accrual, sandwich, comp-off, encashment)
Approvals (N-level flow builder, auto-escalation)
Notifications (channel matrix, templates)
Channels (Teams/Slack/Google/WhatsApp/Email/Discord/etc. config)
Digest (daily/weekly schedules)
Analytics (Bradford Score, points, audit trail) — admin-only
Auth (provider credentials)
Branding (logo, favicon, platform name, colour schemes)
AI (provider, model, rate limit, visibility, persona)
Storage (backend selector display — read-only after setup)
Export (attendance/leaves/lates CSV) — admin-only
Compliance (labour law templates)
Integrations (Okta, biometric, calendar, CRM)
```

---

## 7. SETUP.HTML

The first-run wizard. Served at /setup. No auth required.

Steps:
1. Database backend selection
2. Auth provider selection (all options available — not limited to 4)
3. First admin
4. Company identity
5. DB connection test
6. Done

Writes everything to the database. Redirects to shell.html on completion.

---

## 8. DESIGN SYSTEM

### 8.1 CSS Variables

```css
:root {
  --bg0: #0c0d0f; --bg1: #111318; --bg2: #15171a;
  --bg3: #1c1f24; --bg4: #22262d;
  --tx: #d8dde5;  --tx2: #8b919a; --tx3: #5a5f69; --tx4: #3a3f48;
  --accent: #00e59a;
  --status-in: #3b82f6; --status-break: #fbbf24; --status-absent: #ef4444;
  --bd: #2a2d35; --r: 8px;
}
```

Default values are overridden by member_preferences records on load.

### 8.2 Themes

| Class | Description |
|---|---|
| theme-chromium | Dark default — inherits :root |
| theme-neural | Deep navy, accent #6366f1 |
| theme-holodeck | Electric blue, accent #00d4ff |
| theme-clean | Light theme, all --bg inverted |

### 8.3 Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&display=swap');
/* Work Sans for UI, JetBrains Mono for times/codes/IDs */
```

---

## 9. WHAT COMPLETELY NEEDS TO BE BUILT

- setup.html (first-run wizard)
- shell.html (clean, separated from horizon)
- axis.html (all settings UI)
- apex.html, nebula.html, meridian.html, zenith.html, vector.html, nova.html (tracker modules)
- ai-assistant.html (AI chat widget)
- kiosk.html (shared tablet)
- js/httpClient.js (X-User-Email, no Bearer, all paths relative)
- js/context.js (postMessage receiver, v:1 validation)
- js/settingsCache.js (reads from server, never from localStorage)
- js/prefsClient.js (GET/PUT /api/profiles/me/prefs)
- js/sseClient.js (exponential backoff reconnect)
- js/themeManager.js (4 themes + dark/light/system)
- js/router.js (hash-based)

---

## 10. CRITICAL RULES

| Rule | Why |
|---|---|
| NEVER postMessage("*") | Leaks identity to every origin |
| NEVER Authorization/Bearer | Azure intercepts it |
| NEVER hardcode admin emails | Multi-tenant |
| NEVER hardcode company/logo/colour | Multi-tenant |
| Every iframe src has ?iframe=1 | Server can distinguish |
| CONTEXT always has v:1 | Iframes validate version |
| localStorage only has session_{tenantId} | Everything else in DB |
| All API paths relative | No hardcoded domains |
| Preferences load from GET /api/profiles/me/prefs | On every session start |
| Preferences save to PUT /api/profiles/me/prefs | On every user change |
