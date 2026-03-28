# BlokHR Server — Bug Fix & Enhancement Instructions
## Claude Code Prompt · shaavir-server · TypeScript/Express

---

## ROLE & CONTEXT

You are working on shaavir-server, the BlokHR backend. TypeScript/Express, DatabaseEngine abstraction (SQLite/Postgres/Azure Tables/SharePoint), vitest for tests. 943+ existing tests. Zero regression tolerance.

**Storage rule enforced everywhere in this codebase:** Every piece of application data is a database record. No JSON files, no localStorage writes from the server side. User preferences (theme, colours, timezones) live in `member_preferences` table. Every clock event including breaks lives in `clock_entries`. The session token is the only localStorage value and the server never writes it — only reads it via X-User-Email header.

**Database is pluggable.** Never write `TableClient` or Azure-specific code in route files. Always use `db.get()`, `db.all()`, `db.run()` from the injected `DatabaseEngine`.

**Before touching anything, run:**
```bash
npx vitest run         # confirm baseline is green
npx tsc --noEmit       # confirm TypeScript is clean
```

---

## HOW TO WORK

1. Fix one gap at a time in listed order.
2. Write tests first (TDD). New test files only — never modify existing.
3. After every change: `npx vitest run` → all green before next step.
4. Use `supertest` + `createTestApp()` from tests/helpers/setup.ts for HTTP tests.
5. All patterns: `asyncHandler`, `AppError`, `req.identity?.email`.
6. `npx tsc --noEmit` must pass after every change.

---

## BUG-1 — NotificationDispatcher silently null [CRITICAL]

**File:** src/routes/index.ts

**Problem:** createLeaveRouter, createRegularizationRouter, createBdMeetingRouter all receive null for their dispatcher. Notifications fire into a void.

**Fix:**
```typescript
const notificationDispatcher = createNotificationDispatcher(config, db, logger);
const leaveNotifier = new LeaveNotificationService(notificationDispatcher, db, logger);

app.use('/api', createLeaveRouter(db, logger, leaveNotifier));
app.use('/api', createRegularizationRouter(db, logger, notificationDispatcher));
app.use('/api', createBdMeetingRouter(db, logger, notificationDispatcher));
```

**Tests:** tests/integration/notification-wiring.test.ts
- Leave submit → 200, no TypeError
- Leave approve → 200, no crash
- Regularization submit → 200, no crash
- adapterCount ≥ 0 regardless of env vars (no crash)

---

## BUG-2 — geo.ts route not registered [HIGH]

**File:** src/routes/index.ts

**Fix:**
```typescript
// Remove: import { createGeoFencingRouter } from './geo-fencing';
// Add:    import { createGeoRouter } from './geo';
// Remove: app.use('/api', createGeoFencingRouter(db, logger));
// Add:    app.use('/api', createGeoRouter(db, logger));
```

Do not delete geo-fencing.ts until all tests pass.

**Tests:** tests/integration/geo-routes.test.ts
- GET /api/geo/zones → 200 { zones: [] }
- POST /api/geo/zones with { name, latitude, longitude, radius_meters } → 201
  → Verify row exists in geo_zones table via db.get()
- PUT /api/geo/zones/:id → 200
- DELETE /api/geo/zones/:id → 200
- GET /api/geo/settings → 200
- PUT /api/geo/settings → 200
- GET /api/geo/logs → 200 { logs: [] }
- POST /api/clock/geo with geo disabled → 200 (no block)
- POST /api/clock/geo with geo enabled, outside all zones → { blocked: true }

---

## BUG-3 — OllamaLlmClient missing Authorization header [MEDIUM]

**File:** src/services/llm/llm-client.ts

**Fix:**
```typescript
constructor(
  model: string,
  private readonly logger: Logger,
  baseUrl?: string,
  private readonly apiKey?: string,  // new optional param
) {}

// In chat():
headers: {
  'Content-Type': 'application/json',
  ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
},
```

Pass `process.env.OLLAMA_API_KEY` as 4th arg wherever OllamaLlmClient is instantiated.

**Tests:** tests/unit/ollama-auth.test.ts
- No apiKey → headers object has no Authorization key
- With apiKey → headers.Authorization === 'Bearer test-key'
- Anthropic client still sends x-api-key (regression)
- MockLlmClient unaffected (regression)

---

## BUG-4 — Discord/Telegram/WhatsApp identity resolvers are stubs [HIGH]

**New migration:** migrations/035_platform_ids.sql

