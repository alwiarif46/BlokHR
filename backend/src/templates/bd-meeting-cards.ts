/**
 * Adaptive Card templates for BD meeting notifications.
 * Used by Teams interaction receiver for direct card responses to button clicks.
 * Other adapters use the shared template system via notification-message.ts + format-converters.ts.
 */

export interface BdMeetingCardData {
  meetingId: string;
  employeeName: string;
  employeeEmail: string;
  client: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  status?: string;
  qualifierName?: string;
  approverName?: string;
  rejectionReason?: string;
  reminderNumber?: number;
  totalReminders?: number;
}

/** Card sent to manager when BD meeting is submitted. Has Qualify/Reject buttons. */
export function bdMeetingQualifyCard(data: BdMeetingCardData): Record<string, unknown> {
  const facts = [
    { title: 'Client', value: data.client },
    { title: 'Date', value: data.date },
    ...(data.time ? [{ title: 'Time', value: data.time }] : []),
    ...(data.location ? [{ title: 'Location', value: data.location }] : []),
    ...(data.notes ? [{ title: 'Notes', value: data.notes }] : []),
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
            items: [{ type: 'TextBlock', text: '🤝', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'BD Meeting — Qualification Needed',
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
        title: '✓ Qualify',
        verb: 'bd_meeting.qualify',
        data: { meetingId: data.meetingId, action: 'qualify' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'bd_meeting.reject',
        data: { meetingId: data.meetingId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Card sent to admin/HR after qualification. Has Approve/Reject buttons. */
export function bdMeetingApprovalCard(data: BdMeetingCardData): Record<string, unknown> {
  const facts = [
    { title: 'Client', value: data.client },
    { title: 'Date', value: data.date },
    ...(data.time ? [{ title: 'Time', value: data.time }] : []),
    ...(data.location ? [{ title: 'Location', value: data.location }] : []),
    ...(data.notes ? [{ title: 'Notes', value: data.notes }] : []),
    ...(data.qualifierName ? [{ title: 'Qualified By', value: data.qualifierName }] : []),
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
            items: [{ type: 'TextBlock', text: '☑️', size: 'Large' }],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: 'BD Meeting — Approval Needed',
                weight: 'Bolder',
                size: 'Medium',
              },
              {
                type: 'TextBlock',
                text: `From **${data.employeeName}** · Qualified by ${data.qualifierName ?? 'manager'}`,
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
        verb: 'bd_meeting.approve',
        data: { meetingId: data.meetingId, action: 'approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'bd_meeting.reject',
        data: { meetingId: data.meetingId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}

/** Status card to employee on updates. No buttons. */
export function bdMeetingStatusCard(data: BdMeetingCardData): Record<string, unknown> {
  const statusIcon =
    data.status === 'approved'
      ? '✅'
      : data.status === 'qualified'
        ? '☑️'
        : data.status === 'rejected'
          ? '❌'
          : '🤝';
  const statusText =
    data.status === 'approved'
      ? 'Approved'
      : data.status === 'qualified'
        ? 'Qualified — Pending Approval'
        : data.status === 'rejected'
          ? 'Rejected'
          : (data.status ?? 'Updated');

  const facts = [
    { title: 'Status', value: `${statusIcon} ${statusText}` },
    { title: 'Client', value: data.client },
    { title: 'Date', value: data.date },
    ...(data.qualifierName ? [{ title: 'Qualified By', value: data.qualifierName }] : []),
    ...(data.approverName ? [{ title: 'Approved By', value: data.approverName }] : []),
    ...(data.rejectionReason ? [{ title: 'Reason', value: data.rejectionReason }] : []),
  ];

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `BD Meeting ${statusText}`,
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'TextBlock',
        text: `Your meeting with ${data.client} on ${data.date} has been updated.`,
        isSubtle: true,
        wrap: true,
      },
      { type: 'FactSet', facts },
    ],
  };
}

/** Resolved card replacing original action card. No buttons. */
export function bdMeetingResolvedCard(data: BdMeetingCardData): Record<string, unknown> {
  const statusIcon = data.status === 'approved' ? '✅' : data.status === 'rejected' ? '❌' : '🤝';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `${statusIcon} BD Meeting ${data.status ?? 'Processed'}`,
        weight: 'Bolder',
        size: 'Medium',
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Employee', value: data.employeeName },
          { title: 'Client', value: data.client },
          { title: 'Date', value: data.date },
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

/** Reminder card nudging qualifier/approver. */
export function bdMeetingReminderCard(data: BdMeetingCardData): Record<string, unknown> {
  const isQualifyStage = data.status === 'pending' || !data.status;
  const verb = isQualifyStage ? 'bd_meeting.qualify' : 'bd_meeting.approve';
  const actionLabel = isQualifyStage ? 'Qualify' : 'Approve';

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `⏰ Reminder ${data.reminderNumber ?? ''}/${data.totalReminders ?? 3}: BD Meeting Pending`,
        weight: 'Bolder',
        size: 'Medium',
        color: 'Attention',
      },
      {
        type: 'TextBlock',
        text: `**${data.employeeName}** is waiting for your action on a meeting with **${data.client}** on ${data.date}.`,
        wrap: true,
      },
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: `✓ ${actionLabel}`,
        verb,
        data: { meetingId: data.meetingId, action: isQualifyStage ? 'qualify' : 'approve' },
        style: 'positive',
      },
      {
        type: 'Action.Execute',
        title: '✗ Reject',
        verb: 'bd_meeting.reject',
        data: { meetingId: data.meetingId, action: 'reject' },
        style: 'destructive',
      },
    ],
  };
}
