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

/** Ordered keys for settings section #37 (terminology). */
export const TERMINOLOGY_KEYS = [
  'person',
  'person_plural',
  'group',
  'subgroup',
  'interval',
  'supervisor',
] as const;

export type TerminologyKey = (typeof TERMINOLOGY_KEYS)[number];

export type TerminologySection = Record<TerminologyKey, string>;

const TERMINOLOGY_MAX_LEN = 30;

/**
 * Validate a terminology section object (all six keys required, non-empty, ≤ 30 chars).
 */
export function validateTerminologySection(
  value: unknown,
): { ok: true; value: TerminologySection } | { ok: false; error: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'terminology must be an object' };
  }
  const raw = value as Record<string, unknown>;
  const result = {} as TerminologySection;
  for (const key of TERMINOLOGY_KEYS) {
    const v = raw[key];
    if (typeof v !== 'string' || !v.trim()) {
      return { ok: false, error: `terminology.${key} is required` };
    }
    const trimmed = v.trim();
    if (trimmed.length > TERMINOLOGY_MAX_LEN) {
      return {
        ok: false,
        error: `terminology.${key} must be at most ${TERMINOLOGY_MAX_LEN} characters`,
      };
    }
    result[key] = trimmed;
  }
  return { ok: true, value: result };
}

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
