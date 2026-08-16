import type { ImportUnit } from '../types';

export type SyllabusPackFamily = 'cbse' | 'icse' | 'state';
export type SyllabusPackBoard = 'cbse' | 'icse' | 'state';
export type SyllabusPackStatus = 'sample' | 'official';

export interface SyllabusPackCourse {
  subject_code: string;
  class_label: string;
  label: string;
  units: ImportUnit[];
}

export interface SyllabusPack {
  id: string;
  family: SyllabusPackFamily;
  state_code?: string;
  board: SyllabusPackBoard;
  academic_year: string;
  label: string;
  status: SyllabusPackStatus;
  source_note: string;
  courses: SyllabusPackCourse[];
}

export interface SyllabusPackSummary {
  id: string;
  family: SyllabusPackFamily;
  state_code?: string;
  academic_year: string;
  label: string;
  status: SyllabusPackStatus;
  course_count: number;
  classes: string[];
  subjects: string[];
}
