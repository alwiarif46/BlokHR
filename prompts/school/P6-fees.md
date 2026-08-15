# P6 — school-fees

**Global rule for this phase:** all money is integer paise. This service handles the SCHOOL's fee collection from parents/government. It must not import from or resemble `services/billing` (that is BlokHR's own SaaS billing — different money flow).

---
## PROMPT P6-01 — Scaffold + fee structures

Read `prompts/school/00-CONVENTIONS.md` + references. Copy events.ts pattern.

Create `services/school-fees/`: `@blokhr/school-fees`, env `SCHOOL_FEES_DB_PATH`, port 3017. `migrations/001_structures.sql`:
- `fee_heads`: id, tenant_id, code, label, kind (`tuition|transport|lab|library|exam|admission|other`), taxable INTEGER DEFAULT 0
- `fee_structures`: id, tenant_id, academic_session_ref, class_label, label, lines_json (`[{fee_head_id, amount_paise, schedule: annual|term|monthly}]`), active INTEGER DEFAULT 1
- `concessions`: id, tenant_id, code, label, kind (`pct|flat`), value INTEGER (pct 1–100 or paise), applies_to_heads_json NULL (NULL = all)

Routes: CRUD all three. Validation: amounts > 0; pct 1–100; structure lines reference existing heads; head code unique per tenant. Tests: CRUD, validations, tenant isolation.

---
## PROMPT P6-02 — Invoicing + RTE payer type

Read CONVENTIONS + school-fees migration 001.

`migrations/002_invoices.sql`:
- `student_fee_assignments`: id, tenant_id, student_ref, fee_structure_id, payer (`guardian|government_rte`) NOT NULL DEFAULT 'guardian', concession_ids_json, created_at
- `invoices`: id, tenant_id, student_ref, payer, period_label, lines_json (resolved: head, gross_paise, concession_paise, net_paise), total_paise, status (`draft|issued|part_paid|paid|cancelled`), due_on, issued_at NULL, created_at
- `rte_claims`: id, tenant_id, state_code, period_label, invoice_ids_json, total_paise, status (`draft|submitted|received|rejected`), submitted_at NULL, reference NULL

Rules:
- `POST /api/fees/:tenantId/assignments` — assign structure to student; RTE students (`payer: government_rte`) never receive guardian invoices.
- `POST /api/fees/:tenantId/invoices/generate {academic_session_ref, period_label, class_label?}` — one invoice per assigned student for that period per the structure schedule; concession math (pct on applicable heads, then flat, floor at 0); idempotent per (student, period); guardian-payer invoices emit `school.fee.invoice_issued` (engagement turns this into reminders); government_rte invoices instead aggregate into/create the period's draft `rte_claim`.
- RTE claim lifecycle: draft→submitted→received|rejected; received requires reference; rejected reopens invoices to `issued`.

Tests: generation idempotency; concession math incl. floor; RTE segregation (no guardian event, claim aggregation totals); claim lifecycle; tenant isolation.

---
## PROMPT P6-03 — Payments + UTR reconciliation

Read CONVENTIONS + school-fees invoices service.

`migrations/003_payments.sql`: `payments`: id, tenant_id, invoice_id, amount_paise, method (`upi_direct|gateway|cash|cheque|bank_transfer`), utr TEXT NULL, gateway_ref NULL, received_on, recorded_by, status (`recorded|verified|bounced`), created_at. Unique (tenant_id, utr) where utr not null.

- `POST /api/fees/:tenantId/payments` — amount ≤ outstanding (400 over); invoice status auto: part_paid/paid; `upi_direct|bank_transfer` require UTR (400); duplicate UTR → 409.
- `POST /api/fees/:tenantId/payments/reconcile` — bulk `{rows:[{utr, amount_paise, date}]}` (bank statement import): match by UTR → mark `verified`; unmatched rows returned as `unmatched[]`; amount mismatch → `mismatched[]` with both values (no auto-correct).
- Cheque bounce: `POST .../payments/:id/bounce` — status bounced, invoice recomputed, emits `school.fee.payment_bounced`.
- `GET /api/fees/:tenantId/outstanding?class=&min_days_overdue=` — dues list with ageing buckets (0–30/31–60/61+); `GET .../students/:ref/ledger` — full statement.

Tests: overpay guard; UTR rules; reconcile match/unmatch/mismatch; bounce recompute; ageing math; ledger ordering; tenant isolation.
