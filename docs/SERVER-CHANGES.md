# BlokHR Server Changes — Gap Fixes + Architecture Alignment

**Repository:** `shaavir-server` (TypeScript/Express/SQLite or Postgres)  
**Source archive:** `source-files/shaavir-server-production-ready__1__tar.gz`  
**Test runner:** `vitest`  
**Current state:** 971 tests, 43 files, 0 failures  
**Zero regressions tolerance — all 971 existing tests must continue to pass after every fix.**

---

## How to Work

1. Extract server: `tar -xzf source-files/shaavir-server-production-ready__1__tar.gz && cd shaavir-server && npm install`
2. Fix one gap at a time in the order listed.
3. After every gap, run `npx vitest run` — all tests green before proceeding.
4. Write new tests described under each gap before writing the implementation.
5. Use `supertest` for HTTP-layer tests. Import `createTestApp()` from `tests/helpers/setup.ts`.
6. Never modify existing test files. Add new test files only.
7. TypeScript strict mode is on. `npx tsc --noEmit` must pass after every change.
8. All new routes must follow the existing pattern: `asyncHandler`, `AppError`, `req.identity?.email` for caller identity.

---

## Migration Numbering Plan

| Number | Name | Purpose |
|--------|------|---------|
| 035 | `tenant_settings_prefs` | `tenant_settings` table + `member_preferences` table (architecture alignment) |
| 036 | `platform_ids` | `discord_id`, `telegram_id` columns on `members` (Gap 4) |
| 037 | `feature_flags_admin_only` | `admin_only` column on `feature_flags` (Gap 7) |
| 038 | `lottie_animations` | `lottie_animations` table for clock event animations |
| 039 | `export_audit` | (optional) audit log entries for CSV export access |

---

## Gap 1 — NotificationDispatcher Never Instantiated

**Files to change:** `src/routes/index.ts`

**Problem:**  
`createNotificationDispatcher()` exists in `src/services/notification/index.ts` and is fully implemented, but is never called. The three services that fire notifications receive `null`/`undefined` in place of the dispatcher:

```typescript
// Current — notifications silently disabled
app.use('/api', createLeaveRouter(db, logger));              // notifier = undefined
app.use('/api', createRegularizationRouter(db, logger));    // dispatcher = null
app.use('/api', createBdMeetingRouter(db, logger));         // dispatcher = null
```

**Fix:**

In `src/routes/index.ts`:

1. Import `createNotificationDispatcher` from `../services/notification`.
2. Import `LeaveNotificationService` from `../services/leave-notifications`.
3. After `const { db, config, logger, broadcaster, featureFlags, eventBus } = deps;`, add:

```typescript
const notificationDispatcher = createNotificationDispatcher(config, db, logger);
const leaveNotifier = new LeaveNotificationService(notificationDispatcher, db, logger);
```

4. Pass `leaveNotifier` to `createLeaveRouter`:
```typescript
app.use('/api', createLeaveRouter(db, logger, leaveNotifier));
```

5. Pass `notificationDispatcher` to `createRegularizationRouter` and `createBdMeetingRouter`. Both accept `NotificationDispatcher | null` as 4th argument:
```typescript
app.use('/api', createRegularizationRouter(db, logger, notificationDispatcher));
app.use('/api', createBdMeetingRouter(db, logger, notificationDispatcher));
```

**Tests to write** — `tests/integration/notification-wiring.test.ts`:

- Test 1: Submitting a leave request does not throw when notifier is wired (POST leave → 200, no TypeError)
- Test 2: Approving a leave does not throw when dispatcher is wired (POST approve → 200)
- Test 3: Submitting a regularization does not throw (POST regularization → 200)
- Test 4: Verify dispatcher is registered (adapter count > 0 when env vars present, 0 when not — no crash either way)

**Verify:** `npx vitest run` — 971+ tests pass.

---

## Gap 2 — `geo.ts` Route Not Registered

**Files to change:** `src/routes/index.ts`

**Problem:**  
`src/routes/geo.ts` is fully implemented with 8 endpoints but is never registered. `src/routes/geo-fencing.ts` is registered and covers the same paths — duplicate situation. `geo.ts` is the newer version.

**Fix:**

1. In `src/routes/index.ts`, replace import of `createGeoFencingRouter` with `createGeoRouter` from `./geo`.
2. Replace the `app.use` call accordingly.
3. Do not delete `geo-fencing.ts` yet — verify all tests pass first.

**Tests to write** — `tests/integration/geo-routes.test.ts`:

- Test 1: GET /api/geo/zones → 200, returns `{ zones: [] }`
- Test 2: POST /api/geo/zones with valid body → 201
- Test 3: PUT /api/geo/zones/:id → 200
- Test 4: DELETE /api/geo/zones/:id → 200
- Test 5: GET /api/geo/settings → 200
- Test 6: PUT /api/geo/settings with `{ geo_fencing_enabled: true }` → 200
- Test 7: GET /api/geo/logs → 200
- Test 8: POST /api/clock/geo when disabled → succeeds; when enabled + outside all zones → blocked

**Verify:** `npx vitest run` — all pass.

---

## Gap 3 — Ollama Cloud Missing Authorization Header

**Files to change:** `src/services/llm/llm-client.ts`

**Problem:**  
`OllamaLlmClient.chat()` sends no `Authorization` header. Ollama Cloud requires `Authorization: Bearer <API_KEY>`. Local Ollama ignores the header — fully backward-compatible.

**Fix:**

1. Add `apiKey` as optional 4th constructor parameter.
2. Conditionally add `Authorization: Bearer ${this.apiKey}` header in `chat()`.
3. Pass `process.env.OLLAMA_API_KEY` when instantiating.

**Tests to write** — `tests/unit/ollama-auth.test.ts`:

