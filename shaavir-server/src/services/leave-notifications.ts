import type { Logger } from 'pino';
import type { NotificationDispatcher } from './notification/dispatcher';
import type { LeaveRequest } from '../repositories/leave-repository';
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
 * Leave notification service.
 * Translates leave lifecycle events into dispatcher calls with proper recipients,
 * Adaptive Card data, and reminder scheduling.
 */
export class LeaveNotificationService {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /** Resolve who should approve at manager tier for an employee. */
  private async resolveManagerApprovers(employeeEmail: string): Promise<MemberNotifInfo[]> {
    // Get employee's group
    const member = await this.db.get<{ group_id: string }>(
      'SELECT group_id FROM members WHERE email = ? AND active = 1',
      [employeeEmail],
    );
    if (!member) return [];

    // Find managers: global managers + group-level managers + direct member managers
    const managers = await this.db.all<RoleRow>(
      `SELECT DISTINCT assignee_email FROM role_assignments
       WHERE role_type = 'manager' AND (
         scope_type = 'global'
         OR (scope_type = 'group' AND scope_value = ?)
         OR (scope_type = 'member' AND scope_value = ?)
       )`,
      [member.group_id ?? '', 'member:' + employeeEmail],
    );

    // Also include admins
    const admins = await this.db.all<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM admins',
    );

    const allEmails = new Set([
      ...managers.map((m) => m.assignee_email),
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

  /** Resolve who should approve at HR tier. */
  private async resolveHrApprovers(employeeEmail: string): Promise<MemberNotifInfo[]> {
    const member = await this.db.get<{ group_id: string }>(
      'SELECT group_id FROM members WHERE email = ? AND active = 1',
      [employeeEmail],
    );
    if (!member) return [];

    const hrs = await this.db.all<RoleRow>(
      `SELECT DISTINCT assignee_email FROM role_assignments
       WHERE role_type = 'hr' AND (
         scope_type = 'global'
         OR (scope_type = 'group' AND scope_value = ?)
         OR (scope_type = 'member' AND scope_value = ?)
       )`,
      [member.group_id ?? '', 'member:' + employeeEmail],
    );

    const admins = await this.db.all<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM admins',
    );

    const allEmails = new Set([...hrs.map((h) => h.assignee_email), ...admins.map((a) => a.email)]);

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

  /** Get member notification info. */
  private async getMemberInfo(email: string): Promise<MemberNotifInfo | null> {
    return this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [email],
    );
  }

  /** Build card data from a leave request. */
  private buildCardData(
    leave: LeaveRequest,
    extras: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      leaveId: leave.id,
      employeeName: leave.person_name,
      employeeEmail: leave.person_email,
      leaveType: leave.leave_type,
      kind: leave.kind,
      startDate: leave.start_date,
      endDate: leave.end_date,
      daysRequested: leave.days_requested,
      reason: leave.reason,
      paidType: leave.paid_type,
      status: leave.status,
      ...extras,
    };
  }

  /** Called when a leave is submitted. Notifies managers with reminders. */
  async onLeaveSubmitted(leave: LeaveRequest): Promise<void> {
    const managers = await this.resolveManagerApprovers(leave.person_email);
    if (managers.length === 0) {
      this.logger.warn({ leaveId: leave.id }, 'No managers found for leave approval notification');
      return;
    }

    const cardData = this.buildCardData(leave);

    await this.dispatcher.notify({
      eventType: 'leave:submitted',
      entityType: 'leave',
      entityId: leave.id,
      recipients: managers.map((m) => ({
        email: m.email,
        name: m.name,
        role: 'manager',
      })),
      data: { ...cardData, teamsUserId: managers[0]?.teams_user_id ?? '' },
      reminders: {
        targetEmail: managers[0].email,
        count: 3,
        intervalMinutes: 60,
        cancelOnAction: 'leave:approved',
      },
    });

    this.logger.info(
      { leaveId: leave.id, managerCount: managers.length },
      'Leave submission notifications sent',
    );
  }

