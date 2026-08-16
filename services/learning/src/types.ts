export interface ServiceError {
  error: string;
  status: number;
}

export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type CourseFormat = 'video' | 'doc' | 'link' | 'scorm' | 'classroom' | 'other';
export type Recurrence = 'none' | 'annual' | 'biannual' | 'quarterly';
export type LessonType = 'video' | 'doc' | 'link' | 'scorm' | 'quiz' | 'classroom';
export type EnrollmentStatus = 'enrolled' | 'in_progress' | 'completed' | 'expired' | 'dropped';
export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed';
export type Proficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type ExternalRequestStatus = 'pending' | 'manager_approved' | 'approved' | 'rejected';

export interface Course {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  category: string;
  level: CourseLevel;
  durationMinutes: number;
  format: CourseFormat;
  mandatory: boolean;
  recurrence: Recurrence;
  contentUrl: string;
  fileId: string | null;
  thumbnailUrl: string;
  passScore: number | null;
  validForDays: number | null;
  autoAssignGroupIds: string;
  autoAssignMemberTypes: string;
  status: CourseStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseLesson {
  id: string;
  tenantId: string;
  courseId: string;
  position: number;
  title: string;
  description: string;
  type: LessonType;
  contentUrl: string;
  fileId: string | null;
  durationMinutes: number;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  id: string;
  tenantId: string;
  courseId: string;
  email: string;
  status: EnrollmentStatus;
  progressPct: number;
  score: number | null;
  enrolledBy: string;
  enrolledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueDate: string | null;
  expiresAt: string | null;
  certificateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrollmentWithCourse extends Enrollment {
  courseTitle: string;
  courseCategory: string;
  courseFormat: string;
  courseMandatory: boolean;
}

export interface LessonProgress {
  id: string;
  tenantId: string;
  enrollmentId: string;
  lessonId: string;
  status: LessonProgressStatus;
  completedAt: string | null;
  timeSpentSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface Skill {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  createdAt: string;
}

export interface EmployeeSkill {
  id: number;
  tenantId: string;
  email: string;
  skillId: string;
  proficiency: Proficiency;
  source: string;
  sourceId: string;
  updatedAt: string;
  skillName?: string;
  skillCategory?: string;
}

export interface CourseSkill {
  skillId: string;
  skillName: string;
  proficiencyGranted: Proficiency;
}

export interface TrainingBudget {
  id: number;
  tenantId: string;
  groupId: string;
  year: number;
  annualBudget: number;
  spent: number;
  perEmployeeCap: number;
  updatedAt: string;
}

export interface ExternalTrainingRequest {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  title: string;
  provider: string;
  cost: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: ExternalRequestStatus;
  managerEmail: string;
  hrEmail: string;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompletionReport {
  courseTitle: string;
  totalEnrolled: number;
  completed: number;
  inProgress: number;
  completionRate: number;
}

export interface ComplianceRow {
  courseId: string;
  courseTitle: string;
  mandatory: boolean;
  totalEnrolled: number;
  completed: number;
  overdue: number;
  completionRate: number;
}
