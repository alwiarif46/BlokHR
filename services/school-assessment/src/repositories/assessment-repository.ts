import type { SchoolAssessmentDb } from '../db';
import type {
  Blueprint,
  BlueprintRule,
  Exam,
  ExamKind,
  ExamTerm,
  ExamTermLabel,
  ListQuestionsFilters,
  Mark,
  MarksAudit,
  Paper,
  Question,
  QuestionKind,
  QuestionProvenance,
} from '../types';

interface ExamTermRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  academic_session_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  weightage_pct: number;
  created_at: string;
  updated_at: string;
}

interface ExamRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  exam_term_id: string;
  course_ref: string;
  section_ref: string;
  subject_code: string;
  class_label: string;
  date: string;
  max_marks: number;
  kind: string;
  created_at: string;
}

function mapTerm(row: ExamTermRow): ExamTerm {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    academicSessionId: row.academic_session_id,
    label: row.label as ExamTermLabel,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    weightagePct: row.weightage_pct,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExam(row: ExamRow): Exam {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    examTermId: row.exam_term_id,
    courseRef: row.course_ref,
    sectionRef: row.section_ref,
    subjectCode: row.subject_code,
    classLabel: row.class_label,
    date: row.date,
    maxMarks: row.max_marks,
    kind: row.kind as ExamKind,
    createdAt: row.created_at,
  };
}

export class AssessmentRepository {
  constructor(private readonly db: SchoolAssessmentDb) {}

  async getExamTerm(tenantId: string, id: string): Promise<ExamTerm | null> {
    const row = await this.db.get<ExamTermRow>(
      'SELECT * FROM exam_terms WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapTerm(row) : null;
  }

  async listExamTerms(
    tenantId: string,
    academicSessionId?: string,
  ): Promise<ExamTerm[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (academicSessionId) {
      clauses.push('academic_session_id = ?');
      params.push(academicSessionId);
    }
    const rows = await this.db.all<ExamTermRow>(
      `SELECT * FROM exam_terms
       WHERE ${clauses.join(' AND ')}
       ORDER BY starts_on ASC, created_at ASC`,
      params,
    );
    return rows.map(mapTerm);
  }

  async sumWeightageForSession(
    tenantId: string,
    academicSessionId: string,
    excludeTermId?: string,
  ): Promise<number> {
    const clauses = ['tenant_id = ?', 'academic_session_id = ?'];
    const params: unknown[] = [tenantId, academicSessionId];
    if (excludeTermId) {
      clauses.push('id != ?');
      params.push(excludeTermId);
    }
    const row = await this.db.get<{ s: number | null }>(
      `SELECT SUM(weightage_pct) as s FROM exam_terms WHERE ${clauses.join(' AND ')}`,
      params,
    );
    return Number(row?.s ?? 0);
  }

  async insertExamTerm(term: ExamTerm): Promise<ExamTerm> {
    await this.db.run(
      `INSERT INTO exam_terms (
         id, tenant_id, academic_session_id, label, starts_on, ends_on, weightage_pct
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        term.id,
        term.tenantId,
        term.academicSessionId,
        term.label,
        term.startsOn,
        term.endsOn,
        term.weightagePct,
      ],
    );
    const created = await this.getExamTerm(term.tenantId, term.id);
    if (!created) throw new Error('Failed to read inserted exam term');
    return created;
  }

  async updateExamTerm(tenantId: string, id: string, next: ExamTerm): Promise<ExamTerm | null> {
    await this.db.run(
      `UPDATE exam_terms SET
         label = ?, starts_on = ?, ends_on = ?, weightage_pct = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.label, next.startsOn, next.endsOn, next.weightagePct, tenantId, id],
    );
    return this.getExamTerm(tenantId, id);
  }

