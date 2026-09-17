import type { SchoolFeesDb } from '../db';
import { currentFeesDb } from '../db-context';
import type {
  Concession,
  ConcessionKind,
  FeeHead,
  FeeHeadKind,
  FeePayer,
  FeeStructure,
  FeeStructureLine,
  Invoice,
  InvoiceLine,
  InvoiceStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  RteClaim,
  RteClaimStatus,
  StudentFeeAssignment,
} from '../types';

interface HeadRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  kind: string;
  taxable: number;
  created_at: string;
  updated_at: string;
}

interface StructureRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  academic_session_ref: string;
  class_label: string;
  label: string;
  lines_json: string;
  active: number;
  created_at: string;
  updated_at: string;
}

interface ConcessionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  kind: string;
  value: number;
  applies_to_heads_json: string | null;
  created_at: string;
  updated_at: string;
}

function mapHead(row: HeadRow): FeeHead {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    kind: row.kind as FeeHeadKind,
    taxable: row.taxable === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStructure(row: StructureRow): FeeStructure {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicSessionRef: row.academic_session_ref,
    classLabel: row.class_label,
    label: row.label,
    lines: JSON.parse(row.lines_json) as FeeStructureLine[],
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConcession(row: ConcessionRow): Concession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    kind: row.kind as ConcessionKind,
    value: row.value,
    appliesToHeads:
      row.applies_to_heads_json == null
        ? null
        : (JSON.parse(row.applies_to_heads_json) as string[]),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class FeesRepository {
  constructor(private readonly fallbackDb: SchoolFeesDb) {}

  private get db(): SchoolFeesDb {
    return currentFeesDb(this.fallbackDb);
  }

  async insertHead(h: FeeHead): Promise<FeeHead> {
    await this.db.run(
      `INSERT INTO fee_heads (id, tenant_id, code, label, kind, taxable, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        h.id,
        h.tenantId,
        h.code,
        h.label,
        h.kind,
        h.taxable ? 1 : 0,
        h.createdAt,
        h.updatedAt,
      ],
    );
    const created = await this.getHead(h.tenantId, h.id);
    if (!created) throw new Error('Failed to read inserted fee head');
    return created;
  }

  async getHead(tenantId: string, id: string): Promise<FeeHead | null> {
    const row = await this.db.get<HeadRow>(
      'SELECT * FROM fee_heads WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapHead(row) : null;
  }

  async getHeadByCode(tenantId: string, code: string): Promise<FeeHead | null> {
    const row = await this.db.get<HeadRow>(
      'SELECT * FROM fee_heads WHERE tenant_id = ? AND code = ?',
      [tenantId, code],
    );
    return row ? mapHead(row) : null;
  }

  async listHeads(tenantId: string): Promise<FeeHead[]> {
    const rows = await this.db.all<HeadRow>(
      'SELECT * FROM fee_heads WHERE tenant_id = ? ORDER BY code ASC',
      [tenantId],
    );
    return rows.map(mapHead);
  }

  async updateHead(h: FeeHead): Promise<FeeHead | null> {
    await this.db.run(
      `UPDATE fee_heads
       SET code = ?, label = ?, kind = ?, taxable = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [h.code, h.label, h.kind, h.taxable ? 1 : 0, h.updatedAt, h.tenantId, h.id],
    );
    return this.getHead(h.tenantId, h.id);
  }

  async deleteHead(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getHead(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM fee_heads WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async insertStructure(s: FeeStructure): Promise<FeeStructure> {
    await this.db.run(
      `INSERT INTO fee_structures (
         id, tenant_id, academic_session_ref, class_label, label, lines_json, active, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.tenantId,
        s.academicSessionRef,
        s.classLabel,
        s.label,
        JSON.stringify(s.lines),
        s.active ? 1 : 0,
        s.createdAt,
        s.updatedAt,
      ],
    );
    const created = await this.getStructure(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted fee structure');
    return created;
  }

  async getStructure(tenantId: string, id: string): Promise<FeeStructure | null> {
    const row = await this.db.get<StructureRow>(
      'SELECT * FROM fee_structures WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapStructure(row) : null;
  }

  async listStructures(tenantId: string): Promise<FeeStructure[]> {
    const rows = await this.db.all<StructureRow>(
      'SELECT * FROM fee_structures WHERE tenant_id = ? ORDER BY label ASC',
      [tenantId],
    );
    return rows.map(mapStructure);
  }

  async updateStructure(s: FeeStructure): Promise<FeeStructure | null> {
    await this.db.run(
      `UPDATE fee_structures
       SET academic_session_ref = ?, class_label = ?, label = ?, lines_json = ?, active = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        s.academicSessionRef,
        s.classLabel,
        s.label,
        JSON.stringify(s.lines),
        s.active ? 1 : 0,
        s.updatedAt,
        s.tenantId,
        s.id,
      ],
    );
    return this.getStructure(s.tenantId, s.id);
  }

  async deleteStructure(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getStructure(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM fee_structures WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async insertConcession(c: Concession): Promise<Concession> {
    await this.db.run(
      `INSERT INTO concessions (
         id, tenant_id, code, label, kind, value, applies_to_heads_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.tenantId,
        c.code,
        c.label,
        c.kind,
        c.value,
        c.appliesToHeads == null ? null : JSON.stringify(c.appliesToHeads),
        c.createdAt,
        c.updatedAt,
      ],
    );
    const created = await this.getConcession(c.tenantId, c.id);
    if (!created) throw new Error('Failed to read inserted concession');
    return created;
  }

  async getConcession(tenantId: string, id: string): Promise<Concession | null> {
    const row = await this.db.get<ConcessionRow>(
      'SELECT * FROM concessions WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapConcession(row) : null;
  }

  async getConcessionByCode(tenantId: string, code: string): Promise<Concession | null> {
    const row = await this.db.get<ConcessionRow>(
      'SELECT * FROM concessions WHERE tenant_id = ? AND code = ?',
      [tenantId, code],
    );
    return row ? mapConcession(row) : null;
  }

  async listConcessions(tenantId: string): Promise<Concession[]> {
    const rows = await this.db.all<ConcessionRow>(
      'SELECT * FROM concessions WHERE tenant_id = ? ORDER BY code ASC',
      [tenantId],
    );
    return rows.map(mapConcession);
  }

  async updateConcession(c: Concession): Promise<Concession | null> {
    await this.db.run(
      `UPDATE concessions
       SET code = ?, label = ?, kind = ?, value = ?, applies_to_heads_json = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        c.code,
        c.label,
        c.kind,
        c.value,
        c.appliesToHeads == null ? null : JSON.stringify(c.appliesToHeads),
        c.updatedAt,
        c.tenantId,
        c.id,
      ],
    );
    return this.getConcession(c.tenantId, c.id);
  }

  async deleteConcession(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getConcession(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM concessions WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async insertAssignment(a: StudentFeeAssignment): Promise<StudentFeeAssignment> {
    await this.db.run(
      `INSERT INTO student_fee_assignments (
         id, tenant_id, student_ref, fee_structure_id, payer, concession_ids_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.tenantId,
        a.studentRef,
        a.feeStructureId,
        a.payer,
        JSON.stringify(a.concessionIds),
        a.createdAt,
      ],
    );
    const created = await this.getAssignment(a.tenantId, a.id);
    if (!created) throw new Error('Failed to read inserted assignment');
    return created;
  }

  async getAssignment(tenantId: string, id: string): Promise<StudentFeeAssignment | null> {
    const row = await this.db.get<AssignmentRow>(
      'SELECT * FROM student_fee_assignments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapAssignment(row) : null;
  }

  async listAssignments(tenantId: string): Promise<StudentFeeAssignment[]> {
    const rows = await this.db.all<AssignmentRow>(
      'SELECT * FROM student_fee_assignments WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    );
    return rows.map(mapAssignment);
  }

  async listAssignmentsForGenerate(
    tenantId: string,
    academicSessionRef: string,
    classLabel?: string,
  ): Promise<Array<{ assignment: StudentFeeAssignment; structure: FeeStructure }>> {
    const assignments = await this.listAssignments(tenantId);
    const out: Array<{ assignment: StudentFeeAssignment; structure: FeeStructure }> = [];
    for (const assignment of assignments) {
      const structure = await this.getStructure(tenantId, assignment.feeStructureId);
      if (!structure || !structure.active) continue;
      if (structure.academicSessionRef !== academicSessionRef) continue;
      if (classLabel && structure.classLabel !== classLabel) continue;
      out.push({ assignment, structure });
    }
    return out;
  }

  async insertInvoice(inv: Invoice): Promise<Invoice> {
    await this.db.run(
      `INSERT INTO invoices (
         id, tenant_id, student_ref, payer, period_label, lines_json,
         total_paise, status, due_on, issued_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inv.id,
        inv.tenantId,
        inv.studentRef,
        inv.payer,
        inv.periodLabel,
        JSON.stringify(inv.lines),
        inv.totalPaise,
        inv.status,
        inv.dueOn,
        inv.issuedAt,
        inv.createdAt,
      ],
    );
    const created = await this.getInvoice(inv.tenantId, inv.id);
    if (!created) throw new Error('Failed to read inserted invoice');
    return created;
  }

  async getInvoice(tenantId: string, id: string): Promise<Invoice | null> {
    const row = await this.db.get<InvoiceRow>(
      'SELECT * FROM invoices WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapInvoice(row) : null;
  }

  async getInvoiceByStudentPeriod(
    tenantId: string,
    studentRef: string,
    periodLabel: string,
  ): Promise<Invoice | null> {
    const row = await this.db.get<InvoiceRow>(
      `SELECT * FROM invoices
       WHERE tenant_id = ? AND student_ref = ? AND period_label = ?`,
      [tenantId, studentRef, periodLabel],
    );
    return row ? mapInvoice(row) : null;
  }

  async listInvoices(tenantId: string): Promise<Invoice[]> {
    const rows = await this.db.all<InvoiceRow>(
      'SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    );
    return rows.map(mapInvoice);
  }

  async updateInvoiceStatus(
    tenantId: string,
    id: string,
    status: InvoiceStatus,
  ): Promise<Invoice | null> {
    await this.db.run(
      'UPDATE invoices SET status = ? WHERE tenant_id = ? AND id = ?',
      [status, tenantId, id],
    );
    return this.getInvoice(tenantId, id);
  }

  async insertRteClaim(c: RteClaim): Promise<RteClaim> {
    await this.db.run(
      `INSERT INTO rte_claims (
         id, tenant_id, state_code, period_label, invoice_ids_json, total_paise,
         status, submitted_at, reference, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.tenantId,
        c.stateCode,
        c.periodLabel,
        JSON.stringify(c.invoiceIds),
        c.totalPaise,
        c.status,
        c.submittedAt,
        c.reference,
        c.createdAt,
      ],
    );
    const created = await this.getRteClaim(c.tenantId, c.id);
    if (!created) throw new Error('Failed to read inserted rte claim');
    return created;
  }

  async getRteClaim(tenantId: string, id: string): Promise<RteClaim | null> {
    const row = await this.db.get<RteClaimRow>(
      'SELECT * FROM rte_claims WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapRteClaim(row) : null;
  }

  async getDraftRteClaim(
    tenantId: string,
    periodLabel: string,
    stateCode: string,
  ): Promise<RteClaim | null> {
    const row = await this.db.get<RteClaimRow>(
      `SELECT * FROM rte_claims
       WHERE tenant_id = ? AND period_label = ? AND state_code = ?`,
      [tenantId, periodLabel, stateCode],
    );
    return row ? mapRteClaim(row) : null;
  }

  async updateRteClaim(c: RteClaim): Promise<RteClaim | null> {
    await this.db.run(
      `UPDATE rte_claims
       SET invoice_ids_json = ?, total_paise = ?, status = ?, submitted_at = ?, reference = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        JSON.stringify(c.invoiceIds),
        c.totalPaise,
        c.status,
        c.submittedAt,
        c.reference,
        c.tenantId,
        c.id,
      ],
    );
    return this.getRteClaim(c.tenantId, c.id);
  }

  async listRteClaims(tenantId: string): Promise<RteClaim[]> {
    const rows = await this.db.all<RteClaimRow>(
      'SELECT * FROM rte_claims WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    );
    return rows.map(mapRteClaim);
  }

  async insertPayment(p: Payment): Promise<Payment> {
    await this.db.run(
      `INSERT INTO payments (
         id, tenant_id, invoice_id, amount_paise, method, utr, gateway_ref,
         received_on, recorded_by, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.tenantId,
        p.invoiceId,
        p.amountPaise,
        p.method,
        p.utr,
        p.gatewayRef,
        p.receivedOn,
        p.recordedBy,
        p.status,
        p.createdAt,
      ],
    );
    const created = await this.getPayment(p.tenantId, p.id);
    if (!created) throw new Error('Failed to read inserted payment');
    return created;
  }

  async getPayment(tenantId: string, id: string): Promise<Payment | null> {
    const row = await this.db.get<PaymentRow>(
      'SELECT * FROM payments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapPayment(row) : null;
  }

  async getPaymentByUtr(tenantId: string, utr: string): Promise<Payment | null> {
    const row = await this.db.get<PaymentRow>(
      'SELECT * FROM payments WHERE tenant_id = ? AND utr = ?',
      [tenantId, utr],
    );
    return row ? mapPayment(row) : null;
  }

  async listPaymentsForInvoice(
    tenantId: string,
    invoiceId: string,
  ): Promise<Payment[]> {
    const rows = await this.db.all<PaymentRow>(
      `SELECT * FROM payments
       WHERE tenant_id = ? AND invoice_id = ?
       ORDER BY received_on ASC, created_at ASC`,
      [tenantId, invoiceId],
    );
    return rows.map(mapPayment);
  }

  async listPaymentsForStudent(
    tenantId: string,
    studentRef: string,
  ): Promise<Payment[]> {
    const rows = await this.db.all<PaymentRow>(
      `SELECT p.* FROM payments p
       INNER JOIN invoices i ON i.id = p.invoice_id AND i.tenant_id = p.tenant_id
       WHERE p.tenant_id = ? AND i.student_ref = ?
       ORDER BY p.received_on ASC, p.created_at ASC`,
      [tenantId, studentRef],
    );
    return rows.map(mapPayment);
  }

  async listInvoicesForStudent(
    tenantId: string,
    studentRef: string,
  ): Promise<Invoice[]> {
    const rows = await this.db.all<InvoiceRow>(
      `SELECT * FROM invoices
       WHERE tenant_id = ? AND student_ref = ?
       ORDER BY created_at ASC`,
      [tenantId, studentRef],
    );
    return rows.map(mapInvoice);
  }

  async updatePaymentStatus(
    tenantId: string,
    id: string,
    status: PaymentStatus,
  ): Promise<Payment | null> {
    await this.db.run(
      'UPDATE payments SET status = ? WHERE tenant_id = ? AND id = ?',
      [status, tenantId, id],
    );
    return this.getPayment(tenantId, id);
  }

  async sumActivePayments(
    tenantId: string,
    invoiceId: string,
  ): Promise<number> {
    const row = await this.db.get<{ s: number | null }>(
      `SELECT COALESCE(SUM(amount_paise), 0) as s FROM payments
       WHERE tenant_id = ? AND invoice_id = ? AND status IN ('recorded', 'verified')`,
      [tenantId, invoiceId],
    );
    return Number(row?.s ?? 0);
  }
}

interface AssignmentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_ref: string;
  fee_structure_id: string;
  payer: string;
  concession_ids_json: string;
  created_at: string;
}

function mapAssignment(row: AssignmentRow): StudentFeeAssignment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentRef: row.student_ref,
    feeStructureId: row.fee_structure_id,
    payer: row.payer as FeePayer,
    concessionIds: JSON.parse(row.concession_ids_json || '[]') as string[],
    createdAt: row.created_at,
  };
}

interface InvoiceRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_ref: string;
  payer: string;
  period_label: string;
  lines_json: string;
  total_paise: number;
  status: string;
  due_on: string;
  issued_at: string | null;
  created_at: string;
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentRef: row.student_ref,
    payer: row.payer as FeePayer,
    periodLabel: row.period_label,
    lines: JSON.parse(row.lines_json) as InvoiceLine[],
    totalPaise: row.total_paise,
    status: row.status as InvoiceStatus,
    dueOn: row.due_on,
    issuedAt: row.issued_at,
    createdAt: row.created_at,
  };
}

interface RteClaimRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  state_code: string;
  period_label: string;
  invoice_ids_json: string;
  total_paise: number;
  status: string;
  submitted_at: string | null;
  reference: string | null;
  created_at: string;
}

function mapRteClaim(row: RteClaimRow): RteClaim {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    stateCode: row.state_code,
    periodLabel: row.period_label,
    invoiceIds: JSON.parse(row.invoice_ids_json || '[]') as string[],
    totalPaise: row.total_paise,
    status: row.status as RteClaimStatus,
    submittedAt: row.submitted_at,
    reference: row.reference,
    createdAt: row.created_at,
  };
}

interface PaymentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  invoice_id: string;
  amount_paise: number;
  method: string;
  utr: string | null;
  gateway_ref: string | null;
  received_on: string;
  recorded_by: string;
  status: string;
  created_at: string;
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    invoiceId: row.invoice_id,
    amountPaise: row.amount_paise,
    method: row.method as PaymentMethod,
    utr: row.utr,
    gatewayRef: row.gateway_ref,
    receivedOn: row.received_on,
    recordedBy: row.recorded_by,
    status: row.status as PaymentStatus,
    createdAt: row.created_at,
  };
}
