import type { DatabaseEngine } from '../db/engine';
import type { LeavePolicy } from './leave-repository';

/**
 * Leave Policy repository — admin CRUD for leave type configurations.
 * Each policy defines accrual rules, limits, and approval requirements
 * for a specific leave type + member type combination.
 */
export class LeavePolicyRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Get all active policies. */
  async getAll(): Promise<LeavePolicy[]> {
    return this.db.all<LeavePolicy>(
      'SELECT * FROM leave_policies WHERE active = 1 ORDER BY leave_type, member_type_id',
    );
  }

  /** Get all policies including inactive (for admin view). */
  async getAllIncludingInactive(): Promise<LeavePolicy[]> {
    return this.db.all<LeavePolicy>(
      'SELECT * FROM leave_policies ORDER BY active DESC, leave_type, member_type_id',
    );
  }

  /** Get a policy by ID. */
  async getById(id: number): Promise<LeavePolicy | null> {
    return this.db.get<LeavePolicy>('SELECT * FROM leave_policies WHERE id = ?', [id]);
  }

  /** Get a policy by leave type + member type. */
  async getByTypeAndMember(leaveType: string, memberTypeId: string): Promise<LeavePolicy | null> {
    return this.db.get<LeavePolicy>(
      'SELECT * FROM leave_policies WHERE leave_type = ? AND member_type_id = ?',
      [leaveType, memberTypeId],
    );
  }

  /** Create a new leave policy. */
  async create(data: {
    leaveType: string;
    memberTypeId: string;
    method: string;
    configJson: string;
    maxCarryForward: number;
    maxAccumulation: number;
    encashable: boolean;
    probationMonths: number;
    probationAccrual: number;
    isPaid: boolean;
    requiresApproval: boolean;
  }): Promise<LeavePolicy> {
    await this.db.run(
      `INSERT INTO leave_policies
         (leave_type, member_type_id, method, config_json, max_carry_forward,
          max_accumulation, encashable, probation_months, probation_accrual,
          is_paid, requires_approval)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.leaveType,
        data.memberTypeId,
        data.method,
        data.configJson,
        data.maxCarryForward,
        data.maxAccumulation,
        data.encashable ? 1 : 0,
        data.probationMonths,
        data.probationAccrual,
        data.isPaid ? 1 : 0,
        data.requiresApproval ? 1 : 0,
      ],
    );

    const created = await this.db.get<LeavePolicy>(
      'SELECT * FROM leave_policies WHERE leave_type = ? AND member_type_id = ?',
      [data.leaveType, data.memberTypeId],
    );
    if (!created) throw new Error('Failed to create leave policy');
    return created;
  }

  /** Update a leave policy by ID. */
  async update(
    id: number,
    fields: Partial<{
      method: string;
      configJson: string;
      maxCarryForward: number;
      maxAccumulation: number;
      encashable: boolean;
      probationMonths: number;
      probationAccrual: number;
      isPaid: boolean;
      requiresApproval: boolean;
      active: boolean;
      allowNegative: boolean;
      negativeAction: string;
      maxConsecutiveDays: number;
      minNoticeDays: number;
      medicalCertDays: number;
      allowHalfDay: boolean;
      sandwichPolicy: string;
      probationMode: string;
      encashmentTrigger: string;
    }>,
  ): Promise<void> {
    const colMap: Record<string, string> = {
      method: 'method',
      configJson: 'config_json',
      maxCarryForward: 'max_carry_forward',
      maxAccumulation: 'max_accumulation',
      encashable: 'encashable',
      probationMonths: 'probation_months',
      probationAccrual: 'probation_accrual',
      isPaid: 'is_paid',
      requiresApproval: 'requires_approval',
      active: 'active',
      allowNegative: 'allow_negative',
      negativeAction: 'negative_action',
      maxConsecutiveDays: 'max_consecutive_days',
      minNoticeDays: 'min_notice_days',
      medicalCertDays: 'medical_cert_days',
      allowHalfDay: 'allow_half_day',
      sandwichPolicy: 'sandwich_policy',
      probationMode: 'probation_mode',
      encashmentTrigger: 'encashment_trigger',
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      const col = colMap[key];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE leave_policies SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Soft-delete a policy (set active = 0). */
  async softDelete(id: number): Promise<void> {
    await this.db.run(
      "UPDATE leave_policies SET active = 0, updated_at = datetime('now') WHERE id = ?",
      [id],
    );
  }

  /** Get all distinct leave types currently in use. */
  async getLeaveTypes(): Promise<string[]> {
    const rows = await this.db.all<{ leave_type: string }>(
      'SELECT DISTINCT leave_type FROM leave_policies WHERE active = 1 ORDER BY leave_type',
    );
    return rows.map((r) => r.leave_type);
  }

  // ── Clubbing Rules ──

  /** Get all clubbing rules. */
  async getClubbingRules(): Promise<
    Array<{ id: number; leaveTypeA: string; leaveTypeB: string; gapDays: number }>
  > {
    const rows = await this.db.all<{
      id: number;
      leave_type_a: string;
      leave_type_b: string;
      gap_days: number;
      [key: string]: unknown;
    }>('SELECT * FROM leave_clubbing_rules ORDER BY leave_type_a, leave_type_b');
    return rows.map((r) => ({
      id: r.id,
      leaveTypeA: r.leave_type_a,
      leaveTypeB: r.leave_type_b,
      gapDays: r.gap_days,
    }));
  }

  /** Add a clubbing rule. */
  async addClubbingRule(leaveTypeA: string, leaveTypeB: string, gapDays: number): Promise<void> {
    await this.db.run(
      'INSERT OR IGNORE INTO leave_clubbing_rules (leave_type_a, leave_type_b, gap_days) VALUES (?, ?, ?)',
      [leaveTypeA, leaveTypeB, gapDays],
    );
    // Also insert the reverse direction
    await this.db.run(
      'INSERT OR IGNORE INTO leave_clubbing_rules (leave_type_a, leave_type_b, gap_days) VALUES (?, ?, ?)',
      [leaveTypeB, leaveTypeA, gapDays],
    );
  }

  /** Remove a clubbing rule (both directions). */
  async removeClubbingRule(leaveTypeA: string, leaveTypeB: string): Promise<void> {
    await this.db.run(
      'DELETE FROM leave_clubbing_rules WHERE (leave_type_a = ? AND leave_type_b = ?) OR (leave_type_a = ? AND leave_type_b = ?)',
      [leaveTypeA, leaveTypeB, leaveTypeB, leaveTypeA],
    );
  }

  /**
   * Check if two leave types have a clubbing restriction.
   * Returns gap_days if restricted, null if no restriction.
   */
  async checkClubbingRestriction(leaveTypeA: string, leaveTypeB: string): Promise<number | null> {
    const row = await this.db.get<{ gap_days: number; [key: string]: unknown }>(
      'SELECT gap_days FROM leave_clubbing_rules WHERE leave_type_a = ? AND leave_type_b = ?',
      [leaveTypeA, leaveTypeB],
    );
    return row ? row.gap_days : null;
  }
}
