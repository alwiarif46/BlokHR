/**
 * Tool definitions for the AI Agent. Pure schema — no business logic.
 * Each tool has a name, description, scope, and parameter schema.
 * The agent service matches user intent to a tool, the handler registry executes it.
 */

export interface ToolParam {
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  enum?: string[];
}

export interface ToolSchema {
  name: string;
  description: string;
  scope: 'employee' | 'admin' | 'both';
  category: string;
  parameters: ToolParam[];
}

// ── Param builders (DRY) ──

const P = {
  email: (req = true): ToolParam => ({ name: 'email', type: 'string', description: 'Employee email address', required: req }),
  date: (req = true): ToolParam => ({ name: 'date', type: 'string', description: 'Date in YYYY-MM-DD format', required: req }),
  startDate: (req = true): ToolParam => ({ name: 'startDate', type: 'string', description: 'Start date YYYY-MM-DD', required: req }),
  endDate: (req = true): ToolParam => ({ name: 'endDate', type: 'string', description: 'End date YYYY-MM-DD', required: req }),
  leaveType: (req = true): ToolParam => ({ name: 'leaveType', type: 'string', description: 'Leave type (Casual, Sick, Earned, WFH, Comp-Off, Other)', required: req }),
  reason: (req = false): ToolParam => ({ name: 'reason', type: 'string', description: 'Reason or note', required: req }),
  id: (desc: string): ToolParam => ({ name: 'id', type: 'string', description: desc, required: true }),
  groupId: (req = false): ToolParam => ({ name: 'groupId', type: 'string', description: 'Department/group ID', required: req }),
  projectId: (req = false): ToolParam => ({ name: 'projectId', type: 'string', description: 'Project ID', required: req }),
  hours: (): ToolParam => ({ name: 'hours', type: 'number', description: 'Number of hours', required: true }),
  month: (): ToolParam => ({ name: 'month', type: 'string', description: 'Month in YYYY-MM format', required: false }),
  periodType: (): ToolParam => ({ name: 'periodType', type: 'string', description: 'weekly or monthly', required: true, enum: ['weekly', 'monthly'] }),
  kind: (): ToolParam => ({ name: 'kind', type: 'string', description: 'FullDay, FirstHalf, or SecondHalf', required: false, enum: ['FullDay', 'FirstHalf', 'SecondHalf'] }),
  billable: (): ToolParam => ({ name: 'billable', type: 'boolean', description: 'Whether the entry is billable', required: false }),
  description: (): ToolParam => ({ name: 'description', type: 'string', description: 'Description or note', required: false }),
  approverEmail: (): ToolParam => ({ name: 'approverEmail', type: 'string', description: 'Email of the approver', required: false }),
};

// ══════════════════════════════════════════════════════
// EMPLOYEE TOOLS
// ══════════════════════════════════════════════════════

const CLOCK_TOOLS: ToolSchema[] = [
  { name: 'clock_in', description: 'Clock in to start working', scope: 'employee', category: 'clock', parameters: [] },
  { name: 'clock_out', description: 'Clock out to end the work day', scope: 'employee', category: 'clock', parameters: [] },
  { name: 'clock_break', description: 'Start a break', scope: 'employee', category: 'clock', parameters: [] },
  { name: 'clock_back', description: 'Return from break', scope: 'employee', category: 'clock', parameters: [] },
];

