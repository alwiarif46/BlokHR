# W — Vertical choice, BlokSchool brand, terminology

> Locked product decisions (2026-08-15): vertical-per-tenant chosen at setup step 0, immutable; full BlokSchool brand (name, wordmark, favicon, colour preset); terminology tenant-configurable with vertical defaults.
> Vertical's **source of truth is the entitlement record** (`vertical` field, shipped in P0-01) — there is NO `tenants.vertical` column and none must be added. The monolith persists a read-optimised copy in `settings_json` and puts it on the session.
> Prompts here explicitly name `backend/src` files — that is allowed per CONVENTIONS ("unless the prompt explicitly names a file there"). Setup, session, settings and branding are platform concerns, not school domain code. No school domain logic may be added to the monolith in these prompts.

Run order: W-01 → W-02 → W-03 → W-04 → W-05. Requires P0-01 merged (it is).

---
## PROMPT W-01 — Vertical plumbing (setup → entitlements → session)

Read `prompts/school/00-CONVENTIONS.md`, `services/entitlements/src/types.ts` (the `EntitlementVertical` + `DEFAULT_SCHOOL_MODULES` contract and `startCloudTrial(vertical)` from P0-01), `backend/src/services/setup.service.ts` (or the file registering `/api/setup/step3` — locate it via `backend/src/routes/index.ts`), the session-payload builder used at login, and `backend/src/services/tenant-settings-service.ts`.

In `backend/` only (explicitly permitted files: setup routes/service, auth/session service, tenant-settings service, one test file each):
1. `POST /api/setup/step3` body gains optional `vertical: 'hr'|'school'` (default `'hr'`, 400 on any other value). Pass it through to the entitlements trial start (`startCloudTrial`) for cloud deployments. For `self_hosted`, persist the value but do not touch the license path.
2. Persist the chosen vertical into `settings_json` under a new root key `vertical` via the tenant-settings service (write-once: if already present and different → 409 `{error:"vertical_immutable"}`; same value → no-op 200).
3. `GET /api/setup/status` response gains `vertical` (null until set).
4. Login/session payload gains `vertical` (read from settings_json; default `'hr'` when absent — every existing tenant is hr).
5. Vertical-aware settings seed: when `vertical='school'` is set at step3, merge school defaults into `settings_json`: `terminology` key set to school defaults (see W-04 table) and `dataRetention` tightened school defaults (attendance photo/geo retention halved from HR defaults — read current defaults and halve, do not hardcode magic numbers twice).

Tests (extend existing setup + session integration tests): step3 with school vertical → entitlement has `vertical:'school'` and DEFAULT_SCHOOL_MODULES; hr default unchanged (regression); immutability 409; status + session expose vertical; school seed contains school terminology. DoD: `npx tsc --noEmit` + full `npx vitest run` green in `backend/`.

---
## PROMPT W-02 — Setup wizard step 0 (Company / School)

Read `frontend/modules/setup_wizard/setup_wizard.js`, `setup_wizard.html`, `setup_wizard.css`, `frontend/shared/modal.js`, `frontend/shared/toast.js`, `docs/INSTRUCTIONS.md` frontend rules.

The wizard is currently 3 steps (Branding → Auth → License/Plan). Make it 4: **Vertical → Branding → Auth → License/Plan**.
1. `setup_wizard.html`: new panel `wzP0` before `wzP1`: heading "What are you setting up?", two large selectable cards — `Company` ("Employee attendance, leave, timesheets, HR operations") and `School` ("Student attendance, timetable, syllabus tracking, guardian updates") — plus a warning line: "This choice is permanent for this workspace and cannot be changed later." Add a 4th step indicator node + label ("Type") and a 3rd connector line; renumber existing indicator wiring.
2. `setup_wizard.js`: card select toggles a `selected` class and enables `wzBtn0`; clicking Continue opens a confirm dialog via `shared/modal.js` ("You chose {label}. This cannot be changed later. Continue?"); on confirm store `_vertical` in module state and `wzGoTo(2)`-equivalent (adjust internal numbering — keep panel ids stable, shift `_step` logic). The final step's submit body gains `vertical: _vertical`. If `GET /api/setup/status` already returns a vertical (resumed setup), skip step 0 and lock the choice.
3. School selection immediately applies the BlokSchool accent (`wzApplyAccent`) as a preview; Company keeps the current default.
4. `setup_wizard.css`: card styles with CSS custom properties only — zero new hex literals (reuse `--wz-*` vars).
5. Mock mode (`wzMockApi`) handles the extra field.

