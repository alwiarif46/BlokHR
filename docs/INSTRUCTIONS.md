# BlokHR Frontend Decomposition — Implementation Instructions

You are decomposing a 7,873-line single-file HTML frontend monolith into a modular codebase that mirrors the server's 3-layer architecture. You have full access to everything you need.

---

## FILES IN YOUR CONTEXT

| File | Path | What It Is |
|------|------|-----------|
| **Architecture document** | `docs/blokhr-frontend-architecture.md` | 2,221-line spec covering all 15 sections: target file structure, settings architecture, admin panel (36 sections), employee profile (field-level access), dashboard tabs, themes, Lottie, module decomposition table (28 modules), shared infrastructure, test structure (~525 tests), migration plan, build rules. **Read this first. It is your blueprint.** |
| **Server changes** | `docs/SERVER-CHANGES.md` | 11 server gaps, 4 migrations, ~100 new tests, credential resolution, admin-only enforcement. **Read after architecture doc.** |
| **Frontend monolith** | `source-files/index__3_.html` | The single HTML file you are breaking apart. 7,873 lines / 644 KB. CSS (lines 1–2135, 26 blocks), HTML (2137–2433, 5 screens), JS (2434–7873, all logic in one IIFE). Every CSS block, JS function, and HTML element is mapped in the architecture doc §3. |
| **Server codebase** | `source-files/shaavir-server-production-ready__1__tar.gz` | Complete backend. Extract with `tar -xzf`. 35,334 lines of TypeScript, 971 tests, 34 migrations, ~332 API endpoints. The server's structure (routes → services → repositories) is what the frontend must mirror. The server's test pattern (describe/beforeEach/it with createTestApp + seedMember) is what frontend tests must follow. Key files: `src/routes/index.ts` (all route registration), `tests/helpers/setup.ts` (test infrastructure), `HANDOFF.md` (complete server documentation). |
| **Design reference** | `source-files/Shaavir_Horizon___Attendance_Board.html` | Live production design. Use this for: employee profile layout (5 sections, read-only vs editable fields, `pf-readonly` class, `pf-field-icon` + `pf-field-error` per field, missing fields bar, certification checkbox, save button), Lottie overlay structure, settings panel layout, 4-theme CSS variables, clock card UX, timezone selector. |

---

## WHAT YOU ARE BUILDING

### Target Structure (from architecture doc §4)

```
blokhr/
├── shell.html                          # Boot → Setup → Login → App chrome
├── shared/                             # 9 shared modules + 1 CSS file
│   ├── api.js, session.js, sse.js, toast.js, modal.js
│   ├── themes.js, prefs.js, router.js, lottie.js
│   └── shared.css
├── modules/                            # 28 module directories
│   ├── attendance/                     # attendance.css + attendance.html + attendance.js
│   ├── leaves/
│   ├── regularizations/
│   ├── timesheets/
│   ├── org_chart/
│   ├── documents/
│   ├── training/
│   ├── workflows/
│   ├── surveys/
│   ├── assets/
│   ├── visitors/
│   ├── iris_scan/
│   ├── face_recognition/
│   ├── expenses/
│   ├── time_tracking/
│   ├── overtime/
│   ├── leave_policies/
│   ├── holidays/
│   ├── geo_fencing/
│   ├── ai_chatbot/
│   ├── analytics/
│   ├── audit_trail/
│   ├── feature_flags/
│   ├── webhooks/
│   ├── settings/                       # Admin panel with 36 sections
│   ├── profile/                        # Employee profile with field-level access
│   ├── setup_wizard/
│   └── dashboard/                      # Personal dashboard with 6 tabs
└── tests/
    ├── helpers/setup.js
    ├── integration/                    # ~36 test files, ~525 tests total
    └── unit/validation.test.js
```

---

## HOW TO EXTRACT EACH MODULE

For every module, the architecture doc §11 tells you exactly:
- Which CSS block(s) to extract (by line range in the monolith)
- Which JS functions to extract (by function name)
- Which API endpoints the module consumes
- What the test file should be named

### Extraction Pattern

1. **Read the monolith** at the line ranges specified in §3.2 (CSS block map) and §3.4 (JS function map)
2. **Create `modules/{name}/{name}.css`** — extract the CSS block, replace any hardcoded colors with CSS custom properties (`var(--accent)`, `var(--bg0)`, etc.)
3. **Create `modules/{name}/{name}.html`** — extract the HTML template from the monolith's `screenApp` section or from the `renderXxxPage()` function's innerHTML
4. **Create `modules/{name}/{name}.js`** — extract all JS functions listed in §11 for that module. Replace `api()` calls with imports from `shared/api.js`. Replace `toast()` calls with imports from `shared/toast.js`. Replace localStorage usage with `shared/prefs.js` calls.
5. **Create `tests/integration/{name}.test.js`** — follow the test pattern from §13.3

### Module JS Pattern (every module follows this)

