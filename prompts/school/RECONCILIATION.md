# Capture platform vs school-* services — reconciliation

Short note for running `prompts/school/` against the repo as of 2026-08-15.

## Two stacks, two jobs

| Stack | Packages | Owns | Role |
|-------|----------|------|------|
| **Capture modality** (shipped earlier) | `services/capture`, `consent`, `school-attendance` (thin), `transport`; `apps/blokhr-capture` | Template/UID match, session-token modality gating, roll-call accelerator, bus RFID match | Cross-vertical **device capture** (HR + School hardware) |
| **School vertical** (prompt pack) | `services/school-*` per CONVENTIONS | Identity, timetable, full attendance domain, academics, assessment, engagement, fees, transport ops, compliance | Sellable **BlokHR School** product bounded contexts |

They must **not** share databases or import each other’s `src/`. Cross-talk is HTTP + events only.

## Naming collision: `school-attendance`

- **Existing** `@blokhr/school-attendance`: minimal classes/periods/marks + capture accelerator. Mounted under `/api/school-attendance`.
- **Prompt pack** P2 will scaffold a **new** domain-shaped attendance service (codes, excuses, period instances, NFC/QR **hashes**, 75% rule, nudge) on tenant paths `/api/attendance/:tenantId/...`, port 3013.

**Rule going forward:** P2 **owns** school day attendance product semantics. Treat the existing package as a **legacy/capture-accelerator** until a dedicated rename or merge prompt. Do **not** grow new school product logic in the thin package. When P2 lands, either:

1. Rename thin package → e.g. `school-attendance-lite` / fold marks into capture consumers, or  
2. Replace its API with a facade that calls school-* HTTP.

Do not dual-write indefinitely.

## Consent collision

- **Capture** `@blokhr/consent`: biometric/modality `consent_ref` for template enrol (`fingerprint|face|iris|…`).
- **School P0** consent: student artefact kinds (`apaar|dpdp_processing|biometric|photo|transport_gps`) under school-identity (or follow-on).

**Rule:** Capture consent stays for **device template enrol**. School consent owns **guardian/legal artefacts**. A future school `biometric` kind may **reference** a capture `consent_ref` / artefact storage id — never duplicate raw templates into school DB.

## Biometrics policy tension

- Capture plan (user override): gated `capture_fingerprint_students` + DPIA + guardian.
- School pack CONVENTIONS: “No student biometric capture” in school-* prompts; entitlements gate `school_biometrics` (never in defaults).

**Rule while executing the pack:**

- Do **not** add student biometric capture into `services/school-*` prompts.
- Keep capture FP/face behind capture module IDs + `school_biometrics` (or capture module intersection) at the **gateway / capture session-token** only.
- P0-01 adds `GATED_MODULES = ['school_biometrics']` — school trial must **deny** it. Enabling hardware biometrics for a school tenant is an explicit premium entitlement, implemented in capture — not in P2 NFC/QR hash capture.

## Transport

- Capture `transport` + `bus_rfid` modality = match + GPS context events.
- School P7 `school-transport` = fleet, routes, boarding product, telemetry/ETA.

School-transport **publishes/consumes** boarding intents; capture may verify RFID binding. No shared tables.

## Frontend

- Existing `school_register` / `capture_admin` = capture + thin roll call.
- Pack `F-frontend` = school shell via `api.school(...)` → `/svc/school-*`. Prefer pack modules for product UX; keep capture_admin for device/template ops.

## Entitlements

- Keep existing HR + `CAPTURE_MODULE_IDS`.
- P0-01 adds school module sets + `vertical: 'hr' | 'school'`. School trial does **not** get HR `attendance` or `school_biometrics` by default.

## Execution order (amended 2026-08-15 after codebase review)

1. This note (done).
2. **P0 ✅ and P1 ✅ are already executed** — school-identity (migrations 001–004, state packs, UDISE validator) and school-timetable (migrations 001–005, instance generator, cover) exist on disk. Verify green (`npx vitest run` in each) before continuing; do not re-run their prompts.
3. **`git init` at the repo root before anything else.** Still missing; every rename/refactor below is unrecoverable without it.
4. **W-wizard-vertical.md** (new) — setup step 0, vertical on the entitlement (not a tenants column), BlokSchool brand, terminology. Needs only P0-01.
5. **G-gateway.md** (new) — one-port gateway with the `/svc/<name>` mapping F-01 assumes. Must merge before F-01.
6. **P2-00 (new, inside P2-attendance.md) renames the thin package to `capture-rollcall` BEFORE P2-01** — the original "defer rename until after P2-01 is green" was impossible: P2-01 scaffolds into a folder the thin service already occupies, and its migration runner would collide with the existing `001_school_attendance.sql`. Rename first, scaffold second.
7. Then P2-01 → P8 in file order; F after G and its service dependencies.

## Vertical (amended)
Source of truth = `Entitlement.vertical` (P0-01, shipped). The monolith keeps a write-once read copy in `settings_json.vertical` and exposes it on `/api/setup/status` and the session payload (W-01). There is deliberately **no `tenants.vertical` column** — do not add one.

## Locked packaging decisions (2026-08-15)
- Library = distinct `school_library` moduleId — prompts in `P10-library.md` (`services/school-library`, port 3020). Issuance stays generic (HR/assets untouched).
- HPC peer/parent capture lives in **school-assessment (P4-04) + F-06**, not the platform `surveys` module — surveys reuse would require cross-service coupling the conventions forbid. Platform surveys stay available to school tenants for feedback forms only.
- Staff attendance for school tenants is **native in school-attendance (P2-05)**, not HR-module reuse.
- Teacher leave (2026-08-15): **thin native leave flow in school-attendance (P2-09)** — types/balances/requests/approval with write-through to `staff_attendance`. The monolith `leaves` domain and its accrual engine stay HR-only.
- Guardian auth (2026-08-15): deferred past P5 but committed — **P9-guardian-auth.md**. Opaque sessions owned by school-identity, gateway introspection + hard allowlist, guardian identity always header-forced server-side, parent portal as a separate minimal entry at `/guardian`.
