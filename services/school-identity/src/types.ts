export interface AcademicSession {
  id: string;
  tenantId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAcademicSessionInput {
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent?: boolean;
}

export type StudentGender = 'male' | 'female' | 'other';
export type StudentStatus =
  | 'enquiry'
  | 'admitted'
  | 'active'
  | 'transferred'
  | 'alumni'
  | 'withdrawn';
export type StudentCategory = 'GEN' | 'EWS' | 'OBC' | 'SC' | 'ST' | 'OTHER_STATE';
export type GuardianRelation = 'father' | 'mother' | 'guardian' | 'other';

export interface Student {
  id: string;
  tenantId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: StudentGender;
  admissionDate: string;
  status: StudentStatus;
  category: StudentCategory;
  stateCategoryCode: string | null;
  stateStudentId: string | null;
  motherName: string;
  fatherName: string;
  guardianContact: string;
  aadhaarLast4: string | null;
  apaarId: string | null;
  penId: string | null;
  udiseExportOk: boolean;
  isCwsn: boolean;
  cwsnCategory: string | null;
  cwsnDisability: string | null;
  cwsnCertificate: boolean;
  isRte: boolean;
  photoRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Guardian {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  relation: GuardianRelation;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentGuardian {
  studentId: string;
  guardianId: string;
  tenantId: string;
  isPrimary: boolean;
}

export interface Enrolment {
  id: string;
  tenantId: string;
  studentId: string;
  academicSessionId: string;
  classLabel: string;
  section: string;
  rollNumber: string;
  house: string | null;
  enrolledOn: string;
  exitedOn: string | null;
  exitReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentInput {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: StudentGender;
  admissionDate: string;
  status: StudentStatus;
  category: StudentCategory;
  stateCategoryCode?: string | null;
  stateStudentId?: string | null;
  motherName: string;
  fatherName: string;
  guardianContact: string;
  aadhaarLast4?: string | null;
  apaarId?: string | null;
  penId?: string | null;
  udiseExportOk?: boolean;
  isCwsn?: boolean;
  cwsnCategory?: string | null;
  cwsnDisability?: string | null;
  cwsnCertificate?: boolean;
  isRte?: boolean;
  photoRef?: string | null;
}

export type PatchStudentInput = Partial<Omit<CreateStudentInput, 'admissionNumber'>> & {
  admissionNumber?: string;
};

export interface ListStudentsQuery {
  status?: string;
  classLabel?: string;
  section?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export interface EnrolStudentInput {
  academicSessionId: string;
  classLabel: string;
  section: string;
  rollNumber: string;
  house?: string | null;
  enrolledOn?: string;
}

export interface ExitStudentInput {
  exitedOn: string;
  exitReason: string;
  newStatus: StudentStatus;
}

export interface CreateGuardianInput {
  firstName: string;
  lastName: string;
  relation: GuardianRelation;
  phone: string;
  email?: string | null;
  preferredLanguage?: string;
}

export type PatchGuardianInput = Partial<CreateGuardianInput>;

export interface LinkGuardianInput {
  guardianId: string;
  isPrimary?: boolean;
}

export type ConsentKind =
  | 'apaar'
  | 'dpdp_processing'
  | 'biometric'
  | 'photo'
  | 'transport_gps';

export type ConsentState = 'granted' | 'refused' | 'withdrawn' | 'not_sought';

export type ConsentVerificationMethod =
  | 'existing_records'
  | 'id_details'
  | 'virtual_token'
  | 'digilocker';

export interface ConsentRecord {
  id: string | null;
  tenantId: string;
  studentId: string;
  kind: ConsentKind;
  state: ConsentState;
  grantedByGuardianId: string | null;
  artefactRef: string | null;
  verificationMethod: ConsentVerificationMethod | null;
  notedBy: string | null;
  stateChangedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ConsentTransitionInput {
  kind: ConsentKind;
  state: ConsentState;
  grantedByGuardianId?: string | null;
  artefactRef?: string | null;
  verificationMethod?: ConsentVerificationMethod | null;
  notedBy: string;
  reason?: string | null;
}

export type ConsentSummary = Record<
  ConsentKind,
  { granted: number; refused: number; not_sought: number; withdrawn: number }
>;
