# P5 — school-engagement

---
## PROMPT P5-01 — Scaffold school-engagement

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern. Also read `backend/src/services/notification/dispatcher.ts` and `backend/src/templates/notification-message.ts` for the platform's adapter shapes — you will NOT import them; the engagement service emits to the platform dispatcher over HTTP via env `NOTIFY_SINK_URL` (same swallow-errors rule as EventPublisher).

Create `services/school-engagement/`: `@blokhr/school-engagement`, env `SCHOOL_ENGAGEMENT_DB_PATH`, port 3016. `migrations/001_prefs.sql`:
- `guardian_channels`: id, tenant_id, guardian_ref TEXT (opaque school-identity guardian id), channel (`push|whatsapp|sms|ivr`), address TEXT (device token / phone), verified INTEGER DEFAULT 0, priority INTEGER, is_active INTEGER DEFAULT 1
- `engagement_settings`: tenant_id PK, daily_cap_per_student INTEGER DEFAULT 3, digest_hour INTEGER DEFAULT 17, digest_frequency (`daily|weekly`) DEFAULT 'daily', quiet_start INTEGER DEFAULT 21, quiet_end INTEGER DEFAULT 7

Routes: health; channels CRUD (`PUT` full-replace per guardian, ordered by priority); settings GET/PUT with range validation (cap 1–10, hours 0–23). Tests: CRUD, ordering, validation, tenant isolation.

---
## PROMPT P5-02 — Message log, caps, templates

Read CONVENTIONS + school-engagement migration 001.

`migrations/002_messages.sql`:
- `message_templates`: id, tenant_id NULL (NULL=global seed), key (`absence_alert|attendance_nudge|fee_reminder|digest|general`), lang, body TEXT with `{{var}}` placeholders, kind (`transactional|informational`), reviewed INTEGER DEFAULT 0. Seed global `absence_alert` + `attendance_nudge` in en + hi (reviewed=1).
- `outbound_messages`: id, tenant_id, student_ref NULL, guardian_ref, template_key, lang, channel, rendered_body, status (`queued|sent|suppressed_cap|suppressed_quiet|failed`), suppress_reason NULL, created_at, sent_at NULL

Service `message-service.ts`:
- `queueMessage({tenantId, student_ref, guardian_ref, template_key, vars, urgency: interrupt|digest})`:
  - Resolve template: tenant override in guardian's preferred lang → global in that lang → global en. Missing vars → 400 listing them.
  - `interrupt`: enforce daily cap per student (count today's non-digest sends; at cap ⇒ `suppressed_cap`) and quiet hours (inside window and template ≠ absence_alert ⇒ `suppressed_quiet`; absence_alert always passes).
  - `digest`: store with status `queued`, no dispatch.
  - Dispatch = POST to NOTIFY_SINK_URL `{channel, address, body}` walking the guardian's channel priority until one is verified+active; none ⇒ `failed/no_channel`.
- `POST /api/engagement/:tenantId/messages` (the queue endpoint); `GET /api/engagement/:tenantId/messages?student_ref=&status=&date=`.

Tests: template resolution chain; var validation; cap; quiet hours + absence exception; channel walk with stub sink; digest queuing; tenant isolation.

---
## PROMPT P5-03 — Event consumers + digest job

Read CONVENTIONS + school-engagement message service.

- `POST /api/engagement/:tenantId/ingest` — the event inlet other services' HttpEventPublisher points at (set their EVENT_SINK_URL to this). Handle:
  - `school.attendance.marked_absent` with `explained:false` ⇒ queueMessage absence_alert, urgency interrupt, vars {student_name?, date, period_label?} — missing names allowed (vars passed through from event data; do not call identity).
  - `school.attendance.marked_absent` with `explained:true` ⇒ no message (test).
  - `school.nudge.send` ⇒ queueMessage attendance_nudge, urgency interrupt but EXEMPT from daily cap (nudge has its own term cap upstream) — implement as `cap_exempt` flag on queueMessage.
  - Unknown event types ⇒ 200, logged, dropped (never 4xx).
- Digest: `POST /api/engagement/:tenantId/digest/run {date}` — group queued digest messages per guardian into one rendered digest body (template `digest`, var `items[]` joined as lines), dispatch once per guardian, mark items sent. Idempotent per (guardian, date).
- Escalation timer surface: `GET /api/engagement/:tenantId/pending-escalation?minutes=90` — absence_alert messages sent ≥N min ago with no linked reported-absence acknowledgment (`POST .../messages/:id/ack` writes ack) — the office IVR/callback worklist.

Tests: each event path; unknown event; cap exemption; digest grouping + idempotency; ack + escalation list; tenant isolation.

---
## PROMPT P5-04 — Two-way threads

Read CONVENTIONS + school-engagement all src.

`migrations/003_threads.sql`:
- `threads`: id, tenant_id, guardian_ref, student_ref, subject, state (`open|waiting_school|waiting_guardian|closed`), assigned_to NULL, created_at, updated_at
- `thread_messages`: id, tenant_id, thread_id, direction (`guardian|school`), body, lang_original NULL, body_translated NULL, translated_flag INTEGER DEFAULT 0, author, at

Routes: create thread (guardian side); reply both directions (state flips waiting_* accordingly; closed thread reply → reopens as open, test); assign; close; list with filters + unanswered-age sort; SLA view `GET .../threads/overdue?hours=24` (waiting_school older than N). Translation fields are storage-only here (`body_translated`, `translated_flag`) — actual MT arrives via the platform LLM service later; when body_translated is set, translated_flag must be 1 (enforce).

Tests: state flips; reopen-on-reply; SLA list; translated_flag rule; tenant isolation.
