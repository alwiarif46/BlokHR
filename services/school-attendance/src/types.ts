export type ReasonBucket =
  | 'authorised'
  | 'unauthorised'
  | 'medical'
  | 'school_activity';

export interface ReasonCode {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  bucket: ReasonBucket;
  isActive: boolean;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReasonCodeInput {
  code: string;
  label: string;
  bucket: ReasonBucket;
  isActive?: boolean;
  sort?: number;
}

export interface PatchReasonCodeInput {
  code?: string;
  label?: string;
  bucket?: ReasonBucket;
  isActive?: boolean;
  sort?: number;
}

export type AttendanceGranularity = 'day' | 'session' | 'period';
export type SessionPart = 'am' | 'pm';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'left_early';
export type AttendanceExcuse = 'excused' | 'unexcused' | 'exempt' | 'unknown';
export type AttendanceSource =
  | 'roll_call'
  | 'nfc'
  | 'qr'
  | 'kiosk'
  | 'import'
  | 'regularization';
export type DayDerivation = 'any_absent' | 'majority' | 'half_day_minutes';

export interface AttendanceSettings {
  tenantId: string;
  granularity: AttendanceGranularity;
  editWindowMinutes: number;
  lateThresholdMinutes: number;
  halfDayMinMinutes: number;
  dayDerivation: DayDerivation;
  updatedAt: string;
}

export interface UpsertAttendanceSettingsInput {
  granularity?: AttendanceGranularity;
  editWindowMinutes?: number;
  lateThresholdMinutes?: number;
  halfDayMinMinutes?: number;
  dayDerivation?: DayDerivation;
}

export interface AttendanceMonthlyRollup {
  tenantId: string;
  studentId: string;
  month: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  pct: number;
  computedAt: string;
}

export interface EligibilityResult {
  pct: number;
  threshold: number;
  eligible: boolean;
  projected_pct_if_no_more_absences: number;
}

export interface AttendanceRecord {
  id: string;
  tenantId: string;
  studentId: string;
  date: string;
  periodInstanceId: string | null;
  sessionPart: SessionPart | null;
  status: AttendanceStatus;
  excuse: AttendanceExcuse;
  reasonCodeId: string | null;
  lateMinutes: number | null;
  markedBy: string | null;
  markedAt: string | null;
  source: AttendanceSource | null;
  deviceId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceAuditRow {
  id: string;
  tenantId: string;
  recordId: string;
  beforeJson: string | null;
  afterJson: string | null;
  actor: string;
  at: string;
}

export interface MarkContext {
  date: string;
  periodInstanceId?: string | null;
  sessionPart?: SessionPart | null;
}

export interface MarkItem {
  studentId: string;
  status: AttendanceStatus;
  excuse?: AttendanceExcuse;
  reasonCodeId?: string | null;
  lateMinutes?: number | null;
}

export interface MarkBatchInput {
  context: MarkContext;
  marks: MarkItem[];
  markedBy: string;
  idempotencyKey: string;
}

export interface PatchRecordInput {
  status?: AttendanceStatus;
  excuse?: AttendanceExcuse;
  reasonCodeId?: string | null;
  lateMinutes?: number | null;
  actor: string;
}

export interface RegularizeInput {
  newStatus: AttendanceStatus;
  newExcuse: AttendanceExcuse;
  reasonCodeId: string;
  approvedBy: string;
  note?: string;
}

export type CaptureSubjectType = 'student' | 'staff';
export type CaptureModality = 'nfc' | 'qr';
export type CaptureDecision = 'matched' | 'no_match' | 'duplicate';

export interface CaptureBinding {
  id: string;
  tenantId: string;
  subjectType: CaptureSubjectType;
  subjectId: string;
  modality: CaptureModality;
  payloadHash: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCaptureBindingInput {
  subjectType: CaptureSubjectType;
  subjectId: string;
  modality: CaptureModality;
  payloadB64: string;
}

export interface CaptureContext {
  date: string;
  gate?: string | null;
  periodInstanceId?: string | null;
}

export interface CaptureInput {
  modality: CaptureModality;
  payloadB64: string;
  deviceId: string;
  context: CaptureContext;
  idempotencyKey: string;
}

export interface CaptureEvent {
  id: string;
  tenantId: string;
  deviceId: string;
  modality: CaptureModality;
  payloadHash: string;
  matchedSubjectId: string | null;
  decision: CaptureDecision;
  contextJson: string;
  idempotencyKey: string | null;
  at: string;
}

export type StaffAttendanceStatus = 'present' | 'absent' | 'on_leave' | 'half_day';
export type StaffAttendanceSource = 'manual' | 'nfc' | 'qr' | 'biometric_device';
export type StaffCheckDirection = 'in' | 'out';

export interface StaffAttendance {
  id: string;
  tenantId: string;
  memberId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  status: StaffAttendanceStatus;
  source: StaffAttendanceSource;
  minutesOnPremises: number | null;
  markedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCheckInput {
  memberId: string;
  direction: StaffCheckDirection;
  at: string;
  source: StaffAttendanceSource;
  deviceId?: string | null;
}

export interface StaffMarkItem {
  memberId: string;
  status: StaffAttendanceStatus;
}

export interface StaffBulkMarkInput {
  date: string;
  marks: StaffMarkItem[];
  markedBy: string;
}

export interface StaffMonthTotals {
  present: number;
  absent: number;
  on_leave: number;
  half_day: number;
  total_minutes: number;
}

export interface StaffMonthReport {
  month: string;
  locked: boolean;
  records: StaffAttendance[];
  totals: StaffMonthTotals;
}

export type ReportedAbsenceChannel = 'app' | 'web' | 'ivr' | 'whatsapp';

export interface ReportedAbsence {
  id: string;
  tenantId: string;
  studentId: string;
  reportedByGuardianId: string;
  dates: string[];
  reasonCodeId: string;
  note: string | null;
  attachmentRef: string | null;
  channel: ReportedAbsenceChannel;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportedAbsenceInput {
  studentId: string;
  reportedByGuardianId: string;
  dates: string[];
  reasonCodeId: string;
  note?: string | null;
  channel: ReportedAbsenceChannel;
}

export type NudgeCohort = 'treatment' | 'holdout';
export type NudgeTier = 'at_risk' | 'chronic';

export interface NudgeConfig {
  tenantId: string;
  enabled: boolean;
  atRiskPct: number;
  chronicDays: number;
  holdoutPct: number;
  maxMessagesPerTerm: number;
  updatedAt: string;
}

export interface UpsertNudgeConfigInput {
  enabled?: boolean;
  atRiskPct?: number;
  chronicDays?: number;
  holdoutPct?: number;
  maxMessagesPerTerm?: number;
}

export interface NudgeAssignment {
  tenantId: string;
  studentId: string;
  cohort: NudgeCohort;
  assignedAt: string;
}

export interface NudgeMessage {
  id: string;
  tenantId: string;
  studentId: string;
  tier: NudgeTier;
  ytdAbsentDays: number;
  classPercentile: number;
  renderedVars: Record<string, unknown>;
  createdAt: string;
}

export interface NudgeRunInput {
  asOf: string;
  classMap: Record<string, string>;
}

export interface NudgeReport {
  treatment: { mean_absence_pct: number; message_count: number; student_count: number };
  holdout: { mean_absence_pct: number; message_count: number; student_count: number };
}

export type LeaveRequestState = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveType {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  annualQuota: number;
  carryForward: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  tenantId: string;
  memberId: string;
  leaveTypeId: string;
  year: number;
  opening: number;
  used: number;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  memberId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  isHalfDay: boolean;
  days: number;
  reason: string | null;
  state: LeaveRequestState;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveTypeInput {
  code: string;
  label: string;
  annualQuota: number;
  carryForward?: boolean;
}

export interface PatchLeaveTypeInput {
  label?: string;
  annualQuota?: number;
  carryForward?: boolean;
  isActive?: boolean;
}

export interface CreateLeaveRequestInput {
  memberId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  isHalfDay?: boolean;
  reason?: string | null;
}

export interface DecideLeaveInput {
  decision: 'approved' | 'rejected';
  decidedBy: string;
  decisionNote?: string | null;
}
