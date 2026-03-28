# BlokHR — Feature Completion Checklist

**Every item must be checked off before the work is considered done.**  
**Mark `[x]` when complete. Leave `[ ]` when not started or in progress.**

---

## SERVER WINDOW — Checklist

### Phase 1: Bug Fixes (no schema changes)

- [x] **Gap 1** — NotificationDispatcher wired in `routes/index.ts`
  - [x] `createNotificationDispatcher()` called and passed to leave, regularization, BD meeting routers
  - [x] `tests/integration/notification-wiring.test.ts` written and passing
  - [x] All 971 existing tests still pass

- [x] **Gap 2** — `geo.ts` route registered (replaces `geo-fencing.ts`)
  - [x] Import swapped in `routes/index.ts`
  - [x] `tests/integration/geo-routes.test.ts` — 8 tests written and passing
  - [x] All existing tests still pass

- [ ] **Gap 3** — Ollama Cloud auth header
  - [ ] `apiKey` parameter added to `OllamaLlmClient` constructor
  - [ ] `Authorization: Bearer` header conditionally sent
  - [ ] `tests/unit/ollama-auth.test.ts` — 4 tests written and passing

### Phase 2: Schema Additions

- [ ] **Gap 8** — Migration 035: `tenant_settings` + `member_preferences` tables
  - [ ] `tenant_settings` table created with `settings_json` TEXT column
  - [ ] `member_preferences` table created with all columns from architecture doc §5.4
  - [ ] Default `settings_json` seeded with all 36 sections (Indian defaults)
  - [ ] Existing `branding` + `system_settings` tables NOT dropped (backward compatible)
  - [ ] `src/repositories/tenant-settings-repository.ts` — get, update, getSettingsJson, mergeSettingsJson
  - [ ] `src/services/tenant-settings-service.ts` — getFullBundle, updateSettings, getResolved, getCredential
  - [ ] Two-tier credential resolution working: env var → settings_json → empty string
  - [ ] Secret masking in GET responses (****XXXX for sensitive fields)
  - [ ] Admin-only enforcement on POST /api/settings (403 for non-admins)
  - [ ] SSE `settings-update` broadcast on every POST /api/settings
  - [ ] `tests/integration/tenant-settings.test.ts` — 20 tests written and passing

- [ ] **Gap 4** — Migration 036: `discord_id`, `telegram_id` on members
  - [ ] Columns added with indexes
  - [ ] Discord resolver does real DB lookup
  - [ ] Telegram resolver does real DB lookup
  - [ ] WhatsApp resolver does phone lookup
  - [ ] `tests/integration/interaction-identity.test.ts` — 7 tests written and passing

- [ ] **Gap 7** — Migration 037: `admin_only` column on feature_flags
  - [ ] Column added, analytics/geo/face/iris marked admin_only=1
  - [ ] `getForUser()` method filters flags for non-admins
  - [ ] `guardWithAdmin(db)` enforces 403 on admin-only route prefixes
  - [ ] PUT /api/features/:key requires admin (403 otherwise)
  - [ ] `tests/integration/feature-flags-admin-only.test.ts` — 15 tests written and passing

- [ ] **Gap 10** — Migration 038: `lottie_animations` table
  - [ ] Table created with 4 seeded actions (clock-in/out/break/back)
  - [ ] GET /api/settings/lottie — returns all 4 actions (no file_data)
  - [ ] GET /api/settings/lottie/:action — returns file_data for one action
  - [ ] PUT /api/settings/lottie/:action — upload with 2 MB validation
  - [ ] DELETE /api/settings/lottie/:action — clears data, sets enabled=0
  - [ ] Admin-only on all lottie endpoints
  - [ ] `tests/integration/lottie-animations.test.ts` — 10 tests written and passing

### Phase 3: Feature Additions