Tests: `frontend/tests/integration/setup_wizard.test.js` (create if absent, following `docs/blokhr-frontend-architecture.md` §13): step-0 renders first; Continue disabled until selection; confirm dialog gates advance; vertical included in final submit body; resumed-setup skip. DoD: tests green; `grep -n "localStorage" frontend/modules/setup_wizard/` returns nothing; no raw `fetch()` added outside the existing `wzApi` helper.

---
## PROMPT W-03 — Brand assets + brand.js + shell application

Read `frontend/shell.html` (boot sequence + header markup), `frontend/shared/themes.js`, `frontend/shared/session.js`, `frontend/shared/shared.css` (colour-scheme preset mechanism), `backend/migrations/041_colour_scheme_presets.sql`.

1. Create `frontend/assets/brand/`: `blokhr-wordmark.svg`, `blokschool-wordmark.svg`, `blokhr-favicon.svg`, `blokschool-favicon.svg`. Simple, legible, original marks; use `currentColor` for text portions; each file < 4 KB.
2. Create `frontend/shared/brand.js`: pure `getBrand(vertical)` → `{name, wordmarkPath, faviconPath, tagline, loginHeading, colourPresetKey}` (`blokhr` / `blokschool`), and `applyBrand(vertical)` which sets `document.title`, swaps the favicon `<link>`, and swaps the header wordmark img/element. No other DOM writes, no storage, no fetch.
3. `shell.html` boot: after session (or setup status) resolves, call `applyBrand(vertical || 'hr')` before showing any screen. Pre-tenant screens (setup step 0, login before any vertical exists) use neutral copy — remove hardcoded "BlokHR" strings from shell markup and drive them from `brand.js` (grep and replace every occurrence).
4. New backend migration `backend/migrations/045_blokschool_preset.sql` (explicitly permitted): insert a `blokschool` row into the colour-scheme presets table seeded by migration 041, following its exact column shape and value conventions. Both SQLite and Postgres compatible per `backend/src/db/engine.ts` conventions.
5. `frontend/shared/themes.js`: the preset list is data-driven from the server — verify the new preset flows through without a code change; if presets are hardcoded client-side, add `blokschool` there using CSS custom properties only.

Tests: unit test for `getBrand` both verticals; integration test asserting title/favicon/wordmark swap for a stubbed school session; migration 045 applies on fresh DB (backend test). DoD: `grep -rn "BlokHR" frontend/shell.html` returns nothing outside comments; backend + frontend suites green.

---
## PROMPT W-04 — Terminology settings section (server)

Read `backend/src/services/tenant-settings-service.ts`, `backend/src/repositories/tenant-settings-repository.ts`, the 36-section seed, `tests/integration/tenant-settings.test.ts`.

Add settings section #37 `terminology` to the seed and validation:
- Keys: `person`, `person_plural`, `group`, `subgroup`, `interval`, `supervisor`. All non-empty strings ≤ 30 chars.
- HR defaults: Employee / Employees / Department / Team / Shift / Manager. School defaults: Student / Students / Class / Section / Period / Class Teacher.
- Seeded by vertical (W-01 already merges school defaults at step3 — this prompt makes the section a first-class validated section with HR defaults in the base seed, admin-only like all sections, included in the SSE `settings-update` broadcast; three-tier resolution does not apply here — terminology is tenant-level only, document that in a code comment).

Tests: seed contains section 37 with HR defaults; POST validation (empty / over-length rejected); non-admin 403 (regression pattern); SSE broadcast fires. DoD: backend suite green, `npx tsc --noEmit` clean.

---
## PROMPT W-05 — labels.js + Terminology settings UI

Read `frontend/shared/prefs.js` (settings-snapshot access pattern), `frontend/shared/sse.js`, `frontend/modules/settings/settings.js` + `.html` (section pattern), W-04's section shape.

1. Create `frontend/shared/labels.js`: `initLabels(settingsSnapshot, vertical)`, `t(key)` with three-level fallback — tenant `terminology` section → vertical defaults (same tables as W-04) → the key itself. Subscribe to the SSE `settings-update` event and refresh the internal map; expose `onLabelsChanged(cb)` so the router can re-render the current view. No DOM access inside `labels.js`.
2. `frontend/modules/settings/`: add the Terminology section UI following the existing collapsible-section pattern exactly — 6 labelled text inputs, save via the existing settings POST path, admin-only visibility like every section.
3. Wire `shell.html` boot to call `initLabels` after settings/prefs load. Do NOT retrofit existing modules to use `t()` in this prompt — new school modules will consume it (F pack); note this in a code comment at the top of `labels.js`.

Tests: `frontend/tests/unit/labels.test.js` — three fallback levels; SSE refresh updates `t()` output; `frontend/tests/integration/settings_terminology.test.js` — section renders, saves, validation errors surface via toast. DoD: suites green; zero localStorage; zero raw fetch.
