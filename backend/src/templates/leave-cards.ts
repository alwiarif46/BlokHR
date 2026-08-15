/**
 * Adaptive Card templates for Teams notifications.
 * Each template is a function that returns an Adaptive Card JSON payload.
 * Cards use Action.Execute for interactive approve/reject buttons.
 */

export interface LeaveCardData {
  leaveId: string;
  employeeName: string;
  employeeEmail: string;
  leaveType: string;
  kind: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string;
  paidType: string;
  status?: string;
  approverName?: string;
  rejectionReason?: string;
  reminderNumber?: number;
  totalReminders?: number;
}

/** Card sent to manager when leave is submitted. Has Approve/Reject buttons. */
export function leaveApprovalCard(data: LeaveCardData): Record<string, unknown> {
  const paidBadge =
    data.paidType === 'paid' ? '🟢 PAID' : data.paidType === 'unpaid' ? '🔴 UNPAID' : '';
  const dateRange =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} → ${data.endDate}`;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [{ type: 'TextBlock', text: '📋', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              { type: 'TextBlock', text: 'Leave Request', weight: 'Bolder', size: 'Medium' },
              {
                type: 'TextBlock',
                text: `From **${data.employeeName}**`,
                spacing: 'None',
                isSubtle: true,
              },
            ],
          },
        ],
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Type', value: `${data.leaveType} · ${data.kind} ${paidBadge}` },
          { title: 'Dates', value: dateRange },
          { title: 'Days', value: String(data.daysRequested) },
          ...(data.reason ? [{ title: 'Reason', value: data.reason }] : []),
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ Approve',
        verb: 'leave.approve',
        data: { leaveId: data.leaveId, action: 'approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'leave.reject',
        data: { leaveId: data.leaveId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Card sent to HR after manager approval. Has Approve/Reject buttons. */
export function leaveHrApprovalCard(data: LeaveCardData): Record<string, unknown> {
  const dateRange =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} → ${data.endDate}`;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [{ type: 'TextBlock', text: '📋', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'Leave — HR Approval Needed',
                weight: 'Bolder',
                size: 'Medium',
              },
              {
                type: 'TextBlock',
                text: `From **${data.employeeName}** · Manager approved`,
                spacing: 'None',
                isSubtle: true,
              },
            ],
          },
        ],
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Type', value: `${data.leaveType} · ${data.kind}` },
          { title: 'Dates', value: dateRange },
          { title: 'Days', value: String(data.daysRequested) },
          ...(data.reason ? [{ title: 'Reason', value: data.reason }] : []),
          ...(data.approverName ? [{ title: 'Mgr Approved By', value: data.approverName }] : []),
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ HR Approve',
        verb: 'leave.hr_approve',
        data: { leaveId: data.leaveId, action: 'hr_approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'leave.reject',
        data: { leaveId: data.leaveId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Notification card sent to employee on status changes. No action buttons. */
export function leaveStatusCard(data: LeaveCardData): Record<string, unknown> {
  const statusIcon =
    data.status === 'Approved'
      ? '✅'
      : data.status === 'Approved by Manager'
        ? '⏳'
        : data.status === 'Rejected'
          ? '❌'
          : '📋';

  const statusText =
    data.status === 'Approved'
      ? 'Fully Approved'
      : data.status === 'Approved by Manager'
        ? 'Manager Approved — Pending HR'
        : data.status === 'Rejected'
          ? 'Rejected'
          : (data.status ?? 'Updated');

  const dateRange =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} → ${data.endDate}`;

  const facts = [
    { title: 'Status', value: `${statusIcon} ${statusText}` },
    { title: 'Type', value: `${data.leaveType} · ${data.kind}` },
    { title: 'Dates', value: dateRange },
    { title: 'Days', value: String(data.daysRequested) },
  ];

  if (data.approverName) {
    facts.push({ title: 'Approved By', value: data.approverName });
  }
  if (data.rejectionReason) {
    facts.push({ title: 'Reason', value: data.rejectionReason });
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `Leave ${statusText}`,
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'TextBlock',
        text: `Your ${data.leaveType} leave request has been updated.`,
        isSubtle: true,
        wrap: true,
      },
      { type: 'FactSet', facts },
    ],
  };
}

/** Updated card replacing the original approval card after action taken. */
export function leaveResolvedCard(data: LeaveCardData): Record<string, unknown> {
  const statusIcon =
    data.status === 'Approved'
      ? '✅'
      : data.status === 'Approved by Manager'
        ? '☑️'
        : data.status === 'Rejected'
          ? '❌'
          : '📋';

  const dateRange =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} → ${data.endDate}`;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${statusIcon} Leave ${data.status ?? 'Updated'}`,
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Employee', value: data.employeeName },
          { title: 'Type', value: `${data.leaveType} · ${data.kind}` },
          { title: 'Dates', value: dateRange },
          ...(data.rejectionReason
            ? [{ title: 'Rejection Reason', value: data.rejectionReason }]
            : []),
        ],
      },
      {
        type: 'TextBlock',
        text: '_This request has been processed. No further action needed._',
        isSubtle: true,
        wrap: true,
        size: 'Small',
      },
    ],
  };
}

/** Reminder card — nudges approver to act. */
export function leaveReminderCard(data: LeaveCardData): Record<string, unknown> {
  const dateRange =
    data.startDate === data.endDate ? data.startDate : `${data.startDate} → ${data.endDate}`;

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `⏰ Reminder ${data.reminderNumber ?? ''}/${data.totalReminders ?? 3}: Leave Pending Your Action`,
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: `**${data.employeeName}** is waiting for your approval.`,
        wrap: true,
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Type', value: `${data.leaveType} · ${data.kind}` },
          { title: 'Dates', value: dateRange },
          { title: 'Days', value: String(data.daysRequested) },
        ],
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ Approve',
        verb: data.status === 'Approved by Manager' ? 'leave.hr_approve' : 'leave.approve',
        data: {
          leaveId: data.leaveId,
          action: data.status === 'Approved by Manager' ? 'hr_approve' : 'approve',
        },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'leave.reject',
        data: { leaveId: data.leaveId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}
