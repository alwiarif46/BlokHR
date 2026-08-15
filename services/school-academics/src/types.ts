export type OutcomeFramework = 'ncert' | 'cbse_cbe' | 'custom';
export type CrosswalkRelation = 'equivalent' | 'partial' | 'prerequisite';

export interface LearningOutcome {
  id: string;
  tenantId: string | null;
  code: string;
  classLabel: string;
  subjectCode: string;
  description: string;
  framework: OutcomeFramework;
  createdAt: string;
}

export interface OutcomeCrosswalk {
  id: string;
  tenantId: string;
  fromOutcomeId: string;
  toOutcomeId: string;
  relation: CrosswalkRelation;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOutcomeInput {
  code: string;
  classLabel: string;
  subjectCode: string;
  description: string;
  framework?: OutcomeFramework;
}

export interface ListOutcomesFilters {
  classLabel?: string;
  subjectCode?: string;
  framework?: string;
  q?: string;
}

export interface CreateCrosswalkInput {
  fromOutcomeId: string;
  toOutcomeId: string;
  relation: CrosswalkRelation;
  note?: string | null;
}

export interface PatchCrosswalkInput {
  relation?: CrosswalkRelation;
  note?: string | null;
}

export type CourseBoard = 'cbse' | 'icse' | 'state' | 'ib' | 'cambridge';
export type UnitOutcomeField = 'activity' | 'assessment' | 'resource';
export type UnitOutcomeDepth = 'introduced' | 'reinforced' | 'mastered';

export interface Course {
  id: string;
  tenantId: string;
  academicSessionId: string;
  board: CourseBoard;
  subjectCode: string;
  classLabel: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  tenantId: string;
  courseId: string;
  sequence: number;
  label: string;
  plannedWeeks: number;
  plannedStartWeek: number | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Topic {
  id: string;
  tenantId: string;
  unitId: string;
  sequence: number;
  label: string;
  estimatedPeriods: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitOutcomeTag {
  unitId: string;
  outcomeId: string;
  tenantId: string;
  field: UnitOutcomeField;
  depth: UnitOutcomeDepth;
  createdAt: string;
}

export interface CourseTreeUnit extends Unit {
  topics: Topic[];
  outcomes: UnitOutcomeTag[];
}

export interface CourseTree extends Course {
  units: CourseTreeUnit[];
}

export interface CreateCourseInput {
  academicSessionId: string;
  board: CourseBoard;
  subjectCode: string;
  classLabel: string;
  label: string;
}

export interface PatchCourseInput {
  academicSessionId?: string;
  board?: CourseBoard;
  subjectCode?: string;
  classLabel?: string;
  label?: string;
}

export interface CreateUnitInput {
  label: string;
  plannedWeeks: number;
  plannedStartWeek?: number | null;
  summary?: string | null;
  sequence?: number;
}

export interface PatchUnitInput {
  label?: string;
  plannedWeeks?: number;
  plannedStartWeek?: number | null;
  summary?: string | null;
}

export interface CreateTopicInput {
  label: string;
  estimatedPeriods?: number;
  sequence?: number;
}

export interface PatchTopicInput {
  label?: string;
  estimatedPeriods?: number;
}

export interface TagUnitOutcomeInput {
  outcomeId: string;
  field: UnitOutcomeField;
  depth?: UnitOutcomeDepth;
}

export type LessonKind = 'personal' | 'exemplar';
export type LessonState = 'draft' | 'submitted' | 'approved' | 'changes_requested';
export type LessonProvenance = 'human' | 'ai_assisted' | 'ai_generated';

export interface LessonBody {
  objectives?: unknown;
  activities?: unknown;
  materials?: unknown;
  assessment_check?: unknown;
  [key: string]: unknown;
}

export interface LessonPlan {
  id: string;
  tenantId: string;
  courseId: string;
  unitId: string;
  topicId: string | null;
  teacherMemberId: string;
  weekStart: string;
  title: string;
  body: LessonBody;
  kind: LessonKind;
  state: LessonState;
  reviewedBy: string | null;
  reviewNote: string | null;
  provenance: LessonProvenance;
  outcomeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonInput {
  courseId: string;
  unitId: string;
  topicId?: string | null;
  teacherMemberId: string;
  weekStart: string;
  title: string;
  body?: LessonBody;
  kind?: LessonKind;
  provenance?: LessonProvenance;
  outcomeIds?: string[];
}

export interface PatchLessonInput {
  title?: string;
  body?: LessonBody;
  topicId?: string | null;
  kind?: LessonKind;
  provenance?: LessonProvenance;
  outcomeIds?: string[];
}

export interface ListLessonsFilters {
  teacherMemberId?: string;
  weekStart?: string;
  state?: LessonState;
  courseId?: string;
}

export interface ReviewLessonInput {
  decision: 'approved' | 'changes_requested';
  reviewedBy: string;
  reviewNote?: string | null;
}

export type DeliverySource = 'asserted' | 'inferred_assessment' | 'inferred_resource';

export interface TopicDelivery {
  id: string;
  tenantId: string;
  topicId: string;
  periodInstanceId: string;
  sectionRef: string;
  date: string;
  teacherMemberId: string;
  source: DeliverySource;
  createdAt: string;
}

export interface AssertDeliveryInput {
  topicId: string;
  periodInstanceId: string;
  sectionRef: string;
  date: string;
  teacherMemberId: string;
}

export interface InferDeliveryInput {
  kind: 'assessment' | 'resource';
  topicId: string;
  sectionRef: string;
  date: string;
  ref: string;
  teacherMemberId?: string;
}

export interface UnitCoverage {
  unitId: string;
  label: string;
  topicsTotal: number;
  topicsDelivered: number;
  pct: number;
  firstDeliveryDate: string | null;
  lastDeliveryDate: string | null;
  outcomes: Array<{
    outcomeId: string;
    coveredActivity: boolean;
    coveredAssessment: boolean;
  }>;
}

export interface CourseCoverage {
  courseId: string;
  sectionRef: string;
  units: UnitCoverage[];
}

export type SubmissionState = 'assigned' | 'turned_in' | 'returned' | 'reclaimed';

export interface Assignment {
  id: string;
  tenantId: string;
  courseId: string;
  sectionRef: string;
  topicId: string | null;
  title: string;
  instructions: string | null;
  maxPoints: number | null;
  dueAt: string;
  assignedBy: string;
  attachmentRefs: string[];
  createdAt: string;
}

export interface Submission {
  id: string;
  tenantId: string;
  assignmentId: string;
  studentId: string;
  state: SubmissionState;
  late: boolean;
  missing: boolean;
  excused: boolean;
  draftGrade: number | null;
  assignedGrade: number | null;
  feedback: string | null;
  attachmentRefs: string[];
  turnedInAt: string | null;
  returnedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  courseId: string;
  sectionRef: string;
  topicId?: string | null;
  title: string;
  instructions?: string | null;
  maxPoints?: number | null;
  dueAt: string;
  assignedBy: string;
  attachmentRefs?: string[];
  studentIds: string[];
}

export interface AssignmentStats {
  mean: number | null;
  median: number | null;
  counts: Record<SubmissionState, number>;
  excusedCount: number;
  gradedCount: number;
}

export interface SyllabusTopicImport {
  label: string;
  estimatedPeriods?: number;
}

export interface SyllabusUnitImport {
  label: string;
  plannedWeeks: number;
  plannedStartWeek?: number | null;
  summary?: string | null;
  topics: SyllabusTopicImport[];
  outcomeCodes?: string[];
}

export interface SyllabusImportPayload {
  units: SyllabusUnitImport[];
  mode?: 'append' | 'replace';
}

export interface SyllabusExportPayload {
  units: Array<{
    label: string;
    planned_weeks: number;
    planned_start_week: number | null;
    summary: string | null;
    topics: Array<{ label: string; estimated_periods: number }>;
    outcome_codes: string[];
  }>;
}
