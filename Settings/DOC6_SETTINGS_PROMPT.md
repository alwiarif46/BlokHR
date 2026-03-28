# BlokHR Settings Build Prompt
## Fully Configurable HRMS · Toggle Buttons for Every Feature
## Claude Code Prompt · axis.html + POST /api/settings + PUT /api/profiles/me/prefs

---

## ROLE

You are building the settings layer for BlokHR. Every feature has a toggle. Every value reads from the database. Every change writes to the database. Nothing goes to localStorage. Nothing is hardcoded.

Two APIs:
- `POST /api/settings` — tenant-wide config (admin only, broadcasts SSE to all)
- `PUT /api/profiles/me/prefs` — per-user personalisation (appearance, timezones)

---

## PART 1: MODULE TOGGLE GRID

These appear at the top of axis.html. They control entire feature areas.

### HTML

```html
<div class="ax-section" id="section-modules">
  <div class="ax-section-header">
    <h2>BlokHR Modules</h2>
    <p>Enable or disable feature areas. Disabled modules hide from all users.</p>
  </div>
  <div class="ax-module-grid">

    <div class="ax-module-card">
      <div class="ax-module-icon">🕐</div>
      <div class="ax-module-name">Attendance Board</div>
      <div class="ax-module-desc">Clock-in, board view, employee status</div>
      <label class="ax-toggle">
        <input type="checkbox" data-setting="tabs"
               data-tab-id="horizon"
               onchange="saveTabToggle('horizon', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card">
      <div class="ax-module-icon">🏖️</div>
      <div class="ax-module-name">Leave Management</div>
      <div class="ax-module-desc">Leave requests, approvals, balance</div>
      <label class="ax-toggle">
        <input type="checkbox" data-feature="leave_management"
               onchange="saveFeatureToggle('leave_management', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card">
      <div class="ax-module-icon">✏️</div>
      <div class="ax-module-name">Regularization</div>
      <div class="ax-module-desc">Attendance correction requests</div>
      <label class="ax-toggle">
        <input type="checkbox" data-feature="regularization"
               onchange="saveFeatureToggle('regularization', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card ax-admin-only">
      <div class="ax-module-icon">📊</div>
      <div class="ax-module-name">Analytics</div>
      <div class="ax-module-desc">Dashboards, Bradford Score, reports</div>
      <span class="ax-admin-badge">Admin only</span>
      <label class="ax-toggle">
        <input type="checkbox" data-feature="analytics"
               onchange="saveFeatureToggle('analytics', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card">
      <div class="ax-module-icon">🤖</div>
      <div class="ax-module-name">AI Assistant</div>
      <div class="ax-module-desc">Copilot chat for HR queries</div>
      <label class="ax-toggle">
        <input type="checkbox" data-setting="ai.visibility"
               onchange="saveAIVisibility(this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card ax-admin-only">
      <div class="ax-module-icon">📍</div>
      <div class="ax-module-name">Geo-fencing</div>
      <div class="ax-module-desc">Location-based clock-in</div>
      <span class="ax-admin-badge">Admin only</span>
      <label class="ax-toggle">
        <input type="checkbox" data-setting="attendance.geofenceEnabled"
               onchange="saveSetting('attendance.geofenceEnabled', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <div class="ax-module-card">
      <div class="ax-module-icon">📲</div>
      <div class="ax-module-name">Kiosk Mode</div>
      <div class="ax-module-desc">Shared tablet clock-in</div>
      <label class="ax-toggle">
        <input type="checkbox" data-setting="attendance.kioskEnabled"
               onchange="saveSetting('attendance.kioskEnabled', this.checked)">
        <span class="ax-toggle-track"></span>
      </label>
    </div>

    <!-- Tracker tabs — one card per module -->
    <!-- apex, nebula, meridian, zenith, vector, nova -->
    <!-- Each: saveTabToggle('apex', this.checked) etc. -->

  </div>
</div>
```

### CSS

