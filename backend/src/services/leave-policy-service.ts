import type { Logger } from 'pino';
import type { LeavePolicyRepository } from '../repositories/leave-policy-repository';
import type { LeavePolicy } from '../repositories/leave-repository';

/** All valid accrual methods. */
const VALID_METHODS = new Set([
  'flat',
  'tenure_bucket',
  'annual_lump',
  'per_hours_worked',
  'per_days_worked',
  'tenure_linear',
  'per_pay_period',
  'prorata',
  'unlimited',
]);

/** Frontend-friendly policy shape with all restriction fields. */
export interface PolicyView {
  id: number;
  leaveType: string;
  memberTypeId: string;
  method: string;
  config: Record<string, unknown>;
  maxCarryForward: number;
  maxAccumulation: number;
  encashable: boolean;
  encashmentTrigger: string;
  probationMonths: number;
  probationAccrual: number;
  probationMode: string;
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
}

/**
 * Leave Policy service — admin CRUD for configurable leave rules.
 * Supports all 9 accrual methods, restriction fields, and clubbing rules.
 */
export class LeavePolicyService {
  constructor(
    private readonly repo: LeavePolicyRepository,
    private readonly logger: Logger,
  ) {}

  async getAll(): Promise<PolicyView[]> {
    const policies = await this.repo.getAll();
    return policies.map((p) => this.toView(p));
  }

  async getAllAdmin(): Promise<PolicyView[]> {
    const policies = await this.repo.getAllIncludingInactive();
    return policies.map((p) => this.toView(p));
  }

  async getById(id: number): Promise<PolicyView | null> {
    const policy = await this.repo.getById(id);
    return policy ? this.toView(policy) : null;
  }

  async getLeaveTypes(): Promise<string[]> {
    return this.repo.getLeaveTypes();
  }

  /** Create a new leave policy with full validation. */
  async create(data: {
    leaveType: string;
    memberTypeId: string;
    method: string;
    config: Record<string, unknown>;
    maxCarryForward?: number;
    maxAccumulation?: number;
    encashable?: boolean;
    encashmentTrigger?: string;
    probationMonths?: number;
    probationAccrual?: number;
    probationMode?: string;
    isPaid?: boolean;
    requiresApproval?: boolean;
    allowNegative?: boolean;
    negativeAction?: string;
    maxConsecutiveDays?: number;
    minNoticeDays?: number;
    medicalCertDays?: number;
    allowHalfDay?: boolean;
    sandwichPolicy?: string;
  }): Promise<{ success: boolean; policy?: PolicyView; error?: string }> {
    if (!data.leaveType?.trim()) {
      return { success: false, error: 'Leave type name is required' };
    }
    if (!data.memberTypeId?.trim()) {
      return { success: false, error: 'Member type is required' };
    }
    if (!VALID_METHODS.has(data.method)) {
      return {
        success: false,
        error: `Invalid method "${data.method}". Must be: ${[...VALID_METHODS].join(', ')}`,
      };
    }

    const existing = await this.repo.getByTypeAndMember(
      data.leaveType.trim(),
      data.memberTypeId.trim(),
    );
    if (existing && existing.active === 1) {
      return {
        success: false,
        error: `Policy already exists for ${data.leaveType} / ${data.memberTypeId}`,
      };
    }

    const configError = this.validateConfig(data.method, data.config);
    if (configError) return { success: false, error: configError };

    const policy = await this.repo.create({
      leaveType: data.leaveType.trim(),
      memberTypeId: data.memberTypeId.trim(),
      method: data.method,
      configJson: JSON.stringify(data.config),
      maxCarryForward: data.maxCarryForward ?? 0,
      maxAccumulation: data.maxAccumulation ?? 30,
      encashable: data.encashable ?? false,
      probationMonths: data.probationMonths ?? 0,
      probationAccrual: data.probationAccrual ?? 0,
      isPaid: data.isPaid ?? true,
      requiresApproval: data.requiresApproval ?? true,
    });

    // Update the restriction fields that aren't in the initial create
    if (
      data.allowNegative !== undefined ||
      data.negativeAction !== undefined ||
      data.maxConsecutiveDays !== undefined ||
      data.minNoticeDays !== undefined ||
      data.medicalCertDays !== undefined ||
      data.allowHalfDay !== undefined ||
      data.sandwichPolicy !== undefined ||
      data.probationMode !== undefined ||
      data.encashmentTrigger !== undefined
    ) {
      await this.repo.update(policy.id, {
        allowNegative: data.allowNegative,
        negativeAction: data.negativeAction,
        maxConsecutiveDays: data.maxConsecutiveDays,
        minNoticeDays: data.minNoticeDays,
        medicalCertDays: data.medicalCertDays,
        allowHalfDay: data.allowHalfDay,
        sandwichPolicy: data.sandwichPolicy,
        probationMode: data.probationMode,
        encashmentTrigger: data.encashmentTrigger,
      });
    }

    const created = await this.repo.getById(policy.id);
    this.logger.info(
      { policyId: policy.id, leaveType: data.leaveType, method: data.method },
      'Leave policy created',
    );
    return { success: true, policy: created ? this.toView(created) : this.toView(policy) };
  }

