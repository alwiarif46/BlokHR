export type ExamTermLabel = 'PT1' | 'HY' | 'PT2' | 'Annual' | 'custom';
export type ExamKind = 'formative' | 'summative';

export interface ExamTerm {
  id: string;
  tenantId: string;
  academicSessionId: string;
  label: ExamTermLabel;
  startsOn: string;
  endsOn: string;
  weightagePct: number;
  createdAt: string;
  updatedAt: string;
}

export interface Exam {
  id: string;
  tenantId: string;
  examTermId: string;
  courseRef: string;
  sectionRef: string;
  subjectCode: string;
  classLabel: string;
  date: string;
  maxMarks: number;
  kind: ExamKind;
  createdAt: string;
}

export interface CreateExamTermInput {
  academicSessionId: string;
  label: ExamTermLabel;
  startsOn: string;
  endsOn: string;
  weightagePct: number;
}

export interface PatchExamTermInput {
  label?: ExamTermLabel;
  startsOn?: string;
  endsOn?: string;
  weightagePct?: number;
}

export interface CreateExamInput {
  examTermId: string;
  courseRef: string;
  sectionRef: string;
  subjectCode: string;
  classLabel: string;
  date: string;
  maxMarks: number;
  kind: ExamKind;
}

export interface PatchExamInput {
  courseRef?: string;
  sectionRef?: string;
  subjectCode?: string;
  classLabel?: string;
  date?: string;
  maxMarks?: number;
  kind?: ExamKind;
}

export interface Mark {
  id: string;
  tenantId: string;
  examId: string;
  studentId: string;
  draftMarks: number | null;
  assignedMarks: number | null;
  isAbsent: boolean;
  isExempt: boolean;
  enteredBy: string;
  moderatedBy: string | null;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface MarkWithPct extends Mark {
  pct: number | null;
}

export interface MarksClassStats {
  mean: number | null;
  median: number | null;
  high: number | null;
  low: number | null;
  absentCount: number;
}

export interface BulkMarkEntry {
  studentId: string;
  draftMarks?: number | null;
  isAbsent?: boolean;
  isExempt?: boolean;
}

export interface BulkMarksInput {
  enteredBy: string;
  marks: BulkMarkEntry[];
}

export interface ModerateMarkInput {
  assignedMarks: number;
  moderatedBy: string;
  reason: string;
}

export interface MarksAudit {
  id: string;
  tenantId: string;
  markId: string;
  examId: string;
  studentId: string;
  previousAssigned: number | null;
  newAssigned: number;
  moderatedBy: string;
  reason: string;
  createdAt: string;
}

export type {
  QuestionKind,
  QuestionProvenance,
  BlueprintBucket,
  BlueprintRule,
  Question,
  Blueprint,
  Paper,
  CreateQuestionInput,
  PatchQuestionInput,
  ListQuestionsFilters,
  CreateBlueprintInput,
  CreatePaperInput,
  BucketConformance,
  PaperConformanceReport,
  ItemAnalysisResultRow,
  ItemAnalysisItem,
} from './types-questions';

export type {
  HpcStage,
  HpcAbility,
  HpcSource,
  HpcLevel,
  Competency,
  AssessmentInput,
  CreateHpcInputPayload,
  HpcVoiceLevels,
  HpcStudentCompetencyView,
  HpcMatrixCell,
  HpcCoverageRow,
} from './types-hpc';

export type {
  BoardFormat,
  TemplateState,
  ReportBlockType,
  MarksAggregation,
  ReportBlockDefinition,
  ReportTemplate,
  ReportCard,
  CreateReportTemplateInput,
  PatchReportTemplateInput,
  GenerateReportCardStudent,
  GenerateReportCardsInput,
} from './types-reportcards';

export interface OutcomePerformance {
  tenantId: string;
  examId: string;
  outcomeCode: string;
  meanPct: number;
  nStudents: number;
  computedAt: string;
}

export interface WeakOutcomeExamEvidence {
  examId: string;
  meanPct: number;
  nStudents: number;
}

export interface WeakOutcomeRow {
  outcomeCode: string;
  meanPct: number;
  exams: WeakOutcomeExamEvidence[];
}

