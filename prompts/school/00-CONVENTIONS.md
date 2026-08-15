# Conventions for all school-* services

Cursor: read this file fully before writing any code. Copy patterns from the named reference files. Do not invent alternatives.

## Reference implementation
`services/entitlements/` is the canonical service. Mirror it exactly:

| Concern | Copy from |
|---|---|
| Package layout & scripts | `services/entitlements/package.json` (`@blokhr/<name>`, scripts: build/dev/start/test/typecheck; deps: express, cors, dotenv, pino, sql.js, uuid) |
| DB wrapper | `services/entitlements/src/db.ts` — sql.js class with `get/all/run/close`, `:memory:` support, `runXxxMigrations(db, migrationsDir)` that reads sorted `NNN_*.sql`, tracks `schema_migrations` |
| App factory | `services/entitlements/src/index.ts` — `createXxxApp({dbPath, migrationsDir?, logger}) → {app, db}`. All wiring inside the factory. No side effects at import time |
| Bootstrap | `services/entitlements/src/server.ts` — dotenv, pino, `PORT` env, `<NAME>_DB_PATH` env, `main().catch` |
| Tests | `services/entitlements/tests/entitlements.test.ts` — vitest + supertest, `beforeEach` builds app with `dbPath: ':memory:'` and `pino({level:'silent'})`, `afterEach` closes db |
| tsconfig / vitest config | copy both files from entitlements verbatim, adjust name only |

## Service skeleton (every scaffold prompt produces exactly this)
```
services/<name>/
  package.json  tsconfig.json  vitest.config.ts
  migrations/001_<domain>.sql
  src/db.ts  src/index.ts  src/server.ts  src/types.ts
  src/routes/<domain>.ts
  src/services/<domain>-service.ts
  src/repositories/<domain>-repository.ts
  tests/<domain>.test.ts
```

## Shared shapes

**Tenant scoping.** Every route: `/api/<domain>/:tenantId/...`. Every table has `tenant_id TEXT NOT NULL` and every query filters on it. No exceptions.

**IDs.** `uuid` v4 via the `uuid` package, prefixed strings in API responses are NOT used — plain uuids, same as entitlements.

**Timestamps.** TEXT ISO8601, `created_at`/`updated_at` with `datetime('now')` defaults.

**EventPublisher** (defined once in `services/school-identity/src/events.ts` by prompt P0-02; later services copy the same 30-line file — do NOT import across services):
```ts
export interface DomainEvent { type: string; tenantId: string; occurredAt: string; data: Record<string, unknown>; }
export interface EventPublisher { publish(e: DomainEvent): Promise<void>; }
// LogEventPublisher: pino-logs the event (default, used in tests)
// HttpEventPublisher: POST to process.env.EVENT_SINK_URL if set, swallow+log errors (never crash the request)
```
Event names: `school.<entity>.<verb>` past tense — `school.student.enrolled`, `school.attendance.marked_absent`.

**Errors.** 400 validation, 403 forbidden/limit, 404 missing, 409 conflict. JSON body `{error: string}`. Match entitlements.

**Money.** Integer paise. Never floats.

## Test bar per prompt
Each prompt states its own test list. Global minimum: happy path + one validation failure + tenant isolation (tenant A cannot read tenant B's row) for every new route group. All tests green via `npx vitest run` in the service folder; `npx tsc --noEmit` clean.

## Forbidden (repeat: the diff is rejected if present)
- Any change under `backend/src/` unless the prompt explicitly names a file there
- Imports from another `services/*/src/*`
- New npm dependencies not named in the prompt
- `localStorage`, raw `fetch()` in frontend modules; hex colours in CSS
- TODO / placeholder / "implement later" comments
- Student biometric capture, emotion detection, Aadhaar auth