```sql
ALTER TABLE members ADD COLUMN discord_id TEXT NOT NULL DEFAULT '';
ALTER TABLE members ADD COLUMN telegram_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_members_discord ON members(discord_id) WHERE discord_id != '';
CREATE INDEX IF NOT EXISTS idx_members_telegram ON members(telegram_id) WHERE telegram_id != '';
```

**Fix in src/routes/interactions.ts:** Replace stub resolvers with real DB lookups:

```typescript
async function resolveDiscordEmail(discordUserId: string, _botToken: string,
  logger: Logger, db: DatabaseEngine): Promise<string> {
  if (!discordUserId) return '';
  const row = await db.get<{ email: string }>(
    'SELECT email FROM members WHERE discord_id = ? AND active = 1', [discordUserId]
  );
  return row?.email ?? '';
}

async function resolveTelegramEmail(telegramUserId: number, _botToken: string,
  logger: Logger, db: DatabaseEngine): Promise<string> {
  if (!telegramUserId) return '';
  const row = await db.get<{ email: string }>(
    'SELECT email FROM members WHERE telegram_id = ? AND active = 1', [String(telegramUserId)]
  );
  return row?.email ?? '';
}

async function resolveWhatsAppEmail(phoneNumber: string, logger: Logger,
  _config: AppConfig, db: DatabaseEngine): Promise<string> {
  if (!phoneNumber) return '';
  const row = await db.get<{ email: string }>(
    'SELECT email FROM members WHERE phone = ? AND active = 1', [phoneNumber]
  );
  return row?.email ?? '';
}
```

Update createInteractionRouter to accept db: DatabaseEngine.

**Tests:** tests/integration/interaction-identity.test.ts
- Insert member with discord_id='D123', telegram_id='T456', phone='+911234567890'
- POST /api/interactions/discord with user.id='D123' → dispatched with correct email
- POST /api/interactions/discord with unknown id → 200, no crash, email=''
- POST /api/interactions/telegram → dispatched correctly
- POST /api/interactions/whatsapp → dispatched correctly
- Empty discordUserId → '' without DB query
- telegramUserId=0 → '' without DB query
- Migration 035 applied → discord_id and telegram_id columns exist

---

## BUG-5 — ClickUp dispatch incomplete [MEDIUM]

**File:** src/routes/interactions.ts

**Fix:** When status is 'approved' or 'rejected', fetch the task from ClickUp to read entity ref from description. Respond 200 immediately and process in background to avoid webhook timeout:

```typescript
res.status(200).json({ ok: true });  // respond immediately
setImmediate(async () => {
  if (!config.clickupApiToken) return;
  try {
    const taskResp = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`,
      { headers: { Authorization: config.clickupApiToken }, signal: AbortSignal.timeout(8000) });
    if (!taskResp.ok) return;
    const task = await taskResp.json();
    const entityRef = JSON.parse(task.description ?? '{}');
    const actionId = mapEmailAction(entityRef.entityType, newStatus);
    if (!actionId) return;
    const callerEmail = task.creator?.email ?? entityRef.approverEmail ?? '';
    await dispatcher.dispatch({ actionId, payload: entityRef, callerEmail, reason: '' });
  } catch (err) {
    logger.error({ err, taskId }, 'ClickUp processing failed');
  }
});
```

**Tests:** tests/integration/clickup-interaction.test.ts
- Non-taskStatusUpdated event → 200, no dispatch
- Status 'in_progress' → 200, no dispatch
- Status 'approved', mock ClickUp returns task → dispatcher called with correct actionId
- Status 'rejected', entityType='regularization' → actionId='reg.reject'
- No CLICKUP_API_TOKEN → 200, no crash
- ClickUp API 404 → 200, no crash
- Task description not JSON → 200, no crash

---

## BUG-6 — No export endpoints [HIGH]

**File to create:** src/routes/export.ts  
**Register in:** src/routes/index.ts

```
GET /api/export/attendance?startDate=&endDate=&groupId=&email=
GET /api/export/leaves?startDate=&endDate=&groupId=&email=&status=
GET /api/export/lates?startDate=&endDate=&groupId=&email=
```

Response: text/csv with Content-Disposition: attachment. No CSV libraries — build strings directly.

Queries run against `attendance_daily`, `leave_requests` (joined to `members` and `groups`).

Date loop must include ALL 7 days — no day-of-week filtering.

Validation: both dates required (400 if missing), YYYY-MM-DD format (400 if invalid), start ≤ end (400 if not).

**Tests:** tests/integration/export.test.ts (10 tests)
- 200 + text/csv + attachment disposition
- Missing dates → 400
- start > end → 400
- email filter → only that email's rows
- status filter (leaves) → only that status
- lates endpoint → only is_late=1 rows
- CSV escaping: "Smith, Joe" → quoted correctly
- No records in range → headers only, no crash
- GET /api/analytics/attendance still returns JSON (regression)
- Non-admin → 403 (export is admin-only)

---

## BUG-7 — Feature flags no admin enforcement [HIGH]

**New migration:** migrations/036_feature_flags_admin_only.sql

```sql
ALTER TABLE feature_flags ADD COLUMN admin_only INTEGER NOT NULL DEFAULT 0;
UPDATE feature_flags SET admin_only = 1
  WHERE feature_key IN ('analytics', 'geo_fencing', 'face_recognition', 'iris_scan');
