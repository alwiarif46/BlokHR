import type { Logger } from 'pino';
import type { LeaveRepository, LeaveRequest } from '../repositories/leave-repository';
import type { LeaveNotificationService } from './leave-notifications';
import type { EventBus } from '../events';

export interface LeaveSubmitResult {
  success: boolean;
  leave?: LeaveRequest;
  paidType?: string;
  error?: string;
}

export interface PtoBalanceResult {
  accrued: number;
  used: number;
  remaining: number;
  rate: number;
  tenureYears: number;
}

/** Calculate days between two date strings, accounting for half-day kinds. */
function calculateDaysRequested(startDate: string, endDate: string, kind: string): number {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(1, Math.round(diffMs / 86400000) + 1);

  if (kind === 'FirstHalf' || kind === 'SecondHalf') {
    return diffDays * 0.5;
  }
  return diffDays;
}

/** Calculate tenure in months from joining date to now. */
function tenureMonths(joiningDate: string): number {
  if (!joiningDate) return 0;
  const joined = new Date(joiningDate + 'T00:00:00');
  const now = new Date();
  const months =
    (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  return Math.max(0, months);
}

/** Calculate monthly accrual rate based on policy and tenure. */
function calculateAccrualRate(policyConfig: string, method: string, tenure: number): number {
  try {
    const config = JSON.parse(policyConfig) as Record<string, unknown>;

    if (method === 'flat') {
      return (config.accrualPerMonth as number) ?? 0;
    }

    if (method === 'tenure_bucket') {
      const buckets =
        (config.buckets as Array<{
          minMonths: number;
          maxMonths: number | null;
          accrualPerMonth: number;
        }>) ?? [];
      for (const bucket of buckets) {
        const max = bucket.maxMonths ?? Infinity;
        if (tenure >= bucket.minMonths && tenure < max) {
          return bucket.accrualPerMonth;
        }
      }
      return 0;
    }

    if (method === 'tenure_linear') {
      const base = (config.base as number) ?? 0;
      const multiplier = (config.multiplierPerYear as number) ?? 0;
      return base + (tenure / 12) * multiplier;
    }

    if (method === 'annual_grant') {
      return (config.annualDays as number) ?? 0;
    }

    return 0;
  } catch {
    return 0;
  }
}

/**
 * Leave service — all leave business logic.
 * Handles submission, two-tier approval, rejection, cancellation, PTO calculation.
 */
export class LeaveService {
  private readonly notifier: LeaveNotificationService | null;

  constructor(
    private readonly repo: LeaveRepository,
    private readonly logger: Logger,
    notifier?: LeaveNotificationService,
    private readonly eventBus?: EventBus,
  ) {
    this.notifier = notifier ?? null;
  }

  /** Submit a new leave request. */
  async submit(data: {
    personName: string;
    personEmail: string;
    leaveType: string;
    kind: string;
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<LeaveSubmitResult> {
    // Validate dates
    if (!data.startDate || !data.endDate) {
      return { success: false, error: 'Start and end dates are required' };
    }
    if (data.endDate < data.startDate) {
      return { success: false, error: 'End date cannot be before start date' };
    }

    // Get member
    const member = await this.repo.getMemberForLeave(data.personEmail);
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Get policy
    const policy = await this.repo.getLeavePolicy(data.leaveType, member.member_type_id);

    // Calculate days
    const daysRequested = calculateDaysRequested(data.startDate, data.endDate, data.kind);

    // Determine paid/unpaid from policy
    let paidType = '';
    if (policy) {
      paidType = policy.is_paid === 1 ? 'paid' : 'unpaid';
    }

    const leave = await this.repo.createLeaveRequest({
      personName: data.personName,
      personEmail: data.personEmail,
      leaveType: data.leaveType,
      kind: data.kind,
      startDate: data.startDate,
      endDate: data.endDate,
      daysRequested,
      reason: data.reason,
      paidType,
      policyName: policy?.leave_type ?? data.leaveType,
    });

    this.logger.info(
      { leaveId: leave.id, email: data.personEmail, type: data.leaveType, days: daysRequested },
      'Leave submitted',
    );

    // Fire notification (non-blocking — failures logged, never thrown)
    if (this.notifier) {
      this.notifier.onLeaveSubmitted(leave).catch((err) => {
        this.logger.error({ err, leaveId: leave.id }, 'Leave submit notification failed');
      });
    }

    this.eventBus?.emit('leave.submitted', { leaveId: leave.id, email: data.personEmail, name: data.personName, leaveType: data.leaveType, startDate: data.startDate, endDate: data.endDate, days: daysRequested });

    return { success: true, leave, paidType };
  }

  /** Manager approves a leave. Pending → Approved by Manager. */
  async managerApprove(
    leaveId: string,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const leave = await this.repo.getLeaveById(leaveId);
    if (!leave) return { success: false, error: 'Leave not found' };
    if (leave.status !== 'Pending') {
      return {
        success: false,
        error: `Cannot manager-approve a leave with status "${leave.status}"`,
      };
    }

    await this.repo.updateLeaveStatus(leaveId, {
      status: 'Approved by Manager',
      manager_approver_email: approverEmail,
    });

    this.logger.info({ leaveId, approverEmail }, 'Leave manager-approved');

    // Refresh leave to get updated status
    const updated = await this.repo.getLeaveById(leaveId);
    if (this.notifier && updated) {
      this.notifier.onManagerApproved(updated, approverEmail).catch((err) => {
        this.logger.error({ err, leaveId }, 'Manager approve notification failed');
      });
    }

    return { success: true };
  }

  /** HR approves a leave. Approved by Manager → Approved. Also updates PTO used. */
  async hrApprove(
    leaveId: string,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const leave = await this.repo.getLeaveById(leaveId);
    if (!leave) return { success: false, error: 'Leave not found' };
    if (leave.status !== 'Approved by Manager') {
      return { success: false, error: `Cannot HR-approve a leave with status "${leave.status}"` };
    }

    await this.repo.updateLeaveStatus(leaveId, {
      status: 'Approved',
      hr_approver_email: approverEmail,
    });

    // Update PTO used
    if (leave.paid_type === 'paid') {
      const year = new Date(leave.start_date + 'T00:00:00').getFullYear();
      const balance = await this.repo.getPtoBalance(leave.person_email, leave.leave_type, year);
      const currentUsed = balance?.used ?? 0;
      await this.repo.upsertPtoBalance(leave.person_email, leave.leave_type, year, {
        used: currentUsed + leave.days_requested,
      });
    }

    this.logger.info({ leaveId, approverEmail }, 'Leave HR-approved');

    const hrUpdated = await this.repo.getLeaveById(leaveId);
    if (this.notifier && hrUpdated) {
      this.notifier.onHrApproved(hrUpdated, approverEmail).catch((err) => {
        this.logger.error({ err, leaveId }, 'HR approve notification failed');
      });
    }

    if (hrUpdated) this.eventBus?.emit('leave.approved', { leaveId, email: hrUpdated.person_email, name: hrUpdated.person_name, leaveType: hrUpdated.leave_type, startDate: hrUpdated.start_date, endDate: hrUpdated.end_date, days: hrUpdated.days_requested, approverEmail });

    return { success: true };
  }

  /** Reject a leave at any pending stage. */
  async reject(
    leaveId: string,
    approverEmail: string,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const leave = await this.repo.getLeaveById(leaveId);
    if (!leave) return { success: false, error: 'Leave not found' };
    if (
      leave.status === 'Approved' ||
      leave.status === 'Rejected' ||
      leave.status === 'Cancelled'
    ) {
      return { success: false, error: `Cannot reject a leave with status "${leave.status}"` };
    }

    await this.repo.updateLeaveStatus(leaveId, {
      status: 'Rejected',
      rejection_reason: reason,
    });

    this.logger.info({ leaveId, approverEmail, reason }, 'Leave rejected');

    const rejUpdated = await this.repo.getLeaveById(leaveId);
    if (this.notifier && rejUpdated) {
      this.notifier.onRejected(rejUpdated, approverEmail, reason).catch((err) => {
        this.logger.error({ err, leaveId }, 'Reject notification failed');
      });
    }

    if (rejUpdated) this.eventBus?.emit('leave.rejected', { leaveId, email: rejUpdated.person_email, name: rejUpdated.person_name, leaveType: rejUpdated.leave_type, startDate: rejUpdated.start_date, endDate: rejUpdated.end_date, days: rejUpdated.days_requested, approverEmail, reason });

    return { success: true };
  }

  /** Delete or cancel a leave. */
  async deleteOrCancel(
    leaveId: string,
    cancelledBy?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const leave = await this.repo.getLeaveById(leaveId);
    if (!leave) return { success: false, error: 'Leave not found' };

    if (cancelledBy) {
      // Employee cancelling their own — mark as Cancelled
      await this.repo.updateLeaveStatus(leaveId, {
        status: 'Cancelled',
        cancelled_by: cancelledBy,
      });
      this.logger.info({ leaveId, cancelledBy }, 'Leave cancelled');
    } else {
      // Admin deleting — hard delete
      // If it was approved and paid, reverse the PTO usage
      if (leave.status === 'Approved' && leave.paid_type === 'paid') {
        const year = new Date(leave.start_date + 'T00:00:00').getFullYear();
        const balance = await this.repo.getPtoBalance(leave.person_email, leave.leave_type, year);
        if (balance) {
          const newUsed = Math.max(0, balance.used - leave.days_requested);
          await this.repo.upsertPtoBalance(leave.person_email, leave.leave_type, year, {
            used: newUsed,
          });
        }
      }
      await this.repo.deleteLeave(leaveId);
      this.logger.info({ leaveId }, 'Leave deleted');
    }

    this.eventBus?.emit('leave.cancelled', { leaveId, email: leave.person_email, name: leave.person_name, leaveType: leave.leave_type, startDate: leave.start_date, endDate: leave.end_date, days: leave.days_requested });

    return { success: true };
  }

  /** Get all leaves for an employee. */
  async getLeaves(email: string): Promise<LeaveRequest[]> {
    return this.repo.getLeavesByEmail(email);
  }

  /** Calculate PTO balance for an employee. */
  async getPtoBalance(email: string): Promise<PtoBalanceResult> {
    const member = await this.repo.getMemberForLeave(email);
    if (!member) {
      return { accrued: 0, used: 0, remaining: 0, rate: 0, tenureYears: 0 };
    }

    const tenure = tenureMonths(member.joining_date);
    const tenureYears = tenure / 12;
    const currentYear = new Date().getFullYear();

    // Sum accrued and used across all paid leave types for the current year
    const balances = await this.repo.getAllPtoBalances(email, currentYear);
    let totalAccrued = 0;
    let totalUsed = 0;

    for (const b of balances) {
      totalAccrued += b.accrued + b.carry_forward;
      totalUsed += b.used;
    }

    // Calculate current monthly rate from Earned leave policy (primary PTO)
    const earnedPolicy = await this.repo.getLeavePolicy('Earned', member.member_type_id);
    let rate = 0;
    if (earnedPolicy) {
      const inProbation = tenure < earnedPolicy.probation_months;
      if (inProbation) {
        rate = earnedPolicy.probation_accrual;
      } else {
        rate = calculateAccrualRate(earnedPolicy.config_json, earnedPolicy.method, tenure);
      }
    }

    return {
      accrued: totalAccrued,
      used: totalUsed,
      remaining: totalAccrued - totalUsed,
      rate,
      tenureYears,
    };
  }
}
