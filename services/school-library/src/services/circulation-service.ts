import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { LibraryRepository } from '../repositories/library-repository';
import type {
  CopyCondition,
  Hold,
  LibrarySettings,
  Loan,
  ServiceError,
} from '../types';
import { COPY_CONDITIONS, HOLD_STATUSES, LOAN_STATUSES } from '../types';
import { addDays, parseDateOnly, toDateOnly } from './date-only';
import type { FineService } from './fine-service';

function isCopyCondition(v: string): v is CopyCondition {
  return (COPY_CONDITIONS as readonly string[]).includes(v);
}

export class CirculationService {
  constructor(
    private readonly repo: LibraryRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
    private readonly fines?: FineService,
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

  async getSettings(
    tenantId: string,
  ): Promise<{ settings: LibrarySettings }> {
    const settings = await this.repo.ensureSettings(tenantId);
    return { settings };
  }

  async putSettings(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ settings?: LibrarySettings; error?: ServiceError }> {
    const current = await this.repo.ensureSettings(tenantId);
    const loanDays = Number(
      input.loan_days ?? input.loanDays ?? current.loanDays,
    );
    const renewLimit = Number(
      input.renew_limit ?? input.renewLimit ?? current.renewLimit,
    );
    const maxOpenLoans = Number(
      input.max_open_loans ?? input.maxOpenLoans ?? current.maxOpenLoans,
    );
    const holdDays = Number(
      input.hold_days ?? input.holdDays ?? current.holdDays,
    );
    const finePaisePerDay = Number(
      input.fine_paise_per_day ??
        input.finePaisePerDay ??
        current.finePaisePerDay,
    );
    const fineCapPaise = Number(
      input.fine_cap_paise ?? input.fineCapPaise ?? current.fineCapPaise,
    );
    const graceDays = Number(
      input.grace_days ?? input.graceDays ?? current.graceDays,
    );

    if (!Number.isInteger(loanDays) || loanDays < 1 || loanDays > 90) {
      return { error: { error: 'loan_days invalid', status: 400 } };
    }
    if (!Number.isInteger(renewLimit) || renewLimit < 0 || renewLimit > 5) {
      return { error: { error: 'renew_limit invalid', status: 400 } };
    }
    if (
      !Number.isInteger(maxOpenLoans) ||
      maxOpenLoans < 1 ||
      maxOpenLoans > 20
    ) {
      return { error: { error: 'max_open_loans invalid', status: 400 } };
    }
    if (!Number.isInteger(holdDays) || holdDays < 1 || holdDays > 14) {
      return { error: { error: 'hold_days invalid', status: 400 } };
    }
    if (
      !Number.isInteger(finePaisePerDay) ||
      finePaisePerDay < 0 ||
      finePaisePerDay > 100_000
    ) {
      return { error: { error: 'fine_paise_per_day invalid', status: 400 } };
    }
    if (
      !Number.isInteger(fineCapPaise) ||
      fineCapPaise < 0 ||
      fineCapPaise > 10_000_000
    ) {
      return { error: { error: 'fine_cap_paise invalid', status: 400 } };
    }
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 30) {
      return { error: { error: 'grace_days invalid', status: 400 } };
    }

    const settings = await this.repo.updateSettings(tenantId, {
      loanDays,
      renewLimit,
      maxOpenLoans,
      holdDays,
      finePaisePerDay,
      fineCapPaise,
      graceDays,
    });
    return { settings };
  }

  private async resolveCopy(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ copyId?: string; error?: ServiceError }> {
    const copyId = String(input.copy_id ?? input.copyId ?? '').trim();
    const barcode = String(input.barcode ?? '').trim();
    if (copyId) {
      const copy = await this.repo.getCopy(tenantId, copyId);
      if (!copy) return { error: { error: 'copy_not_found', status: 404 } };
      return { copyId: copy.id };
    }
    if (barcode) {
      const copy = await this.repo.getCopyByBarcode(tenantId, barcode);
      if (!copy) return { error: { error: 'copy_not_found', status: 404 } };
      return { copyId: copy.id };
    }
    return { error: { error: 'copy_id or barcode required', status: 400 } };
  }

