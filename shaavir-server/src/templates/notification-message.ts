/**
 * Shared notification message builder.
 * Produces a platform-agnostic message structure that each adapter
 * converts into its native format (Block Kit, Adaptive Card, HTML, etc.).
 *
 * This is the SINGLE SOURCE OF TRUTH for all notification content.
 * Adding a new module (BD Meetings, etc.) means adding templates here — adapters don't change.
 */

export interface NotificationMessage {
  title: string;
  subtitle: string;
  icon: string;
  color: string; // hex
  fields: Array<{ label: string; value: string }>;
  bodyText?: string;
  footerText: string;
  buttons: Array<{
    label: string;
    actionId: string;
    style: 'primary' | 'danger';
    payload: Record<string, unknown>;
  }>;
  isResolved: boolean;
}

/**
 * Build a notification message from event type + data.
 * Every adapter calls this then converts the result to its native format.
 */
export function buildNotificationMessage(
  templateName: string,
  data: Record<string, unknown>,
  recipientRole?: string,
): NotificationMessage {
  const companyName = (data.companyName as string) || 'Shaavir HR';

  // Route to the correct module builder
  if (templateName.startsWith('leave:') || templateName.startsWith('leave:')) {
    return buildLeaveMessage(templateName, data, recipientRole, companyName);
  }
  if (templateName.startsWith('regularization:')) {
    return buildRegMessage(templateName, data, recipientRole, companyName);
  }
  if (templateName.startsWith('bd_meeting:')) {
    return buildBdMeetingMessage(templateName, data, recipientRole, companyName);
  }
  if (templateName.startsWith('profile:')) {
    return buildProfileMessage(templateName, data, companyName);
  }

  // Fallback
  return {
    title: 'Notification',
    subtitle: '',
    icon: '📋',
    color: '#808080',
    fields: [],
    footerText: companyName,
    buttons: [],
    isResolved: false,
  };
}

// ── LEAVE MESSAGES ──

