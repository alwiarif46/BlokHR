# P8 — school-compliance

**Scope guard for this phase:** this service produces validated FILES and tracks statutory CYCLES. It never auto-submits to any government portal (no scraping, no portal automation). Uploads are done by the school; we make the file correct.

---
## PROMPT P8-01 — Scaffold + compliance calendar

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern.

Create `services/school-compliance/`: `@blokhr/school-compliance`, env `SCHOOL_COMPLIANCE_DB_PATH`, port 3019. `migrations/001_calendar.sql`:
- `compliance_items`: id, tenant_id NULL (NULL=global seed), key (`udise_freeze|cbse_loc|cbse_oasis|cbse_9_11_reg|cisce_entry|rte_reporting|state_return`), label, authority (`udise|cbse|cisce|state|other`), due_rule_json (`{month, day}` or `{window_start:{m,d}, window_end:{m,d}}`), guidance TEXT
- `tenant_compliance_status`: id, tenant_id, item_key, academic_session_ref, state (`not_started|in_progress|ready|submitted|closed`), note NULL, updated_by, updated_at. Unique (tenant_id, item_key, academic_session_ref).
- Seed global items: udise_freeze {month:9, day:30}; cbse_loc window Jul–Sep; cbse_oasis annual; cisce_entry window Aug–Sep. Mark seeds `VERIFY DATES ANNUALLY` in guidance.

Routes: `GET /api/compliance/:tenantId/calendar?session=` — items + tenant status + days_until_due (computed from due_rule against a `?today=` param for testability); status transitions (any forward, backward only with note — 400 without); `GET .../overdue?today=`. Tests: seed visibility, due-date math incl. windows, transition rules, overdue, tenant isolation.

---
## PROMPT P8-02 — UDISE SDMS export

Read CONVENTIONS + school-compliance src, and the preflight validator contract in `services/school-identity/src/services/udise-validator.ts` (read only — you call identity over HTTP).

`migrations/002_exports.sql`: `export_runs`: id, tenant_id, kind (`udise_sdms|cbse_loc|state`), academic_session_ref, state (`running|passed|failed`), total, passing, failing, file_ref NULL, errors_json NULL, created_by, created_at.

- HTTP client `src/clients/identity-client.ts` (env `IDENTITY_URL`): fetch students + preflight results. Stub-server tested.
- `POST /api/compliance/:tenantId/exports/udise {session_ref}`:
  1. Call identity preflight. Any failing rows ⇒ export_run `failed` with errors_json (grouped by error code with counts + first 20 student refs each) — **no file produced on failure** (all-or-nothing).
  2. All passing ⇒ produce CSV: fixed column order defined in `src/exports/udise-columns.ts` as a single exported array (name, dob, gender, admission_no, admission_date, class, section, category, mother_name, contact, apaar_id, cwsn fields, rte flag) with a `VERIFY AGAINST CURRENT SDMS TEMPLATE` comment; CSV escaping for commas/quotes/newlines (reuse the pattern from `backend/src/routes/export.ts` — read it, copy the escape function, do not import).
  3. Store file via storage reference (env `STORAGE_URL` POST; stub-tested), run `passed`, emit `school.compliance.export_ready`.
- `GET /api/compliance/:tenantId/exports?kind=` + `GET .../exports/:id` (incl. errors_json).

Tests: failing preflight blocks file + error grouping; passing produces correct header row + escaping cases; run history; client failure → run `failed` not crash; tenant isolation.

---
## PROMPT P8-03 — APAAR readiness + Aadhaar-mismatch precheck

Read CONVENTIONS + school-compliance src + identity client.

No new tables. Pure logic + routes:
- `src/services/apaar-readiness.ts`: given students+consents (via identity client): classify each student `ready` (consent granted + all ABC-required fields present + no name/DOB anomalies) | `blocked_refused` (consent refused — **valid terminal state, not an error**) | `needs_consent` | `needs_fix {issues[]}`.
- Name/DOB anomaly checks (pure, table-driven tests): DOB in future/age>25; name contains digits or 2+ consecutive spaces; name ALL-CAPS-vs-mixed mismatch between first/last (normalisation hint); trailing/leading whitespace. Each returns `{code, field, hint}` — these are the DOB/name mismatch failures that dominate ABC portal rejections.
- `GET /api/compliance/:tenantId/apaar/readiness?session=` → counts per class + drill-down list, paginated.
- `GET /api/compliance/:tenantId/apaar/fix-list?session=` → only `needs_fix` students with issues — the clerk worklist.
- Emit nothing; read-only feature.

Tests: each classification incl. refused-is-not-error; every anomaly rule both directions; pagination; stubbed identity; tenant isolation.

---
## PROMPT P8-04 — DPDP data-rights workflow

Read CONVENTIONS + school-compliance src. This is the parental access/correction/erasure surface required by DPDP.

`migrations/003_dsr.sql`: `data_requests`: id, tenant_id, student_ref, guardian_ref, kind (`access|correction|erasure`), state (`received|verifying|in_progress|completed|rejected`), details_json, sla_due_on, resolution_note NULL, handled_by NULL, created_at, updated_at; `data_request_audit`: id, tenant_id, request_id, from_state, to_state, actor, at.

- `POST /api/compliance/:tenantId/data-requests` — kind+details; sla_due_on = created +30 days (configurable `dsr_sla_days` in a tenant_config row, same migration).
- Transitions: received→verifying→in_progress→completed|rejected; rejected requires resolution_note (400); every transition audited.
- Erasure completion rule: completing an `erasure` request requires `details_json.services_confirmed` to list at least `["identity","attendance","assessment","engagement"]` — the operator attests each service purged (we cannot cascade automatically across service boundaries; the checklist enforces the operator did). Missing confirmations → 400 listing them.
- `GET /api/compliance/:tenantId/data-requests?state=&overdue=true` (overdue = past sla_due_on, not terminal); `GET .../data-requests/:id` with audit trail.
- Emit `school.dsr.received` and `school.dsr.overdue` (the latter from `POST .../data-requests/sweep-overdue {today}` — idempotent per request).

Tests: SLA computation + config; transition rules + audit; erasure checklist enforcement; overdue sweep idempotency; tenant isolation.
