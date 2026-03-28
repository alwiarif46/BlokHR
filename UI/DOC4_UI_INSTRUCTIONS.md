# BlokHR Frontend — Build Instructions Prompt
## Claude Code Prompt · Shell + Iframe Architecture

---

## ROLE

You are building BlokHR frontend files. Pure HTML/CSS/JS, no build step, no framework. Shell + iframe architecture.

**The three laws (never break):**
```
1. NEVER send Authorization/Bearer. Use X-User-Email + X-User-Name.
2. NEVER postMessage(payload, "*"). Always SAFE_ORIGIN = window.location.origin.
3. NEVER hardcode any company name, email, colour, or timezone.
   Everything from settingsCache.* or the server.
```

**The fourth law (new, equally absolute):**
```
4. NEVER write user preferences to localStorage.
   Theme, dark mode, colours, background, timezones → PUT /api/profiles/me/prefs
   On every page load → GET /api/profiles/me/prefs → apply to DOM
   The session token is the only localStorage value.
```

---

## BUILD METHOD (1/20 BLOCKS)

```
1. PLAN     — estimate total lines, divide by 20
2. WRITE    — one block (5–15 lines)
3. SAVE     — append_block() to disk
4. DIFF     — verify only intended lines changed
5. LINT     — html-validate / Stylelint
6. TEST     — Vitest for JS logic
7. PIXEL    — pixelmatch if UI changed
8. REPEAT
```

---

## JS MODULES REQUIRED

### httpClient.js

```javascript
// js/httpClient.js
// Used by ALL fetch calls in ALL files
const SAFE_ORIGIN = window.location.origin;

class HttpClient {
  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': sessionStorage.getItem('blokhr_email') || '',
      'X-User-Name':  sessionStorage.getItem('blokhr_name')  || '',
      // NEVER: Authorization, Bearer
    };
  }
  async get(path) { return this._req('GET', path); }
  async post(path, b) { return this._req('POST', path, b); }
  async put(path, b) { return this._req('PUT', path, b); }
  async patch(path, b) { return this._req('PATCH', path, b); }
  async delete(path) { return this._req('DELETE', path); }
  async _req(method, path, body) {
    // path is ALWAYS relative: '/api/settings', not 'https://server.com/api/settings'
    const res = await fetch(path, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw Object.assign(new Error(res.statusText), { status: res.status });
    return res.json();
  }
}
export const httpClient = new HttpClient();
```

### prefsClient.js

```javascript
// js/prefsClient.js
// All user preference reads and writes go through this module
import { httpClient } from './httpClient.js';

let _prefs = {};

export async function loadPrefs() {
  const res = await httpClient.get('/api/profiles/me/prefs');
  _prefs = res.prefs ?? {};
  applyPrefsToDOM(_prefs);
  return _prefs;
}

export async function savePref(key, value) {
  await httpClient.put('/api/profiles/me/prefs', { [key]: value });
  _prefs[key] = value;
  applyPrefsToDOM(_prefs);
  // No localStorage write. Period.
}

export function getPrefs() { return _prefs; }

function applyPrefsToDOM(prefs) {
  // Theme
  if (prefs.theme) setTheme(prefs.theme);
  if (prefs.dark_mode) setDarkMode(prefs.dark_mode);
  // Colour overrides
  const colorMap = {
    color_accent:        '--accent',
    color_status_in:     '--status-in',
    color_status_break:  '--status-break',
    color_status_absent: '--status-absent',
    color_bg0:           '--bg0',
    color_tx:            '--tx',
  };
  Object.entries(colorMap).forEach(([prefKey, cssVar]) => {
    if (prefs[prefKey]) {
      document.documentElement.style.setProperty(cssVar, prefs[prefKey]);
    }
  });
  // Background image
  if (prefs.bg_image_url) {
    document.documentElement.style.setProperty('--bg-image', `url(${prefs.bg_image_url})`);
  }
  if (prefs.bg_opacity != null)
    document.documentElement.style.setProperty('--bg-opacity', String(prefs.bg_opacity / 100));
  if (prefs.bg_blur != null)
    document.documentElement.style.setProperty('--bg-blur', `${prefs.bg_blur}px`);
  if (prefs.bg_darken != null)
    document.documentElement.style.setProperty('--bg-darken', String(prefs.bg_darken / 100));
}
```