```javascript
// modules/{name}/{name}.js
import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';

let _data = {};

export function renderXxxPage(container) {
  container.innerHTML = `/* HTML template */`;
  xxxLoadData();
}

async function xxxLoadData() {
  const data = await api.get('/api/{endpoint}');
  if (data._error) { toast('Failed to load', 'error'); return; }
  _data = data;
  xxxRenderStats();
  xxxRender();
}

function xxxRenderStats() { /* update stats bar */ }
function xxxRender() { /* render main content */ }
function xxxShowForm(item) { /* open modal */ }
function xxxDelete(id) { /* confirm + delete */ }
function xxxCloseModal() { /* close modal */ }
```

---

## CRITICAL RULES

### Zero localStorage
- **ONLY** `shared/session.js` may use localStorage (for `session_{tenantId}`)
- Theme, colours, background image, timezone — all go to `PUT /api/profiles/me/prefs`
- The monolith currently uses `lsGet()`/`lsSet()`/`lsRemove()` for preferences. **Replace every one** with `shared/prefs.js` calls that hit the database

### Settings Split
- **Tenant settings** (admin controls): `POST /api/settings` → stored in `tenant_settings` table → SSE broadcasts to all clients
- **Member preferences** (user controls): `PUT /api/profiles/me/prefs` → stored in `member_preferences` table → no broadcast, immediate DOM apply
- The monolith currently mixes these. **Separate them cleanly.**

### Admin Panel Exclusions
- **No app name field** in admin settings (removed by client request)
- **No favicon upload** in admin settings (removed by client request)
- These were in the original monolith's settings panel. Do not include them.

### Profile Field Access
- Read-only fields get `pf-readonly` CSS class + `disabled` attribute
- Email is auto-fetched from SSO login — never editable
- Department, Designation, Employee ID, Joining Date, Shift Start/End, Member ID, Updated — all admin-set, read-only
- Name, Phone, PAN, Aadhaar, UAN, Bank Account, IFSC, Bank Name, Emergency Contact, Parentage — employee-editable with real-time validation
- IFSC → auto-fills Bank Name via Razorpay API
- PAN validates Income Tax format (ABCDE1234F)
- Aadhaar validates with Verhoeff checksum
- Phone validates Indian mobile (TRAI rules)
- Missing fields bar + certification checkbox + save button disabled until valid + certified

### 3-Tier Resolution
- Any configurable value: check `members` table first → then `groups` table → then `tenant_settings`
- Example: shift times, cutoff minutes, manager assignment

### Theme Support
- Every CSS file must use CSS custom properties, never hardcoded colours
- 4 themes: chromium, neural, holodeck, clean
- Each theme sets variables on body class: `--bg0` through `--bg4`, `--accent`, `--tx` through `--tx4`, `--bd`, `--bd2`, `--r`, `--status-in`, `--status-break`, `--status-out`, `--status-absent`

### Test Coverage
- ~525 tests across ~36 files
- Every module gets a test file
- Test pattern mirrors server: describe blocks for rendering, data loading, CRUD, modals, module-specific behavior
- Shared infrastructure gets dedicated test files
- Profile validation gets a unit test file

---

## BUILD ORDER

Follow the extraction order from architecture doc §14.3:

**Phase 1: Shared Infrastructure** (items 1–10)
Extract `shared/` files first. Everything else depends on these.

**Phase 2: Shell & Auth** (items 11–13)
Build `shell.html` with boot sequence, setup wizard, login flows.

**Phase 3: Core Modules** (items 14–20)
Dashboard, attendance, profile, leaves, regularizations, timesheets, settings.

**Phase 4: Server Phase 1 Modules** (items 21–29)
Holidays, leave policies, time tracking, overtime, analytics, audit trail, feature flags, webhooks, expenses.

**Phase 5: Server Phase 2 Modules** (items 30–40)
Org chart, documents, training, workflows, surveys, assets, visitors, iris scan, face recognition, geo-fencing, AI chatbot.

---

## SERVER-SIDE CHANGES NEEDED

Before the frontend can fully work, the server needs migration 035 (from architecture doc §14.1):
- `tenant_settings` table with `settings_json` blob
- `member_preferences` table
- New routes: `GET/PUT /api/profiles/me/prefs`
- Extended `GET/POST /api/settings` to handle `settings_json` merge + SSE broadcast

These are documented in architecture doc §14.2 with the exact files to create/modify.

---

## QUALITY CHECKS

Before delivering any module:
1. CSS uses only CSS custom properties for colors — `grep` for hex values that aren't in variable declarations
2. JS has zero localStorage calls — `grep` for `localStorage`, `lsGet`, `lsSet`, `lsRemove`
3. All API calls go through `shared/api.js` — no raw `fetch()` calls
4. All toasts go through `shared/toast.js` — no direct DOM manipulation for notifications
5. Test file exists and covers: render, load, CRUD, modal, error states
6. Module follows the standard pattern: `renderXxxPage()` → `xxxLoadData()` → `xxxRenderStats()` → `xxxRender()` → CRUD → `xxxCloseModal()`
7. HTML template is self-contained (no dependencies on other module's DOM elements)
8. Feature flag integration: modules with flags check `featureFlags` before rendering

---

## WRITING RULES

- All code on disk, never in chat
- No placeholders, no TODOs, no "implement later" comments
- Every file complete and functional when delivered
- Follow the architecture doc exactly — it is the single source of truth