  async deleteExamTerm(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getExamTerm(tenantId, id);
    if (!existing) return false;
    const exams = await this.listExams(tenantId, id);
    for (const exam of exams) {
      await this.deleteExam(tenantId, exam.id);
    }
    await this.db.run('DELETE FROM exam_terms WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async getExam(tenantId: string, id: string): Promise<Exam | null> {
    const row = await this.db.get<ExamRow>(
      'SELECT * FROM exams WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapExam(row) : null;
  }

  async listExams(tenantId: string, examTermId?: string): Promise<Exam[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (examTermId) {
      clauses.push('exam_term_id = ?');
      params.push(examTermId);
    }
    const rows = await this.db.all<ExamRow>(
      `SELECT * FROM exams
       WHERE ${clauses.join(' AND ')}
       ORDER BY date ASC, created_at ASC`,
      params,
    );
    return rows.map(mapExam);
  }

  async insertExam(exam: Exam): Promise<Exam> {
    await this.db.run(
      `INSERT INTO exams (
         id, tenant_id, exam_term_id, course_ref, section_ref, subject_code,
         class_label, date, max_marks, kind
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exam.id,
        exam.tenantId,
        exam.examTermId,
        exam.courseRef,
        exam.sectionRef,
        exam.subjectCode,
        exam.classLabel,
        exam.date,
        exam.maxMarks,
        exam.kind,
      ],
    );
    const created = await this.getExam(exam.tenantId, exam.id);
    if (!created) throw new Error('Failed to read inserted exam');
    return created;
  }

  async updateExam(tenantId: string, id: string, next: Exam): Promise<Exam | null> {
    await this.db.run(
      `UPDATE exams SET
         course_ref = ?, section_ref = ?, subject_code = ?, class_label = ?,
         date = ?, max_marks = ?, kind = ?
       WHERE tenant_id = ? AND id = ?`,
      [
        next.courseRef,
        next.sectionRef,
        next.subjectCode,
        next.classLabel,
        next.date,
        next.maxMarks,
        next.kind,
        tenantId,
        id,
      ],
    );
    return this.getExam(tenantId, id);
  }

  async deleteExam(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getExam(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM marks_audit WHERE tenant_id = ? AND exam_id = ?', [
      tenantId,
      id,
    ]);
    await this.db.run('DELETE FROM marks WHERE tenant_id = ? AND exam_id = ?', [tenantId, id]);
    await this.db.run('DELETE FROM exams WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async getMark(tenantId: string, id: string): Promise<Mark | null> {
    const row = await this.db.get<MarkRow>(
      'SELECT * FROM marks WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapMark(row) : null;
  }

  async getMarkByExamStudent(
    tenantId: string,
    examId: string,
    studentId: string,
  ): Promise<Mark | null> {
    const row = await this.db.get<MarkRow>(
      'SELECT * FROM marks WHERE tenant_id = ? AND exam_id = ? AND student_id = ?',
      [tenantId, examId, studentId],
    );
    return row ? mapMark(row) : null;
  }

  async listMarksForExam(tenantId: string, examId: string): Promise<Mark[]> {
    const rows = await this.db.all<MarkRow>(
      `SELECT * FROM marks
       WHERE tenant_id = ? AND exam_id = ?
       ORDER BY student_id ASC`,
      [tenantId, examId],
    );
    return rows.map(mapMark);
  }

  async insertMark(mark: Mark): Promise<Mark> {
    await this.db.run(
      `INSERT INTO marks (
         id, tenant_id, exam_id, student_id, draft_marks, assigned_marks,
         is_absent, is_exempt, entered_by, moderated_by, published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mark.id,
        mark.tenantId,
        mark.examId,
        mark.studentId,
        mark.draftMarks,
        mark.assignedMarks,
        mark.isAbsent ? 1 : 0,
        mark.isExempt ? 1 : 0,
        mark.enteredBy,
        mark.moderatedBy,
        mark.publishedAt,
      ],
    );
    const created = await this.getMark(mark.tenantId, mark.id);
    if (!created) throw new Error('Failed to read inserted mark');
    return created;
  }

  async updateMark(tenantId: string, id: string, next: Mark): Promise<Mark | null> {
    await this.db.run(
      `UPDATE marks SET
         draft_marks = ?, assigned_marks = ?, is_absent = ?, is_exempt = ?,
         entered_by = ?, moderated_by = ?, published_at = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.draftMarks,
        next.assignedMarks,
        next.isAbsent ? 1 : 0,
        next.isExempt ? 1 : 0,
        next.enteredBy,
        next.moderatedBy,
        next.publishedAt,
        tenantId,
        id,
      ],
    );
    return this.getMark(tenantId, id);
  }

  async insertMarksAudit(audit: MarksAudit): Promise<MarksAudit> {
    await this.db.run(
      `INSERT INTO marks_audit (
         id, tenant_id, mark_id, exam_id, student_id,
         previous_assigned, new_assigned, moderated_by, reason
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        audit.id,
        audit.tenantId,
        audit.markId,
        audit.examId,
        audit.studentId,
        audit.previousAssigned,
        audit.newAssigned,
        audit.moderatedBy,
        audit.reason,
      ],
    );
    const row = await this.db.get<MarksAuditRow>(
      'SELECT * FROM marks_audit WHERE tenant_id = ? AND id = ?',
      [audit.tenantId, audit.id],
    );
    if (!row) throw new Error('Failed to read inserted marks audit');
    return mapAudit(row);
  }

  async listMarksAuditForMark(tenantId: string, markId: string): Promise<MarksAudit[]> {
    const rows = await this.db.all<MarksAuditRow>(
      `SELECT * FROM marks_audit
       WHERE tenant_id = ? AND mark_id = ?
       ORDER BY created_at ASC`,
      [tenantId, markId],
    );
    return rows.map(mapAudit);
  }

  async getQuestion(tenantId: string, id: string): Promise<Question | null> {
    const row = await this.db.get<QuestionRow>(
      'SELECT * FROM questions WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapQuestion(row) : null;
  }

  async listQuestions(tenantId: string, filters: ListQuestionsFilters): Promise<Question[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.subjectCode) {
      clauses.push('subject_code = ?');
      params.push(filters.subjectCode);
    }
    if (filters.classLabel) {
      clauses.push('class_label = ?');
      params.push(filters.classLabel);
    }
    if (filters.kind) {
      clauses.push('kind = ?');
      params.push(filters.kind);
    }
    if (filters.outcomeCode) {
      clauses.push('outcome_code = ?');
      params.push(filters.outcomeCode);
    }
    if (filters.competencyStyle !== undefined) {
      clauses.push('competency_style = ?');
      params.push(filters.competencyStyle ? 1 : 0);
    }
    const rows = await this.db.all<QuestionRow>(
      `SELECT * FROM questions WHERE ${clauses.join(' AND ')} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(mapQuestion);
  }

  async insertQuestion(q: Question): Promise<Question> {
    await this.db.run(
      `INSERT INTO questions (
         id, tenant_id, subject_code, class_label, outcome_code, kind,
         competency_style, marks, body_json, answer_json, provenance, times_used
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        q.id,
        q.tenantId,
        q.subjectCode,
        q.classLabel,
        q.outcomeCode,
        q.kind,
        q.competencyStyle ? 1 : 0,
        q.marks,
        JSON.stringify(q.body),
        q.answer == null ? null : JSON.stringify(q.answer),
        q.provenance,
        q.timesUsed,
      ],
    );
    const created = await this.getQuestion(q.tenantId, q.id);
    if (!created) throw new Error('Failed to read inserted question');
    return created;
  }

  async updateQuestion(tenantId: string, id: string, next: Question): Promise<Question | null> {
    await this.db.run(
      `UPDATE questions SET
         subject_code = ?, class_label = ?, outcome_code = ?, kind = ?,
         competency_style = ?, marks = ?, body_json = ?, answer_json = ?,
         provenance = ?, times_used = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.subjectCode,
        next.classLabel,
        next.outcomeCode,
        next.kind,
        next.competencyStyle ? 1 : 0,
        next.marks,
        JSON.stringify(next.body),
        next.answer == null ? null : JSON.stringify(next.answer),
        next.provenance,
        next.timesUsed,
        tenantId,
        id,
      ],
    );
    return this.getQuestion(tenantId, id);
  }

  async deleteQuestion(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getQuestion(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM questions WHERE tenant_id = ? AND id = ?', [tenantId, id]);
    return true;
  }

  async getBlueprint(tenantId: string, id: string): Promise<Blueprint | null> {
    const row = await this.db.get<BlueprintRow>(
      'SELECT * FROM blueprints WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapBlueprint(row) : null;
  }

  async listBlueprints(tenantId: string): Promise<Blueprint[]> {
    const rows = await this.db.all<BlueprintRow>(
      'SELECT * FROM blueprints WHERE tenant_id = ? ORDER BY created_at ASC',
      [tenantId],
    );
    return rows.map(mapBlueprint);
  }

  async insertBlueprint(bp: Blueprint): Promise<Blueprint> {
    await this.db.run(
      `INSERT INTO blueprints (
         id, tenant_id, label, class_label, subject_code, total_marks, rules_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        bp.id,
        bp.tenantId,
        bp.label,
        bp.classLabel,
        bp.subjectCode,
        bp.totalMarks,
        JSON.stringify(bp.rules),
      ],
    );
    const created = await this.getBlueprint(bp.tenantId, bp.id);
    if (!created) throw new Error('Failed to read inserted blueprint');
    return created;
  }

  async getPaper(tenantId: string, id: string): Promise<Paper | null> {
    const row = await this.db.get<PaperRow>(
      'SELECT * FROM papers WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapPaper(row) : null;
  }

  async insertPaper(paper: Paper): Promise<Paper> {
    await this.db.run(
      `INSERT INTO papers (
         id, tenant_id, blueprint_id, exam_ref, question_ids_json, generated_variant_of
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        paper.id,
        paper.tenantId,
        paper.blueprintId,
        paper.examRef,
        JSON.stringify(paper.questionIds),
        paper.generatedVariantOf,
      ],
    );
    const created = await this.getPaper(paper.tenantId, paper.id);
    if (!created) throw new Error('Failed to read inserted paper');
    return created;
  }

  async incrementQuestionTimesUsed(tenantId: string, id: string): Promise<void> {
    await this.db.run(
      `UPDATE questions SET times_used = times_used + 1, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
  }
}

interface MarkRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  exam_id: string;
  student_id: string;
  draft_marks: number | null;
  assigned_marks: number | null;
  is_absent: number;
  is_exempt: number;
  entered_by: string;
  moderated_by: string | null;
  published_at: string | null;
  updated_at: string;
  created_at: string;
}

function mapMark(row: MarkRow): Mark {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    examId: row.exam_id,
    studentId: row.student_id,
    draftMarks: row.draft_marks,
    assignedMarks: row.assigned_marks,
    isAbsent: row.is_absent === 1,
    isExempt: row.is_exempt === 1,
    enteredBy: row.entered_by,
    moderatedBy: row.moderated_by,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

interface MarksAuditRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  mark_id: string;
  exam_id: string;
  student_id: string;
  previous_assigned: number | null;
  new_assigned: number;
  moderated_by: string;
  reason: string;
  created_at: string;
}

function mapAudit(row: MarksAuditRow): MarksAudit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    markId: row.mark_id,
    examId: row.exam_id,
    studentId: row.student_id,
    previousAssigned: row.previous_assigned,
    newAssigned: row.new_assigned,
    moderatedBy: row.moderated_by,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

interface QuestionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  subject_code: string;
  class_label: string;
  outcome_code: string | null;
  kind: string;
  competency_style: number;
  marks: number;
  body_json: string;
  answer_json: string | null;
  provenance: string;
  times_used: number;
  created_at: string;
  updated_at: string;
}

function mapQuestion(row: QuestionRow): Question {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(row.body_json) as Record<string, unknown>;
  } catch {
    body = {};
  }
  let answer: Record<string, unknown> | null = null;
  if (row.answer_json) {
    try {
      answer = JSON.parse(row.answer_json) as Record<string, unknown>;
    } catch {
      answer = null;
    }
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectCode: row.subject_code,
    classLabel: row.class_label,
    outcomeCode: row.outcome_code,
    kind: row.kind as QuestionKind,
    competencyStyle: row.competency_style === 1,
    marks: row.marks,
    body,
    answer,
    provenance: row.provenance as QuestionProvenance,
    timesUsed: row.times_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface BlueprintRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  label: string;
  class_label: string;
  subject_code: string;
  total_marks: number;
  rules_json: string;
  created_at: string;
}

function mapBlueprint(row: BlueprintRow): Blueprint {
  let rules: BlueprintRule[] = [];
  try {
    const parsed = JSON.parse(row.rules_json) as BlueprintRule[];
    if (Array.isArray(parsed)) rules = parsed;
  } catch {
    rules = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    classLabel: row.class_label,
    subjectCode: row.subject_code,
    totalMarks: row.total_marks,
    rules,
    createdAt: row.created_at,
  };
}

interface PaperRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  blueprint_id: string;
  exam_ref: string | null;
  question_ids_json: string;
  generated_variant_of: string | null;
  created_at: string;
}

function mapPaper(row: PaperRow): Paper {
  let questionIds: string[] = [];
  try {
    const parsed = JSON.parse(row.question_ids_json) as unknown;
    if (Array.isArray(parsed)) questionIds = parsed.map((x) => String(x));
  } catch {
    questionIds = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    blueprintId: row.blueprint_id,
    examRef: row.exam_ref,
    questionIds,
    generatedVariantOf: row.generated_variant_of,
    createdAt: row.created_at,
  };
}
