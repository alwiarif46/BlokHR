export type HpcStage = 'foundational' | 'preparatory' | 'middle' | 'secondary';
export type HpcAbility = 'awareness' | 'sensitivity' | 'creativity';
export type HpcSource = 'self' | 'peer' | 'teacher' | 'parent';
export type HpcLevel = 'beginner' | 'proficient' | 'advanced';

export interface Competency {
  id: string;
  tenantId: string | null;
  stage: HpcStage;
  ability: HpcAbility;
  subjectArea: string | null;
  label: string;
  createdAt: string;
}

export interface AssessmentInput {
  id: string;
  tenantId: string;
  studentId: string;
  competencyId: string;
  activityRef: string | null;
  source: HpcSource;
  level: HpcLevel | null;
  statementsCircled: number | null;
  observationalChallenge: string | null;
  observationalResolution: string | null;
  evidenceRef: string | null;
  academicSessionRef: string | null;
  recordedBy: string;
  at: string;
}

export interface CreateHpcInputPayload {
  studentId: string;
  competencyId: string;
  activityRef?: string | null;
  source: HpcSource;
  level?: HpcLevel | null;
  statementsCircled?: number | null;
  observationalChallenge?: string | null;
  observationalResolution?: string | null;
  evidenceRef?: string | null;
  academicSessionRef?: string | null;
  recordedBy: string;
  at?: string;
}

export interface HpcVoiceLevels {
  self: HpcLevel | null;
  peer: HpcLevel | null;
  teacher: HpcLevel | null;
  parent: HpcLevel | null;
}

export interface HpcStudentCompetencyView {
  competencyId: string;
  label: string;
  stage: HpcStage;
  ability: HpcAbility;
  voices: HpcVoiceLevels;
  inputCount: number;
}

export interface HpcMatrixCell {
  competencyId: string;
  session: string;
  level: HpcLevel | null;
  teacherInputCount: number;
}

export interface HpcCoverageRow {
  competencyId: string;
  label: string;
  stage: HpcStage;
  studentCount: number;
  filledCount: number;
  pct: number;
}