  async issueLoan(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{
    loan?: Loan;
    error?: ServiceError;
    open_fines_paise?: number;
  }> {
    const studentRef = String(input.student_ref ?? input.studentRef ?? '').trim();
    if (!studentRef) {
      return { error: { error: 'student_ref is required', status: 400 } };
    }

    if (this.fines) {
      const openFinesPaise = await this.fines.openFinesPaise(
        tenantId,
        studentRef,
      );
      if (openFinesPaise > 0) {
        return {
          error: { error: 'fines_outstanding', status: 409 },
          open_fines_paise: openFinesPaise,
        };
      }
    }

    const resolved = await this.resolveCopy(tenantId, input);
    if (resolved.error) return { error: resolved.error };
    const copy = await this.repo.getCopy(tenantId, resolved.copyId!);
    if (!copy) return { error: { error: 'copy_not_found', status: 404 } };

    const settings = await this.repo.ensureSettings(tenantId);
    const openCount = await this.repo.countOpenLoansForStudent(
      tenantId,
      studentRef,
    );
    if (openCount >= settings.maxOpenLoans) {
      return { error: { error: 'max_open_loans', status: 409 } };
    }

    let readyHold:
      | Awaited<ReturnType<LibraryRepository['findReadyHoldForStudentTitle']>>
      | undefined;
    if (copy.status === 'available') {
      // ok
    } else if (copy.status === 'reserved') {
      readyHold = await this.repo.findReadyHoldForStudentTitle(
        tenantId,
        copy.titleId,
        studentRef,
      );
      if (!readyHold) {
        return { error: { error: 'copy_not_available', status: 409 } };
      }
      if (readyHold.readyCopyId && readyHold.readyCopyId !== copy.id) {
        return { error: { error: 'copy_not_available', status: 409 } };
      }
    } else {
      return { error: { error: 'copy_not_available', status: 409 } };
    }

    let issuedOn = this.today();
    if (input.issued_on !== undefined || input.issuedOn !== undefined) {
      const raw = String(input.issued_on ?? input.issuedOn).trim();
      if (!parseDateOnly(raw)) {
        return { error: { error: 'issued_on invalid', status: 400 } };
      }
      issuedOn = raw;
    }
    const dueOn = addDays(issuedOn, settings.loanDays);
    const issuedBy =
      input.issued_by === undefined && input.issuedBy === undefined
        ? null
        : String(input.issued_by ?? input.issuedBy).trim() || null;

    const id = uuidv4();
    try {
      await this.repo.updateCopy(tenantId, copy.id, { status: 'on_loan' });
      const loan = await this.repo.insertLoan({
        id,
        tenantId,
        copyId: copy.id,
        studentRef,
        issuedOn,
        dueOn,
        issuedBy,
      });
      if (readyHold) {
        await this.repo.markHoldFulfilled(tenantId, readyHold.id);
      }
      await this.emit('school.library.loan_issued', tenantId, {
        loan_id: loan.id,
        copy_id: copy.id,
        student_ref: studentRef,
        due_on: dueOn,
      });
      return { loan };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'copy_already_on_loan', status: 409 } };
      }
      throw err;
    }
  }

  async returnLoan(
    tenantId: string,
    loanId: string,
    input: Record<string, unknown>,
  ): Promise<{ loan?: Loan; error?: ServiceError }> {
    const loan = await this.repo.getLoan(tenantId, loanId);
    if (!loan) return { error: { error: 'not_found', status: 404 } };
    if (loan.status !== 'open') {
      return { error: { error: 'loan_not_open', status: 409 } };
    }

    let returnedOn = this.today();
    if (input.returned_on !== undefined || input.returnedOn !== undefined) {
      const raw = String(input.returned_on ?? input.returnedOn).trim();
      if (!parseDateOnly(raw)) {
        return { error: { error: 'returned_on invalid', status: 400 } };
      }
      returnedOn = raw;
    }

    const conditionPatch: { condition?: CopyCondition } = {};
    if (input.condition !== undefined) {
      const c = String(input.condition);
      if (!isCopyCondition(c)) {
        return { error: { error: 'condition invalid', status: 400 } };
      }
      conditionPatch.condition = c;
    }

    const copy = await this.repo.getCopy(tenantId, loan.copyId);
    if (!copy) return { error: { error: 'copy_not_found', status: 404 } };

    if (this.fines) {
      const settings = await this.repo.ensureSettings(tenantId);
      await this.fines.assessLoanAsOf(tenantId, loan, returnedOn, settings);
    }

    const closed = await this.repo.returnLoan(tenantId, loanId, returnedOn);
    if (!closed || closed.status !== 'returned') {
      return { error: { error: 'loan_not_open', status: 409 } };
    }

    const settings = await this.repo.ensureSettings(tenantId);
    const nextHold = await this.repo.nextQueuedHold(tenantId, copy.titleId);
    if (nextHold) {
      const expiresAt = addDays(returnedOn, settings.holdDays);
      await this.repo.markHoldReady(
        tenantId,
        nextHold.id,
        copy.id,
        expiresAt,
      );
      await this.repo.updateCopy(tenantId, copy.id, {
        status: 'reserved',
        ...conditionPatch,
      });
      await this.emit('school.library.hold_ready', tenantId, {
        hold_id: nextHold.id,
        title_id: copy.titleId,
        copy_id: copy.id,
        student_ref: nextHold.studentRef,
        expires_at: expiresAt,
      });
    } else {
      await this.repo.updateCopy(tenantId, copy.id, {
        status: 'available',
        ...conditionPatch,
      });
      await this.emit('school.library.loan_returned', tenantId, {
        loan_id: loan.id,
        copy_id: copy.id,
        student_ref: loan.studentRef,
      });
    }

    return { loan: closed };
  }

  async renewLoan(
    tenantId: string,
    loanId: string,
  ): Promise<{ loan?: Loan; error?: ServiceError }> {
    const loan = await this.repo.getLoan(tenantId, loanId);
    if (!loan) return { error: { error: 'not_found', status: 404 } };
    if (loan.status !== 'open') {
      return { error: { error: 'loan_not_open', status: 409 } };
    }

    const settings = await this.repo.ensureSettings(tenantId);
    const today = this.today();
    if (loan.dueOn < today) {
      return { error: { error: 'overdue_cannot_renew', status: 400 } };
    }
    if (loan.renewals >= settings.renewLimit) {
      return { error: { error: 'renew_limit', status: 409 } };
    }

    const copy = await this.repo.getCopy(tenantId, loan.copyId);
    if (!copy) return { error: { error: 'copy_not_found', status: 404 } };

    const holdPending = await this.repo.hasActiveHoldOnTitle(
      tenantId,
      copy.titleId,
    );
    if (holdPending) {
      return { error: { error: 'hold_pending', status: 409 } };
    }

    const dueOn = addDays(today, settings.loanDays);
    const renewed = await this.repo.renewLoan(
      tenantId,
      loanId,
      dueOn,
      loan.renewals + 1,
    );
    await this.emit('school.library.loan_renewed', tenantId, {
      loan_id: loanId,
      due_on: dueOn,
      renewals: loan.renewals + 1,
    });
    return { loan: renewed };
  }

  async placeHold(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ hold?: Hold; error?: ServiceError }> {
    const titleId = String(input.title_id ?? input.titleId ?? '').trim();
    const studentRef = String(input.student_ref ?? input.studentRef ?? '').trim();
    if (!titleId) return { error: { error: 'title_id is required', status: 400 } };
    if (!studentRef) {
      return { error: { error: 'student_ref is required', status: 400 } };
    }

    const title = await this.repo.getTitle(tenantId, titleId);
    if (!title) return { error: { error: 'title_not_found', status: 404 } };

    const counts = await this.repo.copyCounts(tenantId, titleId);
    if (counts.available > 0) {
      return { error: { error: 'copies_available', status: 400 } };
    }

    const position = await this.repo.nextHoldPosition(tenantId, titleId);
    const id = uuidv4();
    try {
      const hold = await this.repo.insertHold({
        id,
        tenantId,
        titleId,
        studentRef,
        position,
      });
      await this.emit('school.library.hold_placed', tenantId, {
        hold_id: hold.id,
        title_id: titleId,
        student_ref: studentRef,
        position,
      });
      return { hold };
    } catch (err) {
      if (this.repo.isUniqueConstraintError(err)) {
        return { error: { error: 'hold_exists', status: 409 } };
      }
      throw err;
    }
  }

  async cancelHold(
    tenantId: string,
    holdId: string,
  ): Promise<{ hold?: Hold; error?: ServiceError }> {
    const hold = await this.repo.getHold(tenantId, holdId);
    if (!hold) return { error: { error: 'not_found', status: 404 } };
    if (hold.status !== 'queued' && hold.status !== 'ready') {
      return { error: { error: 'hold_not_cancellable', status: 409 } };
    }

    const cancelled = await this.repo.markHoldCancelled(tenantId, holdId);
    if (hold.status === 'ready' && hold.readyCopyId) {
      const next = await this.repo.nextQueuedHold(tenantId, hold.titleId);
      if (next) {
        const settings = await this.repo.ensureSettings(tenantId);
        const expiresAt = addDays(this.today(), settings.holdDays);
        await this.repo.markHoldReady(
          tenantId,
          next.id,
          hold.readyCopyId,
          expiresAt,
        );
        await this.emit('school.library.hold_ready', tenantId, {
          hold_id: next.id,
          title_id: hold.titleId,
          copy_id: hold.readyCopyId,
          student_ref: next.studentRef,
          expires_at: expiresAt,
        });
      } else {
        await this.repo.updateCopy(tenantId, hold.readyCopyId, {
          status: 'available',
        });
      }
    }

    await this.repo.reorderQueuedHolds(tenantId, hold.titleId);
    return { hold: cancelled };
  }

  async fulfillHold(
    tenantId: string,
    holdId: string,
    input: Record<string, unknown>,
  ): Promise<{ loan?: Loan; error?: ServiceError }> {
    const hold = await this.repo.getHold(tenantId, holdId);
    if (!hold) return { error: { error: 'not_found', status: 404 } };
    if (hold.status !== 'ready') {
      return { error: { error: 'hold_not_ready', status: 409 } };
    }

    const resolved = await this.resolveCopy(tenantId, {
      ...input,
      copy_id: input.copy_id ?? input.copyId ?? hold.readyCopyId,
    });
    if (resolved.error) return { error: resolved.error };

    const result = await this.issueLoan(tenantId, {
      copy_id: resolved.copyId,
      student_ref: hold.studentRef,
      issued_on: input.issued_on ?? input.issuedOn,
      issued_by: input.issued_by ?? input.issuedBy,
    });
    return result;
  }

  async markOverdue(
    tenantId: string,
    input: Record<string, unknown>,
  ): Promise<{ count: number; as_of: string }> {
    let asOf = this.today();
    if (input.as_of !== undefined || input.asOf !== undefined) {
      const raw = String(input.as_of ?? input.asOf).trim();
      if (parseDateOnly(raw)) asOf = raw;
    }
    const count = await this.repo.countOverdueOpen(tenantId, asOf);
    return { count, as_of: asOf };
  }

  async listLoans(
    tenantId: string,
    query: {
      studentRef?: string;
      status?: string;
      overdue?: boolean;
    },
  ): Promise<{ loans: Loan[]; error?: ServiceError }> {
    if (query.status && !(LOAN_STATUSES as readonly string[]).includes(query.status)) {
      return { loans: [], error: { error: 'status invalid', status: 400 } };
    }
    const loans = await this.repo.listLoans(tenantId, {
      studentRef: query.studentRef,
      status: query.overdue ? undefined : query.status,
      overdueAsOf: query.overdue ? this.today() : undefined,
    });
    return { loans };
  }

  async listHolds(
    tenantId: string,
    query: { titleId?: string; studentRef?: string; status?: string },
  ): Promise<{ holds: Hold[]; error?: ServiceError }> {
    if (query.status && !(HOLD_STATUSES as readonly string[]).includes(query.status)) {
      return { holds: [], error: { error: 'status invalid', status: 400 } };
    }
    const holds = await this.repo.listHolds(tenantId, query);
    return { holds };
  }
}
