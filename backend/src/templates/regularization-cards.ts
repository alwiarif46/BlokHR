/**
 * Adaptive Card templates for regularization (attendance correction) notifications.
 * Used by Teams adapter directly. Other adapters use the data fields.
 */

export interface RegCardData {
  regId: string;
  employeeName: string;
  employeeEmail: string;
  date: string;
  correctionType: string;
  inTime: string;
  outTime: string;
  reason: string;
  status?: string;
  approverName?: string;
  rejectionReason?: string;
  reminderNumber?: number;
  totalReminders?: number;
}

/** Correction type display label. */
function typeLabel(correctionType: string): string {
  if (correctionType === 'clock-in') return 'Clock In Correction';
  if (correctionType === 'clock-out') return 'Clock Out Correction';
  return 'Both (In + Out)';
}

/** Card sent to manager when regularization is submitted. Has Approve/Reject buttons. */
export function regApprovalCard(data: RegCardData): Record<string, unknown> {
  const facts = [
    { title: 'Date', value: data.date },
    { title: 'Type', value: typeLabel(data.correctionType) },
    ...(data.inTime ? [{ title: 'Correct In', value: data.inTime }] : []),
    ...(data.outTime ? [{ title: 'Correct Out', value: data.outTime }] : []),
    { title: 'Reason', value: data.reason },
  ];

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
            items: [{ type: 'TextBlock', text: '📝', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'Attendance Correction',
                weight: 'Bolder',
                size: 'Medium',
              },
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
      { type: 'FactSet', facts },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ Approve',
        verb: 'reg.approve',
        data: { regId: data.regId, action: 'approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'reg.reject',
        data: { regId: data.regId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Card sent to HR after manager approval. */
export function regHrApprovalCard(data: RegCardData): Record<string, unknown> {
  const facts = [
    { title: 'Date', value: data.date },
    { title: 'Type', value: typeLabel(data.correctionType) },
    ...(data.inTime ? [{ title: 'Correct In', value: data.inTime }] : []),
    ...(data.outTime ? [{ title: 'Correct Out', value: data.outTime }] : []),
    { title: 'Reason', value: data.reason },
    ...(data.approverName ? [{ title: 'Mgr Approved By', value: data.approverName }] : []),
  ];

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
            items: [{ type: 'TextBlock', text: '📝', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'Correction — HR Approval Needed',
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
      { type: 'FactSet', facts },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: '✓ HR Approve',
        verb: 'reg.hr_approve',
        data: { regId: data.regId, action: 'hr_approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'reg.reject',
        data: { regId: data.regId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Status card to employee on updates. No buttons. */
export function regStatusCard(data: RegCardData): Record<string, unknown> {
  const statusIcon =
    data.status === 'approved'
      ? '✅'
      : data.status === 'manager_approved'
        ? '⏳'
        : data.status === 'rejected'
          ? '❌'
          : '📝';
  const statusText =
    data.status === 'approved'
      ? 'Fully Approved'
      : data.status === 'manager_approved'
        ? 'Manager Approved — Pending HR'
        : data.status === 'rejected'
          ? 'Rejected'
          : (data.status ?? 'Updated');

  const facts = [
    { title: 'Status', value: `${statusIcon} ${statusText}` },
    { title: 'Date', value: data.date },
    { title: 'Type', value: typeLabel(data.correctionType) },
    ...(data.approverName ? [{ title: 'By', value: data.approverName }] : []),
    ...(data.rejectionReason ? [{ title: 'Reason', value: data.rejectionReason }] : []),
  ];

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      { type: 'TextBlock', text: `Correction ${statusText}`, weight: 'Bolder', size: 'Medium' },
      {
        type: 'TextBlock',
        text: `Your attendance correction for ${data.date} has been updated.`,
        isSubtle: true,
        wrap: true,
      },
      { type: 'FactSet', facts },
    ],
  };
}

/** Resolved card replacing original approval card. No buttons. */
export function regResolvedCard(data: RegCardData): Record<string, unknown> {
  const statusIcon = data.status === 'approved' ? '✅' : data.status === 'rejected' ? '❌' : '📝';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${statusIcon} Correction ${data.status ?? 'Processed'}`,
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Employee', value: data.employeeName },
          { title: 'Date', value: data.date },
          { title: 'Type', value: typeLabel(data.correctionType) },
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

/** Reminder card nudging approver. */
export function regReminderCard(data: RegCardData): Record<string, unknown> {
  const verb = data.status === 'manager_approved' ? 'reg.hr_approve' : 'reg.approve';
  const actionLabel = data.status === 'manager_approved' ? 'HR Approve' : 'Approve';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `⏰ Reminder ${data.reminderNumber ?? ''}/${data.totalReminders ?? 3}: Correction Pending`,
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: `**${data.employeeName}** is waiting for your approval on a ${typeLabel(data.correctionType)} for ${data.date}.`,
        wrap: true,
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: `✓ ${actionLabel}`,
        verb,
        data: { regId: data.regId, action: verb === 'reg.hr_approve' ? 'hr_approve' : 'approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'reg.reject',
        data: { regId: data.regId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}