  /** Called when manager approves. Notifies employee + HR with reminders. */
  async onManagerApproved(leave: LeaveRequest, approverEmail: string): Promise<void> {
    const approverInfo = await this.getMemberInfo(approverEmail);
    const cardData = this.buildCardData(leave, {
      approverName: approverInfo?.name ?? approverEmail,
      status: 'Approved by Manager',
    });

    // Notify employee
    const employeeInfo = await this.getMemberInfo(leave.person_email);
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'leave:manager_approved',
        entityType: 'leave',
        entityId: leave.id,
        recipients: [
          {
            email: employeeInfo.email,
            name: employeeInfo.name,
            role: 'employee',
          },
        ],
        data: { ...cardData, teamsUserId: employeeInfo.teams_user_id ?? '' },
      });
    }

    // Notify HR with reminders
    const hrs = await this.resolveHrApprovers(leave.person_email);
    if (hrs.length > 0) {
      await this.dispatcher.notify({
        eventType: 'leave:manager_approved',
        entityType: 'leave',
        entityId: leave.id + ':hr',
        recipients: hrs.map((h) => ({
          email: h.email,
          name: h.name,
          role: 'hr',
        })),
        data: { ...cardData, teamsUserId: hrs[0]?.teams_user_id ?? '' },
        reminders: {
          targetEmail: hrs[0].email,
          count: 3,
          intervalMinutes: 60,
          cancelOnAction: 'leave:hr_approved',
        },
      });
    }

    // Update original manager approval cards to show "resolved"
    await this.dispatcher.updateCards('leave', leave.id, 'leave:resolved', {
      ...cardData,
      status: 'Approved by Manager',
    });

    // Cancel manager reminders
    await this.dispatcher.cancelReminders('leave', leave.id);

    this.logger.info({ leaveId: leave.id, approverEmail }, 'Manager approval notifications sent');
  }

  /** Called when HR approves. Notifies employee + manager. */
  async onHrApproved(leave: LeaveRequest, approverEmail: string): Promise<void> {
    const approverInfo = await this.getMemberInfo(approverEmail);
    const cardData = this.buildCardData(leave, {
      approverName: approverInfo?.name ?? approverEmail,
      status: 'Approved',
    });

    // Notify employee
    const employeeInfo = await this.getMemberInfo(leave.person_email);
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'leave:hr_approved',
        entityType: 'leave',
        entityId: leave.id + ':final',
        recipients: [
          {
            email: employeeInfo.email,
            name: employeeInfo.name,
            role: 'employee',
          },
        ],
        data: { ...cardData, teamsUserId: employeeInfo.teams_user_id ?? '' },
      });
    }

    // Notify original manager
    if (leave.manager_approver_email) {
      const mgrInfo = await this.getMemberInfo(leave.manager_approver_email);
      if (mgrInfo) {
        await this.dispatcher.notify({
          eventType: 'leave:hr_approved',
          entityType: 'leave',
          entityId: leave.id + ':mgr-notify',
          recipients: [
            {
              email: mgrInfo.email,
              name: mgrInfo.name,
              role: 'manager',
            },
          ],
          data: { ...cardData, teamsUserId: mgrInfo.teams_user_id ?? '' },
        });
      }
    }

    // Update HR approval cards to show "resolved"
    await this.dispatcher.updateCards('leave', leave.id + ':hr', 'leave:resolved', {
      ...cardData,
      status: 'Approved',
    });

    // Cancel HR reminders
    await this.dispatcher.cancelReminders('leave', leave.id + ':hr');

    this.logger.info({ leaveId: leave.id, approverEmail }, 'HR approval notifications sent');
  }

  /** Called when leave is rejected. Notifies employee + other tier. */
  async onRejected(leave: LeaveRequest, rejectorEmail: string, reason: string): Promise<void> {
    const rejectorInfo = await this.getMemberInfo(rejectorEmail);
    const cardData = this.buildCardData(leave, {
      status: 'Rejected',
      rejectionReason: reason,
      approverName: rejectorInfo?.name ?? rejectorEmail,
    });

    // Notify employee
    const employeeInfo = await this.getMemberInfo(leave.person_email);
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'leave:rejected',
        entityType: 'leave',
        entityId: leave.id + ':reject',
        recipients: [
          {
            email: employeeInfo.email,
            name: employeeInfo.name,
            role: 'employee',
          },
        ],
        data: { ...cardData, teamsUserId: employeeInfo.teams_user_id ?? '' },
      });
    }

    // Update all pending cards for this leave to "resolved"
    await this.dispatcher.updateCards('leave', leave.id, 'leave:resolved', cardData);
    await this.dispatcher.updateCards('leave', leave.id + ':hr', 'leave:resolved', cardData);

    // Cancel all reminders
    await this.dispatcher.cancelReminders('leave', leave.id);
    await this.dispatcher.cancelReminders('leave', leave.id + ':hr');

    this.logger.info({ leaveId: leave.id, rejectorEmail, reason }, 'Rejection notifications sent');
  }
}