```

**Changes to FeatureFlagService:**
- Add adminOnly: boolean to FeatureFlag type
- Add getForUser(email, db) — filters adminOnly flags for non-admins
- Add guardWithAdmin(db) — new method, keeps existing guard() intact

**Changes to feature-flags route:**
- createFeatureFlagsRouter now accepts db: DatabaseEngine
- GET /api/features: use getForUser(callerEmail, db)
- PUT /api/features/:key: admin check → 403 for non-admins
- These prefixes return 403 for non-admins: /api/analytics, /api/geo/zones, /api/geo/settings, /api/face/enroll, /api/iris/enroll, /api/export

**Tests:** tests/integration/feature-flags-admin-only.test.ts (15 tests)
- Non-admin GET /api/features → filtered (no analytics, geo_fencing, face_recognition, iris_scan)
- Admin GET /api/features → all flags including admin-only ones
- No X-User-Email → graceful fallback (non-admin view)
- Non-admin PUT /api/features/analytics → 403
- Admin PUT /api/features/analytics → 200
- GET /api/analytics with non-admin → 403
- GET /api/export with non-admin → 403
- GET /api/training with non-admin → 200 (not admin-only)
- Migration 036: analytics.admin_only=1, training_lms.admin_only=0
- Regression: existing guard() still works

---

## ENHANCEMENT: member_preferences API

Add to src/routes/profiles.ts:

```
GET  /api/profiles/me/prefs       → returns member_preferences for caller
PUT  /api/profiles/me/prefs       → upserts member_preferences for caller
```

This is how the frontend saves theme, dark mode, colours, background, and timezones. Nothing about user appearance state goes to localStorage except the session token.

Request body for PUT:
```json
{
  "theme": "neural",
  "dark_mode": "system",
  "color_accent": "#6366f1",
  "bg_image_url": "data:image/jpeg;base64,...",
  "bg_opacity": 40,
  "timezone_slot_1": "Asia/Kolkata",
  "timezone_slot_2": "America/New_York"
}
```

All fields optional. Unset fields retain their current DB value.

---

## ENHANCEMENT: Setup Wizard Routes

**File to create:** src/routes/setup.ts

```
GET  /setup          → serves setup.html (static, no auth required, only works if FIRST_RUN)
POST /setup/test-db  → tests the database connection with provided config
POST /setup/init     → writes initial tenant_settings, admins, runs migrations, clears FIRST_RUN
```

The wizard collects:
1. Database backend choice (sqlite/postgres/azure-tables/sharepoint)
2. Auth provider selection — all of these are available, admin picks any combination:
   - Microsoft MSAL
   - Google OAuth
   - Okta
   - Teams SSO
   - GitHub OAuth
   - SAML 2.0
   - Custom JWT endpoint URL
   - Magic Link (passwordless email)
   - Local PIN (for kiosk mode)
3. First admin email + name
4. Company identity (name, timezone, logo)

Everything written to tenant_settings and admins tables. Nothing to .env or JSON.

---

## FINAL VERIFICATION

```bash
npx tsc --noEmit
npx eslint src/ tests/ --ext .ts
npx vitest run                    # 943+ tests, 0 failures
npx vitest run --coverage         # statements > 80%, branches > 70%

# Smoke tests
curl http://localhost:3000/api/geo/zones -H "X-User-Email: t@t.com"
curl "http://localhost:3000/api/export/attendance?startDate=2026-01-01&endDate=2026-12-31" \
     -H "X-User-Email: admin@t.com"
curl http://localhost:3000/api/features -H "X-User-Email: admin@t.com"
curl http://localhost:3000/api/profiles/me/prefs -H "X-User-Email: user@t.com"
```