- Test 1: Without apiKey → no Authorization header
- Test 2: With apiKey → correct Bearer header
- Test 3: Anthropic client still sends x-api-key (regression)
- Test 4: MockLlmClient unaffected (regression)

**Verify:** `npx vitest run` — all pass.

---

## Gap 4 — Discord / Telegram / WhatsApp Identity Resolution

**Files to change:** `src/routes/interactions.ts`  
**New migration:** `migrations/036_platform_ids.sql`

**Problem:**  
Three resolver functions return `Promise.resolve('')` — button clicks from these channels are silently ignored.

**Fix — Part A: Migration 036**

```sql
ALTER TABLE members ADD COLUMN discord_id TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN telegram_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_members_discord ON members(discord_id) WHERE discord_id != '';
CREATE INDEX IF NOT EXISTS idx_members_telegram ON members(telegram_id) WHERE telegram_id != '';
```

**Fix — Part B: Resolvers**

Each resolver gets a `db: DatabaseEngine` parameter and performs a real lookup:

- Discord: `SELECT email FROM members WHERE discord_id = ? AND active = 1`
- Telegram: `SELECT email FROM members WHERE telegram_id = ? AND active = 1`
- WhatsApp: `SELECT email FROM members WHERE phone = ? AND active = 1`

All resolvers return `''` gracefully on empty input or DB error — no crashes.

**Fix — Part C:** Ensure `updateMember` in settings-service allows setting `discord_id` and `telegram_id`.

**Tests to write** — `tests/integration/interaction-identity.test.ts`:

- Test 1: Discord with known discord_id → correct email resolved
- Test 2: Discord with unknown id → returns '' (no crash)
- Test 3: Telegram with known id → correct email
- Test 4: WhatsApp with known phone → correct email
- Test 5: Empty discordUserId → '' without DB query
- Test 6: Telegram id = 0 → ''
- Test 7: Migration applied — columns exist

**Verify:** `npx vitest run` — all pass.

---

## Gap 5 — ClickUp Action Dispatch Incomplete

**Files to change:** `src/routes/interactions.ts`

**Problem:**  
ClickUp handler detects status changes but cannot resolve the entity — needs ClickUp API call to read task description containing the entity reference JSON.

**Fix:**

Replace the ClickUp handler with a full implementation that:
1. Checks event type is `taskStatusUpdated`
2. Checks new status is `approved` or `rejected`
3. Fetches task from ClickUp API using `config.clickupApiToken`
4. Parses entity reference from task description (JSON)
5. Maps entity type + status to action ID
6. Dispatches via `ActionDispatcher`
7. Every failure path returns 200 `{ ok: true }` (webhook must never retry)

**Tests to write** — `tests/integration/clickup-interaction.test.ts`:

- Test 1: Non-taskStatusUpdated event → 200, no dispatch
- Test 2: Status 'in_progress' → 200, no dispatch
- Test 3: Status 'approved' with valid entity ref → dispatcher called with correct action
- Test 4: Status 'rejected' → dispatcher called with reject action
- Test 5: No CLICKUP_API_TOKEN → 200, no crash
- Test 6: ClickUp API returns 404 → 200, no crash
- Test 7: Task description not valid JSON → 200, no crash

**Verify:** `npx vitest run` — all pass.

---

## Gap 6 — No Attendance / Leave / Late Export

**Files to create:** `src/routes/export.ts`  
**Files to change:** `src/routes/index.ts`

**Problem:**  
No CSV export endpoints exist. Admin users need downloadable reports.

**Fix:**

Create `src/routes/export.ts` with 3 endpoints:

- `GET /api/export/attendance?startDate=&endDate=&groupId=&email=` → CSV
- `GET /api/export/leaves?startDate=&endDate=&groupId=&email=&status=` → CSV
- `GET /api/export/lates?startDate=&endDate=&groupId=&email=` → CSV

