import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { FeesRepository } from '../repositories/fees-repository';
import type {
  AgeingBucket,
  Invoice,
  InvoiceStatus,
  LedgerEntry,
  OutstandingRow,
  Payment,
  PaymentMethod,
} from '../types';

type ServiceError = { error: string; status: number };

const METHODS = new Set<PaymentMethod>([
  'upi_direct',
  'gateway',
  'cash',
  'cheque',
  'bank_transfer',
]);

const UTR_REQUIRED = new Set<PaymentMethod>(['upi_direct', 'bank_transfer']);

export function ageingBucket(daysOverdue: number): AgeingBucket {
  if (daysOverdue <= 30) return '0-30';
  if (daysOverdue <= 60) return '31-60';
  return '61+';
}

export function daysBetween(fromIsoDate: string, to: Date): number {
  const due = Date.parse(`${fromIsoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(due)) return 0;
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.floor((end - due) / 86_400_000));
}

export class PaymentService {
  constructor(
    private readonly repo: FeesRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async recordPayment(
    tenantId: string,
    input: {
      invoiceId: string;
      amountPaise: number;
      method: PaymentMethod;
      utr?: string | null;
      gatewayRef?: string | null;
      receivedOn?: string;
      recordedBy: string;
    },
  ): Promise<{ payment?: Payment; invoice?: Invoice; error?: ServiceError }> {
    const invoiceId = (input.invoiceId || '').trim();
    if (!invoiceId) return { error: { error: 'invoice_id is required', status: 400 } };
    if (!METHODS.has(input.method)) {
      return { error: { error: 'invalid payment method', status: 400 } };
    }
    const amountPaise = Number(input.amountPaise);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return { error: { error: 'amount_paise must be an integer > 0', status: 400 } };
    }
    const recordedBy = (input.recordedBy || '').trim();
    if (!recordedBy) return { error: { error: 'recorded_by is required', status: 400 } };

    let utr =
      input.utr === undefined || input.utr === null
        ? null
        : String(input.utr).trim() || null;
    if (UTR_REQUIRED.has(input.method) && !utr) {
      return { error: { error: 'utr is required for this method', status: 400 } };
    }

    const invoice = await this.repo.getInvoice(tenantId, invoiceId);
    if (!invoice) return { error: { error: 'invoice not found', status: 404 } };
    if (invoice.status === 'cancelled') {
      return { error: { error: 'cannot pay a cancelled invoice', status: 400 } };
    }

    const paid = await this.repo.sumActivePayments(tenantId, invoiceId);
    const outstanding = invoice.totalPaise - paid;
    if (amountPaise > outstanding) {
      return { error: { error: 'amount exceeds outstanding balance', status: 400 } };
    }

    if (utr) {
      const dup = await this.repo.getPaymentByUtr(tenantId, utr);
      if (dup) return { error: { error: 'duplicate utr', status: 409 } };
    }

    const now = this.clock().toISOString();
    const payment = await this.repo.insertPayment({
      id: uuidv4(),
      tenantId,
      invoiceId,
      amountPaise,
      method: input.method,
      utr,
      gatewayRef:
        input.gatewayRef === undefined || input.gatewayRef === null
          ? null
          : String(input.gatewayRef).trim() || null,
      receivedOn: (input.receivedOn || '').trim() || now.slice(0, 10),
      recordedBy,
      status: 'recorded',
      createdAt: now,
    });

    const updated = await this.recomputeInvoiceStatus(tenantId, invoiceId);
    return { payment, invoice: updated ?? invoice };
  }

  async reconcile(
    tenantId: string,
    rows: Array<{ utr: string; amountPaise: number; date?: string }>,
  ): Promise<{
    verified?: Payment[];
    unmatched?: Array<{ utr: string; amountPaise: number; date?: string }>;
    mismatched?: Array<{
      utr: string;
      statementPaise: number;
      paymentPaise: number;
      paymentId: string;
      date?: string;
    }>;
    error?: ServiceError;
  }> {
    if (!Array.isArray(rows)) {
      return { error: { error: 'rows must be an array', status: 400 } };
    }
    const verified: Payment[] = [];
    const unmatched: Array<{ utr: string; amountPaise: number; date?: string }> = [];
    const mismatched: Array<{
      utr: string;
      statementPaise: number;
      paymentPaise: number;
      paymentId: string;
      date?: string;
    }> = [];

    for (const row of rows) {
      const utr = String(row.utr ?? '').trim();
      const amountPaise = Number(row.amountPaise);
      if (!utr || !Number.isInteger(amountPaise)) continue;
      const payment = await this.repo.getPaymentByUtr(tenantId, utr);
      if (!payment) {
        unmatched.push({
          utr,
          amountPaise,
          date: row.date,
        });
        continue;
      }
      if (payment.amountPaise !== amountPaise) {
        mismatched.push({
          utr,
          statementPaise: amountPaise,
          paymentPaise: payment.amountPaise,
          paymentId: payment.id,
          date: row.date,
        });
        continue;
      }
      const updated = await this.repo.updatePaymentStatus(
        tenantId,
        payment.id,
        'verified',
      );
      if (updated) verified.push(updated);
    }

    return { verified, unmatched, mismatched };
  }

  async bouncePayment(
    tenantId: string,
    paymentId: string,
  ): Promise<{ payment?: Payment; invoice?: Invoice; error?: ServiceError }> {
    const payment = await this.repo.getPayment(tenantId, paymentId);
    if (!payment) return { error: { error: 'payment not found', status: 404 } };
    if (payment.status === 'bounced') {
      return { error: { error: 'payment already bounced', status: 400 } };
    }

    const bounced = await this.repo.updatePaymentStatus(
      tenantId,
      paymentId,
      'bounced',
    );
    if (!bounced) return { error: { error: 'payment not found', status: 404 } };

    const invoice = await this.recomputeInvoiceStatus(tenantId, payment.invoiceId);
    await this.events.publish({
      type: 'school.fee.payment_bounced',
      tenantId,
      occurredAt: this.clock().toISOString(),
      data: {
        payment_id: paymentId,
        invoice_id: payment.invoiceId,
        amount_paise: payment.amountPaise,
      },
    });

    return { payment: bounced, invoice: invoice ?? undefined };
  }

  async listOutstanding(
    tenantId: string,
    filters: { classLabel?: string; minDaysOverdue?: number },
  ): Promise<{ outstanding: OutstandingRow[] }> {
    const invoices = await this.repo.listInvoices(tenantId);
    const assignments = await this.repo.listAssignments(tenantId);
    const classByStudent = new Map<string, string>();
    for (const a of assignments) {
      const structure = await this.repo.getStructure(tenantId, a.feeStructureId);
      if (structure) classByStudent.set(a.studentRef, structure.classLabel);
    }

    const now = this.clock();
    const out: OutstandingRow[] = [];
    for (const inv of invoices) {
      if (inv.status === 'paid' || inv.status === 'cancelled') continue;
      const paidPaise = await this.repo.sumActivePayments(tenantId, inv.id);
      const outstandingPaise = inv.totalPaise - paidPaise;
      if (outstandingPaise <= 0) continue;

      const classLabel = classByStudent.get(inv.studentRef) ?? null;
      if (filters.classLabel && classLabel !== filters.classLabel) continue;

      const daysOverdue = daysBetween(inv.dueOn, now);
      if (
        filters.minDaysOverdue !== undefined &&
        daysOverdue < filters.minDaysOverdue
      ) {
        continue;
      }

      out.push({
        invoiceId: inv.id,
        studentRef: inv.studentRef,
        classLabel,
        periodLabel: inv.periodLabel,
        dueOn: inv.dueOn,
        totalPaise: inv.totalPaise,
        paidPaise,
        outstandingPaise,
        daysOverdue,
        ageingBucket: ageingBucket(daysOverdue),
      });
    }

    out.sort((a, b) => b.daysOverdue - a.daysOverdue || a.studentRef.localeCompare(b.studentRef));
    return { outstanding: out };
  }

  async studentLedger(
    tenantId: string,
    studentRef: string,
  ): Promise<{ entries?: LedgerEntry[]; error?: ServiceError }> {
    const ref = (studentRef || '').trim();
    if (!ref) return { error: { error: 'student_ref is required', status: 400 } };

    const invoices = await this.repo.listInvoicesForStudent(tenantId, ref);
    const payments = await this.repo.listPaymentsForStudent(tenantId, ref);

    const entries: LedgerEntry[] = [];
    for (const inv of invoices) {
      entries.push({
        kind: 'invoice',
        at: inv.issuedAt ?? inv.createdAt,
        invoiceId: inv.id,
        periodLabel: inv.periodLabel,
        amountPaise: inv.totalPaise,
        status: inv.status,
      });
    }
    for (const p of payments) {
      entries.push({
        kind: 'payment',
        at: p.receivedOn,
        paymentId: p.id,
        invoiceId: p.invoiceId,
        amountPaise: p.amountPaise,
        status: p.status,
        method: p.method,
        utr: p.utr,
      });
    }
    entries.sort((a, b) => a.at.localeCompare(b.at));
    return { entries };
  }

  private async recomputeInvoiceStatus(
    tenantId: string,
    invoiceId: string,
  ): Promise<Invoice | null> {
    const invoice = await this.repo.getInvoice(tenantId, invoiceId);
    if (!invoice || invoice.status === 'cancelled') return invoice;

    const paid = await this.repo.sumActivePayments(tenantId, invoiceId);
    let status: InvoiceStatus;
    if (paid <= 0) {
      status = 'issued';
    } else if (paid >= invoice.totalPaise) {
      status = 'paid';
    } else {
      status = 'part_paid';
    }
    return this.repo.updateInvoiceStatus(tenantId, invoiceId, status);
  }
}