- [ ] **Gap 9** — Member preferences routes
  - [ ] `src/repositories/member-preferences-repository.ts` — getByMemberId, upsert
  - [ ] `src/services/member-preferences-service.ts` — getPrefs, updatePrefs with validation
  - [ ] `src/routes/member-preferences.ts` — GET/PUT /api/profiles/me/prefs
  - [ ] Theme validation (chromium/neural/holodeck/clean only)
  - [ ] Hex color validation on all color_* fields
  - [ ] Range validation (bg_opacity 0-100, bg_blur 0-30, bg_darken 0-95)
  - [ ] User isolation (user A prefs don't affect user B)
  - [ ] 401 when no identity
  - [ ] Registered in routes/index.ts
  - [ ] `tests/integration/member-preferences.test.ts` — 15 tests written and passing

- [ ] **Gap 5** — ClickUp action dispatch
  - [ ] Full handler: fetch task from ClickUp API, parse entity ref, dispatch action
  - [ ] All failure paths return 200 (webhook must never retry)
  - [ ] `tests/integration/clickup-interaction.test.ts` — 7 tests written and passing

- [ ] **Gap 6** — CSV export endpoints
  - [ ] `src/routes/export.ts` created with 3 endpoints
  - [ ] GET /api/export/attendance — CSV with correct headers
  - [ ] GET /api/export/leaves — CSV with status filter
  - [ ] GET /api/export/lates — CSV with only is_late=1 rows
  - [ ] Date validation (YYYY-MM-DD, start ≤ end)
  - [ ] CSV escaping for commas, quotes, newlines
  - [ ] Registered in routes/index.ts
  - [ ] `tests/integration/export.test.ts` — 10 tests written and passing

- [ ] **Gap 11** — Test helpers updated
  - [ ] `seedTenantSettings()` added to tests/helpers/setup.ts
  - [ ] `seedMemberPreferences()` added to tests/helpers/setup.ts

### Final Server Verification

- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npx vitest run` — all tests pass (971 original + ~100 new = ~1070+)
- [ ] Server boots without errors: `PORT=3999 DB_PATH=./dev.db npx tsx src/index.ts`
- [ ] All 4 migrations (035-038) apply cleanly on fresh DB

---

## FRONTEND WINDOW — Checklist

### Phase 1: Shared Infrastructure

- [ ] `shared/api.js` — HTTP client with auth headers, 401 redirect, MOCK_MODE
- [ ] `shared/session.js` — Session in localStorage (THE ONLY localStorage use)
- [ ] `shared/toast.js` — Toast notifications with configurable duration
- [ ] `shared/themes.js` — 4 themes, CSS variable injection, colour overrides
- [ ] `shared/prefs.js` — Load/save member preferences from DB, apply to DOM, ZERO localStorage
- [ ] `shared/sse.js` — SSE connection, reconnect, event dispatch, sync indicator
- [ ] `shared/modal.js` — Theme-aware overlays (modal/split/inline/drawer per theme)
- [ ] `shared/router.js` — Sidebar navigation, lazy module loading, feature flag visibility
- [ ] `shared/lottie.js` — Lottie overlay for clock events
- [ ] `shared/shared.css` — Global CSS: 4 themes, reset, typography, header, sidebar, toasts
- [ ] Tests: `api.test.js`, `session.test.js`, `sse.test.js`, `themes.test.js`, `prefs.test.js`, `router.test.js` — all passing

### Phase 2: Shell & Auth

- [ ] `shell.html` — Boot → Setup → Login → ChangePassword → App chrome (header + sidebar + content)
- [ ] `modules/setup_wizard/` — 3-step wizard, writes to tenant_settings
- [ ] Auth flows — SSO buttons, email/password, magic link, change password
- [ ] Tests: `setup_wizard.test.js`, `auth.test.js` — all passing

### Phase 3: Core Modules

- [ ] `modules/dashboard/` — 6-tab personal dashboard (Dashboard, Attendance, Leaves, Meetings, Regularization, Profile)
  - [ ] Tab switching works
  - [ ] Clock card with in/out/break/back buttons
  - [ ] Today's timeline
  - [ ] Week summary
  - [ ] Leave balance bars
  - [ ] `dashboard.test.js` — passing

- [ ] `modules/attendance/` — Clock logic + team grid + detail views
  - [ ] Team grid renders employee cards
  - [ ] Detail views use theme-appropriate pattern (modal/split/inline/drawer)
  - [ ] Clock events trigger Lottie animations
  - [ ] `attendance.test.js` — passing

- [ ] `modules/profile/` — Employee profile with field-level access control
  - [ ] 5 sections: Organization, Shift, Contact, Financial & Identity, Account
  - [ ] Read-only fields: email, dept, designation, empId, joinDate, gEmail, shiftStart/End, memberId, updatedAt — all `pf-readonly` + `disabled`
  - [ ] Editable fields: name, phone, emergency, parentage, PAN, Aadhaar, UAN, bankAcc, IFSC, bankName
  - [ ] PAN validation (ABCDE1234F)
  - [ ] Aadhaar validation (Verhoeff checksum)
  - [ ] IFSC validation + auto-fill bank name via Razorpay API
  - [ ] Phone validation (Indian mobile, TRAI rules)
  - [ ] Missing fields bar dynamically updates
  - [ ] Certification checkbox → save enable/disable
  - [ ] Lock/unlock cycle (certify → locked → admin unlock → re-edit)
  - [ ] `profile.test.js` — passing

- [ ] `modules/leaves/` — Leave CRUD + balances + approve/reject
  - [ ] `leaves.test.js` — passing

- [ ] `modules/regularizations/` — Submit + 2-tier approve/reject
  - [ ] `regularizations.test.js` — passing

- [ ] `modules/timesheets/` — Weekly timesheet view
  - [ ] `timesheets.test.js` — passing

- [ ] `modules/settings/` — Admin panel with 36 sections
  - [ ] §6.1 Branding (logo, tagline)
  - [ ] §6.2 Attendance Rules (cutoff, grace, rounding, geofence, IP, kiosk)
  - [ ] §6.3 Overtime (enabled, thresholds, multiplier)
  - [ ] §6.4 Shifts (default start/end, overnight, work days)
  - [ ] §6.5 Leave Configuration (types CRUD, accrual, sandwich, encashment, comp-off)
  - [ ] §6.6 Approval Flows (per-entity steps, auto-escalation)
  - [ ] §6.7 Digest / Notifications (daily/weekly schedule + sections)
  - [ ] §6.8 Analytics (Bradford, point system, audit trail)
  - [ ] §6.9 Profile Requirements (required fields, photo max, face rec, iris)
  - [ ] §6.10 UI Defaults (grid columns, sort order, toast duration, refresh)
  - [ ] §6.11 AI Chatbot (provider, model, visibility, position, rate limit)
  - [ ] §6.12 Colour Schemes (3 presets, admin picks global default)
  - [ ] §6.13 Compliance (country, state, labour law)
  - [ ] §6.14 Auth Providers (post-setup editing, all 9 provider types)
  - [ ] §6.15 Tabs (CRUD: id, label, source, enabled, icon, group visibility)
  - [ ] §6.16 Lottie Animations (upload/preview/test/remove per clock action)
  - [ ] §6.17 Storage Provider (provider select + per-provider credentials)
  - [ ] §6.18 Notification Channels (8 channels, enabled + credentials + Test Connection)
  - [ ] §6.19 Meeting Integrations (Zoom, Webex, GoTo, BlueJeans)
  - [ ] §6.20 Security & Session (timeout, password, lockout, rate limits, MFA)
  - [ ] §6.21 Scheduler (4 interval configs)
  - [ ] §6.22 Regularization Rules (max days back, max per month, auto-approve)
  - [ ] §6.23 BD Meetings (department ID, qualification)
  - [ ] §6.24 Data Retention (6 retention periods)
  - [ ] §6.25 Localization (date/time format, week start, currency)
  - [ ] §6.26 Payroll / Formula Parameters (EPF/ESI/gratuity/bonus rates)
  - [ ] §6.27 Live Chat (message length, file sharing, edit window)
  - [ ] §6.28 Training / LMS (external webhooks, budgets, certificates)
  - [ ] §6.29 Workflow Defaults (SLA, max steps, max instances)
  - [ ] §6.30 Survey Defaults (anonymous, max questions, deadline)
  - [ ] §6.31 Asset Configuration (types CRUD, depreciation, warranty alerts)
  - [ ] §6.32 Visitor Configuration (auto-checkout, NDA, badge printer)
  - [ ] §6.33 Mobile / Location (tracking interval, push batch, deep links)
  - [ ] §6.34 Export Defaults (date range, max rows, scheduled exports)
  - [ ] §6.35 Email Templates (logo, footer, CSS, reply-to)
  - [ ] §6.36 Calendar & Time (fiscal year, pay period, holiday import)
  - [ ] All sections admin-only (hidden from non-admins)
  - [ ] All sections collapsible
  - [ ] Every save calls POST /api/settings → SSE broadcast
  - [ ] Secret fields masked (show ****XXXX)
  - [ ] `settings.test.js` — passing

### Phase 4: Server Phase 1 Modules

- [ ] `modules/holidays/` + `holidays.test.js`
- [ ] `modules/leave_policies/` + `leave_policies.test.js`
- [ ] `modules/time_tracking/` + `time_tracking.test.js`
- [ ] `modules/overtime/` + `overtime.test.js`
- [ ] `modules/analytics/` + `analytics.test.js`
- [ ] `modules/audit_trail/` + `audit_trail.test.js`
- [ ] `modules/feature_flags/` + `feature_flags.test.js`
- [ ] `modules/webhooks/` + `webhooks.test.js`
- [ ] `modules/expenses/` + `expenses.test.js`

### Phase 5: Server Phase 2 Modules

- [ ] `modules/org_chart/` + `org_chart.test.js`
- [ ] `modules/documents/` + `documents.test.js`
- [ ] `modules/training/` + `training.test.js`
- [ ] `modules/workflows/` + `workflows.test.js`
- [ ] `modules/surveys/` + `surveys.test.js`
- [ ] `modules/assets/` + `assets.test.js`
- [ ] `modules/visitors/` + `visitors.test.js`
- [ ] `modules/iris_scan/` + `iris_scan.test.js`
- [ ] `modules/face_recognition/` + `face_recognition.test.js`
- [ ] `modules/geo_fencing/` + `geo_fencing.test.js`
- [ ] `modules/ai_chatbot/` + `ai_chatbot.test.js`

### Validation Tests

- [ ] `tests/unit/validation.test.js` — PAN, Aadhaar (Verhoeff), IFSC, phone, name, bank account, UAN, email

### Final Frontend Verification

- [ ] Zero localStorage usage outside `shared/session.js` — `grep -r "localStorage" modules/ shared/` returns nothing
- [ ] Zero hardcoded hex colors in CSS — all use CSS custom properties
- [ ] Zero raw `fetch()` calls — all go through `shared/api.js`
- [ ] Zero `toast()` calls outside `shared/toast.js` import
- [ ] Every module follows pattern: `renderXxxPage()` → `xxxLoadData()` → `xxxRenderStats()` → `xxxRender()` → CRUD → `xxxCloseModal()`
- [ ] All ~525 tests pass
- [ ] All 28 modules have CSS + HTML + JS + test file
