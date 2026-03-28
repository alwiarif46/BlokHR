import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface LeaveRequest {
  [key: string]: unknown;
  id: string;
  person_name: string;
  person_email: string;
  leave_type: string;
  policy_name: string;
  kind: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string;
  status: string;
  paid_type: string;
  rejection_reason: string;
  manager_approver_email: string;
  hr_approver_email: string;
  cancelled_by: string;
  created_at: string;
  updated_at: string;
}

export interface LeavePolicy {
  [key: string]: unknown;
  id: number;
  leave_type: string;
  member_type_id: string;
  method: string;
  config_json: string;
  max_carry_forward: number;
  max_accumulation: number;
  encashable: number;
  probation_months: number;
  probation_accrual: number;
  is_paid: number;
  requires_approval: number;
  active: number;
}

export interface PtoBalance {
  [key: string]: unknown;
  email: string;
  leave_type: string;
  year: number;
  accrued: number;
  used: number;
  carry_forward: number;
}

export interface MemberForLeave {
  [key: string]: unknown;
  email: string;
  name: string;
  member_type_id: string;
  joining_date: string;
}

/**
 * Leave repository — all leave-related database operations.
 */
export class LeaveRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Create a new leave request. Returns the created record. */
  async createLeaveRequest(data: {
    personName: string;
    personEmail: string;
    leaveType: string;
    kind: string;
    startDate: string;
    endDate: string;
    daysRequested: number;
    reason: string;
    paidType: string;
    policyName: string;
  }): Promise<LeaveRequest> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO leave_requests
       (id, person_name, person_email, leave_type, policy_name, kind, start_date, end_date, days_requested, reason, paid_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.personName,
        data.personEmail,
        data.leaveType,
        data.policyName,
        data.kind,
        data.startDate,
        data.endDate,
        data.daysRequested,
        data.reason,
        data.paidType,
      ],
    );
    const created = await this.db.get<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [
      id,
    ]);
    if (!created) throw new Error('Failed to create leave request');
    return created;
  }

  /** Get all leave requests for an employee. */
  async getLeavesByEmail(email: string): Promise<LeaveRequest[]> {
    return this.db.all<LeaveRequest>(
      'SELECT * FROM leave_requests WHERE person_email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  /** Get a leave request by ID. */
  async getLeaveById(id: string): Promise<LeaveRequest | null> {
    return this.db.get<LeaveRequest>('SELECT * FROM leave_requests WHERE id = ?', [id]);
  }

  /** Update leave request status and related fields. */
  async updateLeaveStatus(
    id: string,
    fields: Partial<
      Pick<
        LeaveRequest,
        | 'status'
        | 'rejection_reason'
        | 'manager_approver_email'
        | 'hr_approver_email'
        | 'cancelled_by'
        | 'paid_type'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE leave_requests SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Delete a leave request. */
  async deleteLeave(id: string): Promise<void> {
    await this.db.run('DELETE FROM leave_requests WHERE id = ?', [id]);
  }

  /** Get leave policy for a leave type and member type. */
  async getLeavePolicy(leaveType: string, memberTypeId: string): Promise<LeavePolicy | null> {
    return this.db.get<LeavePolicy>(
      'SELECT * FROM leave_policies WHERE leave_type = ? AND member_type_id = ? AND active = 1',
      [leaveType, memberTypeId],
    );
  }

  /** Get member info needed for leave calculations. */
  async getMemberForLeave(email: string): Promise<MemberForLeave | null> {
    return this.db.get<MemberForLeave>(
      'SELECT email, name, member_type_id, joining_date FROM members WHERE email = ? AND active = 1',
      [email],
    );
  }

  /** Get PTO balance for an employee, leave type, and year. */
  async getPtoBalance(email: string, leaveType: string, year: number): Promise<PtoBalance | null> {
    return this.db.get<PtoBalance>(
      'SELECT * FROM pto_balances WHERE email = ? AND leave_type = ? AND year = ?',
      [email, leaveType, year],
    );
  }

  /** Get all PTO balances for an employee for a year. */
  async getAllPtoBalances(email: string, year: number): Promise<PtoBalance[]> {
    return this.db.all<PtoBalance>('SELECT * FROM pto_balances WHERE email = ? AND year = ?', [
      email,
      year,
    ]);
  }

  /** Upsert PTO balance — create or update accrued/used. */
  async upsertPtoBalance(
    email: string,
    leaveType: string,
    year: number,
    fields: { accrued?: number; used?: number; carry_forward?: number },
  ): Promise<void> {
    const existing = await this.getPtoBalance(email, leaveType, year);
    if (existing) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      for (const [key, val] of Object.entries(fields)) {
        if (val !== undefined) {
          sets.push(`${key} = ?`);
          vals.push(val);
        }
      }
      if (sets.length === 0) return;
      sets.push("updated_at = datetime('now')");
      vals.push(email, leaveType, year);
      await this.db.run(
        `UPDATE pto_balances SET ${sets.join(', ')} WHERE email = ? AND leave_type = ? AND year = ?`,
        vals,
      );
    } else {
      await this.db.run(
        'INSERT INTO pto_balances (email, leave_type, year, accrued, used, carry_forward) VALUES (?, ?, ?, ?, ?, ?)',
        [email, leaveType, year, fields.accrued ?? 0, fields.used ?? 0, fields.carry_forward ?? 0],
      );
    }
  }

  /** Get approved leaves overlapping a date (to check if someone is on leave today). */
  async getApprovedLeavesForDate(date: string): Promise<LeaveRequest[]> {
    return this.db.all<LeaveRequest>(
      `SELECT * FROM leave_requests
       WHERE status = 'Approved' AND start_date <= ? AND end_date >= ?`,
      [date, date],
    );
  }

  /** Count pending leaves (for pending actions). */
  async countPendingLeaves(): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM leave_requests WHERE status IN ('Pending', 'Approved by Manager')",
    );
    return row?.cnt ?? 0;
  }

  /** Get all pending leaves with details (for pending actions detail). */
  async getPendingLeavesDetail(): Promise<LeaveRequest[]> {
    return this.db.all<LeaveRequest>(
      "SELECT * FROM leave_requests WHERE status IN ('Pending', 'Approved by Manager') ORDER BY created_at DESC",
    );
  }
}