function buildLeaveMessage(
  templateName: string,
  data: Record<string, unknown>,
  recipientRole: string | undefined,
  companyName: string,
): NotificationMessage {
  const employeeName = (data.employeeName as string) ?? '';
  const leaveType = (data.leaveType as string) ?? '';
  const kind = (data.kind as string) ?? '';
  const startDate = (data.startDate as string) ?? '';
  const endDate = (data.endDate as string) ?? '';
  const daysRequested = (data.daysRequested as number) ?? 0;
  const reason = (data.reason as string) ?? '';
  const approverName = (data.approverName as string) ?? '';
  const rejectionReason = (data.rejectionReason as string) ?? '';
  const leaveId = (data.leaveId as string) ?? '';
  const reminderNumber = (data.reminderNumber as number) ?? 0;
  const totalReminders = (data.totalReminders as number) ?? 3;
  const status = (data.status as string) ?? '';
  const paidType = (data.paidType as string) ?? '';

  const dateRange = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  const paidBadge = paidType === 'paid' ? ' [PAID]' : paidType === 'unpaid' ? ' [UNPAID]' : '';

  const fields = [
    { label: 'Type', value: `${leaveType} / ${kind}${paidBadge}` },
    { label: 'Dates', value: dateRange },
    { label: 'Days', value: String(daysRequested) },
    ...(reason ? [{ label: 'Reason', value: reason }] : []),
    ...(approverName && status ? [{ label: 'By', value: approverName }] : []),
    ...(rejectionReason ? [{ label: 'Rejection Reason', value: rejectionReason }] : []),
  ];

  const approveVerb = recipientRole === 'hr' ? 'leave.hr_approve' : 'leave.approve';
  const approveLabel = recipientRole === 'hr' ? 'HR Approve' : 'Approve';
  const approveActionVal = recipientRole === 'hr' ? 'hr_approve' : 'approve';

  const approveRejectButtons = [
    {
      label: `✓ ${approveLabel}`,
      actionId: approveVerb,
      style: 'primary' as const,
      payload: { leaveId, action: approveActionVal },
    },
    {
      label: '✗ Reject',
      actionId: 'leave.reject',
      style: 'danger' as const,
      payload: { leaveId, action: 'reject' },
    },
  ];

  if (templateName === 'leave:resolved') {
    const icon = status === 'Approved' ? '✅' : status === 'Rejected' ? '❌' : '☑️';
    return {
      title: `Leave ${status}`,
      subtitle: `${employeeName} - ${leaveType}`,
      icon,
      color: status === 'Approved' ? '#22C55E' : status === 'Rejected' ? '#EF4444' : '#3B82F6',
      fields,
      bodyText: 'This request has been processed.',
      footerText: companyName,
      buttons: [],
      isResolved: true,
    };
  }

  if (templateName.includes(':reminder')) {
    return {
      title: `Reminder ${reminderNumber}/${totalReminders}: Leave Pending`,
      subtitle: `${employeeName} is waiting for your approval`,
      icon: '⏰',
      color: '#F5A623',
      fields,
      footerText: companyName,
      buttons: approveRejectButtons,
      isResolved: false,
    };
  }

  switch (templateName) {
    case 'leave:submitted':
      return {
        title: 'Leave Request',
        subtitle: `From ${employeeName}`,
        icon: '📋',
        color: '#F5A623',
        fields,
        footerText: companyName,
        buttons: approveRejectButtons,
        isResolved: false,
      };

    case 'leave:manager_approved':
      if (recipientRole === 'hr') {
        return {
          title: 'Leave — HR Approval Needed',
          subtitle: `From ${employeeName} - Manager approved by ${approverName}`,
          icon: '☑️',
          color: '#3B82F6',
          fields,
          footerText: companyName,
          buttons: approveRejectButtons,
          isResolved: false,
        };
      }
      return {
        title: 'Manager Approved',
        subtitle: `${employeeName}'s ${leaveType} leave`,
        icon: '☑️',
        color: '#3B82F6',
        fields,
        bodyText: 'Pending HR approval.',
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'leave:hr_approved':
      return {
        title: 'Leave Fully Approved',
        subtitle: `${employeeName}'s ${leaveType} leave`,
        icon: '✅',
        color: '#22C55E',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'leave:rejected':
      return {
        title: 'Leave Rejected',
        subtitle: `${employeeName}'s ${leaveType} leave`,
        icon: '❌',
        color: '#EF4444',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    default:
      return {
        title: 'Leave Update',
        subtitle: employeeName,
        icon: '📋',
        color: '#808080',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };
  }
}

// ── REGULARIZATION MESSAGES ──

function regTypeLabel(correctionType: string): string {
  if (correctionType === 'clock-in') return 'Clock In Correction';
  if (correctionType === 'clock-out') return 'Clock Out Correction';
  return 'Both (In + Out)';
}

function buildRegMessage(
  templateName: string,
  data: Record<string, unknown>,
  recipientRole: string | undefined,
  companyName: string,
): NotificationMessage {
  const employeeName = (data.employeeName as string) ?? '';
  const date = (data.date as string) ?? '';
  const correctionType = (data.correctionType as string) ?? 'both';
  const inTime = (data.inTime as string) ?? '';
  const outTime = (data.outTime as string) ?? '';
  const reason = (data.reason as string) ?? '';
  const approverName = (data.approverName as string) ?? '';
  const rejectionReason = (data.rejectionReason as string) ?? '';
  const regId = (data.regId as string) ?? '';
  const reminderNumber = (data.reminderNumber as number) ?? 0;
  const totalReminders = (data.totalReminders as number) ?? 3;
  const status = (data.status as string) ?? '';

  const fields = [
    { label: 'Date', value: date },
    { label: 'Type', value: regTypeLabel(correctionType) },
    ...(inTime ? [{ label: 'Correct In', value: inTime }] : []),
    ...(outTime ? [{ label: 'Correct Out', value: outTime }] : []),
    { label: 'Reason', value: reason },
    ...(approverName && status ? [{ label: 'By', value: approverName }] : []),
    ...(rejectionReason ? [{ label: 'Rejection Reason', value: rejectionReason }] : []),
  ];

  const approveVerb = recipientRole === 'hr' ? 'reg.hr_approve' : 'reg.approve';
  const approveLabel = recipientRole === 'hr' ? 'HR Approve' : 'Approve';
  const approveActionVal = recipientRole === 'hr' ? 'hr_approve' : 'approve';

  const approveRejectButtons = [
    {
      label: `✓ ${approveLabel}`,
      actionId: approveVerb,
      style: 'primary' as const,
      payload: { regId, action: approveActionVal },
    },
    {
      label: '✗ Reject',
      actionId: 'reg.reject',
      style: 'danger' as const,
      payload: { regId, action: 'reject' },
    },
  ];

  if (templateName === 'regularization:resolved') {
    const icon = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '📝';
    return {
      title: `Correction ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Processed'}`,
      subtitle: `${employeeName} - ${date}`,
      icon,
      color: status === 'approved' ? '#22C55E' : status === 'rejected' ? '#EF4444' : '#808080',
      fields,
      bodyText: 'This request has been processed.',
      footerText: companyName,
      buttons: [],
      isResolved: true,
    };
  }

  if (templateName.includes(':reminder')) {
    return {
      title: `Reminder ${reminderNumber}/${totalReminders}: Correction Pending`,
      subtitle: `${employeeName} is waiting for your approval`,
      icon: '⏰',
      color: '#F5A623',
      fields,
      footerText: companyName,
      buttons: approveRejectButtons,
      isResolved: false,
    };
  }

  switch (templateName) {
    case 'regularization:submitted':
      return {
        title: 'Attendance Correction Request',
        subtitle: `From ${employeeName}`,
        icon: '📝',
        color: '#F5A623',
        fields,
        footerText: companyName,
        buttons: approveRejectButtons,
        isResolved: false,
      };

    case 'regularization:manager_approved':
      if (recipientRole === 'hr') {
        return {
          title: 'Correction — HR Approval Needed',
          subtitle: `From ${employeeName} - Manager approved by ${approverName}`,
          icon: '☑️',
          color: '#3B82F6',
          fields,
          footerText: companyName,
          buttons: approveRejectButtons,
          isResolved: false,
        };
      }
      return {
        title: 'Manager Approved',
        subtitle: `${employeeName}'s correction for ${date}`,
        icon: '☑️',
        color: '#3B82F6',
        fields,
        bodyText: 'Pending HR approval.',
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'regularization:hr_approved':
      return {
        title: 'Correction Fully Approved',
        subtitle: `${employeeName}'s attendance for ${date} has been corrected.`,
        icon: '✅',
        color: '#22C55E',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'regularization:rejected':
      return {
        title: 'Correction Rejected',
        subtitle: `${employeeName}'s correction for ${date}`,
        icon: '❌',
        color: '#EF4444',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    default:
      return {
        title: 'Correction Update',
        subtitle: employeeName,
        icon: '📝',
        color: '#808080',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };
  }
}

// ── BD MEETING MESSAGES ──

function buildBdMeetingMessage(
  templateName: string,
  data: Record<string, unknown>,
  recipientRole: string | undefined,
  companyName: string,
): NotificationMessage {
  const employeeName = (data.employeeName as string) ?? '';
  const client = (data.client as string) ?? '';
  const date = (data.date as string) ?? '';
  const time = (data.time as string) ?? '';
  const location = (data.location as string) ?? '';
  const notes = (data.notes as string) ?? '';
  const approverName = (data.approverName as string) ?? '';
  const qualifierName = (data.qualifierName as string) ?? '';
  const rejectionReason = (data.rejectionReason as string) ?? '';
  const meetingId = (data.meetingId as string) ?? '';
  const reminderNumber = (data.reminderNumber as number) ?? 0;
  const totalReminders = (data.totalReminders as number) ?? 3;
  const status = (data.status as string) ?? '';

  const fields = [
    { label: 'Client', value: client },
    { label: 'Date', value: date },
    ...(time ? [{ label: 'Time', value: time }] : []),
    ...(location ? [{ label: 'Location', value: location }] : []),
    ...(notes ? [{ label: 'Notes', value: notes }] : []),
    ...(qualifierName && status ? [{ label: 'Qualified By', value: qualifierName }] : []),
    ...(approverName && status === 'approved'
      ? [{ label: 'Approved By', value: approverName }]
      : []),
    ...(rejectionReason ? [{ label: 'Rejection Reason', value: rejectionReason }] : []),
  ];

  const qualifyButton = {
    label: '✓ Qualify',
    actionId: 'bd_meeting.qualify',
    style: 'primary' as const,
    payload: { meetingId, action: 'qualify' },
  };

  const approveButton = {
    label: '✓ Approve',
    actionId: 'bd_meeting.approve',
    style: 'primary' as const,
    payload: { meetingId, action: 'approve' },
  };

  const rejectButton = {
    label: '✗ Reject',
    actionId: 'bd_meeting.reject',
    style: 'danger' as const,
    payload: { meetingId, action: 'reject' },
  };

  if (templateName === 'bd_meeting:resolved') {
    const icon =
      status === 'approved'
        ? '✅'
        : status === 'rejected'
          ? '❌'
          : status === 'qualified'
            ? '☑️'
            : '🤝';
    return {
      title: `BD Meeting ${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : status === 'qualified' ? 'Qualified' : 'Processed'}`,
      subtitle: `${employeeName} - ${client}`,
      icon,
      color: status === 'approved' ? '#22C55E' : status === 'rejected' ? '#EF4444' : '#3B82F6',
      fields,
      bodyText: 'This request has been processed.',
      footerText: companyName,
      buttons: [],
      isResolved: true,
    };
  }

  if (templateName.includes(':reminder')) {
    return {
      title: `Reminder ${reminderNumber}/${totalReminders}: BD Meeting Pending`,
      subtitle: `${employeeName} is waiting for your action`,
      icon: '⏰',
      color: '#F5A623',
      fields,
      footerText: companyName,
      buttons: [qualifyButton, rejectButton],
      isResolved: false,
    };
  }

  switch (templateName) {
    case 'bd_meeting:submitted':
      return {
        title: 'BD Meeting — Qualification Needed',
        subtitle: `From ${employeeName}`,
        icon: '🤝',
        color: '#F5A623',
        fields,
        footerText: companyName,
        buttons: [qualifyButton, rejectButton],
        isResolved: false,
      };

    case 'bd_meeting:qualified':
      if (recipientRole === 'hr') {
        return {
          title: 'BD Meeting — Approval Needed',
          subtitle: `From ${employeeName} - Qualified by ${qualifierName}`,
          icon: '☑️',
          color: '#3B82F6',
          fields,
          footerText: companyName,
          buttons: [approveButton, rejectButton],
          isResolved: false,
        };
      }
      return {
        title: 'BD Meeting Qualified',
        subtitle: `${employeeName}'s meeting with ${client}`,
        icon: '☑️',
        color: '#3B82F6',
        fields,
        bodyText: 'Pending final approval.',
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'bd_meeting:approved':
      return {
        title: 'BD Meeting Approved',
        subtitle: `${employeeName}'s meeting with ${client}`,
        icon: '✅',
        color: '#22C55E',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    case 'bd_meeting:rejected':
      return {
        title: 'BD Meeting Rejected',
        subtitle: `${employeeName}'s meeting with ${client}`,
        icon: '❌',
        color: '#EF4444',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };

    default:
      return {
        title: 'BD Meeting Update',
        subtitle: employeeName,
        icon: '🤝',
        color: '#808080',
        fields,
        footerText: companyName,
        buttons: [],
        isResolved: false,
      };
  }
}

// ── PROFILE MESSAGES ──

function buildProfileMessage(
  templateName: string,
  data: Record<string, unknown>,
  companyName: string,
): NotificationMessage {
  const employeeName = (data.employeeName as string) ?? '';
  const employeeEmail = (data.employeeEmail as string) ?? '';
  const certifiedAt = (data.certifiedAt as string) ?? '';

  const fields = [
    { label: 'Employee', value: employeeName },
    { label: 'Email', value: employeeEmail },
    ...(certifiedAt ? [{ label: 'Certified', value: certifiedAt.split('T')[0] }] : []),
  ];

  if (templateName === 'profile:certified') {
    return {
      title: 'Profile Certified',
      subtitle: `${employeeName} has completed and certified their profile`,
      icon: '📋',
      color: '#22C55E',
      fields,
      bodyText: 'Please review the submitted information.',
      footerText: companyName,
      buttons: [],
      isResolved: false,
    };
  }

  return {
    title: 'Profile Update',
    subtitle: employeeName,
    icon: '📋',
    color: '#808080',
    fields,
    footerText: companyName,
    buttons: [],
    isResolved: false,
  };
}
