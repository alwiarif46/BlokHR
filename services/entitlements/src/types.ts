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

export const DEFAULT_ENTERPRISE_MODULES = [
  ...DEFAULT_CLOUD_MODULES,
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
] as const;

/** Never in any default set — must be explicitly entitled. */
export const GATED_MODULES = ['school_biometrics'] as const;
