export type DaySchemeKind = 'weekly' | 'cyclic';
export type ExclusionScope = 'school' | 'class';
export type ExclusionReason = 'holiday' | 'exam' | 'event' | 'other';

export interface PeriodDef {
  index: number;
  label: string;
  startTime: string;
  endTime: string;
  isTeaching: boolean;
}

export interface Term {
  id: string;
  tenantId: string;
  academicSessionId: string;
  label: string;
  startsOn: string;
  endsOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayScheme {
  id: string;
  tenantId: string;
  label: string;
  kind: DaySchemeKind;
  cycleLength: number | null;
  periods: PeriodDef[];
  createdAt: string;
  updatedAt: string;
}

export interface Exclusion {
  id: string;
  tenantId: string;
  date: string;
  scope: ExclusionScope;
  classLabel: string | null;
  reason: ExclusionReason;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTermInput {
  academicSessionId: string;
  label: string;
  startsOn: string;
  endsOn: string;
}

export type PatchTermInput = Partial<CreateTermInput>;

export interface CreateDaySchemeInput {
  label: string;
  kind: DaySchemeKind;
  cycleLength?: number | null;
  periods: PeriodDef[];
}

export type PatchDaySchemeInput = Partial<CreateDaySchemeInput>;

export interface CreateExclusionInput {
  date: string;
  scope: ExclusionScope;
  classLabel?: string | null;
  reason: ExclusionReason;
  label: string;
}

export type PatchExclusionInput = Partial<CreateExclusionInput>;

export interface ListExclusionsQuery {
  from?: string;
  to?: string;
}

export interface Section {
  id: string;
  tenantId: string;
  academicSessionId: string;
  classLabel: string;
  section: string;
  daySchemeId: string;
  classTeacherMemberId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subject {
  id: string;
  tenantId: string;
  code: string;
  label: string;
  isElective: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Allocation {
  id: string;
  tenantId: string;
  sectionId: string;
  subjectId: string;
  teacherMemberId: string;
  periodsPerWeek: number;
  room: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSectionInput {
  academicSessionId: string;
  classLabel: string;
  section: string;
  daySchemeId: string;
  classTeacherMemberId?: string | null;
}

export type PatchSectionInput = Partial<CreateSectionInput>;

export interface CreateSubjectInput {
  code: string;
  label: string;
  isElective?: boolean;
}

export type PatchSubjectInput = Partial<CreateSubjectInput>;

export interface CreateAllocationInput {
  sectionId: string;
  subjectId: string;
  teacherMemberId: string;
  periodsPerWeek: number;
  room?: string | null;
}

export type PatchAllocationInput = Partial<CreateAllocationInput>;

export interface Slot {
  id: string;
  tenantId: string;
  sectionId: string;
  dayRef: string;
  periodIndex: number;
  allocationId: string;
  createdAt: string;
}

export interface SlotGridEntry extends Slot {
  subjectId: string;
  teacherMemberId: string;
  subjectCode: string;
  subjectLabel: string;
}

export interface SlotInput {
  dayRef: string;
  periodIndex: number;
  allocationId: string;
}

export interface TeacherClash {
  sectionId: string;
  dayRef: string;
  periodIndex: number;
  teacherMemberId: string;
  allocationId: string;
  conflictingSectionId: string;
}

export type PeriodInstanceStatus = 'scheduled' | 'held' | 'lost';
export type PeriodLostReason =
  | 'holiday'
  | 'exam'
  | 'event'
  | 'teacher_absent_uncovered'
  | 'other';
export type PeriodInstanceSource = 'generated' | 'manual';

export interface PeriodInstance {
  id: string;
  tenantId: string;
  sectionId: string;
  date: string;
  periodIndex: number;
  allocationId: string;
  status: PeriodInstanceStatus;
  lostReason: PeriodLostReason | null;
  source: PeriodInstanceSource;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateInstancesResult {
  created: number;
  lost: number;
  skipped: number;
}

export interface PatchPeriodInstanceInput {
  status: PeriodInstanceStatus;
  lostReason?: PeriodLostReason | null;
}

export interface ListPeriodInstancesQuery {
  from?: string;
  to?: string;
  status?: PeriodInstanceStatus;
}

export type CoverState = 'open' | 'offered' | 'accepted' | 'declined' | 'uncovered';

export interface TeacherAbsence {
  id: string;
  tenantId: string;
  teacherMemberId: string;
  date: string;
  periodIndexes: number[] | null;
  reason: string;
  createdAt: string;
}

export interface CoverAssignment {
  id: string;
  tenantId: string;
  absenceId: string;
  periodInstanceId: string;
  coverTeacherMemberId: string | null;
  state: CoverState;
  offeredAt: string | null;
  respondedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAbsenceInput {
  teacherMemberId: string;
  date: string;
  periodIndexes?: number[] | null;
  reason: string;
}

export interface CoverFairnessRow {
  teacherMemberId: string;
  acceptedCount: number;
}

export interface PeriodInstanceWithMeta extends PeriodInstance {
  teacherMemberId: string;
  subjectId: string;
  subjectCode: string;
  subjectLabel: string;
}