```css
.ax-module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.ax-module-card {
  background: var(--bg1); border: 1px solid var(--bd);
  border-radius: var(--r); padding: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.ax-module-icon  { font-size: 24px; }
.ax-module-name  { font-weight: 600; font-size: 14px; color: var(--tx); }
.ax-module-desc  { font-size: 12px; color: var(--tx3); flex: 1; }
.ax-admin-badge  {
  font-size: 10px; color: var(--tx3);
  border: 1px solid var(--bd); border-radius: 4px;
  padding: 2px 6px; align-self: flex-start;
}

/* Toggle switch */
.ax-toggle { position: relative; display: inline-flex; cursor: pointer; }
.ax-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
.ax-toggle-track {
  width: 44px; height: 24px; background: var(--bg4);
  border-radius: 12px; transition: background 0.2s; border: 1px solid var(--bd);
  position: relative;
}
.ax-toggle-track::after {
  content: ''; position: absolute; top: 2px; left: 2px;
  width: 18px; height: 18px; background: var(--tx3);
  border-radius: 50%; transition: transform 0.2s, background 0.2s;
}
.ax-toggle input:checked + .ax-toggle-track {
  background: var(--accent); border-color: var(--accent);
}
.ax-toggle input:checked + .ax-toggle-track::after {
  transform: translateX(20px); background: #000;
}

/* Inline toggle row */
.ax-toggle-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 0; border-bottom: 1px solid var(--bd);
}
.ax-toggle-row:last-child { border-bottom: none; }
.ax-toggle-info { flex: 1; margin-right: 16px; }
.ax-toggle-label { font-size: 13px; font-weight: 500; color: var(--tx); }
.ax-toggle-hint  { font-size: 11px; color: var(--tx3); margin-top: 2px; }
```

---

## PART 2: ATTENDANCE SETTINGS

```html
<div class="ax-section" id="section-attendance">
  <div class="ax-section-header"><h2>Attendance Rules</h2></div>
  <div class="ax-section-body">

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Auto-cutoff</div>
        <div class="ax-toggle-hint">Automatically clock out employees after their shift</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="attendance.autoCutoffEnabled"
        onchange="saveSetting('attendance.autoCutoffEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-field-row">
      <label>Auto-cutoff delay after shift end (minutes)</label>
      <input type="number" min="15" max="180"
             data-setting="attendance.autoCutoffMinutes"
             onblur="saveSetting('attendance.autoCutoffMinutes', +this.value)">
    </div>

    <div class="ax-field-row">
      <label>Grace period (minutes before counted late)</label>
      <input type="number" min="0" max="60"
             data-setting="attendance.gracePeriodMinutes"
             onblur="saveSetting('attendance.gracePeriodMinutes', +this.value)">
    </div>

    <div class="ax-field-row">
      <label>Clock-in rounding</label>
      <select data-setting="attendance.roundingRules"
              onchange="saveSetting('attendance.roundingRules', this.value)">
        <option value="none">No rounding</option>
        <option value="5">Nearest 5 min</option>
        <option value="10">Nearest 10 min</option>
        <option value="15">Nearest 15 min</option>
      </select>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Overtime calculation</div>
        <div class="ax-toggle-hint">Track and report overtime hours</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="attendance.overtimeEnabled"
        onchange="saveSetting('attendance.overtimeEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">IP restriction</div>
        <div class="ax-toggle-hint">Clock-in only from configured office IP ranges</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="attendance.ipRestrictionEnabled"
        onchange="saveSetting('attendance.ipRestrictionEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

  </div>
</div>
```

---

## PART 3: LEAVE SETTINGS

```html
<div class="ax-section" id="section-leaves">
  <div class="ax-section-header"><h2>Leave Management</h2></div>
  <div class="ax-section-body">

    <!-- dynamic leave types list from DB -->
    <div class="ax-subsection-title">Leave Types</div>
    <div id="leaveTypesContainer"></div>
    <button onclick="addLeaveType()">+ Add Leave Type</button>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Leave accrual engine</div>
        <div class="ax-toggle-hint">Automatically accrue leave over time</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="leaves.accrualEngine.enabled"
        onchange="saveSetting('leaves.accrualEngine.enabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Sandwich leave policy</div>
        <div class="ax-toggle-hint">Weekends between leave days count as leave</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="leaves.sandwichPolicy"
        onchange="saveSetting('leaves.sandwichPolicy', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Comp-off</div>
        <div class="ax-toggle-hint">Earn leave for extra work days</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="leaves.compOffEnabled"
        onchange="saveSetting('leaves.compOffEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Leave encashment</div>
        <div class="ax-toggle-hint">Convert leave balance to pay</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="leaves.encashmentEnabled"
        onchange="saveSetting('leaves.encashmentEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

  </div>
</div>
```

