export type QuestionKind =
  | 'mcq'
  | 'vsa'
  | 'sa'
  | 'la'
  | 'case_based'
  | 'source_based';

export type QuestionProvenance = 'human' | 'ai_assisted' | 'ai_generated';

export type BlueprintBucket = 'competency' | 'objective' | 'short_long';

export interface BlueprintRule {
  bucket: BlueprintBucket;
  pct: number;
}

export interface Question {
  id: string;
  tenantId: string;
  subjectCode: string;
  classLabel: string;
  outcomeCode: string | null;
  kind: QuestionKind;
  competencyStyle: boolean;
  marks: number;
  body: Record<string, unknown>;
  answer: Record<string, unknown> | null;
  provenance: QuestionProvenance;
  timesUsed: number;
  createdAt: string;
  updatedAt: string;
}

export interface Blueprint {
  id: string;
  tenantId: string;
  label: string;
  classLabel: string;
  subjectCode: string;
  totalMarks: number;
  rules: BlueprintRule[];
  createdAt: string;
}

export interface Paper {
  id: string;
  tenantId: string;
  blueprintId: string;
  examRef: string | null;
  questionIds: string[];
  generatedVariantOf: string | null;
  createdAt: string;
}

export interface CreateQuestionInput {
  subjectCode: string;
  classLabel: string;
  outcomeCode?: string | null;
  kind: QuestionKind;
  competencyStyle?: boolean;
  marks: number;
  body: Record<string, unknown>;
  answer?: Record<string, unknown> | null;
  provenance?: QuestionProvenance;
}

export interface PatchQuestionInput {
  subjectCode?: string;
  classLabel?: string;
  outcomeCode?: string | null;
  kind?: QuestionKind;
  competencyStyle?: boolean;
  marks?: number;
  body?: Record<string, unknown>;
  answer?: Record<string, unknown> | null;
  provenance?: QuestionProvenance;
}

export interface ListQuestionsFilters {
  subjectCode?: string;
  classLabel?: string;
  kind?: QuestionKind;
  outcomeCode?: string;
  competencyStyle?: boolean;
}

export interface CreateBlueprintInput {
  label: string;
  classLabel: string;
  subjectCode: string;
  totalMarks: number;
  rules: BlueprintRule[];
}

export interface CreatePaperInput {
  blueprintId: string;
  questionIds: string[];
  examRef?: string | null;
  generatedVariantOf?: string | null;
}

export interface BucketConformance {
  bucket: BlueprintBucket;
  expectedPct: number;
  actualPct: number;
  pass: boolean;
}

export interface PaperConformanceReport {
  pass: boolean;
  totalMarks: number;
  expectedTotalMarks: number;
  totalMarksPass: boolean;
  buckets: BucketConformance[];
  duplicates: string[];
  outcomeCoverage: string[];
}

export interface ItemAnalysisResultRow {
  questionId: string;
  scores: number[];
  max: number;
}

export interface ItemAnalysisItem {
  questionId: string;
  pValue: number;
  discrimination: number | null;
  review: boolean;
}