  /** Update an existing policy. */
  async update(
    id: number,
    fields: Record<string, unknown>,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'Policy not found' };

    if (fields.method !== undefined && !VALID_METHODS.has(fields.method as string)) {
      return { success: false, error: `Invalid method "${fields.method as string}"` };
    }

    if (fields.config !== undefined) {
      const method = (fields.method as string) ?? existing.method;
      const configError = this.validateConfig(method, fields.config as Record<string, unknown>);
      if (configError) return { success: false, error: configError };
    }

    const update: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      method: 'method',
      config: 'configJson',
      maxCarryForward: 'maxCarryForward',
      maxAccumulation: 'maxAccumulation',
      encashable: 'encashable',
      encashmentTrigger: 'encashmentTrigger',
      probationMonths: 'probationMonths',
      probationAccrual: 'probationAccrual',
      probationMode: 'probationMode',
      isPaid: 'isPaid',
      requiresApproval: 'requiresApproval',
      active: 'active',
      allowNegative: 'allowNegative',
      negativeAction: 'negativeAction',
      maxConsecutiveDays: 'maxConsecutiveDays',
      minNoticeDays: 'minNoticeDays',
      medicalCertDays: 'medicalCertDays',
      allowHalfDay: 'allowHalfDay',
      sandwichPolicy: 'sandwichPolicy',
    };

    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      const mapped = fieldMap[key];
      if (!mapped) continue;
      if (key === 'config') {
        update.configJson = JSON.stringify(val);
      } else {
        update[mapped] = val;
      }
    }

    await this.repo.update(id, update as Parameters<typeof this.repo.update>[1]);
    this.logger.info({ policyId: id, fields: Object.keys(update) }, 'Leave policy updated');
    return { success: true };
  }

  async remove(id: number): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'Policy not found' };
    await this.repo.softDelete(id);
    this.logger.info({ policyId: id, leaveType: existing.leave_type }, 'Leave policy deactivated');
    return { success: true };
  }

  // ── Clubbing rules ──

  async getClubbingRules(): Promise<
    Array<{ id: number; leaveTypeA: string; leaveTypeB: string; gapDays: number }>
  > {
    return this.repo.getClubbingRules();
  }

  async addClubbingRule(
    leaveTypeA: string,
    leaveTypeB: string,
    gapDays: number,
  ): Promise<{ success: boolean; error?: string }> {
    if (!leaveTypeA || !leaveTypeB) {
      return { success: false, error: 'Both leave types are required' };
    }
    if (leaveTypeA === leaveTypeB) {
      return { success: false, error: 'Cannot create a clubbing rule between the same leave type' };
    }
    await this.repo.addClubbingRule(leaveTypeA, leaveTypeB, gapDays);
    this.logger.info({ leaveTypeA, leaveTypeB, gapDays }, 'Clubbing rule added');
    return { success: true };
  }

  async removeClubbingRule(
    leaveTypeA: string,
    leaveTypeB: string,
  ): Promise<{ success: boolean; error?: string }> {
    await this.repo.removeClubbingRule(leaveTypeA, leaveTypeB);
    this.logger.info({ leaveTypeA, leaveTypeB }, 'Clubbing rule removed');
    return { success: true };
  }

  // ── Private helpers ──

  private toView(p: LeavePolicy): PolicyView {
    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(p.config_json) as Record<string, unknown>;
    } catch {
      config = {};
    }

    return {
      id: p.id,
      leaveType: p.leave_type,
      memberTypeId: p.member_type_id,
      method: p.method,
      config,
      maxCarryForward: p.max_carry_forward,
      maxAccumulation: p.max_accumulation,
      encashable: p.encashable === 1,
      encashmentTrigger: (p.encashment_trigger as string) ?? '',
      probationMonths: p.probation_months,
      probationAccrual: p.probation_accrual,
      probationMode: (p.probation_mode as string) ?? 'full',
      isPaid: p.is_paid === 1,
      requiresApproval: p.requires_approval === 1,
      active: p.active === 1,
      allowNegative: (p.allow_negative as number) === 1,
      negativeAction: (p.negative_action as string) ?? 'block',
      maxConsecutiveDays: (p.max_consecutive_days as number) ?? 0,
      minNoticeDays: (p.min_notice_days as number) ?? 0,
      medicalCertDays: (p.medical_cert_days as number) ?? 0,
      allowHalfDay: (p.allow_half_day as number) !== 0,
      sandwichPolicy: (p.sandwich_policy as string) ?? 'exclude_weekends',
    };
  }

  /** Validate config_json structure per accrual method. */
  private validateConfig(method: string, config: Record<string, unknown>): string | null {
    switch (method) {
      case 'flat': {
        if (typeof config.accrualPerMonth !== 'number' || config.accrualPerMonth < 0) {
          return 'Flat method: "accrualPerMonth" must be a non-negative number';
        }
        return null;
      }
      case 'tenure_bucket': {
        const buckets = config.buckets;
        if (!Array.isArray(buckets) || buckets.length === 0) {
          return 'Tenure bucket: "buckets" array is required';
        }
        for (let i = 0; i < buckets.length; i++) {
          const b = buckets[i] as Record<string, unknown>;
          if (typeof b.minMonths !== 'number') return `Bucket ${i}: minMonths must be a number`;
          if (b.maxMonths !== null && typeof b.maxMonths !== 'number')
            return `Bucket ${i}: maxMonths must be a number or null`;
          if (typeof b.accrualPerMonth !== 'number' || b.accrualPerMonth < 0)
            return `Bucket ${i}: accrualPerMonth must be non-negative`;
        }
        return null;
      }
      case 'annual_lump': {
        if (typeof config.annualDays !== 'number' || config.annualDays < 0) {
          return 'Annual lump: "annualDays" must be non-negative';
        }
        return null;
      }
      case 'per_hours_worked': {
        if (typeof config.hoursPerLeaveHour !== 'number' || config.hoursPerLeaveHour <= 0) {
          return 'Per hours worked: "hoursPerLeaveHour" must be positive';
        }
        return null;
      }
      case 'per_days_worked': {
        if (typeof config.daysPerLeaveDay !== 'number' || config.daysPerLeaveDay <= 0) {
          return 'Per days worked: "daysPerLeaveDay" must be positive';
        }
        return null;
      }
      case 'tenure_linear': {
        if (typeof config.basePerMonth !== 'number')
          return 'Tenure linear: "basePerMonth" required';
        if (typeof config.incrementPerYear !== 'number')
          return 'Tenure linear: "incrementPerYear" required';
        return null;
      }
      case 'per_pay_period': {
        if (typeof config.daysPerPeriod !== 'number' || config.daysPerPeriod < 0) {
          return 'Per pay period: "daysPerPeriod" must be non-negative';
        }
        return null;
      }
      case 'prorata': {
        if (typeof config.annualDays !== 'number' || config.annualDays < 0) {
          return 'Pro-rata: "annualDays" must be non-negative';
        }
        return null;
      }
      case 'unlimited':
        return null;
      default:
        return `Unknown method: ${method}`;
    }
  }
}
