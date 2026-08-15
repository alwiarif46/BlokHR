# P7 — school-transport

**Legal scope for this phase:** GPS is for vehicles only — never person-tracking on campus. Boarding events reference students; location belongs to the bus.

---
## PROMPT P7-01 — Scaffold + routes/vehicles

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern.

Create `services/school-transport/`: `@blokhr/school-transport`, env `SCHOOL_TRANSPORT_DB_PATH`, port 3018. `migrations/001_fleet.sql`:
- `vehicles`: id, tenant_id, registration, capacity, ais140_device_id NULL, gps_provider NULL, insurance_expiry, fitness_expiry, active INTEGER
- `routes`: id, tenant_id, label, vehicle_id, attendant_name NULL, active INTEGER
- `stops`: id, tenant_id, route_id, sequence, label, lat REAL, lng REAL, pickup_time, drop_time
- `route_students`: route_id, stop_id, student_ref, tenant_id. PK (route_id, student_ref).

Routes: CRUD all; stop resequencing; assign/unassign students (capacity check vs vehicle → 409 over capacity); expiry report `GET /api/transport/:tenantId/expiries?within_days=30` (insurance/fitness). Tests: CRUD, capacity guard, resequence, expiry window, tenant isolation.

---
## PROMPT P7-02 — Boarding events + notifications

Read CONVENTIONS + school-transport migration 001, and the capture-binding hash pattern in `services/school-attendance/src` (mirror the pattern; do not import).

`migrations/002_boarding.sql`:
- `transport_bindings`: id, tenant_id, student_ref, payload_hash, is_active, created_at (same hash-only rule: raw card value never stored)
- `boarding_events`: id, tenant_id, route_id, vehicle_id, student_ref NULL, direction (`board|alight`), leg (`pickup|drop`), at, lat REAL NULL, lng REAL NULL, source (`rfid|manual`), device_id NULL

- `POST /api/transport/:tenantId/boarding` `{payload_b64|student_ref, direction, leg, route_id, at, lat?, lng?, device_id, idempotency_key}` — resolve binding; emit `school.transport.boarded|alighted {student_ref, route, stop_hint, at}` (engagement renders guardian notification); no-match → 200 recorded unmatched.
- Sequence rule: `alight` without a prior same-leg `board` for that student that day ⇒ record + emit `school.transport.anomaly {kind:"alight_without_board"}`.
- Missed-boarding sweep: `POST /api/transport/:tenantId/sweep-missed {route_id, leg, date}` — assigned students with no board event ⇒ emit `school.transport.missed_boarding` per student (idempotent per day; table `sweep_log` in same migration).
- `GET /api/transport/:tenantId/routes/:id/manifest?date=` — per student: boarded/alighted/missed per leg.

Tests: bind+capture; events emitted with correct types; anomaly; sweep idempotency; manifest states; raw-payload-never-stored assertion; tenant isolation.

---
## PROMPT P7-03 — Vehicle telemetry + ETA

Read CONVENTIONS + school-transport all src.

`migrations/003_telemetry.sql`: `vehicle_pings`: id, tenant_id, vehicle_id, lat, lng, speed_kmh REAL NULL, at. Index (tenant_id, vehicle_id, at).

- `POST /api/transport/:tenantId/pings` bulk `[{vehicle_id, lat, lng, speed_kmh?, at}]` — AIS-140 backend webhook shape; validate lat/lng ranges; reject batches > 500 (400).
- Retention: pings older than 30 days deleted by `POST /api/transport/:tenantId/pings/prune` (data minimisation — location is sensitive; note in code comment).
- `GET /api/transport/:tenantId/vehicles/:id/last-known` → latest ping + staleness seconds.
- ETA: `GET /api/transport/:tenantId/routes/:id/eta?stop_id=` — haversine distance from last ping to stop ÷ max(avg speed of last 5 pings, 15 km/h) ⇒ minutes; stale ping (>10 min) ⇒ `{eta: null, stale: true}`. Pure `haversineKm` + `computeEta` functions, table-driven tests with hand-computed distances.
- Delay events: `POST .../routes/:id/check-delay {leg}` — ETA to next stop > scheduled time +15 min ⇒ emit `school.transport.delayed {route_id, minutes_late}` once per leg per day.

Tests: ping validation + batch cap; prune; last-known staleness; haversine/ETA math; stale ETA; delay once-per-day; tenant isolation.
