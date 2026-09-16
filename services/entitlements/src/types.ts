/** Shared entitlements contract for cloud + self-hosted channels. */

export type EntitlementChannel = 'cloud' | 'self_hosted';
export type EntitlementPlan = 'trial' | 'starter' | 'business' | 'enterprise';
export type EntitlementStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'expired'
  | 'cancelled';
export type EntitlementSource = 'razorpay' | 'signed_license' | 'manual';
export type EntitlementVertical = 'hr' | 'school';

export interface Entitlement {
  tenantId: string;
  channel: EntitlementChannel;
  plan: EntitlementPlan;
  status: EntitlementStatus;
  seatLimit: number;
  modules: string[];
  trialEndsAt: string | null;
  renewsAt: string | null;
  currency: 'INR';
  source: EntitlementSource;
  /** Defaults to `hr` when missing on older rows. */
  vertical?: EntitlementVertical;
}

export interface SeatCheckResult {
  allowed: boolean;
  seatLimit: number;
  activeSeats: number;
  reason?: string;
}

export interface ModuleCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface SignedLicenseClaims {
  tenantId: string;
  orgName?: string;
  plan: EntitlementPlan;
  seatLimit: number;
  modules: string[];
  validFrom: string;
  validTo: string;
  edition?: string;
}

export const TRIAL_SEAT_LIMIT = 25;
export const TRIAL_DAYS = 30;

export const DEFAULT_CLOUD_MODULES = [
  'attendance',
  'leaves',
  'regularizations',
  'timesheets',
  'profile',
  'settings',
  'capture_qr',
];

/**
 * HR work-time modules — not in trial/starter defaults (avoids silently
 * changing commercial tiers). Backfill tenants that already had the
 * matching feature flags enabled; otherwise entitle explicitly per plan.
 */
export const HR_WORK_TIME_MODULES = ['time_tracking', 'overtime'] as const;

export const DEFAULT_ENTERPRISE_MODULES = [
  ...DEFAULT_CLOUD_MODULES,
  ...HR_WORK_TIME_MODULES,
  'analytics',
  'webhooks',
  'workflows',
  'documents',
  'org_chart',
  'school_roll_call',
  'capture_nfc',
  'capture_fingerprint_staff',
  'capture_face_adults',
];

/** Capture modality module IDs (plan contract). */
export const CAPTURE_MODULE_IDS = [
  'school_roll_call',
  'capture_qr',
  'capture_nfc',
  'capture_fingerprint_staff',
  'capture_fingerprint_students',
  'capture_face_adults',
  'capture_face_students',
  'capture_iris_students',
  'transport_bus_rfid',
] as const;

/** School vertical — included in school cloud trial. */
export const DEFAULT_SCHOOL_MODULES = [
  'school_identity',
  'school_timetable',
  'school_attendance',
  'school_academics',
  'school_engagement',
  'school_surveys',
] as const;

/** School vertical — premium / paid add-ons. */
export const SCHOOL_PREMIUM_MODULES = [
  ...DEFAULT_SCHOOL_MODULES,
  'school_assessment',
  'school_fees',
  'school_transport',
  'school_compliance',
  'school_operations',
  'school_library',
  'school_nudge',
  'school_family_hub',
  'school_parent_portal',
  /** Feature-flag stubs — not wired to UI modules yet. */
  'school_family_health',
  'school_family_meals',
  'school_family_activities',
  'school_family_pickup',
  'school_family_community',
  'school_family_fundraising',
  'school_family_ai',
] as const;

/** Never in any default set — must be explicitly entitled. */
export const GATED_MODULES = ['school_biometrics'] as const;
