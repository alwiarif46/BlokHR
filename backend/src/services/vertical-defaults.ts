/**
 * Vertical defaults for setup seed (W-01).
 * Single source for HR retention numbers — school halves attendance photo/geo only.
 */

export type TenantVertical = 'hr' | 'school';

export const HR_TERMINOLOGY_DEFAULTS = {
  person: 'Employee',
  person_plural: 'Employees',
  group: 'Department',
  subgroup: 'Team',
  interval: 'Shift',
  supervisor: 'Manager',
} as const;

export const SCHOOL_TERMINOLOGY_DEFAULTS = {
  person: 'Student',
  person_plural: 'Students',
  group: 'Class',
  subgroup: 'Section',
  interval: 'Period',
  supervisor: 'Class Teacher',
} as const;

/** HR dataRetention defaults (mirrors docs / migration seed). */
export const HR_DATA_RETENTION_DEFAULTS = {
  auditLogDays: 365,
  chatMessageDays: 365,
  clockEventDays: 730,
  notificationQueueDays: 30,
  webhookLogDays: 90,
  eventBusRetentionDays: 90,
  /** Attendance evidence retention (days). */
  attendancePhotoDays: 90,
  attendanceGeoDays: 90,
} as const;

export type DataRetentionDefaults = {
  [K in keyof typeof HR_DATA_RETENTION_DEFAULTS]: number;
};

/** School: copy HR retention, halve attendance photo/geo from the HR defaults object (no second magic numbers). */
export function schoolDataRetentionFromHr(
  hr: DataRetentionDefaults = { ...HR_DATA_RETENTION_DEFAULTS },
): DataRetentionDefaults {
  return {
    ...hr,
    attendancePhotoDays: Math.max(1, Math.floor(hr.attendancePhotoDays / 2)),
    attendanceGeoDays: Math.max(1, Math.floor(hr.attendanceGeoDays / 2)),
  };
}

export function isTenantVertical(value: unknown): value is TenantVertical {
  return value === 'hr' || value === 'school';
}