const MY_ATTENDANCE_TOOLS: ToolSchema[] = [
  { name: 'my_attendance_today', description: 'Check my attendance status, worked hours, and break time for today', scope: 'employee', category: 'attendance', parameters: [] },
  { name: 'my_attendance_for_date', description: 'Check my attendance for a specific date', scope: 'employee', category: 'attendance', parameters: [P.date()] },
  { name: 'my_attendance_range', description: 'Check my attendance records over a date range', scope: 'employee', category: 'attendance', parameters: [P.startDate(), P.endDate()] },
  { name: 'am_i_late_today', description: 'Check if I was marked late today', scope: 'employee', category: 'attendance', parameters: [] },
  { name: 'my_late_count_month', description: 'How many times I was late this month or a specific month', scope: 'employee', category: 'attendance', parameters: [P.month()] },
  { name: 'my_worked_hours_today', description: 'How many hours I have worked today so far', scope: 'employee', category: 'attendance', parameters: [] },
  { name: 'my_worked_hours_range', description: 'Total hours I worked over a date range', scope: 'employee', category: 'attendance', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_break_time_today', description: 'How much break time I have taken today', scope: 'employee', category: 'attendance', parameters: [] },
  { name: 'my_clock_events_today', description: 'My clock in/out/break/back timeline for today', scope: 'employee', category: 'attendance', parameters: [] },
  { name: 'my_clock_events_for_date', description: 'My clock event timeline for a specific date', scope: 'employee', category: 'attendance', parameters: [P.date()] },
];

const MY_REGULARIZATION_TOOLS: ToolSchema[] = [
  { name: 'submit_regularization', description: 'Submit an attendance correction/regularization request for a specific date', scope: 'employee', category: 'regularization', parameters: [P.date(), P.reason(true), { name: 'clockIn', type: 'string', description: 'Corrected clock-in time HH:MM', required: false }, { name: 'clockOut', type: 'string', description: 'Corrected clock-out time HH:MM', required: false }] },
  { name: 'my_regularizations', description: 'List all my regularization requests', scope: 'employee', category: 'regularization', parameters: [] },
  { name: 'my_pending_regularizations', description: 'List my regularization requests that are still pending', scope: 'employee', category: 'regularization', parameters: [] },
  { name: 'regularization_status', description: 'Check the status of a specific regularization request by ID', scope: 'employee', category: 'regularization', parameters: [P.id('Regularization request ID')] },
];

const MY_LEAVE_TOOLS: ToolSchema[] = [
  { name: 'my_leave_balance', description: 'Check my leave balance for all leave types this year', scope: 'employee', category: 'leaves', parameters: [] },
  { name: 'my_leave_balance_by_type', description: 'Check my leave balance for a specific leave type', scope: 'employee', category: 'leaves', parameters: [P.leaveType()] },
  { name: 'request_leave', description: 'Submit a leave request', scope: 'employee', category: 'leaves', parameters: [P.leaveType(), P.startDate(), P.endDate(), P.kind(), P.reason(false)] },
  { name: 'cancel_my_leave', description: 'Cancel one of my leave requests by ID', scope: 'employee', category: 'leaves', parameters: [P.id('Leave request ID')] },
  { name: 'my_leave_requests', description: 'List all my leave requests', scope: 'employee', category: 'leaves', parameters: [] },
  { name: 'my_pending_leaves', description: 'List my leave requests that are still pending approval', scope: 'employee', category: 'leaves', parameters: [] },
  { name: 'my_upcoming_leaves', description: 'List my approved upcoming/future leaves', scope: 'employee', category: 'leaves', parameters: [] },
  { name: 'my_leave_history', description: 'My leave requests for a specific date range', scope: 'employee', category: 'leaves', parameters: [P.startDate(), P.endDate()] },
];

const MY_TIME_TRACKING_TOOLS: ToolSchema[] = [
  { name: 'log_time_entry', description: 'Log hours worked on a project for a date', scope: 'employee', category: 'time_tracking', parameters: [P.projectId(true), P.date(), P.hours(), P.description(), P.billable()] },
  { name: 'my_time_entries_today', description: 'List my time entries logged for today', scope: 'employee', category: 'time_tracking', parameters: [] },
  { name: 'my_time_entries_range', description: 'List my time entries for a date range', scope: 'employee', category: 'time_tracking', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_billable_summary', description: 'Summary of my billable vs non-billable hours for a date range', scope: 'employee', category: 'time_tracking', parameters: [P.startDate(), P.endDate()] },
  { name: 'list_projects', description: 'List all active projects I can log time against', scope: 'employee', category: 'time_tracking', parameters: [] },
  { name: 'list_clients', description: 'List all clients', scope: 'employee', category: 'time_tracking', parameters: [] },
  { name: 'delete_my_time_entry', description: 'Delete one of my time entries by ID', scope: 'employee', category: 'time_tracking', parameters: [P.id('Time entry ID')] },
];

const MY_OVERTIME_TOOLS: ToolSchema[] = [
  { name: 'my_overtime_records', description: 'My overtime records for a date range', scope: 'employee', category: 'overtime', parameters: [P.startDate(false), P.endDate(false)] },
  { name: 'my_overtime_summary', description: 'Summary of my total OT hours and pay for a date range', scope: 'employee', category: 'overtime', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_ot_remaining_quarter', description: 'How many OT hours I have remaining in the current quarterly cap', scope: 'employee', category: 'overtime', parameters: [] },
  { name: 'my_overtime_for_date', description: 'Check my overtime for a specific date', scope: 'employee', category: 'overtime', parameters: [P.date()] },
];

const MY_TIMESHEET_TOOLS: ToolSchema[] = [
  { name: 'my_timesheets', description: 'List all my timesheets', scope: 'employee', category: 'timesheets', parameters: [] },
  { name: 'generate_my_timesheet', description: 'Generate a new timesheet for a period', scope: 'employee', category: 'timesheets', parameters: [P.periodType(), P.startDate()] },
  { name: 'submit_my_timesheet', description: 'Submit a draft timesheet for approval', scope: 'employee', category: 'timesheets', parameters: [P.id('Timesheet ID')] },
  { name: 'my_timesheet_detail', description: 'Get the daily breakdown of a specific timesheet', scope: 'employee', category: 'timesheets', parameters: [P.id('Timesheet ID')] },
];

const MY_PROFILE_TOOLS: ToolSchema[] = [
  { name: 'my_profile', description: 'View my employee profile information', scope: 'employee', category: 'profile', parameters: [] },
  { name: 'my_shift', description: 'What are my assigned shift timings', scope: 'employee', category: 'profile', parameters: [] },
  { name: 'my_department', description: 'Which department/group am I in', scope: 'employee', category: 'profile', parameters: [] },
  { name: 'my_joining_date', description: 'When did I join the company', scope: 'employee', category: 'profile', parameters: [] },
];

const MY_TARGET_TOOLS: ToolSchema[] = [
  { name: 'my_attendance_target', description: 'My expected shift hours vs actual worked hours for a date range (attendance target)', scope: 'employee', category: 'targets', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_billable_target', description: 'My billable hours logged vs project budget allocation', scope: 'employee', category: 'targets', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_ot_cap_status', description: 'How much of my quarterly overtime cap have I used', scope: 'employee', category: 'targets', parameters: [] },
];

const MY_HOLIDAY_TOOLS: ToolSchema[] = [
  { name: 'is_today_holiday', description: 'Is today a holiday', scope: 'employee', category: 'holidays', parameters: [] },
  { name: 'upcoming_holidays', description: 'List upcoming holidays', scope: 'employee', category: 'holidays', parameters: [] },
  { name: 'holidays_in_range', description: 'List holidays in a specific date range', scope: 'employee', category: 'holidays', parameters: [P.startDate(), P.endDate()] },
  { name: 'my_selected_holidays', description: 'List optional/restricted holidays I have selected', scope: 'employee', category: 'holidays', parameters: [] },
];

const MY_MEETING_TOOLS: ToolSchema[] = [
  { name: 'my_tracked_meetings', description: 'List my tracked meetings for a date range', scope: 'employee', category: 'meetings', parameters: [P.startDate(false), P.endDate(false)] },
  { name: 'log_meeting', description: 'Log a meeting I attended', scope: 'employee', category: 'meetings', parameters: [{ name: 'title', type: 'string', description: 'Meeting title', required: true }, P.date(), P.hours(), { name: 'platform', type: 'string', description: 'Platform (teams, google-meet, zoom, webex, goto, bluejeans)', required: false }] },
  { name: 'submit_bd_meeting', description: 'Submit a business development meeting for qualification', scope: 'employee', category: 'meetings', parameters: [{ name: 'title', type: 'string', description: 'Meeting title', required: true }, P.date(), P.description()] },
  { name: 'my_bd_meetings', description: 'List my submitted BD meetings', scope: 'employee', category: 'meetings', parameters: [] },
];

const MY_PENDING_TOOLS: ToolSchema[] = [
  { name: 'my_pending_actions', description: 'List things I need to take action on (pending leaves to approve if manager, pending regs, etc.)', scope: 'employee', category: 'pending', parameters: [] },
];

// ══════════════════════════════════════════════════════
// ADMIN / MANAGEMENT TOOLS
// ══════════════════════════════════════════════════════

const ADMIN_ATTENDANCE_TOOLS: ToolSchema[] = [
  { name: 'who_is_present_today', description: 'List all employees who are currently clocked in / present today', scope: 'admin', category: 'admin_attendance', parameters: [] },
  { name: 'who_is_absent_today', description: 'List all employees who are absent today (no attendance record or marked absent)', scope: 'admin', category: 'admin_attendance', parameters: [] },
  { name: 'who_is_late_today', description: 'List all employees who were late today', scope: 'admin', category: 'admin_attendance', parameters: [] },
  { name: 'who_is_on_leave_today', description: 'List all employees on approved leave today', scope: 'admin', category: 'admin_attendance', parameters: [] },
  { name: 'who_is_on_break_today', description: 'List employees currently on break', scope: 'admin', category: 'admin_attendance', parameters: [] },
  { name: 'attendance_for_date', description: 'Full attendance board for everyone on a specific date', scope: 'admin', category: 'admin_attendance', parameters: [P.date()] },
  { name: 'attendance_for_employee', description: 'Attendance record for a specific employee on a date or date range', scope: 'admin', category: 'admin_attendance', parameters: [P.email(), P.startDate(), P.endDate()] },
  { name: 'attendance_for_employee_range', description: 'Detailed attendance history for one employee over a range of dates', scope: 'admin', category: 'admin_attendance', parameters: [P.email(), P.startDate(), P.endDate()] },
  { name: 'department_attendance', description: 'Attendance summary for a specific department/group on a date', scope: 'admin', category: 'admin_attendance', parameters: [P.groupId(true), P.date(false)] },
];

const ADMIN_LEAVE_TOOLS: ToolSchema[] = [
  { name: 'pending_leave_approvals', description: 'List all leave requests pending approval', scope: 'admin', category: 'admin_leaves', parameters: [] },
  { name: 'approve_leave', description: 'Approve a leave request by ID', scope: 'admin', category: 'admin_leaves', parameters: [P.id('Leave request ID'), P.approverEmail()] },
  { name: 'reject_leave', description: 'Reject a leave request by ID', scope: 'admin', category: 'admin_leaves', parameters: [P.id('Leave request ID'), P.reason(true), P.approverEmail()] },
  { name: 'leave_report', description: 'Leave usage report for a date range (by type, by employee)', scope: 'admin', category: 'admin_leaves', parameters: [P.startDate(), P.endDate(), P.groupId()] },
  { name: 'leaves_for_employee', description: 'All leave requests for a specific employee', scope: 'admin', category: 'admin_leaves', parameters: [P.email()] },
];

const ADMIN_REGULARIZATION_TOOLS: ToolSchema[] = [
  { name: 'pending_regularizations', description: 'List all regularization requests pending approval', scope: 'admin', category: 'admin_regularization', parameters: [] },
  { name: 'approve_regularization', description: 'Approve a regularization request by ID', scope: 'admin', category: 'admin_regularization', parameters: [P.id('Regularization ID'), P.approverEmail()] },
  { name: 'reject_regularization', description: 'Reject a regularization request by ID', scope: 'admin', category: 'admin_regularization', parameters: [P.id('Regularization ID'), P.reason(true), P.approverEmail()] },
  { name: 'regularizations_for_employee', description: 'All regularization requests for a specific employee', scope: 'admin', category: 'admin_regularization', parameters: [P.email()] },
];

const ADMIN_OVERTIME_TOOLS: ToolSchema[] = [
  { name: 'pending_overtime_approvals', description: 'List all overtime records pending approval', scope: 'admin', category: 'admin_overtime', parameters: [] },
  { name: 'approve_overtime', description: 'Approve an overtime record by ID', scope: 'admin', category: 'admin_overtime', parameters: [P.id('Overtime record ID'), P.approverEmail()] },
  { name: 'reject_overtime', description: 'Reject an overtime record by ID', scope: 'admin', category: 'admin_overtime', parameters: [P.id('Overtime record ID'), P.reason(true), P.approverEmail()] },
  { name: 'overtime_report', description: 'Overtime report for a date range (by employee, by type)', scope: 'admin', category: 'admin_overtime', parameters: [P.startDate(), P.endDate(), P.groupId(), P.email(false)] },
];

const ADMIN_BD_TOOLS: ToolSchema[] = [
  { name: 'pending_bd_meetings', description: 'List all BD meetings pending qualification or approval', scope: 'admin', category: 'admin_bd', parameters: [] },
  { name: 'approve_bd_meeting', description: 'Approve a BD meeting by ID', scope: 'admin', category: 'admin_bd', parameters: [P.id('BD meeting ID'), P.approverEmail()] },
  { name: 'reject_bd_meeting', description: 'Reject a BD meeting by ID', scope: 'admin', category: 'admin_bd', parameters: [P.id('BD meeting ID'), P.reason(true), P.approverEmail()] },
];

const ADMIN_TIMESHEET_TOOLS: ToolSchema[] = [
  { name: 'pending_timesheets', description: 'List all submitted timesheets awaiting approval', scope: 'admin', category: 'admin_timesheets', parameters: [] },
  { name: 'approve_timesheet', description: 'Approve a submitted timesheet by ID', scope: 'admin', category: 'admin_timesheets', parameters: [P.id('Timesheet ID'), P.approverEmail()] },
  { name: 'reject_timesheet', description: 'Reject a submitted timesheet by ID', scope: 'admin', category: 'admin_timesheets', parameters: [P.id('Timesheet ID'), P.reason(true), P.approverEmail()] },
  { name: 'timesheets_for_employee', description: 'List timesheets for a specific employee', scope: 'admin', category: 'admin_timesheets', parameters: [P.email()] },
];

const ADMIN_TARGET_TOOLS: ToolSchema[] = [
  { name: 'employee_attendance_target', description: 'Compare expected shift hours vs actual worked hours for an employee over a date range', scope: 'admin', category: 'admin_targets', parameters: [P.email(), P.startDate(), P.endDate()] },
  { name: 'group_attendance_target', description: 'Attendance target achievement for an entire department/group', scope: 'admin', category: 'admin_targets', parameters: [P.groupId(true), P.startDate(), P.endDate()] },
  { name: 'employee_billable_target', description: 'Billable hours vs budget for an employee over a date range', scope: 'admin', category: 'admin_targets', parameters: [P.email(), P.startDate(), P.endDate()] },
];

const ADMIN_PEOPLE_TOOLS: ToolSchema[] = [
  { name: 'employee_info', description: 'Get profile information for a specific employee', scope: 'admin', category: 'admin_people', parameters: [P.email()] },
  { name: 'employee_count', description: 'How many active employees (optionally by department)', scope: 'admin', category: 'admin_people', parameters: [P.groupId()] },
  { name: 'employee_list_department', description: 'List all employees in a department/group', scope: 'admin', category: 'admin_people', parameters: [P.groupId(true)] },
  { name: 'employee_of_month', description: 'Who is the current employee of the month', scope: 'admin', category: 'admin_people', parameters: [] },
];

const ADMIN_REPORT_TOOLS: ToolSchema[] = [
  { name: 'department_dashboard', description: 'Per-department headcount, present/absent/leave counts, attendance rate', scope: 'admin', category: 'admin_reports', parameters: [P.startDate(false), P.endDate(false)] },
  { name: 'utilization_report', description: 'Billable vs non-billable hours per employee, utilization percentage', scope: 'admin', category: 'admin_reports', parameters: [P.startDate(), P.endDate(), P.email(false)] },
  { name: 'attendance_trend', description: 'Daily/weekly/monthly attendance trend for charting', scope: 'admin', category: 'admin_reports', parameters: [P.startDate(), P.endDate(), P.groupId(), { name: 'groupBy', type: 'string', description: 'day, week, or month', required: false, enum: ['day', 'week', 'month'] }] },
  { name: 'attendance_overview', description: 'Per-employee attendance breakdown for a date range (present, absent, late, hours)', scope: 'admin', category: 'admin_reports', parameters: [P.startDate(), P.endDate(), P.groupId(), P.email(false)] },
];

const ADMIN_PENDING_TOOLS: ToolSchema[] = [
  { name: 'all_pending_approvals', description: 'Count and summary of all items pending approval (leaves, regs, OT, BD, timesheets)', scope: 'admin', category: 'admin_pending', parameters: [] },
];

// ══════════════════════════════════════════════════════
// FULL REGISTRY
// ══════════════════════════════════════════════════════

export const ALL_TOOLS: ToolSchema[] = [
  ...CLOCK_TOOLS,
  ...MY_ATTENDANCE_TOOLS,
  ...MY_REGULARIZATION_TOOLS,
  ...MY_LEAVE_TOOLS,
  ...MY_TIME_TRACKING_TOOLS,
  ...MY_OVERTIME_TOOLS,
  ...MY_TIMESHEET_TOOLS,
  ...MY_PROFILE_TOOLS,
  ...MY_TARGET_TOOLS,
  ...MY_HOLIDAY_TOOLS,
  ...MY_MEETING_TOOLS,
  ...MY_PENDING_TOOLS,
  ...ADMIN_ATTENDANCE_TOOLS,
  ...ADMIN_LEAVE_TOOLS,
  ...ADMIN_REGULARIZATION_TOOLS,
  ...ADMIN_OVERTIME_TOOLS,
  ...ADMIN_BD_TOOLS,
  ...ADMIN_TIMESHEET_TOOLS,
  ...ADMIN_TARGET_TOOLS,
  ...ADMIN_PEOPLE_TOOLS,
  ...ADMIN_REPORT_TOOLS,
  ...ADMIN_PENDING_TOOLS,
];

/** Employee-scoped tools only. */
export const EMPLOYEE_TOOLS: ToolSchema[] = ALL_TOOLS.filter(
  (t) => t.scope === 'employee' || t.scope === 'both',
);

/** Admin-scoped tools only. */
export const ADMIN_TOOLS: ToolSchema[] = ALL_TOOLS.filter(
  (t) => t.scope === 'admin' || t.scope === 'both',
);

/** Tool name → schema lookup. */
export const TOOL_MAP: Map<string, ToolSchema> = new Map(
  ALL_TOOLS.map((t) => [t.name, t]),
);

/**
 * Convert tool schemas to the format needed for LLM function-calling.
 * Output is provider-agnostic — the LLM client adapts it to Anthropic/Ollama format.
 */
export function toolsToFunctionDefs(tools: ToolSchema[]): Array<{
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}> {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: 'object' as const,
      properties: Object.fromEntries(
        t.parameters.map((p) => [
          p.name,
          { type: p.type, description: p.description, ...(p.enum ? { enum: p.enum } : {}) },
        ]),
      ),
      required: t.parameters.filter((p) => p.required).map((p) => p.name),
    },
  }));
}
