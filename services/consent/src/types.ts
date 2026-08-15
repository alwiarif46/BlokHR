export type SubjectType = 'staff' | 'student' | 'visitor';
export type BiometricModality = 'fingerprint' | 'face' | 'iris';
export type ConsentModality = BiometricModality | 'nfc' | 'qr' | 'bus_rfid';

export interface ConsentRecord {
  id: string;
  tenantId: string;
  subjectRef: string;
  subjectType: SubjectType;
  modality: ConsentModality;
  legalBasis: string;
  guardianRef: string;
  dpiaRef: string;
  alternativeAcknowledged: boolean;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateConsentInput {
  tenantId: string;
  subjectRef: string;
  subjectType: SubjectType;
  modality: ConsentModality;
  legalBasis?: string;
  guardianRef?: string;
  dpiaRef?: string;
  alternativeAcknowledged?: boolean;
}

export const BIOMETRIC_MODALITIES = new Set<string>(['fingerprint', 'face', 'iris']);