All endpoints:
- Require `startDate` and `endDate` in YYYY-MM-DD format
- Return `Content-Type: text/csv` with `Content-Disposition: attachment`
- Support optional filters (groupId, email, status)
- Use proper CSV escaping (quote fields containing commas, quotes, newlines)
- Zero external dependencies — build CSV strings directly
- Admin-only access (enforced by Gap 7's `ADMIN_ONLY_ROUTE_PREFIXES`)

Register in `src/routes/index.ts`.

**Tests to write** — `tests/integration/export.test.ts`:

- Test 1: Attendance export → 200, CSV content type, correct headers
- Test 2: Missing dates → 400
- Test 3: startDate > endDate → 400
- Test 4: Filter by email → only matching rows
- Test 5: Leaves export → 200, correct CSV headers
- Test 6: Filter by status → only matching leaves
- Test 7: Lates export → only is_late=1 rows
- Test 8: CSV escaping for names with commas
- Test 9: Empty date range → 200, headers only
- Test 10: Regression — analytics endpoints still return JSON

**Verify:** `npx vitest run` — all pass.

---

## Gap 7 — Feature Flags: Admin-Only Visibility

**Files to change:** `src/services/feature-flags.ts`, `src/routes/feature-flags.ts`  
**New migration:** `migrations/037_feature_flags_admin_only.sql`

**Problem:**  
All feature flags are visible to every user. Admin-only features (analytics, geo config, biometric enrollment, exports) should be hidden from non-admins and API-guarded.

**Fix — Part A: Migration 037**

```sql
ALTER TABLE feature_flags ADD COLUMN admin_only INTEGER NOT NULL DEFAULT 0;
UPDATE feature_flags SET admin_only = 1 WHERE feature_key IN ('analytics', 'geo_fencing', 'face_recognition', 'iris_scan');
```

**Fix — Part B: Type updates**

Add `admin_only: number` to `FeatureFlagRow`, `adminOnly: boolean` to `FeatureFlag`, update `toFlag()`.

**Fix — Part C: `getForUser()` method**

Filters flags based on admin status. Non-admins only see flags where `adminOnly = false`.

**Fix — Part D: Route updates**

- `GET /api/features` uses `getForUser()` to filter response
- `PUT /api/features/:key` and `PUT /api/features` enforce admin-only toggle (403 for non-admins)

**Fix — Part E: `guardWithAdmin()` method**

New guard that enforces 403 on admin-only route prefixes:

```typescript
const ADMIN_ONLY_ROUTE_PREFIXES: string[] = [
  '/api/analytics',
  '/api/geo/zones', '/api/geo/settings',
  '/api/face/enroll', '/api/face/status', '/api/face/enrollment',
  '/api/iris/enroll', '/api/iris/status', '/api/iris/enrollment',
  '/api/export',
];
```

Keep existing `guard()` for backward compatibility. Use `guardWithAdmin(db)` in production route registration.

**Tests to write** — `tests/integration/feature-flags-admin-only.test.ts`:

- Test 1: Non-admin GET /api/features → no admin-only flags in response
- Test 2: Admin GET /api/features → all flags including admin-only
- Test 3: No auth header → only non-adminOnly enabled flags
- Test 4: Non-admin PUT /api/features/:key → 403
- Test 5: Admin PUT /api/features/:key → 200
- Test 6: Non-admin GET /api/analytics → 403
- Test 7: Admin GET /api/analytics → 200
- Test 8: Non-admin GET /api/export → 403
- Test 9: Admin GET /api/export → 200
- Test 10: Non-admin POST /api/face/enroll → 403
- Test 11: Admin POST /api/face/enroll → passes guard
- Test 12: Non-admin GET /api/training → 200 (not admin-only)
- Test 13: Non-admin GET /api/surveys → 200 (not admin-only)
- Test 14: Migration applied — admin_only column exists with correct values
- Test 15: Regression — disabled feature still returns 404

**Verify:** `npx vitest run` — all pass.

---

## Gap 8 — Tenant Settings Table (Architecture Alignment)

**New files:** `src/repositories/tenant-settings-repository.ts`, `src/services/tenant-settings-service.ts`  
**Modified files:** `src/routes/settings.ts`, `src/services/settings-service.ts`, `src/routes/setup.ts`, `src/services/setup-service.ts`, `src/routes/index.ts`  
**New migration:** `migrations/035_tenant_settings_prefs.sql`

**Problem:**  
The server currently splits configuration across two tables (`branding` and `system_settings`). The frontend architecture requires a unified `tenant_settings` table with a `settings_json` TEXT column for infrequently-changed settings, plus a `member_preferences` table for per-user preferences. Everything must be in the database — no localStorage, no JSON files on disk.

**Fix — Part A: Migration 035**

```sql
-- 035_tenant_settings_prefs: Unified tenant configuration + per-user preferences

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

-- Seed default tenant_settings from existing branding + system_settings data
-- This INSERT runs on fresh installs; existing data is migrated below

INSERT OR IGNORE INTO tenant_settings (id) VALUES ('default');

-- Migrate existing branding data into tenant_settings (if branding table exists)
-- The migration runner tolerates errors on individual statements
UPDATE tenant_settings SET
  platform_name = (SELECT COALESCE(company_name, 'BlokHR') FROM branding LIMIT 1),
  primary_timezone = 'Asia/Kolkata',
  updated_at = datetime('now')
WHERE id = 'default' AND EXISTS (SELECT 1 FROM branding LIMIT 1);
```

**Note:** The `branding` and `system_settings` tables remain alive — they are not dropped. Existing services that read from them continue to work unchanged during transition. The `tenant-settings-service` reads from `tenant_settings` as the primary source, falling back to `branding`/`system_settings` for any values not yet migrated.

**Fix — Part B: Tenant Settings Repository**

`src/repositories/tenant-settings-repository.ts`:

- `get(): Promise<TenantSettingsRow>` — returns the single row
- `update(fields: Partial<TenantSettingsRow>): Promise<void>` — updates top-level columns
- `getSettingsJson(): Promise<SettingsJson>` — parses and returns the JSON blob
- `mergeSettingsJson(partial: Partial<SettingsJson>): Promise<void>` — deep-merges partial update into existing JSON, saves

**Fix — Part C: Tenant Settings Service**

`src/services/tenant-settings-service.ts`:

- `getFullBundle(): Promise<TenantSettingsBundle>` — assembles columns + parsed settings_json into a single object
- `updateSettings(partial): Promise<void>` — updates columns and/or settings_json sections, triggers SSE `settings-update` broadcast
- `getResolved(key, email): Promise<any>` — 3-tier resolution helper: member → group → tenant_settings

**Fix — Part D: Route Changes**

`GET /api/settings` returns the unified bundle from `tenant_settings`.  
`POST /api/settings` accepts partial updates to both columns and settings_json sub-sections, deep-merges, saves, broadcasts SSE.

Backward compatibility: The existing response shape from `GET /api/settings` is preserved — new fields are additive.

**Fix — Part E: Setup Wizard Changes**

`src/services/setup-service.ts` Step 1 writes `platform_name`, `logo_data_url`, `login_tagline` to `tenant_settings`.  
Step 2 writes `settings_json.auth.providers`.  
Step 3 writes admin to `admins` table, seeds default `settings_json`.

**Fix — Part F: Service Migration**

Services that currently read from `system_settings` need a compatibility layer. The cleanest approach:

```typescript
// In tenant-settings-service.ts
async getAttendanceConfig(): Promise<AttendanceConfig> {
  // Read from tenant_settings.settings_json.attendance first
  const ts = await this.getSettingsJson();
  if (ts.attendance) return ts.attendance;
  // Fallback to system_settings for backward compatibility
  const row = await this.db.get('SELECT * FROM system_settings WHERE id = 1');
  return {
    autoCutoffMinutes: row?.auto_cutoff_buffer_minutes ?? 120,
    // ... map all fields
  };
}
```

Services affected: `scheduler-service.ts`, `clock-service.ts`, `geo-fencing-service.ts`, `face-recognition-service.ts`, `iris-scan-service.ts`, `overtime-service.ts`, `settings-service.ts`, `setup-service.ts`.

**Fix — Part G: Two-Tier Credential Resolution**

Integration credentials (notification channels, meeting platforms, storage, AI) follow a two-tier resolution: env var wins (operator override) → then settings_json (admin-configured) → then feature disabled.

Add to `src/services/tenant-settings-service.ts`:

```typescript
/**
 * Resolve a credential value. Env var takes priority over DB.
 * This lets operators lock credentials at deployment level while
 * admins can configure via UI when no env var is set.
 */
getCredential(envKey: string, jsonPath: string): string {
  const envVal = process.env[envKey]?.trim();
  if (envVal) return envVal;
  return this.getNestedJsonValue(jsonPath) ?? '';
}

private getNestedJsonValue(path: string): string | undefined {
  const parts = path.split('.');
  let current: any = this.cachedSettingsJson;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}
```

**Credential mapping table (used by NotificationDispatcher and service factories):**

| Integration | Env Var | settings_json Path |
|-------------|---------|-------------------|
| Teams App ID | `AZURE_BOT_APP_ID` | `notifications.channels.teams.appId` |
| Teams App Password | `AZURE_BOT_APP_PASSWORD` | `notifications.channels.teams.appPassword` |
| Slack Bot Token | `SLACK_BOT_TOKEN` | `notifications.channels.slack.botToken` |
| Slack Signing Secret | `SLACK_SIGNING_SECRET` | `notifications.channels.slack.signingSecret` |
| Google Chat SA JSON | `GOOGLE_CHAT_SERVICE_ACCOUNT_JSON` | `notifications.channels.googleChat.serviceAccountJson` |
| Discord Bot Token | `DISCORD_BOT_TOKEN` | `notifications.channels.discord.botToken` |
| Discord App ID | `DISCORD_APP_ID` | `notifications.channels.discord.appId` |
| Telegram Bot Token | `TELEGRAM_BOT_TOKEN` | `notifications.channels.telegram.botToken` |
| WhatsApp Phone ID | `WHATSAPP_PHONE_ID` | `notifications.channels.whatsapp.phoneId` |
| WhatsApp Token | `WHATSAPP_TOKEN` | `notifications.channels.whatsapp.token` |
| ClickUp API Token | `CLICKUP_API_TOKEN` | `notifications.channels.clickup.apiToken` |
| SMTP Host | `SMTP_HOST` | `notifications.channels.email.host` |
| SMTP Port | `SMTP_PORT` | `notifications.channels.email.port` |
| SMTP User | `SMTP_USER` | `notifications.channels.email.user` |
| SMTP Pass | `SMTP_PASS` | `notifications.channels.email.pass` |
| SMTP From | `SMTP_FROM` | `notifications.channels.email.from` |
| Action Link Secret | `ACTION_LINK_SECRET` | `notifications.channels.email.actionLinkSecret` |
| Server Base URL | `SERVER_BASE_URL` | `notifications.channels.email.serverBaseUrl` |
| Azure Face Endpoint | `AZURE_FACE_ENDPOINT` | `profiles.faceRecognition.endpoint` |
| Azure Face Key | `AZURE_FACE_KEY` | `profiles.faceRecognition.apiKey` |
| LLM API Key | `LLM_API_KEY` | `ai.{provider}.apiKey` |
| LLM Base URL | `LLM_BASE_URL` | `ai.ollama.baseUrl` |
| LLM Model | `LLM_MODEL` | `ai.{provider}.model` |
| Zoom Account ID | `ZOOM_ACCOUNT_ID` | `meetings.zoom.accountId` |
| Zoom Client ID | `ZOOM_CLIENT_ID` | `meetings.zoom.clientId` |
| Zoom Client Secret | `ZOOM_CLIENT_SECRET` | `meetings.zoom.clientSecret` |
| Webex Bot Token | `WEBEX_BOT_TOKEN` | `meetings.webex.botToken` |
| GoTo Client ID | `GOTO_CLIENT_ID` | `meetings.goto.clientId` |
| GoTo Client Secret | `GOTO_CLIENT_SECRET` | `meetings.goto.clientSecret` |
| BlueJeans API Key | `BLUEJEANS_API_KEY` | `meetings.bluejeans.apiKey` |
| Azure Blob Connection | `AZURE_BLOB_CONNECTION_STRING` | `storage.azureBlob.connectionString` |
| Azure Blob Container | `AZURE_BLOB_CONTAINER` | `storage.azureBlob.container` |
| AWS Region | `AWS_REGION` | `storage.awsS3.region` |
| AWS Bucket | `AWS_BUCKET` | `storage.awsS3.bucket` |
| AWS Access Key ID | `AWS_ACCESS_KEY_ID` | `storage.awsS3.accessKeyId` |
| AWS Secret Access Key | `AWS_SECRET_ACCESS_KEY` | `storage.awsS3.secretAccessKey` |
| S3 Endpoint | `S3_ENDPOINT` | `storage.s3Compatible.endpoint` |
| S3 Path Style | `S3_PATH_STYLE` | `storage.s3Compatible.pathStyle` |

**Impact on NotificationDispatcher initialization:**

Currently `createNotificationDispatcher(config, db, logger)` reads credentials from `AppConfig` (env vars only). After this fix, it should accept a `TenantSettingsService` instead:

```typescript
// Before (Gap 1 wiring):
const notificationDispatcher = createNotificationDispatcher(config, db, logger);

// After (Gap 8 credential resolution):
const tenantSettingsService = new TenantSettingsService(db, logger);
await tenantSettingsService.load();
const notificationDispatcher = createNotificationDispatcher(tenantSettingsService, db, logger);
```

Each adapter factory reads credentials via `tenantSettingsService.getCredential(envKey, jsonPath)`. If both env var and DB are empty, the adapter is skipped (not configured).

**Fix — Part H: Default settings_json Seed**

Migration 035 must seed the complete default `settings_json` so fresh installs have all 36 sections with sensible defaults. The seed is a single JSON blob:

```typescript
const DEFAULT_SETTINGS_JSON = {
  auth: { providers: {} },
  tabs: [],
  attendance: {
    autoCutoffMinutes: 120, autoCutoffNotify: true, autoCutoffGraceWarningMinutes: 15,
    clockOutShowMinutes: 0, clockInEarlyMinutes: 30, dayBoundaryHour: 6,
    gracePeriodMinutes: 15, roundingRules: 'none',
    overtimeEnabled: false, overtimeDailyThresholdMinutes: 480,
    overtimeWeeklyThresholdMinutes: 2400, overtimeMultiplier: 1.5,
    geofenceEnabled: false, geofenceStrict: false,
    ipRestrictionEnabled: false, allowedIPs: [], kioskEnabled: false,
  },
  shifts: { default: { start: '09:00', end: '18:00', overnight: false }, workDays: [1,2,3,4,5] },
  leaves: {
    types: [], accrualEngine: { enabled: false, period: 'monthly', rate: 1 },
    sandwichPolicy: false, encashmentEnabled: false, maxEncashPerYear: 0,
    yearEndCarryover: 5, compOffEnabled: false, compOffExpiryDays: 90,
  },
  approvals: { flows: {}, autoEscalationEnabled: false, autoEscalationHours: 48 },
  digest: {
    dailyEnabled: false, dailyTime: '09:00',
    dailySections: { present: true, absent: true, late: true, onLeave: true },
    weeklyEnabled: false, weeklyDay: 1, weeklyTime: '09:00',
  },
  analytics: { bradfordScoreEnabled: false, bradfordAlertThreshold: 250, pointSystemEnabled: false, auditTrailEnabled: true },
  profiles: { requiredFields: ['name','phone','pan','aadhaar','bank_account','ifsc','bank_name'], photoMaxKB: 512, faceRecognitionEnabled: false, irisEnabled: false },
  ui: { gridColumns: { desktop: 3, tablet: 2, mobile: 1 }, statusSortOrder: ['in','break','out','absent'], toastDurationMs: 3500, boardRefreshMs: 30000 },
  lottie: {
    'clock-in': { enabled: false, duration: 3 }, 'clock-out': { enabled: false, duration: 3 },
    break: { enabled: false, duration: 3 }, back: { enabled: false, duration: 3 },
  },
  ai: { provider: 'mock', assistantName: 'HR Assistant', welcomeMessage: 'How can I help?', systemPromptPrefix: '', visibility: 'off', position: 'bottom-right', rateLimit: 10, copilotVisibility: 'off', ollama: { model: 'llama3', baseUrl: 'http://localhost:11434' }, anthropic: { model: 'claude-sonnet-4-20250514' }, gemini: { model: 'gemini-pro' } },
  compliance: { country: 'IN' },
  colourSchemes: [],
  storage: { provider: 'local', maxFileSizeMB: 10, local: { basePath: './uploads' } },
  notifications: { channels: {} },
  meetings: {},
  security: {
    sessionTimeoutMinutes: 480, passwordMinLength: 8, maxLoginAttempts: 5,
    lockoutDurationMinutes: 15, magicLinkExpiryMinutes: 15, actionLinkExpiryHours: 72,
    rateLimitGlobal: 200, rateLimitAuth: 20, mfaEnabled: false,
  },
  scheduler: { autoCutoffIntervalMinutes: 10, absenceMarkingIntervalMinutes: 30, ptoAccrualIntervalHours: 6, reminderIntervalHours: 3 },
  regularization: { maxDaysBack: 30, maxPerMonth: 0, autoApproveMinorCorrections: false, minorCorrectionThresholdMinutes: 15 },
  bdMeetings: { departmentId: '', requireQualification: true, qualificationFields: [] },
  dataRetention: { auditLogDays: 365, chatMessageDays: 365, clockEventDays: 730, notificationQueueDays: 30, webhookLogDays: 90, eventBusRetentionDays: 90 },
  localization: { dateFormat: 'DD/MM/YYYY', timeFormat: '24h', weekStartDay: 1, currencyCode: 'INR', currencySymbol: '₹', numberLocale: 'en-IN' },
  payroll: {
    epfEmployeeRate: 12, epfEmployerRate: 3.67, epsRate: 8.33, epfSalaryCap: 15000,
    esiEmployeeRate: 0.75, esiEmployerRate: 3.25, esiThreshold: 21000,
    gratuityTaxExemptCap: 2000000, bonusMinRate: 8.33, bonusMaxRate: 20, bonusSalaryCap: 21000,
    tdsEnabled: false,
  },
  liveChat: { maxMessageLength: 2000, fileSharingEnabled: true, autoCreateDepartmentChannels: true, messageEditWindowMinutes: 15, messageDeleteEnabled: true, typingIndicatorEnabled: true },
  trainingLms: { externalLmsWebhooks: [], defaultBudgetPerDepartment: 0, perEmployeeBudgetCap: 0, certificateTemplateId: '', mandatoryOnNewHire: false, autoAssignCourseIds: [], recertificationMonths: 0 },
  workflowDefaults: { defaultSlaHours: 48, maxStepsPerWorkflow: 10, maxActiveInstances: 1000, enablePrebuiltTemplates: true },
  surveyDefaults: { defaultAnonymous: true, maxQuestionsPerSurvey: 50, responseDeadlineDays: 14, minResponseRateForResults: 0 },
  assetConfig: {
    assetTypes: [
      { id: 'laptop', name: 'Laptop', enabled: true }, { id: 'phone', name: 'Phone', enabled: true },
      { id: 'id_card', name: 'ID Card', enabled: true }, { id: 'parking', name: 'Parking', enabled: true },
      { id: 'furniture', name: 'Furniture', enabled: true }, { id: 'other', name: 'Other', enabled: true },
    ],
    defaultDepreciationMethod: 'straight_line',
    defaultUsefulLifeYears: { laptop: 3, phone: 2, furniture: 7 },
    warrantyAlertDays: 30, customFields: [],
  },
  visitorConfig: { autoCheckoutReminderHours: 8, ndaTemplateText: '', badgePrinterUrl: '', preRegistrationLeadTimeDays: 7, maxVisitDurationHours: 12, photoRequired: false, hostApprovalRequired: false },
  mobileConfig: { locationTrackingIntervalSeconds: 300, pushBatchSize: 100, deepLinkWebBaseUrl: '', biometricAuthEnabled: false, offlineRegularizationPrompt: true },
  exportConfig: { defaultDateRangeDays: 30, maxRowsPerExport: 50000, scheduledExportEnabled: false, scheduledExportTime: '06:00', scheduledExportRecipients: [], scheduledExportFormat: 'csv', exportRetentionDays: 30 },
  emailTemplates: { logoInHeader: true, footerText: '', customCss: '', replyToAddress: '', companyAddress: '' },
  calendar: { fiscalYearStartMonth: 4, payPeriodType: 'monthly', payDayOfMonth: 1, holidayImportSourceUrl: '' },
  uiBehavior: { idleTimeoutMinutes: 0, autoRefreshOnFocus: true, soundNotifications: false, cardViewDensity: 'comfortable', dashboardWidgets: [], showWelcomeMessage: true },
};
```

This object is serialized and stored as the default `settings_json` value in migration 035. Every section has sensible Indian defaults (INR currency, DD/MM/YYYY dates, IST timezone, Indian payroll rates).

**Fix — Part I: Admin-Only Enforcement**

All settings endpoints are admin-only. The `POST /api/settings` handler must check:

```typescript
router.post('/settings', asyncHandler(async (req, res) => {
  const callerEmail = req.identity?.email ?? '';
  if (!callerEmail) throw new AppError('Authentication required', 401);
  const isAdmin = await db.get('SELECT email FROM admins WHERE email = ?', [callerEmail]);
  if (!isAdmin) throw new AppError('Admin access required', 403);
  // ... proceed with update
}));
```

The `GET /api/settings` endpoint returns the full bundle for admins and a filtered bundle (no secrets) for non-admins. Specifically, the `notifications.channels.*.botToken`, `*.appPassword`, `*.signingSecret`, `*.apiKey`, `*.pass`, `*.secretAccessKey`, `*.connectionString` fields are replaced with `'****'` + last 4 chars in the GET response for all callers. Full values are only sent to the DB on POST.

**Tests to write** — `tests/integration/tenant-settings.test.ts`:

- Test 1: GET /api/settings returns full bundle with columns + settings_json (all 36 sections present)
- Test 2: POST /api/settings updates platform_name column
- Test 3: POST /api/settings merges settings_json.attendance partial (other sections untouched)
- Test 4: POST /api/settings merges settings_json.leaves without destroying attendance
- Test 5: SSE broadcast fires on POST /api/settings
- Test 6: Default tenant_settings row exists after migration with all 36 sections in settings_json
- Test 7: 3-tier resolution: member override > group > tenant default
- Test 8: Fresh install has sensible defaults in settings_json (Indian defaults)
- Test 9: Backward compatibility — existing GET /api/settings response shape preserved
- Test 10: Concurrent JSON merges don't lose data (simulate rapid updates)
- Test 11: Credential resolution — env var wins over settings_json value
- Test 12: Credential resolution — settings_json used when env var is empty
- Test 13: Credential resolution — empty string returned when both are empty (no crash)
- Test 14: GET /api/settings masks secrets (botToken, apiKey, pass, connectionString show ****XXXX)
- Test 15: POST /api/settings with non-admin caller → 403
- Test 16: POST /api/settings with admin caller → 200
- Test 17: POST /api/settings stores full secret values in DB (not masked)
- Test 18: Deep merge preserves nested arrays (e.g. assetConfig.assetTypes not overwritten by empty array)
- Test 19: POST /api/settings with notification channel credentials → NotificationDispatcher reinitializes
- Test 20: All 36 default sections validate against TypeScript interface (no missing keys)

**Verify:** `npx vitest run` — all pass.

---

## Gap 9 — Member Preferences (Per-User, Database-Backed)

**New files:** `src/repositories/member-preferences-repository.ts`, `src/services/member-preferences-service.ts`, `src/routes/member-preferences.ts`  
**Modified files:** `src/routes/index.ts`

**Problem:**  
The frontend monolith stores all user preferences (theme, colours, background, timezone) in localStorage. The architecture requires these to be database-backed so they sync across devices. The `member_preferences` table is created in migration 035 (Gap 8).

**Fix — Part A: Repository**

`src/repositories/member-preferences-repository.ts`:

- `getByMemberId(memberId: string): Promise<MemberPrefsRow | null>`
- `upsert(memberId: string, tenantId: string, fields: Partial<MemberPrefsRow>): Promise<MemberPrefsRow>` — INSERT OR REPLACE with merge semantics (unset fields unchanged)

**Fix — Part B: Service**

`src/services/member-preferences-service.ts`:

- `getPrefs(email: string): Promise<MemberPrefsRow>` — returns row or defaults
- `updatePrefs(email: string, partial: Partial<MemberPrefsRow>): Promise<MemberPrefsRow>` — validates fields (theme must be one of chromium/neural/holodeck/clean, colors must be valid hex, bg_opacity 0-100, bg_blur 0-30, bg_darken 0-95), upserts

**Fix — Part C: Routes**

`src/routes/member-preferences.ts`:

```typescript
GET  /api/profiles/me/prefs   → returns prefs for calling user (req.identity.email)
PUT  /api/profiles/me/prefs   → upserts partial prefs for calling user
                                Body: any subset of columns
                                Unset fields unchanged
                                401 if no identity
```

**Fix — Part D: Registration**

In `src/routes/index.ts`:
```typescript
import { createMemberPreferencesRouter } from './member-preferences';
app.use('/api', createMemberPreferencesRouter(db, logger));
```

**Tests to write** — `tests/integration/member-preferences.test.ts`:

- Test 1: GET /api/profiles/me/prefs with no existing row → returns defaults (theme: 'chromium', bg_opacity: 30, etc.)
- Test 2: PUT /api/profiles/me/prefs `{ theme: 'neural' }` → 200, subsequent GET returns theme: 'neural'
- Test 3: PUT with partial update `{ color_accent: '#ff6b35' }` → only accent changes, theme unchanged
- Test 4: PUT with full update (all fields) → all fields persisted
- Test 5: Two different users have isolated preferences (user A changes theme, user B unaffected)
- Test 6: Invalid theme rejected → 400
- Test 7: Invalid hex color rejected → 400
- Test 8: bg_opacity out of range (0-100) rejected → 400
- Test 9: bg_blur out of range (0-30) rejected → 400
- Test 10: bg_darken out of range (0-95) rejected → 400
- Test 11: No identity header → 401
- Test 12: Upsert idempotency — PUT same values twice → 200 both times, no error
- Test 13: timezone_slot_1 through _4 all persist correctly
- Test 14: notification_prefs JSON string persists and returns correctly
- Test 15: Regression — existing profile routes (GET/PUT /api/profiles/me) unaffected

**Verify:** `npx vitest run` — all pass.

---

## Gap 10 — Lottie Animations Table

**New migration:** `migrations/038_lottie_animations.sql`  
**Modified files:** `src/routes/settings.ts` (add lottie endpoints)

**Problem:**  
Lottie animation data (JSON files up to 2 MB each) cannot be embedded in `settings_json` — it would bloat every `GET /api/settings` response. The animation data needs its own table. The `settings_json.lottie` section stores only the config (enabled, duration), not the data.

**Fix — Part A: Migration 038**

```sql
CREATE TABLE IF NOT EXISTS lottie_animations (
  action          TEXT PRIMARY KEY CHECK(action IN ('clock-in', 'clock-out', 'break', 'back')),
  tenant_id       TEXT NOT NULL DEFAULT 'default',
  file_data       TEXT,              -- full Lottie JSON as TEXT (up to 2 MB)
  file_name       TEXT,              -- original filename for display
  file_size_bytes INTEGER DEFAULT 0,
  duration_sec    INTEGER NOT NULL DEFAULT 3,
  enabled         INTEGER NOT NULL DEFAULT 0,
  uploaded_by     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed all 4 actions with empty/disabled defaults
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('clock-in', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('clock-out', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('break', 0);
INSERT OR IGNORE INTO lottie_animations (action, enabled) VALUES ('back', 0);
```

**Fix — Part B: Endpoints**

Add to settings routes (or create `src/routes/lottie.ts`):

```
GET    /api/settings/lottie              → returns all 4 actions with enabled, duration, fileName, fileSize (NO file_data — too large)
GET    /api/settings/lottie/:action      → returns file_data for one action (the actual animation JSON)
PUT    /api/settings/lottie/:action      → body { file_data, file_name, file_size_bytes, duration_sec, enabled }
                                           Validates: action must be one of 4, file_size ≤ 2MB, file_data is valid JSON
DELETE /api/settings/lottie/:action      → clears file_data, sets enabled = 0
```

All lottie endpoints are admin-only (add to `ADMIN_ONLY_ROUTE_PREFIXES` or check admin inline).

**Fix — Part C: settings_json.lottie reference**

The `settings_json.lottie` section in `tenant_settings` becomes config-only:

```typescript
lottie: {
  'clock-in':  { enabled: boolean; duration: number };
  'clock-out': { enabled: boolean; duration: number };
  break:       { enabled: boolean; duration: number };
  back:        { enabled: boolean; duration: number };
}
```

The actual animation data is fetched separately via `GET /api/settings/lottie/:action` only when the frontend needs to play it.

**Tests to write** — `tests/integration/lottie-animations.test.ts`:

- Test 1: GET /api/settings/lottie → 200, returns 4 actions all disabled, no file_data in response
- Test 2: PUT /api/settings/lottie/clock-in with valid Lottie JSON → 200
- Test 3: GET /api/settings/lottie/clock-in → 200, returns file_data
- Test 4: PUT with file > 2 MB → 400
- Test 5: PUT with invalid JSON in file_data → 400
- Test 6: PUT with invalid action name → 400
- Test 7: DELETE /api/settings/lottie/clock-in → 200, subsequent GET returns null file_data, enabled = false
- Test 8: PUT with `{ enabled: true, duration_sec: 5 }` without file_data → updates config only
- Test 9: Non-admin PUT → 403 (admin-only)
- Test 10: Duration validation (1-10 seconds) → 400 for out of range

**Verify:** `npx vitest run` — all pass.

---

## Gap 11 — Test Helper Updates

**Files to change:** `tests/helpers/setup.ts`

**Problem:**  
The test helper needs new seed functions for the new tables.

**Fix:**

Add to `tests/helpers/setup.ts`:

```typescript
export async function seedTenantSettings(db: DatabaseEngine, overrides: Record<string, unknown> = {}): Promise<void> {
  const defaults = {
    id: 'default',
    platform_name: 'TestHR',
    primary_timezone: 'Asia/Kolkata',
    settings_json: JSON.stringify({
      attendance: { autoCutoffMinutes: 120, gracePeriodMinutes: 15 },
      shifts: { default: { start: '09:00', end: '18:00', overnight: false }, workDays: [1,2,3,4,5] },
      leaves: { types: [], accrualEngine: { enabled: false } },
      ui: { gridColumns: { desktop: 3, tablet: 2, mobile: 1 }, toastDurationMs: 3500, boardRefreshMs: 30000 },
      lottie: {
        'clock-in': { enabled: false, duration: 3 },
        'clock-out': { enabled: false, duration: 3 },
        break: { enabled: false, duration: 3 },
        back: { enabled: false, duration: 3 },
      },
      ai: { provider: 'mock', visibility: 'off' },
      compliance: { country: 'IN' },
      colourSchemes: [],
    }),
  };
  const merged = { ...defaults, ...overrides };
  await db.run(
    `INSERT OR REPLACE INTO tenant_settings (id, platform_name, primary_timezone, settings_json)
     VALUES (?, ?, ?, ?)`,
    [merged.id, merged.platform_name, merged.primary_timezone, merged.settings_json],
  );
}

export async function seedMemberPreferences(
  db: DatabaseEngine,
  memberId: string,
  overrides: Record<string, unknown> = {},
): Promise<void> {
  const defaults = {
    tenant_id: 'default',
    theme: 'chromium',
    dark_mode: 'system',
    bg_opacity: 30,
    bg_blur: 0,
    bg_darken: 70,
  };
  const merged = { ...defaults, ...overrides };
  await db.run(
    `INSERT OR REPLACE INTO member_preferences
     (member_id, tenant_id, theme, dark_mode, bg_opacity, bg_blur, bg_darken)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [memberId, merged.tenant_id, merged.theme, merged.dark_mode, merged.bg_opacity, merged.bg_blur, merged.bg_darken],
  );
}
```

**No standalone test file needed** — these helpers are verified by the tests that use them (Gaps 8, 9, 10).

---

## Implementation Order

Execute gaps in this exact sequence — each builds on the previous:

```
Phase 1: Bug Fixes (no schema changes)
  Gap 1 — NotificationDispatcher wiring
  Gap 2 — geo.ts route registration
  Gap 3 — Ollama auth header
  → npx vitest run (971+ tests)

