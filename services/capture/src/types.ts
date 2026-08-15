export type SubjectType = 'staff' | 'student' | 'visitor';
export type Modality = 'fingerprint' | 'face' | 'iris' | 'nfc' | 'qr' | 'bus_rfid';
export type Decision = 'matched' | 'no_match' | 'manual_required';
export type Vertical = 'hr' | 'school';
export type DeviceCapability = 'otg_fingerprint' | 'nfc' | 'camera_qr' | 'camera_face' | 'bus_rfid';

export const BIOMETRIC_MODALITIES = new Set<Modality>(['fingerprint', 'face', 'iris']);

export const MODULE_IDS = {
  school_roll_call: 'school_roll_call',
  capture_qr: 'capture_qr',
  capture_nfc: 'capture_nfc',
  capture_fingerprint_staff: 'capture_fingerprint_staff',
  capture_fingerprint_students: 'capture_fingerprint_students',
  capture_face_adults: 'capture_face_adults',
  capture_face_students: 'capture_face_students',
  capture_iris_students: 'capture_iris_students',
  transport_bus_rfid: 'transport_bus_rfid',
} as const;

export interface TenantJurisdiction {
  country: string;
  state: string;
  vertical: Vertical;
  faceAdultsEnabled: boolean;
  faceStudentsDpiaRef: string;
  retentionDays: number;
}

export interface EnrolmentInput {
  subjectRef: string;
  subjectType: SubjectType;
  modality: Modality;
  payloadB64: string;
  algo?: string;
  quality?: number;
  deviceId?: string;
  capturedAt?: string;
  consentRef?: string;
  /** Required for fingerprint: enrol ≥2 fingers (slots 1 and 2). */
  fingerSlot?: 1 | 2;
}

export interface EventInput {
  modality: Modality;
  payloadB64: string;
  algo?: string;
  deviceId?: string;
  capturedAt?: string;
  idempotencyKey: string;
  context?: Record<string, unknown>;
  subjectTypeHint?: SubjectType;
}

export interface EventResult {
  id: string;
  subjectRef: string;
  matchScore: number;
  decision: Decision;
  idempotentReplay?: boolean;
}

export interface ConsentPort {
  validate(tenantId: string, consentRef: string, modality: string): Promise<boolean>;
}

export interface EntitlementsPort {
  hasModule(tenantId: string, moduleId: string): Promise<boolean>;
}

export interface SchoolAttendancePort {
  markFromCapture(input: {
    tenantId: string;
    subjectRef: string;
    periodId?: string;
    classId?: string;
    decision: Decision;
    source: string;
    idempotencyKey: string;
  }): Promise<void>;
}

export interface ClockPort {
  clock(action: string, email: string, name: string, source: string): Promise<{ success: boolean; error?: string }>;
}
