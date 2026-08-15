import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { FeesRepository } from '../repositories/fees-repository';
import type {
  Concession,
  FeePayer,
  FeeStructure,
  Invoice,
  InvoiceLine,
  RteClaim,
  StudentFeeAssignment,
} from '../types';

type ServiceError = { error: string; status: number };

const PAYERS = new Set<FeePayer>(['guardian', 'government_rte']);

/** pct on applicable heads, then flat, floor at 0. Exported for tests. */
export function applyConcessions(
  lines: Array<{
    feeHeadId: string;
    headCode: string;
    headLabel: string;
    grossPaise: number;
  }>,
  concessions: Concession[],
): InvoiceLine[] {
  const pcts = concessions.filter((c) => c.kind === 'pct');
  const flatsHead = concessions.filter(
    (c) => c.kind === 'flat' && c.appliesToHeads != null,
  );
  const flatsAll = concessions.filter(
    (c) => c.kind === 'flat' && c.appliesToHeads == null,
  );

  const resolved: InvoiceLine[] = lines.map((line) => {
    let concessionPaise = 0;
    for (const c of pcts) {
      if (
        c.appliesToHeads != null &&
        !c.appliesToHeads.includes(line.feeHeadId)
      ) {
        continue;
      }
      concessionPaise += Math.floor((line.grossPaise * c.value) / 100);
    }
    for (const c of flatsHead) {
      if (!c.appliesToHeads!.includes(line.feeHeadId)) continue;
      concessionPaise += c.value;
    }
    const netPaise = Math.max(0, line.grossPaise - concessionPaise);
    return {
      feeHeadId: line.feeHeadId,
      headCode: line.headCode,
      headLabel: line.headLabel,
      grossPaise: line.grossPaise,
      concessionPaise: line.grossPaise - netPaise,
      netPaise,
    };
  });

  let remainingFlat = flatsAll.reduce((s, c) => s + c.value, 0);
  for (const line of resolved) {
    if (remainingFlat <= 0) break;
    const take = Math.min(line.netPaise, remainingFlat);
    line.netPaise -= take;
    line.concessionPaise += take;
    remainingFlat -= take;
  }

  return resolved;
}

