export type BoardFormat =
  | 'cbse_9pt'
  | 'msbshse_ssc'
  | 'msbshse_hsc'
  | 'icse'
  | 'custom';

export type TemplateState = 'sandbox' | 'live' | 'retired';

export type ReportBlockType =
  | 'marks_table'
  | 'attendance'
  | 'hpc_summary'
  | 'remarks'
  | 'custom_text'
  | 'header'
  | 'footer'
  | 'signatures'
  | 'health'
  | 'co_scholastic';

export type MarksAggregation = 'sum' | 'avg' | 'weighted_by_term';

export interface ReportBlockDefinition {
  type: ReportBlockType;
  config?: Record<string, unknown>;
}

export interface ReportTemplate {
  id: string;
  tenantId: string;
  label: string;
  boardFormat: BoardFormat;
  state: TemplateState;
  definition: ReportBlockDefinition[];
  version: number;
  promotedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCard {
  id: string;
  tenantId: string;
  studentId: string;
  templateId: string;
  templateVersion: number;
  academicSessionRef: string;
  payload: Record<string, unknown>;
  generatedAt: string;
  generatedBy: string;
  /** ISO datetime; null = hidden from guardians */
  visibleFrom: string | null;
}

export interface CreateReportTemplateInput {
  label: string;
  boardFormat: BoardFormat;
  definition: ReportBlockDefinition[];
}

export interface PatchReportTemplateInput {
  label?: string;
  boardFormat?: BoardFormat;
  definition?: ReportBlockDefinition[];
}

export interface GenerateReportCardStudent {
  studentId: string;
  attendance?: Record<string, unknown> | null;
  remarks?: string | null;
  health?: Record<string, unknown> | null;
  coScholastic?: Record<string, unknown> | null;
  signatures?: Array<Record<string, unknown>> | null;
}

export interface GenerateReportCardsInput {
  templateId: string;
  session: string;
  generatedBy: string;
  students: GenerateReportCardStudent[];
  /** Optional default parent release time applied to all generated cards */
  visibleFrom?: string | null;
}

/** Cohort rank snapshot fields stored on report card payload */
export interface ReportCardRank {
  rank: number | null;
  outOf: number;
  percentage: number | null;
}

