import type { Logger } from 'pino';
import type {
  RegularizationRepository,
  Regularization,
} from '../repositories/regularization-repository';
import type { ClockRepository } from '../repositories/clock-repository';
import type { EventBus } from '../events';
import type { NotificationDispatcher } from './notification/dispatcher';
import type { DatabaseEngine } from '../db/engine';

interface MemberNotifInfo {
  [key: string]: unknown;
  email: string;
  name: string;
  teams_user_id: string;
}

interface RoleRow {
  [key: string]: unknown;
  assignee_email: string;
}

/**
 * Regularization service — attendance correction business logic.
 * Handles submit, two-tier approval (manager → HR), rejection.
 * On final approval, patches the actual attendance record.
 */
export class RegularizationService {
  constructor(
    private readonly repo: RegularizationRepository,
    private readonly clockRepo: ClockRepository,
    private readonly db: DatabaseEngine,
    private readonly dispatcher: NotificationDispatcher | null,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  /** Submit a new regularization request. */
  async submit(data: {
    email: string;
    name: string;
    date: string;
    correctionType: string;
    inTime: string;
    outTime: string;
    reason: string;
  }): Promise<{ success: boolean; regularization?: Regularization; error?: string }> {
    if (!data.email || !data.date) {
      return { success: false, error: 'email and date are required' };
    }
    if (!data.reason) {
      return { success: false, error: 'Reason is required for correction requests' };
    }

    const reg = await this.repo.create(data);

    this.logger.info(
      { regId: reg.id, email: data.email, date: data.date, type: data.correctionType },
      'Regularization submitted',
    );

    // Notify managers
    if (this.dispatcher) {
      this.notifySubmitted(reg).catch((err) => {
        this.logger.error({ err, regId: reg.id }, 'Regularization submit notification failed');
      });
    }

    this.eventBus?.emit('regularization.submitted', { regularizationId: String(reg.id), email: data.email, date: data.date });

    return { success: true, regularization: reg };
  }

  /** Approve a regularization (manager or HR tier). */
  async approve(
    id: string,
    role: string,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const reg = await this.repo.getById(id);
    if (!reg) return { success: false, error: 'Regularization not found' };

    if (role === 'manager') {
      if (reg.status !== 'pending') {
        return { success: false, error: `Cannot manager-approve with status "${reg.status}"` };
      }
      await this.repo.update(id, {
        status: 'manager_approved',
        manager_approver_email: approverEmail,
      });

      this.logger.info({ regId: id, approverEmail }, 'Regularization manager-approved');

      // Notify: employee gets status update, HR gets approval card
      if (this.dispatcher) {
        const updated = await this.repo.getById(id);
        if (updated) {
          this.notifyManagerApproved(updated, approverEmail).catch((err) => {
            this.logger.error({ err, regId: id }, 'Reg manager-approve notification failed');
          });
        }
      }
    } else if (role === 'hr') {
      if (reg.status !== 'manager_approved') {
        return { success: false, error: `Cannot HR-approve with status "${reg.status}"` };
      }
      await this.repo.update(id, {
        status: 'approved',
        hr_approver_email: approverEmail,
      });

      this.logger.info({ regId: id, approverEmail }, 'Regularization HR-approved');

      // Apply the correction to attendance
      await this.applyCorrection(reg);

      // Notify: employee + manager get final status
      if (this.dispatcher) {
        const updated = await this.repo.getById(id);
        if (updated) {
          this.notifyHrApproved(updated, approverEmail).catch((err) => {
            this.logger.error({ err, regId: id }, 'Reg HR-approve notification failed');
          });
        }
      }
    } else {
      return { success: false, error: `Invalid role: ${role}` };
    }

    this.eventBus?.emit('regularization.approved', { regularizationId: id, email: reg.email, date: reg.date, approverEmail });

    return { success: true };
  }

  /** Reject a regularization. */
  async reject(
    id: string,
    approverEmail: string,
    comments: string,
  ): Promise<{ success: boolean; error?: string }> {
    const reg = await this.repo.getById(id);
    if (!reg) return { success: false, error: 'Regularization not found' };

    if (reg.status === 'approved' || reg.status === 'rejected') {
      return { success: false, error: `Cannot reject with status "${reg.status}"` };
    }

    await this.repo.update(id, {
      status: 'rejected',
      rejection_comments: comments,
    });

    this.logger.info({ regId: id, approverEmail, comments }, 'Regularization rejected');

    if (this.dispatcher) {
      const updated = await this.repo.getById(id);
      if (updated) {
        this.notifyRejected(updated, approverEmail, comments).catch((err) => {
          this.logger.error({ err, regId: id }, 'Reg rejection notification failed');
        });
      }
    }

    this.eventBus?.emit('regularization.rejected', { regularizationId: id, email: reg.email, date: reg.date, approverEmail, reason: comments });

    return { success: true };
  }

  /** Get all regularizations for an employee. */
  async getByEmail(email: string): Promise<Regularization[]> {
    return this.repo.getByEmail(email);
  }

  /**
   * Apply the approved correction to the actual attendance record.
   * Patches clock times and recalculates worked hours and late status.
   */
  private async applyCorrection(reg: Regularization): Promise<void> {
    const daily = await this.clockRepo.getDaily(reg.email, reg.date);
    if (!daily) {
      this.logger.warn(
        { regId: reg.id, email: reg.email, date: reg.date },
        'No attendance record to correct',
      );
      return;
    }

    const updates: Record<string, unknown> = {};

    if ((reg.correction_type === 'clock-in' || reg.correction_type === 'both') && reg.in_time) {
      // Build full ISO timestamp from date + time
      const correctedIn = `${reg.date}T${reg.in_time}:00.000Z`;
      updates.first_in = correctedIn;

      // Recalculate late status
      const memberShift = await this.clockRepo.getMemberShiftInfo(reg.email);
      if (memberShift) {
        const shift = memberShift.individual_shift_start || memberShift.group_shift_start;
        if (shift) {
          const lateRules = await this.clockRepo.getLateRules();
          const shiftParts = shift.split(':').map(Number);
          const shiftMin = shiftParts[0] * 60 + (shiftParts[1] || 0);
          const inParts = reg.in_time.split(':').map(Number);
          const inMin = inParts[0] * 60 + (inParts[1] || 0);
          const lateBy = inMin - shiftMin - lateRules.grace_minutes;

          if (lateBy <= 0 && daily.is_late === 1) {
            // Was late, now corrected to not late — decrement counter
            updates.is_late = 0;
            updates.late_minutes = 0;
            const yearMonth = reg.date.substring(0, 7);
            const currentCount = await this.clockRepo.getMonthlyLateCount(reg.email, yearMonth);
            if (currentCount > 0) {
              await this.db.run(
                'UPDATE monthly_late_counts SET late_count = late_count - 1 WHERE email = ? AND year_month = ?',
                [reg.email, yearMonth],
              );
            }
          } else if (lateBy > 0) {
            updates.is_late = 1;
            updates.late_minutes = inMin - shiftMin;
          }
        }
      }
    }

    if ((reg.correction_type === 'clock-out' || reg.correction_type === 'both') && reg.out_time) {
      const correctedOut = `${reg.date}T${reg.out_time}:00.000Z`;
      updates.last_out = correctedOut;
      if (daily.status === 'in' || daily.status === 'break') {
        updates.status = 'out';
        updates.status_source = 'regularization';
      }
    }

    // Recalculate total worked if both times are available
    const finalIn = (updates.first_in as string) ?? daily.first_in;
    const finalOut = (updates.last_out as string) ?? daily.last_out;
    if (finalIn && finalOut) {
      const inMs = new Date(finalIn).getTime();
      const outMs = new Date(finalOut).getTime();
      if (outMs > inMs) {
        const totalMinutes = (outMs - inMs) / 60000;
        updates.total_worked_minutes = Math.max(0, totalMinutes - daily.total_break_minutes);
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.clockRepo.updateDaily(reg.email, reg.date, updates);
      this.logger.info(
        { regId: reg.id, email: reg.email, date: reg.date, updates: Object.keys(updates) },
        'Attendance record corrected',
      );
    }
  }

  // ── Notification helpers ──

  private async resolveApprovers(
    employeeEmail: string,
    roleType: string,
  ): Promise<MemberNotifInfo[]> {
    const member = await this.db.get<{ group_id: string }>(
      'SELECT group_id FROM members WHERE email = ? AND active = 1',
      [employeeEmail],
    );
    if (!member) return [];

    const roles = await this.db.all<RoleRow>(
      `SELECT DISTINCT assignee_email FROM role_assignments
       WHERE role_type = ? AND (
         scope_type = 'global'
         OR (scope_type = 'group' AND scope_value = ?)
         OR (scope_type = 'member' AND scope_value = ?)
       )`,
      [roleType, member.group_id ?? '', 'member:' + employeeEmail],
    );

    const admins = await this.db.all<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM admins',
    );

    const allEmails = new Set([
      ...roles.map((r) => r.assignee_email),
      ...admins.map((a) => a.email),
    ]);

    const result: MemberNotifInfo[] = [];
    for (const email of allEmails) {
      const info = await this.db.get<MemberNotifInfo>(
        'SELECT email, name, teams_user_id FROM members WHERE email = ? AND active = 1',
        [email],
      );
      if (info) result.push(info);
    }
    return result;
  }

  private buildCardData(
    reg: Regularization,
    extras: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      regId: reg.id,
      employeeName: reg.name,
      employeeEmail: reg.email,
      date: reg.date,
      correctionType: reg.correction_type,
      inTime: reg.in_time,
      outTime: reg.out_time,
      reason: reg.reason,
      status: reg.status,
      ...extras,
    };
  }

