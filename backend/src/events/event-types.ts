/**
 * All typed events emitted by services. Each event has a name and a payload schema.
 * The EventBus enforces these types at compile time.
 */

// ── Payload types ──

export interface ClockEventPayload {
  email: string;
  name: string;
  date: string;
  source: string;
  isLate?: boolean;
  lateMinutes?: number;
}

export interface LeaveEventPayload {
  leaveId: string;
  email: string;
  name: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  approverEmail?: string;
  reason?: string;
}

export interface RegularizationEventPayload {
  regularizationId: string;
  email: string;
  date: string;
  approverEmail?: string;
  reason?: string;
}

export interface OvertimeEventPayload {
  recordId: number;
  email: string;
  date: string;
  otMinutes: number;
  otType: string;
  approverEmail?: string;
  reason?: string;
}

export interface TimesheetEventPayload {
  timesheetId: string;
  email: string;
  periodType: string;
  startDate: string;
  endDate: string;
  approverEmail?: string;
  reason?: string;
}

export interface ProfileEventPayload {
  email: string;
  field?: string;
  unlockedBy?: string;
}

export interface BdMeetingEventPayload {
  meetingId: string;
  email: string;
  client: string;
  date: string;
  approverEmail?: string;
  reason?: string;
}

export interface MemberEventPayload {
  email: string;
  name: string;
  groupId?: string;
  previousGroupId?: string;
}

// ── Event map: event name → payload type ──

export interface EventMap {
  // Clock (4)
  'clock.in': ClockEventPayload;
  'clock.out': ClockEventPayload;
  'clock.break': ClockEventPayload;
  'clock.back': ClockEventPayload;

  // Leaves (4)
  'leave.submitted': LeaveEventPayload;
  'leave.approved': LeaveEventPayload;
  'leave.rejected': LeaveEventPayload;
  'leave.cancelled': LeaveEventPayload;

  // Regularization (3)
  'regularization.submitted': RegularizationEventPayload;
  'regularization.approved': RegularizationEventPayload;
  'regularization.rejected': RegularizationEventPayload;

  // Overtime (3)
  'overtime.detected': OvertimeEventPayload;
  'overtime.approved': OvertimeEventPayload;
  'overtime.rejected': OvertimeEventPayload;

  // Timesheets (3)
  'timesheet.submitted': TimesheetEventPayload;
  'timesheet.approved': TimesheetEventPayload;
  'timesheet.rejected': TimesheetEventPayload;

  // Profile (3)
  'profile.updated': ProfileEventPayload;
  'profile.certified': ProfileEventPayload;
  'profile.unlocked': ProfileEventPayload;

  // BD Meetings (4)
  'bd_meeting.submitted': BdMeetingEventPayload;
  'bd_meeting.qualified': BdMeetingEventPayload;
  'bd_meeting.approved': BdMeetingEventPayload;
  'bd_meeting.rejected': BdMeetingEventPayload;

  // Members (4)
  'member.created': MemberEventPayload;
  'member.deactivated': MemberEventPayload;
  'member.group_changed': MemberEventPayload;
  'member.position_changed': MemberEventPayload;
}

export type EventName = keyof EventMap;

export const ALL_EVENT_NAMES: EventName[] = [
  'clock.in', 'clock.out', 'clock.break', 'clock.back',
  'leave.submitted', 'leave.approved', 'leave.rejected', 'leave.cancelled',
  'regularization.submitted', 'regularization.approved', 'regularization.rejected',
  'overtime.detected', 'overtime.approved', 'overtime.rejected',
  'timesheet.submitted', 'timesheet.approved', 'timesheet.rejected',
  'profile.updated', 'profile.certified', 'profile.unlocked',
  'bd_meeting.submitted', 'bd_meeting.qualified', 'bd_meeting.approved', 'bd_meeting.rejected',
  'member.created', 'member.deactivated', 'member.group_changed', 'member.position_changed',
];
