import type { Logger } from 'pino';
import type { LeaveService } from '../services/leave-service';
import type { RegularizationService } from '../services/regularization-service';
import type { BdMeetingService } from '../services/bd-meeting-service';

/** Result from dispatching an action. */
export interface ActionResult {
  success: boolean;
  message: string;
  error?: string;
}

/** Parsed action from any platform's webhook. */
export interface ParsedAction {
  actionId: string;
  payload: Record<string, unknown>;
  callerEmail: string;
  /** Rejection/comment reason if provided. */
  reason?: string;
}

/**
 * Action Dispatcher — routes button-click actions from all 8 platforms
 * to the correct service method.
 *
 * Every notification card carries an actionId + payload. When a user clicks
 * a button on Teams/Slack/Discord/etc., the platform sends a webhook.
 * Each platform receiver parses its native format into a ParsedAction,
 * then calls dispatcher.dispatch(). This class does the routing.
 *
 * Adding a new module's actions means adding cases here.
 * Platform receivers never change.
 */
export class ActionDispatcher {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly regService: RegularizationService,
    private readonly bdMeetingService: BdMeetingService,
    private readonly logger: Logger,
  ) {}

  /** Dispatch a parsed action to the correct service method. */
  async dispatch(action: ParsedAction): Promise<ActionResult> {
    const { actionId, payload, callerEmail, reason } = action;

    this.logger.info(
      { actionId, callerEmail, entityId: this.extractEntityId(actionId, payload) },
      'Dispatching action',
    );

    try {
      switch (actionId) {
        // ── Leave actions ──
        case 'leave.approve': {
          const leaveId = (payload.leaveId as string) ?? '';
          if (!leaveId)
            return { success: false, message: 'Missing leaveId', error: 'Missing leaveId' };
          const result = await this.leaveService.managerApprove(leaveId, callerEmail);
          return result.success
            ? { success: true, message: 'Leave approved by manager' }
            : { success: false, message: result.error ?? 'Approval failed', error: result.error };
        }

        case 'leave.hr_approve': {
          const leaveId = (payload.leaveId as string) ?? '';
          if (!leaveId)
            return { success: false, message: 'Missing leaveId', error: 'Missing leaveId' };
          const result = await this.leaveService.hrApprove(leaveId, callerEmail);
          return result.success
            ? { success: true, message: 'Leave HR-approved' }
            : {
                success: false,
                message: result.error ?? 'HR approval failed',
                error: result.error,
              };
        }

        case 'leave.reject': {
          const leaveId = (payload.leaveId as string) ?? '';
          if (!leaveId)
            return { success: false, message: 'Missing leaveId', error: 'Missing leaveId' };
          const result = await this.leaveService.reject(leaveId, callerEmail, reason ?? '');
          return result.success
            ? { success: true, message: 'Leave rejected' }
            : { success: false, message: result.error ?? 'Rejection failed', error: result.error };
        }

        // ── Regularization actions ──
        case 'reg.approve': {
          const regId = (payload.regId as string) ?? '';
          if (!regId) return { success: false, message: 'Missing regId', error: 'Missing regId' };
          const result = await this.regService.approve(regId, 'manager', callerEmail);
          return result.success
            ? { success: true, message: 'Correction approved by manager' }
            : { success: false, message: result.error ?? 'Approval failed', error: result.error };
        }

        case 'reg.hr_approve': {
          const regId = (payload.regId as string) ?? '';
          if (!regId) return { success: false, message: 'Missing regId', error: 'Missing regId' };
          const result = await this.regService.approve(regId, 'hr', callerEmail);
          return result.success
            ? { success: true, message: 'Correction HR-approved' }
            : {
                success: false,
                message: result.error ?? 'HR approval failed',
                error: result.error,
              };
        }

        case 'reg.reject': {
          const regId = (payload.regId as string) ?? '';
          if (!regId) return { success: false, message: 'Missing regId', error: 'Missing regId' };
          const result = await this.regService.reject(regId, callerEmail, reason ?? '');
          return result.success
            ? { success: true, message: 'Correction rejected' }
            : { success: false, message: result.error ?? 'Rejection failed', error: result.error };
        }

        // ── BD Meeting actions ──
        case 'bd_meeting.qualify': {
          const meetingId = (payload.meetingId as string) ?? '';
          if (!meetingId)
            return { success: false, message: 'Missing meetingId', error: 'Missing meetingId' };
          const result = await this.bdMeetingService.qualify(meetingId, callerEmail);
          return result.success
            ? { success: true, message: 'BD meeting qualified' }
            : {
                success: false,
                message: result.error ?? 'Qualification failed',
                error: result.error,
              };
        }

        case 'bd_meeting.approve': {
          const meetingId = (payload.meetingId as string) ?? '';
          if (!meetingId)
            return { success: false, message: 'Missing meetingId', error: 'Missing meetingId' };
          const result = await this.bdMeetingService.approve(meetingId, callerEmail);
          return result.success
            ? { success: true, message: 'BD meeting approved' }
            : { success: false, message: result.error ?? 'Approval failed', error: result.error };
        }

        case 'bd_meeting.reject': {
          const meetingId = (payload.meetingId as string) ?? '';
          if (!meetingId)
            return { success: false, message: 'Missing meetingId', error: 'Missing meetingId' };
          const result = await this.bdMeetingService.reject(meetingId, callerEmail, reason ?? '');
          return result.success
            ? { success: true, message: 'BD meeting rejected' }
            : { success: false, message: result.error ?? 'Rejection failed', error: result.error };
        }

        default:
          this.logger.warn({ actionId }, 'Unknown action ID');
          return {
            success: false,
            message: `Unknown action: ${actionId}`,
            error: `Unknown action: ${actionId}`,
          };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err, actionId, callerEmail }, 'Action dispatch failed');
      return { success: false, message: 'Internal error', error: errMsg };
    }
  }

  /** Extract the entity ID for logging. */
  private extractEntityId(actionId: string, payload: Record<string, unknown>): string {
    if (actionId.startsWith('leave.')) return (payload.leaveId as string) ?? '';
    if (actionId.startsWith('reg.')) return (payload.regId as string) ?? '';
    if (actionId.startsWith('bd_meeting.')) return (payload.meetingId as string) ?? '';
    return '';
  }
}