  private async notifySubmitted(reg: Regularization): Promise<void> {
    if (!this.dispatcher) return;
    const managers = await this.resolveApprovers(reg.email, 'manager');
    if (managers.length === 0) return;

    await this.dispatcher.notify({
      eventType: 'regularization:submitted',
      entityType: 'regularization',
      entityId: reg.id,
      recipients: managers.map((m) => ({ email: m.email, name: m.name, role: 'manager' })),
      data: this.buildCardData(reg),
      reminders: {
        targetEmail: managers[0].email,
        count: 3,
        intervalMinutes: 60,
        cancelOnAction: 'regularization:approved',
      },
    });
  }

  private async notifyManagerApproved(reg: Regularization, approverEmail: string): Promise<void> {
    if (!this.dispatcher) return;
    const approverInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [approverEmail],
    );

    // Notify employee
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [reg.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'regularization:manager_approved',
        entityType: 'regularization',
        entityId: reg.id + ':emp',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: this.buildCardData(reg, { approverName: approverInfo?.name ?? approverEmail }),
      });
    }

    // Notify HR
    const hrs = await this.resolveApprovers(reg.email, 'hr');
    if (hrs.length > 0) {
      await this.dispatcher.notify({
        eventType: 'regularization:manager_approved',
        entityType: 'regularization',
        entityId: reg.id + ':hr',
        recipients: hrs.map((h) => ({ email: h.email, name: h.name, role: 'hr' })),
        data: this.buildCardData(reg, { approverName: approverInfo?.name ?? approverEmail }),
        reminders: {
          targetEmail: hrs[0].email,
          count: 3,
          intervalMinutes: 60,
          cancelOnAction: 'regularization:hr_approved',
        },
      });
    }

    // Cancel manager reminders + update cards
    await this.dispatcher.cancelReminders('regularization', reg.id);
    await this.dispatcher.updateCards(
      'regularization',
      reg.id,
      'regularization:resolved',
      this.buildCardData(reg),
    );
  }

  private async notifyHrApproved(reg: Regularization, approverEmail: string): Promise<void> {
    if (!this.dispatcher) return;
    const approverInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [approverEmail],
    );
    const cardData = this.buildCardData(reg, {
      approverName: approverInfo?.name ?? approverEmail,
      status: 'approved',
    });

    // Notify employee
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [reg.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'regularization:hr_approved',
        entityType: 'regularization',
        entityId: reg.id + ':final',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: cardData,
      });
    }

    // Notify original manager
    if (reg.manager_approver_email) {
      const mgrInfo = await this.db.get<MemberNotifInfo>(
        'SELECT email, name, teams_user_id FROM members WHERE email = ?',
        [reg.manager_approver_email],
      );
      if (mgrInfo) {
        await this.dispatcher.notify({
          eventType: 'regularization:hr_approved',
          entityType: 'regularization',
          entityId: reg.id + ':mgr-notify',
          recipients: [{ email: mgrInfo.email, name: mgrInfo.name, role: 'manager' }],
          data: cardData,
        });
      }
    }

    await this.dispatcher.cancelReminders('regularization', reg.id + ':hr');
    await this.dispatcher.updateCards(
      'regularization',
      reg.id + ':hr',
      'regularization:resolved',
      cardData,
    );
  }

  private async notifyRejected(
    reg: Regularization,
    rejectorEmail: string,
    comments: string,
  ): Promise<void> {
    if (!this.dispatcher) return;
    const rejectorInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [rejectorEmail],
    );
    const cardData = this.buildCardData(reg, {
      status: 'rejected',
      rejectionReason: comments,
      approverName: rejectorInfo?.name ?? rejectorEmail,
    });

    // Notify employee
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [reg.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'regularization:rejected',
        entityType: 'regularization',
        entityId: reg.id + ':reject',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: cardData,
      });
    }

    // Cancel all reminders + update cards
    await this.dispatcher.cancelReminders('regularization', reg.id);
    await this.dispatcher.cancelReminders('regularization', reg.id + ':hr');
    await this.dispatcher.updateCards(
      'regularization',
      reg.id,
      'regularization:resolved',
      cardData,
    );
    await this.dispatcher.updateCards(
      'regularization',
      reg.id + ':hr',
      'regularization:resolved',
      cardData,
    );
  }
}
