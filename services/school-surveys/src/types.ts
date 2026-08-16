export type SurveyStatus = 'draft' | 'active' | 'closed';
export type SurveyTargetKind = 'all' | 'students';
export type SurveyAudience = 'guardian';

export type SurveyQuestionType =
  | 'scale'
  | 'nps'
  | 'rating'
  | 'choice'
  | 'multi'
  | 'text'
  | 'yesno';

export interface SurveyQuestion {
  key: string;
  label: string;
  type: SurveyQuestionType;
  options?: string[];
  required?: boolean;
}

export interface Survey {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  questionsJson: string;
  anonymous: boolean;
  audience: SurveyAudience;
  targetKind: SurveyTargetKind;
  status: SurveyStatus;
  createdBy: string;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyResponse {
  id: string;
  tenantId: string;
  surveyId: string;
  studentRef: string;
  answersJson: string;
  submittedAt: string;
}

export interface SurveyCompletion {
  surveyId: string;
  tenantId: string;
  guardianRef: string;
  studentRef: string;
  completedAt: string;
}

export interface ServiceError {
  status: number;
  error: string;
}