### context.js (iframe receiver)

```javascript
// js/context.js
// Every module iframe includes this
import { loadPrefs } from './prefsClient.js';

const SAFE_ORIGIN = window.location.origin;
let settingsCache = null;
let currentUser   = null;
let isAdmin       = false;
let memberRecord  = null;

window.addEventListener('message', async (event) => {
  if (event.origin !== SAFE_ORIGIN) return;
  try {
    const ctx = JSON.parse(event.data);
    if (ctx.v !== 1) return;
    settingsCache = ctx.settings;
    currentUser   = ctx.user;
    isAdmin       = ctx.isAdmin;
    memberRecord  = ctx.member;
    // prefs come from server, apply them
    if (ctx.prefs) applyPrefsToDOM(ctx.prefs);
    onContextReady(ctx);
  } catch (e) { console.error('Invalid CONTEXT', e); }
});

export function onContextReady(ctx) {
  // Override in each module
}
```

---

## SHELL.HTML — BUILD INSTRUCTIONS

### Boot sequence (strict order)

```javascript
async function boot() {
  // 1. Load tenant settings
  const { settings } = await httpClient.get('/api/settings');
  settingsCache = settings;

  // 2. Apply tenant branding from settings
  document.title = settingsCache.tenant.platformName;
  document.getElementById('logoImg').src = settingsCache.tenant.logoDataUrl || '';

  // 3. Show login for enabled providers (read from settings, not hardcoded)
  renderLoginButtons(settingsCache.auth.providers);

  // 4. After auth callback:
  //    Store email/name in sessionStorage (NOT localStorage — these are session-scoped)
  //    sessionStorage.setItem('blokhr_email', user.email);
  //    Store the session token in localStorage (this is the ONLY localStorage write)
  //    localStorage.setItem(`session_${settingsCache.tenant.id}`, token);

  // 5. Load user preferences from server
  const { prefs } = await httpClient.get('/api/profiles/me/prefs');
  applyPrefsToDOM(prefs);

  // 6. Load member record
  const { member } = await httpClient.get('/api/members/me');

  // 7. Render tabs from settings (never hardcoded)
  renderTabs(settingsCache.tabs.filter(t => t.enabled));

  // 8. Load first tab iframe
  // 9. Connect SSE
  // 10. Dispatch CONTEXT to iframe
}
```

### Tab rendering

```javascript
// CORRECT — from settings
const tabs = settingsCache.tabs.filter(t => t.enabled);
tabs.forEach(tab => {
  const btn = document.createElement('button');
  btn.textContent = tab.label;  // from DB, not hardcoded
  btn.onclick = () => loadModule(tab.src + '?iframe=1');
  tabBar.appendChild(btn);
});
```

### Login button rendering

```javascript
// Only render buttons for enabled providers
// Number of providers is not fixed at 4 — it is whatever is configured
function renderLoginButtons(providers) {
  const loginContainer = document.getElementById('loginButtons');
  loginContainer.innerHTML = '';
  Object.entries(providers).forEach(([key, config]) => {
    if (!config.enabled) return;
    const btn = createProviderButton(key, config);
    loginContainer.appendChild(btn);
  });
}
// Supported: msal, google, okta, teamsSso, github, saml, customJwt, magicLink, localPin
// Admin enables whichever they want in the setup wizard. None are hardcoded as mandatory.
```

### Gear panel — preference saves