---

## PART 4: APPEARANCE SETTINGS (per-user — saves to member_preferences)

```html
<div class="ax-section" id="section-appearance">
  <div class="ax-section-header">
    <h2>Appearance</h2>
    <p>Your personal preferences. Synced across all your devices.</p>
  </div>
  <div class="ax-section-body">

    <!-- Theme -->
    <div class="ax-subsection-title">Theme</div>
    <div class="theme-toggle">
      <button class="tt-btn" onclick="setThemeAndSave('chromium')">Chromium</button>
      <button class="tt-btn" onclick="setThemeAndSave('neural')">Neural</button>
      <button class="tt-btn" onclick="setThemeAndSave('holodeck')">Holodeck</button>
      <button class="tt-btn" onclick="setThemeAndSave('clean')">Clean</button>
    </div>

    <!-- Dark mode -->
    <div class="ax-field-row">
      <label>Light / Dark mode</label>
      <select onchange="savePref('dark_mode', this.value)">
        <option value="system">Follow system</option>
        <option value="dark">Always dark</option>
        <option value="light">Always light</option>
      </select>
    </div>

    <!-- Colour overrides -->
    <div class="ax-subsection-title">Colours</div>
    <div class="color-row">
      <label>Accent</label>
      <input type="color" data-pref="color_accent"
             onchange="setColorAndSave('--accent', 'color_accent', this.value)">
    </div>
    <div class="color-row">
      <label>Active (clocked in)</label>
      <input type="color" data-pref="color_status_in"
             onchange="setColorAndSave('--status-in', 'color_status_in', this.value)">
    </div>
    <!-- ... repeat for break, absent, bg0, tx -->

    <!-- Background image -->
    <div class="ax-subsection-title">Background Image</div>
    <div class="bg-upload-zone">
      <input type="file" accept="image/*" onchange="handleBgUpload(this)">
      <div class="bg-upload-text">Click or drop image — synced to your account</div>
    </div>
    <div class="sp-slider-row">
      <label>Opacity</label>
      <input type="range" min="0" max="100" id="bgOp"
             oninput="savePref('bg_opacity', +this.value)">
    </div>
    <div class="sp-slider-row">
      <label>Blur</label>
      <input type="range" min="0" max="30" id="bgBl"
             oninput="savePref('bg_blur', +this.value)">
    </div>
    <div class="sp-slider-row">
      <label>Darken</label>
      <input type="range" min="0" max="95" id="bgDk"
             oninput="savePref('bg_darken', +this.value)">
    </div>

    <!-- Timezones -->
    <div class="ax-subsection-title">Timezone Clocks</div>
    <div class="ax-field-row">
      <label>Clock 1</label>
      <input type="text" placeholder="Asia/Kolkata" id="tz1"
             onblur="savePref('timezone_slot_1', this.value)">
    </div>
    <div class="ax-field-row">
      <label>Clock 2</label>
      <input type="text" placeholder="America/New_York" id="tz2"
             onblur="savePref('timezone_slot_2', this.value)">
    </div>
    <!-- tz3, tz4 -->

  </div>
</div>
```

---

## PART 5: ANALYTICS (admin-only)

```html
<div class="ax-section ax-admin-only" id="section-analytics">
  <div class="ax-section-header"><h2>Analytics &amp; Scoring</h2></div>
  <div class="ax-section-body">

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Bradford Score</div>
        <div class="ax-toggle-hint">Mathematical absence pattern scoring (S² × D)</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="analytics.bradfordScoreEnabled"
        onchange="saveSetting('analytics.bradfordScoreEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Attendance point system</div>
        <div class="ax-toggle-hint">Points per infraction, thresholds trigger actions</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="analytics.pointSystemEnabled"
        onchange="saveSetting('analytics.pointSystemEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

    <div class="ax-toggle-row">
      <div class="ax-toggle-info">
        <div class="ax-toggle-label">Audit trail</div>
        <div class="ax-toggle-hint">Log every change with who/when/what</div>
      </div>
      <label class="ax-toggle"><input type="checkbox"
        data-setting="analytics.auditTrailEnabled"
        onchange="saveSetting('analytics.auditTrailEnabled', this.checked)">
        <span class="ax-toggle-track"></span></label>
    </div>

  </div>
</div>
```

