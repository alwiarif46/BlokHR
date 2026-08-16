import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { LibraryRepository } from '../repositories/library-repository';
import type {
  Fine,
  LibrarySettings,
  LibrarySummary,
  Loan,
  ServiceError,
} from '../types';
import { FINE_STATUSES } from '../types';
import { parseDateOnly, toDateOnly } from './date-only';
import { computeFine } from './fine-math';

export class FineService {
  constructor(
    private readonly repo: LibraryRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private today(): string {
    return toDateOnly(this.clock());
  }

  private async emit(
    type: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.events.publish({
      type,
      tenantId,
      occurredAt: this.clock().toISOString(),
      data,
    });
  }

  /**
   * Assess/update open fine for one loan as of a date.
   * Returns null when amount is 0 (no fine row created).
   * Leaves paid/waived rows untouched.
   */
  async assessLoanAsOf(
    tenantId: string,
    loan: Loan,
    asOf: string,
    settings: LibrarySettings,
  ): Promise<Fine | null> {
    const math = computeFine({
      dueOn: loan.dueOn,
      asOf,
      graceDays: settings.graceDays,
      finePaisePerDay: settings.finePaisePerDay,
      fineCapPaise: settings.fineCapPaise,
    });
    if (math.amountPaise <= 0 || math.daysOverdue <= 0) {
      return null;
    }
    return this.repo.upsertOpenFine({
      id: uuidv4(),
      tenantId,
      loanId: loan.id,
      studentRef: loan.studentRef,
      daysOverdue: math.daysOverdue,
      amountPaise: math.amountPaise,
    });
  }

  async assessAll(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<
    | { assessed: number; total_paise: number; as_of: string }
    | { error: ServiceError }
  > {
    let asOf = this.today();
    if (input.as_of !== undefined || input.asOf !== undefined) {
      const raw = String(input.as_of ?? input.asOf).trim();
      if (!parseDateOnly(raw)) {
        return { error: { error: 'as_of invalid', status: 400 } };
      }
      asOf = raw;
    }
    const settings = await this.repo.ensureSettings(tenantId);
    const openLoans = await this.repo.listLoans(tenantId, { status: 'open' });
    let assessed = 0;
    let totalPaise = 0;
    for (const loan of openLoans) {
      if (loan.dueOn >= asOf) continue;
      const fine = await this.assessLoanAsOf(tenantId, loan, asOf, settings);
      if (fine && fine.status === 'open') {
        assessed += 1;
        totalPaise += fine.amountPaise;
      }
    }
    return { assessed, total_paise: totalPaise, as_of: asOf };
  }

  async listFines(
    tenantId: string,
    query: { studentRef?: string; status?: string },
  ): Promise<{ fines: Fine[]; error?: ServiceError }> {
    if (
      query.status &&
      !(FINE_STATUSES as readonly string[]).includes(query.status)
    ) {
      return { fines: [], error: { error: 'status invalid', status: 400 } };
    }
    const fines = await this.repo.listFines(tenantId, query);
    return { fines };
  }

  async payFine(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<{ fine?: Fine; error?: ServiceError }> {
    const existing = await this.repo.getFine(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };
    if (existing.status !== 'open') {
      return { error: { error: 'fine_not_open', status: 400 } };
    }
    let paidOn = this.today();
    if (input.received_on !== undefined || input.receivedOn !== undefined) {
      const raw = String(input.received_on ?? input.receivedOn).trim();
      if (!parseDateOnly(raw)) {
        return { error: { error: 'received_on invalid', status: 400 } };
      }
      paidOn = raw;
    }
    const fine = await this.repo.payFine(tenantId, id, paidOn);
    if (!fine || fine.status !== 'paid') {
      return { error: { error: 'fine_not_open', status: 400 } };
    }
    await this.emit('school.library.fine_paid', tenantId, {
      fine_id: fine.id,
      amount_paise: fine.amountPaise,
      student_ref: fine.studentRef,
    });
    return { fine };
  }

  async waiveFine(
    tenantId: string,
    id: string,
    input: Record<string, unknown>,
  ): Promise<{ fine?: Fine; error?: ServiceError }> {
    const existing = await this.repo.getFine(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };
    if (existing.status !== 'open') {
      return { error: { error: 'fine_not_open', status: 400 } };
    }
    const reason = String(input.reason ?? '').trim();
    if (reason.length < 3) {
      return { error: { error: 'reason required', status: 400 } };
    }
    const fine = await this.repo.waiveFine(tenantId, id, reason);
    if (!fine || fine.status !== 'waived') {
      return { error: { error: 'fine_not_open', status: 400 } };
    }
    await this.emit('school.library.fine_waived', tenantId, {
      fine_id: fine.id,
      amount_paise: fine.amountPaise,
      student_ref: fine.studentRef,
      reason,
    });
    return { fine };
  }

  async openFinesPaise(tenantId: string, studentRef: string): Promise<number> {
    return this.repo.sumOpenFinesPaise(tenantId, studentRef);
  }

  async librarySummary(
    tenantId: string,
    studentRef: string,
  ): Promise<{ summary?: LibrarySummary; error?: ServiceError }> {
    const ref = studentRef.trim();
    if (!ref) return { error: { error: 'student_ref required', status: 400 } };
    const today = this.today();
    const openLoans = await this.repo.listLoans(tenantId, {
      studentRef: ref,
      status: 'open',
    });
    const overdue = openLoans.filter((l) => l.dueOn < today).length;
    const openFinesPaise = await this.repo.sumOpenFinesPaise(tenantId, ref);
    const holds = await this.repo.countActiveHoldsForStudent(tenantId, ref);
    return {
      summary: {
        open_loans: openLoans.length,
        overdue_loans: overdue,
        open_fines_paise: openFinesPaise,
        holds,
      },
    };
  }
}