export class InvoiceService {
  constructor(
    private readonly repo: FeesRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createAssignment(
    tenantId: string,
    input: {
      studentRef: string;
      feeStructureId: string;
      payer?: FeePayer;
      concessionIds?: string[];
    },
  ): Promise<{ assignment?: StudentFeeAssignment; error?: ServiceError }> {
    const studentRef = (input.studentRef || '').trim();
    const feeStructureId = (input.feeStructureId || '').trim();
    if (!studentRef) return { error: { error: 'student_ref is required', status: 400 } };
    if (!feeStructureId) {
      return { error: { error: 'fee_structure_id is required', status: 400 } };
    }
    const payer = input.payer ?? 'guardian';
    if (!PAYERS.has(payer)) {
      return { error: { error: 'payer must be guardian or government_rte', status: 400 } };
    }
    const structure = await this.repo.getStructure(tenantId, feeStructureId);
    if (!structure) {
      return { error: { error: 'fee structure not found', status: 404 } };
    }

    const concessionIds = input.concessionIds ?? [];
    for (const cid of concessionIds) {
      const c = await this.repo.getConcession(tenantId, cid);
      if (!c) return { error: { error: `concession not found: ${cid}`, status: 400 } };
    }

    const assignment = await this.repo.insertAssignment({
      id: uuidv4(),
      tenantId,
      studentRef,
      feeStructureId,
      payer,
      concessionIds,
      createdAt: this.clock().toISOString(),
    });
    return { assignment };
  }

  async listAssignments(tenantId: string): Promise<{ assignments: StudentFeeAssignment[] }> {
    return { assignments: await this.repo.listAssignments(tenantId) };
  }

  async generateInvoices(
    tenantId: string,
    input: {
      academicSessionRef: string;
      periodLabel: string;
      classLabel?: string;
      stateCode?: string;
      dueOn?: string;
    },
  ): Promise<{
    created?: Invoice[];
    skipped?: number;
    rteClaim?: RteClaim | null;
    error?: ServiceError;
  }> {
    const academicSessionRef = (input.academicSessionRef || '').trim();
    const periodLabel = (input.periodLabel || '').trim();
    if (!academicSessionRef) {
      return { error: { error: 'academic_session_ref is required', status: 400 } };
    }
    if (!periodLabel) {
      return { error: { error: 'period_label is required', status: 400 } };
    }

    const pairs = await this.repo.listAssignmentsForGenerate(
      tenantId,
      academicSessionRef,
      input.classLabel?.trim() || undefined,
    );

    const needsRte = pairs.some((p) => p.assignment.payer === 'government_rte');
    const stateCode = (input.stateCode || '').trim();
    if (needsRte && !stateCode) {
      return {
        error: { error: 'state_code is required when RTE assignments are present', status: 400 },
      };
    }

    const now = this.clock();
    const dueOn =
      (input.dueOn || '').trim() ||
      (/^\d{4}-\d{2}-\d{2}$/.test(periodLabel)
        ? periodLabel
        : new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10));

    const created: Invoice[] = [];
    let skipped = 0;
    let rteClaim: RteClaim | null = null;

    for (const { assignment, structure } of pairs) {
      const existing = await this.repo.getInvoiceByStudentPeriod(
        tenantId,
        assignment.studentRef,
        periodLabel,
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const invoice = await this.buildInvoice(
        tenantId,
        assignment,
        structure,
        periodLabel,
        dueOn,
        now,
      );
      created.push(invoice);

      if (assignment.payer === 'guardian') {
        await this.events.publish({
          type: 'school.fee.invoice_issued',
          tenantId,
          occurredAt: now.toISOString(),
          data: {
            invoice_id: invoice.id,
            student_ref: invoice.studentRef,
            period_label: periodLabel,
            total_paise: invoice.totalPaise,
          },
        });
      } else {
        rteClaim = await this.aggregateRteClaim(
          tenantId,
          stateCode,
          periodLabel,
          invoice,
          rteClaim,
        );
      }
    }

    return { created, skipped, rteClaim };
  }

  private async buildInvoice(
    tenantId: string,
    assignment: StudentFeeAssignment,
    structure: FeeStructure,
    periodLabel: string,
    dueOn: string,
    now: Date,
  ): Promise<Invoice> {
    const concessions: Concession[] = [];
    for (const cid of assignment.concessionIds) {
      const c = await this.repo.getConcession(tenantId, cid);
      if (c) concessions.push(c);
    }

    const rawLines: Array<{
      feeHeadId: string;
      headCode: string;
      headLabel: string;
      grossPaise: number;
    }> = [];
    for (const line of structure.lines) {
      const head = await this.repo.getHead(tenantId, line.feeHeadId);
      rawLines.push({
        feeHeadId: line.feeHeadId,
        headCode: head?.code ?? line.feeHeadId,
        headLabel: head?.label ?? line.feeHeadId,
        grossPaise: line.amountPaise,
      });
    }

    const lines = applyConcessions(rawLines, concessions);
    const totalPaise = lines.reduce((s, l) => s + l.netPaise, 0);
    const issuedAt = now.toISOString();

    return this.repo.insertInvoice({
      id: uuidv4(),
      tenantId,
      studentRef: assignment.studentRef,
      payer: assignment.payer,
      periodLabel,
      lines,
      totalPaise,
      status: 'issued',
      dueOn,
      issuedAt,
      createdAt: issuedAt,
    });
  }

  private async aggregateRteClaim(
    tenantId: string,
    stateCode: string,
    periodLabel: string,
    invoice: Invoice,
    current: RteClaim | null,
  ): Promise<RteClaim> {
    let claim =
      current ??
      (await this.repo.getDraftRteClaim(tenantId, periodLabel, stateCode));

    if (!claim) {
      return this.repo.insertRteClaim({
        id: uuidv4(),
        tenantId,
        stateCode,
        periodLabel,
        invoiceIds: [invoice.id],
        totalPaise: invoice.totalPaise,
        status: 'draft',
        submittedAt: null,
        reference: null,
        createdAt: this.clock().toISOString(),
      });
    }

    if (claim.status !== 'draft') {
      // Still attach to existing claim row for the period if not draft — only draft accepts new invoices
      if (claim.invoiceIds.includes(invoice.id)) return claim;
      return claim;
    }

    if (claim.invoiceIds.includes(invoice.id)) return claim;

    const updated = await this.repo.updateRteClaim({
      ...claim,
      invoiceIds: [...claim.invoiceIds, invoice.id],
      totalPaise: claim.totalPaise + invoice.totalPaise,
    });
    if (!updated) throw new Error('Failed to update rte claim');
    return updated;
  }

  async listInvoices(tenantId: string): Promise<{ invoices: Invoice[] }> {
    return { invoices: await this.repo.listInvoices(tenantId) };
  }

  async listRteClaims(tenantId: string): Promise<{ claims: RteClaim[] }> {
    return { claims: await this.repo.listRteClaims(tenantId) };
  }

  async submitRteClaim(
    tenantId: string,
    claimId: string,
  ): Promise<{ claim?: RteClaim; error?: ServiceError }> {
    const claim = await this.repo.getRteClaim(tenantId, claimId);
    if (!claim) return { error: { error: 'rte claim not found', status: 404 } };
    if (claim.status !== 'draft') {
      return { error: { error: 'only draft claims can be submitted', status: 400 } };
    }
    const updated = await this.repo.updateRteClaim({
      ...claim,
      status: 'submitted',
      submittedAt: this.clock().toISOString(),
    });
    if (!updated) return { error: { error: 'rte claim not found', status: 404 } };
    return { claim: updated };
  }

  async receiveRteClaim(
    tenantId: string,
    claimId: string,
    reference: string,
  ): Promise<{ claim?: RteClaim; error?: ServiceError }> {
    const ref = (reference || '').trim();
    if (!ref) return { error: { error: 'reference is required', status: 400 } };
    const claim = await this.repo.getRteClaim(tenantId, claimId);
    if (!claim) return { error: { error: 'rte claim not found', status: 404 } };
    if (claim.status !== 'submitted') {
      return { error: { error: 'only submitted claims can be received', status: 400 } };
    }
    const updated = await this.repo.updateRteClaim({
      ...claim,
      status: 'received',
      reference: ref,
    });
    if (!updated) return { error: { error: 'rte claim not found', status: 404 } };
    return { claim: updated };
  }

  async rejectRteClaim(
    tenantId: string,
    claimId: string,
  ): Promise<{ claim?: RteClaim; error?: ServiceError }> {
    const claim = await this.repo.getRteClaim(tenantId, claimId);
    if (!claim) return { error: { error: 'rte claim not found', status: 404 } };
    if (claim.status !== 'submitted') {
      return { error: { error: 'only submitted claims can be rejected', status: 400 } };
    }
    for (const invoiceId of claim.invoiceIds) {
      await this.repo.updateInvoiceStatus(tenantId, invoiceId, 'issued');
    }
    const updated = await this.repo.updateRteClaim({
      ...claim,
      status: 'rejected',
    });
    if (!updated) return { error: { error: 'rte claim not found', status: 404 } };
    return { claim: updated };
  }
}