```javascript
// Theme toggle
function setThemeAndSave(name) {
  setTheme(name);                            // apply immediately
  savePref('theme', name);                   // save to DB via PUT /api/profiles/me/prefs
  // No localStorage write
}

// Colour picker
function setColorAndSave(cssVar, hex) {
  document.documentElement.style.setProperty(cssVar, hex);
  const prefKey = cssVar.replace('--', 'color_').replace(/-/g, '_');
  // e.g. '--accent' → 'color_accent'
  savePref(prefKey, hex);
}

// Background image
async function handleBgUpload(file) {
  const dataUrl = await fileToDataUrl(file);
  document.documentElement.style.setProperty('--bg-image', `url(${dataUrl})`);
  await savePref('bg_image_url', dataUrl);   // saves to DB
}

// Timezone slot
function saveTimezone(slot, iana) {
  savePref(`timezone_slot_${slot}`, iana);
  updateClockDisplay(slot, iana);
}
```

---

## HORIZON.HTML — BUILD INSTRUCTIONS

### CONTEXT receiver

```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const ctx = JSON.parse(event.data);
  if (ctx.v !== 1) return;
  settingsCache = ctx.settings;
  currentUser = ctx.user;
  isAdmin = ctx.isAdmin;
  if (ctx.prefs) applyPrefsToDOM(ctx.prefs);
  initBoard();
});
```

### Employee card

```html
<div class="emp-card" data-status="in"
     style="border-left: 3px solid var(--status-in)">
  <div class="emp-avatar">
    <img src="" alt="" onerror="this.style.display='none'">
    <span class="emp-initials">JD</span>
  </div>
  <div class="emp-info">
    <div class="emp-name"><!-- from member.name --></div>
    <div class="emp-dept"><!-- from member.group --></div>
    <div class="emp-time mf"><!-- from clock entry --></div>
  </div>
  <div class="emp-status-badge"
       style="background: var(--status-in)">In</div>
</div>
```

### Clock-out threshold

```javascript
function shouldShowClockOut(clockInTime) {
  const threshold = settingsCache?.attendance?.clockOutShowMinutes ?? 0;
  if (threshold === 0) return true;
  const elapsed = (Date.now() - new Date(clockInTime).getTime()) / 60000;
  return elapsed >= threshold;
}
```

### What to REMOVE from source file

```javascript
// REMOVE — Feature #116
<div id="testModeBanner">...</div>

// REMOVE — Feature #118
let _testMode = ...;
// and all _testMode references

// REMOVE — Feature #117
// The test-mode API call inside initApp()

// REMOVE
// Any localStorage.setItem for theme, colours, bg, timezone, dark mode
// Replace with: savePref(key, value) → PUT /api/profiles/me/prefs

// REMOVE
// Any localStorage.getItem for theme, colours, bg, timezone
// Replace with: prefs from ctx.prefs in CONTEXT handler
```

---

## AXIS.HTML — SETTINGS UI

### Save pattern

```javascript
async function saveSetting(dotPath, value) {
  const body = dotPathToObject(dotPath, value);
  await httpClient.post('/api/settings', body);
  showToast('Saved', 'success');
}

async function saveFeatureToggle(featureKey, enabled) {
  await httpClient.put(`/api/features/${featureKey}`, { enabled });
  showToast(`${featureKey} ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