Phase 2: Schema Additions
  Gap 8 — tenant_settings + member_preferences (migration 035)
  Gap 4 — Platform IDs for identity resolution (migration 036)
  Gap 7 — Feature flags admin-only (migration 037)
  Gap 10 — Lottie animations table (migration 038)
  → npx vitest run (971+ tests)

Phase 3: Feature Additions
  Gap 9 — Member preferences routes + service
  Gap 5 — ClickUp dispatch completion
  Gap 6 — CSV export endpoints
  Gap 11 — Test helper updates
  → npx vitest run (971+ tests, likely 1040+ with all new tests)
```

---

## Final Verification Checklist

After all 11 gaps are fixed:

```bash
# 1. TypeScript — zero type errors
npx tsc --noEmit

# 2. Lint — zero errors
npx eslint src/ tests/ --ext .ts

# 3. Format check
npx prettier --check "src/**/*.ts" "tests/**/*.ts"

# 4. Full test suite — must be 971+ original + ~100 new = ~1070+ tests, 0 failures
npx vitest run

# 5. Boot and smoke test
PORT=3999 DB_PATH=./dev.db npx tsx src/index.ts
curl -s http://localhost:3999/api/settings | jq .platform_name
curl -s http://localhost:3999/api/profiles/me/prefs -H "X-User-Email: test@test.com" | jq .
curl -s http://localhost:3999/api/settings/lottie | jq .
curl -s http://localhost:3999/api/export/attendance?startDate=2026-01-01\&endDate=2026-12-31 -H "X-User-Email: admin@test.com"
curl -s http://localhost:3999/api/features -H "X-User-Email: admin@test.com" | jq .
curl -s http://localhost:3999/api/features -H "X-User-Email: user@test.com" | jq .
curl -s http://localhost:3999/api/geo/zones -H "X-User-Email: test@test.com" | jq .
```

## Summary

| Gap | What | New Files | Modified | New Tests | Migrations |
|-----|------|-----------|----------|-----------|------------|
| 1 | NotificationDispatcher wiring | 0 | 1 | ~4 | 0 |
| 2 | geo.ts registration | 0 | 1 | ~8 | 0 |
| 3 | Ollama auth header | 0 | 1 | ~4 | 0 |
| 4 | Identity resolution | 0 | 2 | ~7 | 036 |
| 5 | ClickUp dispatch | 0 | 1 | ~7 | 0 |
| 6 | CSV exports | 1 | 1 | ~10 | 0 |
| 7 | Admin-only flags | 0 | 3 | ~15 | 037 |
| 8 | Tenant settings + credentials | 2 | 6 | ~20 | 035 |
| 9 | Member preferences | 3 | 1 | ~15 | (in 035) |
| 10 | Lottie table | 0 | 1 | ~10 | 038 |
| 11 | Test helpers | 0 | 1 | 0 | 0 |
| **Total** | | **6 new** | **~19 modified** | **~100 new tests** | **4 migrations** |

All gaps fixed. All tests green. Zero regressions.