---

## PART 6: SAVE FUNCTIONS

```javascript
// Save a tenant-wide setting
async function saveSetting(dotPath, value) {
  const body = dotPathToObject(dotPath, value);
  try {
    await httpClient.post('/api/settings', body);
    showToast('Saved');
    // SSE will broadcast settings-update → all clients refresh
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
    loadSettingsIntoUI();  // revert UI
  }
}

// Save a user preference (goes to member_preferences table, NOT localStorage)
async function savePref(key, value) {
  try {
    await httpClient.put('/api/profiles/me/prefs', { [key]: value });
    // No localStorage write. Period.
  } catch (e) {
    showToast('Preference save failed', 'error');
  }
}

// Save a colour override (applies to DOM + saves to DB)
function setColorAndSave(cssVar, prefKey, hex) {
  document.documentElement.style.setProperty(cssVar, hex);
  savePref(prefKey, hex);
}

// Save a theme (applies to DOM + saves to DB)
async function setThemeAndSave(name) {
  setTheme(name);         // applies CSS class immediately
  await savePref('theme', name);
}

// Save a module tab toggle
async function saveTabToggle(tabId, enabled) {
  const tabs = settingsCache.tabs.map(t =>
    t.id === tabId ? { ...t, enabled } : t
  );
  await saveSetting('tabs', tabs);
}

// Save a feature toggle
async function saveFeatureToggle(key, enabled) {
  try {
    await httpClient.put(`/api/features/${key}`, { enabled });
    showToast(`${key} ${enabled ? 'enabled' : 'disabled'}`);
  } catch (e) {
    if (e.status === 403) showToast('Admin access required', 'error');
    else showToast('Save failed', 'error');
    loadSettingsIntoUI();
  }
}

// Save AI visibility toggle (maps boolean to the appropriate visibility string)
async function saveAIVisibility(enabled) {
  // When toggled on: restore last non-off value or default to 'all'
  // When toggled off: set to 'off'
  const currentVis = settingsCache?.ai?.visibility;
  const newVis = enabled
    ? (currentVis && currentVis !== 'off' ? currentVis : 'all')
    : 'off';
  await saveSetting('ai.visibility', newVis);
}

// Handle background image upload → save to member_preferences
async function handleBgUpload(input) {
  if (!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    document.documentElement.style.setProperty('--bg-image', `url(${e.target.result})`);
    await savePref('bg_image_url', e.target.result);  // to DB
  };
  reader.readAsDataURL(input.files[0]);
}

// Helper: "attendance.autoCutoffMinutes" → { attendance: { autoCutoffMinutes: value }}
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

// Load all settings + prefs into UI fields on page load
function loadSettingsIntoUI() {
  document.querySelectorAll('[data-setting]').forEach(el => {
    const val = getNestedValue(settingsCache, el.dataset.setting);
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val ?? '';
  });
}

function loadPrefsIntoUI() {
  document.querySelectorAll('[data-pref]').forEach(el => {
    const val = memberPrefs[el.dataset.pref];
    if (el.type === 'color') el.value = val || '#000000';
    else el.value = val ?? '';
  });
}
```

---

## PART 7: API CONTRACT

```
POST /api/settings
  Auth: admin only
  Body: partial settings object (deep merged)
  Response: { success: true }
  Side effect: SSE settings-update to all clients

GET /api/settings
  Auth: any authenticated user
  Response: { settings: SettingsObject }
  Note: sensitive keys (API keys) redacted for non-admins

GET /api/profiles/me/prefs
  Auth: any authenticated user
  Response: { prefs: MemberPreferences }

PUT /api/profiles/me/prefs
  Auth: any authenticated user
  Body: partial member_preferences (upsert, unset fields unchanged)
  Response: { success: true }
  Note: NO SSE broadcast — private to this user

PUT /api/features/:key
  Auth: admin only
  Body: { enabled: boolean }
  Response: { success: true }

GET /api/features
  Auth: any authenticated user
  Response: { features: Record<key, { enabled, adminOnly, label, category }> }
  Note: adminOnly features filtered out for non-admin callers
```
