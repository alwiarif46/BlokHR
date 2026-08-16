import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import type { NotificationDispatcher } from './notification/dispatcher';
import {
  ExpenseRepository,
  type ExpenseReceiptRow,
  type ExpensePolicyRow,
  type ExpenseApprovalRow,
} from '../repositories/expense-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  statusCode?: number;
  data?: T;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
  reports_to: string;
}

export const VALID_EXPENSE_CATEGORIES = [
  'travel',
  'meals',
  'accommodation',
  'supplies',
  'client',
  'other',
];

/** Map camelCase or snake_case update fields to DB column names. */
export function mapExpenseUpdateFields(fields: Record<string, unknown>): Record<string, unknown> {
  const keyMap: Record<string, string> = {
    vendor: 'vendor',
    amount: 'amount',
    currency: 'currency',
    receiptDate: 'receipt_date',
    receipt_date: 'receipt_date',
    category: 'category',
    description: 'description',
    fileId: 'file_id',
    file_id: 'file_id',
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = keyMap[k];
    if (col) out[col] = v;
  }
  return out;
}

export class ExpenseService {
  private readonly repo: ExpenseRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
    private readonly dispatcher?: NotificationDispatcher | null,
  ) {
    this.repo = new ExpenseRepository(db);
  }

  async createExpense(
    data: {
      email: string;
      fileId?: string | null;
      vendor?: string;
      amount?: number;
      currency?: string;
      receiptDate?: string;
      category?: string;
      description?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult<ExpenseReceiptRow>> {
    if (data.category && !VALID_EXPENSE_CATEGORIES.includes(data.category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_EXPENSE_CATEGORIES.join(', ')}`,
      };
    }

    const member = await this.db.get<MemberRow>(
      'SELECT email FROM members WHERE email = ? AND active = 1',
      [data.email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    const ocrRawJson = JSON.stringify({
      extracted: true,
      vendor: data.vendor ?? '',
      amount: data.amount ?? 0,
      date: data.receiptDate ?? '',
    });

    const receipt = await this.repo.createReceipt({ ...data, ocrRawJson });
    this.logger.info({ receiptId: receipt.id, email: data.email }, 'Expense created');
    this.logAudit('expense_receipt', receipt.id, 'created', actorEmail, {
      vendor: receipt.vendor,
      amount: receipt.amount,
    });
    return { success: true, data: receipt };
  }

  /** Alias for mobile receipt create. */
  async createReceipt(
    data: Parameters<ExpenseService['createExpense']>[0],
  ): Promise<ServiceResult<ExpenseReceiptRow>> {
    return this.createExpense(data, data.email);
  }

  async updateExpense(
    id: string,
    fields: Record<string, unknown>,
    actorEmail: string,
    isAdmin: boolean,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getReceiptById(id);
    if (!existing) return { success: false, error: 'Expense not found' };
    if (existing.status !== 'draft') {
      return { success: false, error: 'Only draft expenses can be updated' };
    }
    if (!isAdmin && existing.email !== actorEmail) {
      return { success: false, error: 'Not authorized', statusCode: 403 };
    }
    const mapped = mapExpenseUpdateFields(fields);
    if (mapped.category && !VALID_EXPENSE_CATEGORIES.includes(String(mapped.category))) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_EXPENSE_CATEGORIES.join(', ')}`,
      };
    }
    if (Object.keys(mapped).length === 0) {
      return { success: false, error: 'No valid fields to update' };
    }
    await this.repo.updateReceipt(id, mapped as Parameters<typeof this.repo.updateReceipt>[1]);
    this.logAudit('expense_receipt', id, 'updated', actorEmail, mapped);
    return { success: true };
  }

  async deleteExpense(
    id: string,
    actorEmail: string,
    isAdmin: boolean,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getReceiptById(id);
    if (!existing) return { success: false, error: 'Expense not found' };
    if (existing.status !== 'draft') {
      return { success: false, error: 'Only draft expenses can be deleted' };
    }
    if (!isAdmin && existing.email !== actorEmail) {
      return { success: false, error: 'Not authorized', statusCode: 403 };
    }
    await this.repo.deleteReceipt(id);
    this.logAudit('expense_receipt', id, 'deleted', actorEmail, { vendor: existing.vendor });
    return { success: true };
  }

  async submitExpense(id: string, actorEmail: string): Promise<ServiceResult> {
    const receipt = await this.repo.getReceiptById(id);
    if (!receipt) return { success: false, error: 'Expense not found' };
    if (receipt.status !== 'draft') {
      return { success: false, error: 'Only draft receipts can be submitted' };
    }
    if (receipt.email !== actorEmail) {
      return { success: false, error: 'Not authorized', statusCode: 403 };
    }

    const policyError = await this.checkPolicyLimits(receipt);
    if (policyError) return { success: false, error: policyError };

    const steps = await this.repo.getExpenseApprovalSteps();
    const startLevel = steps.length > 0 ? steps[0].level : 1;

    await this.repo.updateReceipt(id, {
      status: 'submitted',
      current_level: startLevel,
    });
    this.logAudit('expense_receipt', id, 'submitted', actorEmail, {
      currentLevel: startLevel,
    });
    this.notifyApprovers(receipt, startLevel).catch((err) => {
      this.logger.error({ err, id }, 'Approver notification failed');
    });
    return { success: true };
  }

  /** Alias for mobile. */
  async submitReceipt(id: string, actorEmail: string): Promise<ServiceResult> {
    return this.submitExpense(id, actorEmail);
  }

  async approveExpense(id: string, approverEmail: string): Promise<ServiceResult> {
    const receipt = await this.repo.getReceiptById(id);
    if (!receipt) return { success: false, error: 'Expense not found' };
    if (receipt.status !== 'submitted') {
      return { success: false, error: 'Only submitted receipts can be approved' };
    }

    const steps = await this.repo.getExpenseApprovalSteps();
    const currentStep =
      steps.find((s) => s.level === receipt.current_level) || steps[0] || null;
    const role = currentStep?.role || 'manager';
    const level = currentStep?.level || receipt.current_level || 1;

    const allowed = await this.canActAsRole(approverEmail, role, receipt.email);
    if (!allowed) {
      return {
        success: false,
        error: `Approver must have role "${role}" for this level`,
        statusCode: 403,
      };
    }

    await this.repo.addApproval({
      receiptId: id,
      level,
      role,
      approverEmail,
      action: 'approved',
    });

    const nextStep = steps.find((s) => s.level > level);
    if (nextStep) {
      await this.repo.updateReceipt(id, {
        current_level: nextStep.level,
        approver_email: approverEmail,
      });
      this.logAudit('expense_receipt', id, 'level_approved', approverEmail, {
        level,
        nextLevel: nextStep.level,
      });
      return { success: true };
    }

    await this.repo.updateReceipt(id, {
      status: 'approved',
      approver_email: approverEmail,
    });
    this.logAudit('expense_receipt', id, 'approved', approverEmail, { level });
    this.notifyClaimant(receipt, 'approved').catch((err) => {
      this.logger.error({ err, id }, 'Claimant notification failed');
    });
    return { success: true };
  }

  async approveReceipt(id: string, approverEmail: string): Promise<ServiceResult> {
    return this.approveExpense(id, approverEmail);
  }

  async rejectExpense(
    id: string,
    rejectorEmail: string,
    reason: string,
  ): Promise<ServiceResult> {
    const receipt = await this.repo.getReceiptById(id);
    if (!receipt) return { success: false, error: 'Expense not found' };
    if (receipt.status !== 'submitted') {
      return { success: false, error: 'Only submitted receipts can be rejected' };
    }

    const steps = await this.repo.getExpenseApprovalSteps();
    const currentStep =
      steps.find((s) => s.level === receipt.current_level) || steps[0] || null;
    const role = currentStep?.role || 'manager';
    const level = currentStep?.level || receipt.current_level || 1;

    const allowed = await this.canActAsRole(rejectorEmail, role, receipt.email);
    if (!allowed) {
      return {
        success: false,
        error: `Rejector must have role "${role}" for this level`,
        statusCode: 403,
      };
    }

    await this.repo.addApproval({
      receiptId: id,
      level,
      role,
      approverEmail: rejectorEmail,
      action: 'rejected',
      reason,
    });

    await this.repo.updateReceipt(id, {
      status: 'rejected',
      approver_email: rejectorEmail,
      rejection_reason: reason,
    });
    this.logAudit('expense_receipt', id, 'rejected', rejectorEmail, { reason, level });
    this.notifyClaimant(receipt, 'rejected', reason).catch((err) => {
      this.logger.error({ err, id }, 'Claimant notification failed');
    });
    return { success: true };
  }

  async rejectReceipt(
    id: string,
    rejectorEmail: string,
    reason: string,
  ): Promise<ServiceResult> {
    return this.rejectExpense(id, rejectorEmail, reason);
  }

  async reimburseExpense(id: string, actorEmail: string): Promise<ServiceResult> {
    const isAdmin = await this.isAdmin(actorEmail);
    if (!isAdmin) {
      return { success: false, error: 'Admin access required', statusCode: 403 };
    }
    const receipt = await this.repo.getReceiptById(id);
    if (!receipt) return { success: false, error: 'Expense not found' };
    if (receipt.status !== 'approved') {
      return { success: false, error: 'Only approved expenses can be reimbursed' };
    }
    await this.repo.updateReceipt(id, {
      status: 'reimbursed',
      reimbursed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      reimbursed_by: actorEmail,
    });
    this.logAudit('expense_receipt', id, 'reimbursed', actorEmail, {});
    this.notifyClaimant(receipt, 'reimbursed').catch((err) => {
      this.logger.error({ err, id }, 'Claimant notification failed');
    });
    return { success: true };
  }

  async getExpenseById(id: string): Promise<{
    expense: ExpenseReceiptRow;
    approvals: ExpenseApprovalRow[];
  } | null> {
    const expense = await this.repo.getReceiptById(id);
    if (!expense) return null;
    const approvals = await this.repo.listApprovals(id);
    return { expense, approvals };
  }

  async getReceiptById(id: string): Promise<ExpenseReceiptRow | null> {
    return this.repo.getReceiptById(id);
  }

  async getReceiptsByEmail(email: string): Promise<ExpenseReceiptRow[]> {
    return this.repo.getReceiptsByEmail(email);
  }

  async listExpenses(filters?: {
    status?: string;
    category?: string;
  }): Promise<ExpenseReceiptRow[]> {
    return this.repo.listReceipts(filters);
  }

  async listReceipts(status?: string): Promise<ExpenseReceiptRow[]> {
    return this.repo.listReceipts(status ? { status } : undefined);
  }

  async listPendingApprovals(): Promise<ExpenseReceiptRow[]> {
    return this.repo.listPendingApprovals();
  }

  async listPolicies(): Promise<ExpensePolicyRow[]> {
    return this.repo.listPolicies();
  }

  async updatePolicy(
    category: string,
    fields: {
      maxAmountPerClaim?: number;
      monthlyCap?: number;
      requiresReceipt?: boolean | number;
      active?: boolean | number;
    },
    actorEmail: string,
  ): Promise<ServiceResult> {
    if (!VALID_EXPENSE_CATEGORIES.includes(category)) {
      return { success: false, error: 'Invalid category' };
    }
    const existing = await this.repo.getPolicy(category);
    if (!existing) return { success: false, error: 'Policy not found' };

    const mapped: Parameters<typeof this.repo.updatePolicy>[1] = {};
    if (fields.maxAmountPerClaim !== undefined) {
      mapped.max_amount_per_claim = Number(fields.maxAmountPerClaim);
    }
    if (fields.monthlyCap !== undefined) {
      mapped.monthly_cap = Number(fields.monthlyCap);
    }
    if (fields.requiresReceipt !== undefined) {
      mapped.requires_receipt =
        fields.requiresReceipt === true || fields.requiresReceipt === 1 ? 1 : 0;
    }
    if (fields.active !== undefined) {
      mapped.active = fields.active === true || fields.active === 1 ? 1 : 0;
    }
    await this.repo.updatePolicy(category, mapped);
    this.logAudit('expense_policy', category, 'updated', actorEmail, mapped);
    return { success: true };
  }

  async isAdmin(email: string): Promise<boolean> {
    if (!email) return false;
    const row = await this.db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
      email,
    ]);
    return !!row;
  }

  // ── Policy checks ──

  private async checkPolicyLimits(receipt: ExpenseReceiptRow): Promise<string | null> {
    const policy = await this.repo.getPolicy(receipt.category);
    if (!policy || policy.active !== 1) return null;

    if (policy.requires_receipt === 1 && !receipt.file_id) {
      return 'A receipt attachment is required for this category';
    }
    if (policy.max_amount_per_claim > 0 && receipt.amount > policy.max_amount_per_claim) {
      return `Amount exceeds per-claim limit of ${policy.max_amount_per_claim} for ${receipt.category}`;
    }
    if (policy.monthly_cap > 0) {
      const ym = (receipt.receipt_date || receipt.created_at || '').slice(0, 7);
      const yearMonth = ym || new Date().toISOString().slice(0, 7);
      const monthTotal = await this.repo.getMonthlyTotal(
        receipt.email,
        receipt.category,
        yearMonth,
      );
      if (monthTotal + receipt.amount > policy.monthly_cap) {
        return `Amount exceeds monthly cap of ${policy.monthly_cap} for ${receipt.category} (used ${monthTotal})`;
      }
    }
    return null;
  }

  // ── Role checks ──

  private async canActAsRole(
    actorEmail: string,
    role: string,
    claimantEmail: string,
  ): Promise<boolean> {
    if (!actorEmail) return false;
    if (await this.isAdmin(actorEmail)) return true;

    if (role === 'admin') {
      return this.isAdmin(actorEmail);
    }

    if (role === 'manager') {
      const claimant = await this.db.get<MemberRow>(
        'SELECT email, reports_to FROM members WHERE email = ?',
        [claimantEmail],
      );
      if (claimant && claimant.reports_to && claimant.reports_to === actorEmail) {
        return true;
      }
      const assignment = await this.db.get<{ id: number }>(
        `SELECT id FROM role_assignments
         WHERE assignee_email = ? AND role_type = 'manager'
           AND (scope_type = 'global'
             OR (scope_type = 'member' AND scope_value = ?)
             OR scope_type = 'group')`,
        [actorEmail, claimantEmail],
      );
      return !!assignment;
    }

    if (role === 'hr') {
      const assignment = await this.db.get<{ id: number }>(
        `SELECT id FROM role_assignments
         WHERE assignee_email = ? AND role_type = 'hr'`,
        [actorEmail],
      );
      return !!assignment;
    }

    return false;
  }

  // ── Notifications ──

  private async notifyApprovers(receipt: ExpenseReceiptRow, level: number): Promise<void> {
    if (!this.dispatcher) return;
    const steps = await this.repo.getExpenseApprovalSteps();
    const step = steps.find((s) => s.level === level);
    const role = step?.role || 'manager';

    const recipients: { email: string; name: string; role: string }[] = [];
    if (role === 'manager') {
      const claimant = await this.db.get<MemberRow>(
        'SELECT email, name, reports_to FROM members WHERE email = ?',
        [receipt.email],
      );
      if (claimant?.reports_to) {
        const mgr = await this.db.get<MemberRow>(
          'SELECT email, name FROM members WHERE email = ?',
          [claimant.reports_to],
        );
        if (mgr) recipients.push({ email: mgr.email, name: mgr.name, role: 'manager' });
      }
    }

    if (recipients.length === 0) return;
    await this.dispatcher.notify({
      eventType: 'expense:submitted',
      entityType: 'expense_receipt',
      entityId: receipt.id,
      recipients,
      data: {
        expenseId: receipt.id,
        vendor: receipt.vendor,
        amount: receipt.amount,
        category: receipt.category,
        claimant: receipt.email,
      },
    });
  }

  private async notifyClaimant(
    receipt: ExpenseReceiptRow,
    event: string,
    reason?: string,
  ): Promise<void> {
    if (!this.dispatcher) return;
    const member = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ?',
      [receipt.email],
    );
    if (!member) return;
    await this.dispatcher.notify({
      eventType: `expense:${event}`,
      entityType: 'expense_receipt',
      entityId: receipt.id,
      recipients: [{ email: member.email, name: member.name, role: 'claimant' }],
      data: {
        expenseId: receipt.id,
        vendor: receipt.vendor,
        amount: receipt.amount,
        status: event,
        reason: reason || '',
      },
    });
  }

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}
