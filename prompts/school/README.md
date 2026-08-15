# BlokHR School — Cursor Prompt Pack

Execution playbook for building the school vertical. Source plan: `BLOKHR-SCHOOL-PLAN.md` (project doc).

## How to use

1. **One prompt = one Cursor session.** Never paste two prompts at once. Never say "continue with the next phase".
2. Run prompts **in file order, block order** (P0-01 → P0-02 → …). Later prompts assume earlier ones are merged and green.
3. Every prompt starts by telling Cursor to read `prompts/school/00-CONVENTIONS.md` and named existing files. Do not skip that line — it is what stops hallucinated APIs.
4. After each prompt, run the **Definition of Done** commands yourself before starting the next prompt. If red, fix in the same session with a short follow-up ("test X fails with Y, fix it"), not a new feature prompt.
5. If Cursor invents an endpoint, table, or helper that a prompt did not name → reject the diff and re-run the single prompt. Do not patch hallucinations forward.

## Hard rules (repeated in every prompt; also enforced by .cursor/rules)

- All school code lives in `services/school-*` packages. **Never** add routes/services/repositories to `backend/src/*`.
- Each service owns its own `migrations/`. No cross-service DB access, no imports from another service's `src/`.
- Cross-service communication: HTTP + the `EventPublisher` interface (defined in P0-02). Never direct DB reads.
- Tenant-scoped paths: `/api/<domain>/:tenantId/...` (same shape as entitlements).
- Students/guardians are `school-identity` data. Never rows in the monolith `members` table.
- No localStorage in frontend modules except `shared/session.js`. No raw fetch. CSS variables only.
- No student biometrics, no emotion/engagement detection, no Aadhaar authentication — anywhere, in any prompt.

## Order

Read `RECONCILIATION.md` once before P0-01 (capture vs school-* boundaries). Then:

| File | Prompts | Builds | Status |
|---|---|---|---|
| P0-platform-identity.md | 8 | entitlements modules, service scaffold pattern, school-identity, consent, UDISE enums, state packs | ✅ done (migrations 001–004 + state packs + UDISE validator on disk) |
| P1-timetable.md | 5 | school-timetable | ✅ done (migrations 001–005 + instance-generator on disk) |
| **W-wizard-vertical.md** | 5 | setup-wizard step 0 (Company/School), vertical plumbing via entitlements, BlokSchool brand assets + preset, terminology section + labels.js | ⬜ next |
| **G-gateway.md** | 3 | `services/gateway` — one port, `/svc/<name>` proxy, static frontend, SSE passthrough, `dev:school` script | ⬜ after W (must precede F-01) |
| P2-attendance.md | 10 (P2-00 rename first) | rename thin capture package → `capture-rollcall`, then real school-attendance + nudge + native staff leave (P2-09) | ⬜ |
| P3-academics.md | 7 | school-academics + variance |
| P4-assessment.md | 6 | school-assessment + HPC store |
| P5-engagement.md | 4 | school-engagement |
| P6-fees.md | 3 | school-fees |
| P7-transport.md | 3 | school-transport |
| P8-compliance.md | 4 | school-compliance (UDISE export, APAAR, OASIS/LOC calendars) |
| **P9-guardian-auth.md** | 4 | guardian credentials + sessions (school-identity), gateway guardian guard + allowlist, guardian-scoped service endpoints, parent portal frontend | ⬜ after P5 + G |
| F-frontend.md | 6 | frontend modules for the school shell |

Roughly 68 sessions. Do not reorder phases: P1 needs P0 identity; W needs P0-01; G needs nothing but must precede F-01; P2-00 must precede P2-01; P2 needs P1 period instances; P3 needs P2 period-level attendance; P4 needs P3 outcome tags; P9 needs P5 (threads) + G (gateway) and must precede any parent-facing release.

## Standing gaps (tracked, not yet prompted)
- **school-operations / library** — no prompt file yet. Locked decision: library is a distinct `school_library` moduleId (catalogue/ISBN/fines), assets-style issuance stays generic.

## Resolved (2026-08-15)
- Git initialised at root — baseline commit `3091c37` on `main`. Commit after every green prompt session.
- Teacher leave → **P2-09** (thin, native in school-attendance; monolith `leaves` untouched).
- Guardian login → **P9** (deferred past P5 by design, prompts ready).
