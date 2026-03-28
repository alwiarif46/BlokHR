import type { Logger } from 'pino';
import type { BdMeetingRepository, BdMeeting } from '../repositories/bd-meeting-repository';
import type { NotificationDispatcher } from './notification/dispatcher';
import type { DatabaseEngine } from '../db/engine';
import type { EventBus } from '../events';

interface MemberNotifInfo {
  [key: string]: unknown;
  email: string;
  name: string;
  teams_user_id: string;
}

interface GroupRow {
  [key: string]: unknown;
  id: string;
  name: string;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string;
}

interface RoleRow {
  [key: string]: unknown;
  assignee_email: string;
}

/**
 * BD Meeting service — meeting qualification & approval business logic.
 * This module is EXCLUSIVELY for Business Development department members.
 *
 * Flow: Submit → Qualify → Approve (rejection at any open stage).
 * Non-BD members are rejected at submit time.
 */
export class BdMeetingService {
  constructor(
    private readonly repo: BdMeetingRepository,
    private readonly db: DatabaseEngine,
    private readonly dispatcher: NotificationDispatcher | null,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  /** Submit a new BD meeting request. Rejects non-BD members. */
  async submit(data: {
    email: string;
    name: string;
    client: string;
    date: string;
    time: string;
    location: string;
    notes: string;
  }): Promise<{ success: boolean; meeting?: BdMeeting; error?: string }> {
    if (!data.email || !data.date) {
      return { success: false, error: 'email and date are required' };
    }
    if (!data.client) {
      return { success: false, error: 'Client name is required' };
    }

    // Enforce BD-department-only
    const isBd = await this.isBdMember(data.email);
    if (!isBd) {
      return {
        success: false,
        error: 'BD meetings are only for Business Development department members',
      };
    }

    const meeting = await this.repo.create(data);

    this.logger.info(
      { meetingId: meeting.id, email: data.email, client: data.client, date: data.date },
      'BD meeting submitted',
    );

    // Notify managers for qualification
    if (this.dispatcher) {
      this.notifySubmitted(meeting).catch((err) => {
        this.logger.error({ err, meetingId: meeting.id }, 'BD meeting submit notification failed');
      });
    }

    this.eventBus?.emit('bd_meeting.submitted', { meetingId: String(meeting.id), email: data.email, client: data.client, date: data.date });

    return { success: true, meeting };
  }

  /** Qualify a pending BD meeting (manager/admin action). */
  async qualify(
    meetingId: string,
    qualifierEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const meeting = await this.repo.getById(meetingId);
    if (!meeting) return { success: false, error: 'BD meeting not found' };

    if (meeting.status !== 'pending') {
      return { success: false, error: `Cannot qualify with status "${meeting.status}"` };
    }

    await this.repo.update(meetingId, {
      status: 'qualified',
      qualifier_email: qualifierEmail,
    });

    this.logger.info({ meetingId, qualifierEmail }, 'BD meeting qualified');

    if (this.dispatcher) {
      const updated = await this.repo.getById(meetingId);
      if (updated) {
        this.notifyQualified(updated, qualifierEmail).catch((err) => {
          this.logger.error({ err, meetingId }, 'BD meeting qualify notification failed');
        });
      }
    }

    this.eventBus?.emit('bd_meeting.qualified', { meetingId, email: meeting.email, client: meeting.client, date: meeting.date, approverEmail: qualifierEmail });

    return { success: true };
  }

  /** Approve a qualified BD meeting (admin/HR action). */
  async approve(
    meetingId: string,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    const meeting = await this.repo.getById(meetingId);
    if (!meeting) return { success: false, error: 'BD meeting not found' };

    if (meeting.status !== 'qualified' && meeting.status !== 'notified') {
      return { success: false, error: `Cannot approve with status "${meeting.status}"` };
    }

    await this.repo.update(meetingId, {
      status: 'approved',
      approver_email: approverEmail,
    });

    this.logger.info({ meetingId, approverEmail }, 'BD meeting approved');

    if (this.dispatcher) {
      const updated = await this.repo.getById(meetingId);
      if (updated) {
        this.notifyApproved(updated, approverEmail).catch((err) => {
          this.logger.error({ err, meetingId }, 'BD meeting approve notification failed');
        });
      }
    }

    this.eventBus?.emit('bd_meeting.approved', { meetingId, email: meeting.email, client: meeting.client, date: meeting.date, approverEmail });

    return { success: true };
  }

  /** Reject a BD meeting at any open stage. */
  async reject(
    meetingId: string,
    rejectorEmail: string,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const meeting = await this.repo.getById(meetingId);
    if (!meeting) return { success: false, error: 'BD meeting not found' };

    if (meeting.status === 'approved' || meeting.status === 'rejected') {
      return { success: false, error: `Cannot reject with status "${meeting.status}"` };
    }

    await this.repo.update(meetingId, {
      status: 'rejected',
      rejection_reason: reason,
    });

    this.logger.info({ meetingId, rejectorEmail, reason }, 'BD meeting rejected');

    if (this.dispatcher) {
      const updated = await this.repo.getById(meetingId);
      if (updated) {
        this.notifyRejected(updated, rejectorEmail, reason).catch((err) => {
          this.logger.error({ err, meetingId }, 'BD meeting rejection notification failed');
        });
      }
    }

    this.eventBus?.emit('bd_meeting.rejected', { meetingId, email: meeting.email, client: meeting.client, date: meeting.date, approverEmail: rejectorEmail, reason });

    return { success: true };
  }

  /** Get all BD meetings for an employee. */
  async getByEmail(email: string): Promise<BdMeeting[]> {
    return this.repo.getByEmail(email);
  }

  // ── BD department check ──

  /**
   * Determines if a member belongs to the Business Development department.
   * Matches group name containing "business development" (case-insensitive).
   */
  private async isBdMember(email: string): Promise<boolean> {
    const member = await this.db.get<MemberRow>(
      'SELECT email, name, group_id FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member || !member.group_id) return false;

    const group = await this.db.get<GroupRow>('SELECT id, name FROM groups WHERE id = ?', [
      member.group_id,
    ]);
    if (!group) return false;

    return group.name.toLowerCase().includes('business development');
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
    meeting: BdMeeting,
    extras: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      meetingId: meeting.id,
      employeeName: meeting.name,
      employeeEmail: meeting.email,
      client: meeting.client,
      date: meeting.date,
      time: meeting.time,
      location: meeting.location,
      notes: meeting.notes,
      status: meeting.status,
      ...extras,
    };
  }

  private async notifySubmitted(meeting: BdMeeting): Promise<void> {
    if (!this.dispatcher) return;
    const managers = await this.resolveApprovers(meeting.email, 'manager');
    if (managers.length === 0) return;

    await this.dispatcher.notify({
      eventType: 'bd_meeting:submitted',
      entityType: 'bd_meeting',
      entityId: meeting.id,
      recipients: managers.map((m) => ({ email: m.email, name: m.name, role: 'manager' })),
      data: this.buildCardData(meeting),
      reminders: {
        targetEmail: managers[0].email,
        count: 3,
        intervalMinutes: 60,
        cancelOnAction: 'bd_meeting:qualified',
      },
    });
  }

  private async notifyQualified(meeting: BdMeeting, qualifierEmail: string): Promise<void> {
    if (!this.dispatcher) return;
    const qualifierInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [qualifierEmail],
    );

    // Notify employee of qualification
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [meeting.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'bd_meeting:qualified',
        entityType: 'bd_meeting',
        entityId: meeting.id + ':emp',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: this.buildCardData(meeting, {
          qualifierName: qualifierInfo?.name ?? qualifierEmail,
        }),
      });
    }

    // Notify admins/HR for final approval
    const hrs = await this.resolveApprovers(meeting.email, 'hr');
    if (hrs.length > 0) {
      await this.dispatcher.notify({
        eventType: 'bd_meeting:qualified',
        entityType: 'bd_meeting',
        entityId: meeting.id + ':approve',
        recipients: hrs.map((h) => ({ email: h.email, name: h.name, role: 'hr' })),
        data: this.buildCardData(meeting, {
          qualifierName: qualifierInfo?.name ?? qualifierEmail,
        }),
        reminders: {
          targetEmail: hrs[0].email,
          count: 3,
          intervalMinutes: 60,
          cancelOnAction: 'bd_meeting:approved',
        },
      });
    }

    // Cancel qualification reminders + update submit cards
    await this.dispatcher.cancelReminders('bd_meeting', meeting.id);
    await this.dispatcher.updateCards(
      'bd_meeting',
      meeting.id,
      'bd_meeting:resolved',
      this.buildCardData(meeting, { status: 'qualified' }),
    );
  }

  private async notifyApproved(meeting: BdMeeting, approverEmail: string): Promise<void> {
    if (!this.dispatcher) return;
    const approverInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [approverEmail],
    );
    const cardData = this.buildCardData(meeting, {
      approverName: approverInfo?.name ?? approverEmail,
      status: 'approved',
    });

    // Notify employee
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [meeting.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'bd_meeting:approved',
        entityType: 'bd_meeting',
        entityId: meeting.id + ':final',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: cardData,
      });
    }

    // Notify qualifier
    if (meeting.qualifier_email) {
      const qualInfo = await this.db.get<MemberNotifInfo>(
        'SELECT email, name, teams_user_id FROM members WHERE email = ?',
        [meeting.qualifier_email],
      );
      if (qualInfo) {
        await this.dispatcher.notify({
          eventType: 'bd_meeting:approved',
          entityType: 'bd_meeting',
          entityId: meeting.id + ':qual-notify',
          recipients: [{ email: qualInfo.email, name: qualInfo.name, role: 'manager' }],
          data: cardData,
        });
      }
    }

    await this.dispatcher.cancelReminders('bd_meeting', meeting.id + ':approve');
    await this.dispatcher.updateCards(
      'bd_meeting',
      meeting.id + ':approve',
      'bd_meeting:resolved',
      cardData,
    );
  }

  private async notifyRejected(
    meeting: BdMeeting,
    rejectorEmail: string,
    reason: string,
  ): Promise<void> {
    if (!this.dispatcher) return;
    const rejectorInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [rejectorEmail],
    );
    const cardData = this.buildCardData(meeting, {
      status: 'rejected',
      rejectionReason: reason,
      approverName: rejectorInfo?.name ?? rejectorEmail,
    });

    // Notify employee
    const employeeInfo = await this.db.get<MemberNotifInfo>(
      'SELECT email, name, teams_user_id FROM members WHERE email = ?',
      [meeting.email],
    );
    if (employeeInfo) {
      await this.dispatcher.notify({
        eventType: 'bd_meeting:rejected',
        entityType: 'bd_meeting',
        entityId: meeting.id + ':reject',
        recipients: [{ email: employeeInfo.email, name: employeeInfo.name, role: 'employee' }],
        data: cardData,
      });
    }

    // Cancel all outstanding reminders + update all open cards
    await this.dispatcher.cancelReminders('bd_meeting', meeting.id);
    await this.dispatcher.cancelReminders('bd_meeting', meeting.id + ':approve');
    await this.dispatcher.updateCards('bd_meeting', meeting.id, 'bd_meeting:resolved', cardData);
    await this.dispatcher.updateCards(
      'bd_meeting',
      meeting.id + ':approve',
      'bd_meeting:resolved',
      cardData,
    );
  }
}
