import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface ExpenseReceiptRow {
  [key: string]: unknown;
  id: string;
  email: string;
  file_id: string | null;
  vendor: string;
  amount: number;
  currency: string;
  receipt_date: string;
  category: string;
  description: string;
  status: string;
  current_level: number;
  ocr_raw_json: string;
  approver_email: string;
  rejection_reason: string;
  reimbursed_at: string | null;
  reimbursed_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExpensePolicyRow {
  [key: string]: unknown;
  category: string;
  max_amount_per_claim: number;
  monthly_cap: number;
  requires_receipt: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ExpenseApprovalRow {
  [key: string]: unknown;
  id: string;
  receipt_id: string;
  level: number;
  role: string;
  approver_email: string;
  action: string;
  reason: string;
  acted_at: string;
}

export interface ApprovalStepRow {
  [key: string]: unknown;
  id: string;
  flow_id: string;
  level: number;
  role: string;
  escalate_after_hours: number;
}

export class ExpenseRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async createReceipt(data: {
    email: string;
    fileId?: string | null;
    vendor?: string;
    amount?: number;
    currency?: string;
    receiptDate?: string;
    category?: string;
    description?: string;
    ocrRawJson?: string;
  }): Promise<ExpenseReceiptRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO expense_receipts (id, email, file_id, vendor, amount, currency,
        receipt_date, category, description, ocr_raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.email,
        data.fileId ?? null,
        data.vendor ?? '',
        data.amount ?? 0,
        data.currency ?? 'INR',
        data.receiptDate ?? '',
        data.category ?? 'other',
        data.description ?? '',
        data.ocrRawJson ?? '{}',
      ],
    );
    const row = await this.getReceiptById(id);
    if (!row) throw new Error('Failed to create receipt');
    return row;
  }

  async getReceiptById(id: string): Promise<ExpenseReceiptRow | null> {
    return this.db.get<ExpenseReceiptRow>('SELECT * FROM expense_receipts WHERE id = ?', [id]);
  }

  async getReceiptsByEmail(email: string): Promise<ExpenseReceiptRow[]> {
    return this.db.all<ExpenseReceiptRow>(
      'SELECT * FROM expense_receipts WHERE email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  async listReceipts(filters?: {
    status?: string;
    category?: string;
  }): Promise<ExpenseReceiptRow[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters?.status) {
      conds.push('status = ?');
      params.push(filters.status);
    }
    if (filters?.category) {
      conds.push('category = ?');
      params.push(filters.category);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return this.db.all<ExpenseReceiptRow>(
      `SELECT * FROM expense_receipts ${where} ORDER BY created_at DESC`,
      params,
    );
  }

  async listPendingApprovals(): Promise<ExpenseReceiptRow[]> {
    return this.db.all<ExpenseReceiptRow>(
      "SELECT * FROM expense_receipts WHERE status = 'submitted' ORDER BY created_at ASC",
    );
  }

  async updateReceipt(
    id: string,
    fields: Partial<
      Pick<
        ExpenseReceiptRow,
        | 'vendor'
        | 'amount'
        | 'currency'
        | 'receipt_date'
        | 'category'
        | 'description'
        | 'file_id'
        | 'status'
        | 'current_level'
        | 'approver_email'
        | 'rejection_reason'
        | 'reimbursed_at'
        | 'reimbursed_by'
        | 'ocr_raw_json'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE expense_receipts SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteReceipt(id: string): Promise<void> {
    await this.db.run('DELETE FROM expense_receipts WHERE id = ?', [id]);
  }

  async getMonthlyTotal(
    email: string,
    category: string,
    yearMonth: string,
  ): Promise<number> {
    const row = await this.db.get<{ total: number; [key: string]: unknown }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expense_receipts
       WHERE email = ? AND category = ?
         AND status IN ('submitted', 'approved', 'reimbursed')
         AND substr(COALESCE(NULLIF(receipt_date, ''), created_at), 1, 7) = ?`,
      [email, category, yearMonth],
    );
    return row?.total ?? 0;
  }

  // ── Policies ──

  async listPolicies(): Promise<ExpensePolicyRow[]> {
    return this.db.all<ExpensePolicyRow>(
      'SELECT * FROM expense_policies ORDER BY category ASC',
    );
  }

  async getPolicy(category: string): Promise<ExpensePolicyRow | null> {
    return this.db.get<ExpensePolicyRow>(
      'SELECT * FROM expense_policies WHERE category = ?',
      [category],
    );
  }

  async updatePolicy(
    category: string,
    fields: Partial<
      Pick<ExpensePolicyRow, 'max_amount_per_claim' | 'monthly_cap' | 'requires_receipt' | 'active'>
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(category);
    await this.db.run(`UPDATE expense_policies SET ${sets.join(', ')} WHERE category = ?`, vals);
  }

  // ── Approvals trail ──

  async addApproval(data: {
    receiptId: string;
    level: number;
    role: string;
    approverEmail: string;
    action: 'approved' | 'rejected';
    reason?: string;
  }): Promise<ExpenseApprovalRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO expense_approvals (id, receipt_id, level, role, approver_email, action, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.receiptId,
        data.level,
        data.role,
        data.approverEmail,
        data.action,
        data.reason ?? '',
      ],
    );
    const row = await this.db.get<ExpenseApprovalRow>(
      'SELECT * FROM expense_approvals WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create approval record');
    return row;
  }

  async listApprovals(receiptId: string): Promise<ExpenseApprovalRow[]> {
    return this.db.all<ExpenseApprovalRow>(
      'SELECT * FROM expense_approvals WHERE receipt_id = ? ORDER BY level ASC, acted_at ASC',
      [receiptId],
    );
  }

  // ── Approval flow steps ──

  async getExpenseApprovalSteps(): Promise<ApprovalStepRow[]> {
    return this.db.all<ApprovalStepRow>(
      `SELECT s.* FROM approval_steps s
       INNER JOIN approval_flows f ON f.id = s.flow_id
       WHERE f.entity_type = 'expense'
       ORDER BY s.level ASC`,
    );
  }
}