function dotPathToObject(path, value) {
  const keys = path.split('.');
  const result = {};
  let cur = result;
  keys.forEach((k, i) => {
    cur[k] = i === keys.length - 1 ? value : {};
    cur = cur[k];
  });
  return result;
}
```

### Load settings into all fields

```javascript
function loadSettingsIntoUI() {
  document.querySelectorAll('[data-setting]').forEach(el => {
    const val = getNestedValue(settingsCache, el.dataset.setting);
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val ?? '';
  });
}
```

---

## SETUP.HTML — WIZARD BUILD

### Step 1: DB backend selector

```html
<div class="setup-step" id="step-db">
  <h2>Choose your database</h2>
  <div class="backend-grid">
    <label class="backend-card">
      <input type="radio" name="backend" value="sqlite">
      <span class="backend-name">SQLite</span>
      <span class="backend-desc">Local file. Simple. Great for single-server deploys.</span>
    </label>
    <label class="backend-card">
      <input type="radio" name="backend" value="postgres">
      <span class="backend-name">PostgreSQL</span>
      <span class="backend-desc">Production-grade. Multi-server ready.</span>
    </label>
    <label class="backend-card">
      <input type="radio" name="backend" value="azure-tables">
      <span class="backend-name">Azure Table Storage</span>
      <span class="backend-desc">Ideal for Azure-hosted deployments.</span>
    </label>
    <label class="backend-card">
      <input type="radio" name="backend" value="sharepoint">
      <span class="backend-name">SharePoint Lists</span>
      <span class="backend-desc">For Microsoft 365 tenants.</span>
    </label>
    <label class="backend-card">
      <input type="radio" name="backend" value="mirrored">
      <span class="backend-name">Mirrored</span>
      <span class="backend-desc">Write to two backends. Read from primary.</span>
    </label>
  </div>
</div>
```

### Step 2: Auth providers (multi-select, no forced defaults)

```html
<div class="setup-step" id="step-auth">
  <h2>Authentication methods</h2>
  <p>Select all methods your organisation will use. You can change this later.</p>
  <div class="auth-grid">
    <label class="auth-card"><input type="checkbox" name="auth" value="msal">
      <span>Microsoft (MSAL)</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="google">
      <span>Google OAuth</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="okta">
      <span>Okta</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="teamsSso">
      <span>Teams SSO</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="github">
      <span>GitHub OAuth</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="saml">
      <span>SAML 2.0</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="customJwt">
      <span>Custom JWT</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="magicLink">
      <span>Magic Link (email)</span></label>
    <label class="auth-card"><input type="checkbox" name="auth" value="localPin">
      <span>Local PIN (kiosk)</span></label>
  </div>
</div>
```

---

## VITEST TEST TEMPLATES

```javascript
// prefsClient.test.js
test('savePref calls PUT /api/profiles/me/prefs', async () => {
  const spy = vi.spyOn(httpClient, 'put').mockResolvedValue({});
  await savePref('theme', 'neural');
  expect(spy).toHaveBeenCalledWith('/api/profiles/me/prefs', { theme: 'neural' });
});

test('savePref does NOT write to localStorage', async () => {
  vi.spyOn(httpClient, 'put').mockResolvedValue({});
  await savePref('theme', 'neural');
  expect(localStorage.getItem('theme')).toBeNull();
  expect(localStorage.getItem('blokhr_theme')).toBeNull();
});

test('loadPrefs applies theme from server to DOM', async () => {
  vi.spyOn(httpClient, 'get').mockResolvedValue({ prefs: { theme: 'clean' } });
  await loadPrefs();
  expect(document.body.classList.contains('theme-clean')).toBe(true);
});

// context.test.js
test('rejects CONTEXT with wrong origin', () => { ... });
test('rejects CONTEXT with v !== 1', () => { ... });
test('applies prefs from CONTEXT without localStorage read', () => { ... });

// httpClient.test.js
test('sends X-User-Email', () => { ... });
test('sends X-User-Name', () => { ... });
test('does NOT send Authorization', () => { ... });
test('all paths are relative', () => { ... });
```

---

## ZERO-HARDCODING AUDIT (run before marking any file done)

```bash
grep -n "Shaavir\|shaavir" frontend/*.html           # company name
grep -n "@shaavir\|@company" frontend/*.html          # emails
grep -n "Asia/Kolkata\|IST" frontend/*.html           # timezone
grep -n "Authorization.*Bearer" frontend/js/*.js      # forbidden header
grep -n 'postMessage.*"\*"' frontend/*.html           # wildcard origin
grep -n 'localStorage.setItem.*theme\|localStorage.setItem.*color\|localStorage.setItem.*bg' frontend/*.html
# ↑ must return 0 — preferences go to DB, not localStorage
```
