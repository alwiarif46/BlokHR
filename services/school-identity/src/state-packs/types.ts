export interface StatePackCategory {
  code: string;
  label: string;
}

export interface StatePackStudentIdField {
  label: string;
  pattern: string;
}

export interface StatePackGradeScheme {
  board: string;
  labels: string[];
}

export interface StatePack {
  code: string;
  label: string;
  categories: StatePackCategory[];
  studentIdField?: StatePackStudentIdField;
  gradeSchemes: StatePackGradeScheme[];
  scripts: string[];
}
