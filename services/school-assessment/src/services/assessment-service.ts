import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { AssessmentRepository } from '../repositories/assessment-repository';
import type {
  Blueprint,
  BlueprintBucket,
  BlueprintRule,
  BulkMarksInput,
  CreateBlueprintInput,
  CreateExamInput,
  CreateExamTermInput,
  CreatePaperInput,
  CreateQuestionInput,
  Exam,
  ExamKind,
  ExamTerm,
  ExamTermLabel,
  ItemAnalysisItem,
  ItemAnalysisResultRow,
  ListQuestionsFilters,
  Mark,
  MarksAudit,
  MarksClassStats,
  MarkWithPct,
  ModerateMarkInput,
  Paper,
  PaperConformanceReport,
  PatchExamInput,
  PatchExamTermInput,
  PatchQuestionInput,
  Question,
  QuestionKind,
  QuestionProvenance,
} from '../types';
import { analyzeItems, checkPaperConformance } from './item-analysis';

type ServiceError = {
  error: string;
  status: number;
  studentIds?: string[];
  report?: PaperConformanceReport;
};

const TERM_LABELS = new Set<ExamTermLabel>(['PT1', 'HY', 'PT2', 'Annual', 'custom']);
const EXAM_KINDS = new Set<ExamKind>(['formative', 'summative']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const QUESTION_KINDS = new Set<QuestionKind>([
  'mcq',
  'vsa',
  'sa',
  'la',
  'case_based',
  'source_based',
]);
const PROVENANCES = new Set<QuestionProvenance>(['human', 'ai_assisted', 'ai_generated']);
const BUCKETS = new Set<BlueprintBucket>(['competency', 'objective', 'short_long']);

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function medianOf(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return round2((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function effectiveScore(m: Mark): number | null {
  if (m.isExempt || m.isAbsent) return null;
  if (m.assignedMarks != null) return m.assignedMarks;
  if (m.draftMarks != null) return m.draftMarks;
  return null;
}

function pctFor(m: Mark, maxMarks: number): number | null {
  const score = m.assignedMarks != null ? m.assignedMarks : m.draftMarks;
  if (m.isExempt || m.isAbsent || score == null || maxMarks <= 0) return null;
  return round2((score / maxMarks) * 100);
}

function computeStats(marks: Mark[]): MarksClassStats {
  const scores: number[] = [];
  let absentCount = 0;
  for (const m of marks) {
    if (m.isAbsent) absentCount += 1;
    if (m.isExempt) continue;
    const score = effectiveScore(m);
    if (score != null) scores.push(score);
  }
  scores.sort((a, b) => a - b);
  return {
    mean: scores.length === 0 ? null : round2(scores.reduce((a, b) => a + b, 0) / scores.length),
    median: medianOf(scores),
    high: scores.length === 0 ? null : scores[scores.length - 1]!,
    low: scores.length === 0 ? null : scores[0]!,
    absentCount,
  };
}

export class AssessmentService {
  constructor(
    private readonly repo: AssessmentRepository,
    private readonly events: EventPublisher,
  ) {}

  async createExamTerm(
    tenantId: string,
    input: CreateExamTermInput,
  ): Promise<{ term?: ExamTerm; error?: ServiceError }> {
    const academicSessionId = (input.academicSessionId || '').trim();
    const label = input.label;
    const startsOn = (input.startsOn || '').trim();
    const endsOn = (input.endsOn || '').trim();
    const weightagePct = Number(input.weightagePct);

    if (!academicSessionId) {
      return { error: { error: 'academic_session_id is required', status: 400 } };
    }
    if (!TERM_LABELS.has(label)) {
      return { error: { error: 'invalid exam term label', status: 400 } };
    }
    if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
      return { error: { error: 'starts_on and ends_on must be ISO dates', status: 400 } };
    }
    if (startsOn > endsOn) {
      return { error: { error: 'starts_on must be on or before ends_on', status: 400 } };
    }
    if (!Number.isFinite(weightagePct) || weightagePct < 0) {
      return { error: { error: 'weightage_pct must be a non-negative number', status: 400 } };
    }

    const existingSum = await this.repo.sumWeightageForSession(tenantId, academicSessionId);
    if (existingSum + weightagePct > 100 + 1e-9) {
      return {
        error: {
          error: 'sum of weightage_pct for session exceeds 100',
          status: 400,
        },
      };
    }

    const term = await this.repo.insertExamTerm({
      id: uuidv4(),
      tenantId,
      academicSessionId,
      label,
      startsOn,
      endsOn,
      weightagePct,
      createdAt: '',
      updatedAt: '',
    });
    return { term };
  }

  async listExamTerms(
    tenantId: string,
    academicSessionId?: string,
  ): Promise<{ terms: ExamTerm[] }> {
    return {
      terms: await this.repo.listExamTerms(tenantId, academicSessionId),
    };
  }

  async getExamTerm(
    tenantId: string,
    id: string,
  ): Promise<{ term?: ExamTerm; error?: ServiceError }> {
    const term = await this.repo.getExamTerm(tenantId, id);
    if (!term) return { error: { error: 'exam term not found', status: 404 } };
    return { term };
  }

  async patchExamTerm(
    tenantId: string,
    id: string,
    input: PatchExamTermInput,
  ): Promise<{ term?: ExamTerm; error?: ServiceError }> {
    const current = await this.repo.getExamTerm(tenantId, id);
    if (!current) return { error: { error: 'exam term not found', status: 404 } };

    let label = current.label;
    let startsOn = current.startsOn;
    let endsOn = current.endsOn;
    let weightagePct = current.weightagePct;

    if (input.label !== undefined) {
      if (!TERM_LABELS.has(input.label)) {
        return { error: { error: 'invalid exam term label', status: 400 } };
      }
      label = input.label;
    }
    if (input.startsOn !== undefined) {
      startsOn = String(input.startsOn).trim();
      if (!ISO_DATE.test(startsOn)) {
        return { error: { error: 'starts_on must be an ISO date', status: 400 } };
      }
    }
    if (input.endsOn !== undefined) {
      endsOn = String(input.endsOn).trim();
      if (!ISO_DATE.test(endsOn)) {
        return { error: { error: 'ends_on must be an ISO date', status: 400 } };
      }
    }
    if (startsOn > endsOn) {
      return { error: { error: 'starts_on must be on or before ends_on', status: 400 } };
    }
    if (input.weightagePct !== undefined) {
      weightagePct = Number(input.weightagePct);
      if (!Number.isFinite(weightagePct) || weightagePct < 0) {
        return { error: { error: 'weightage_pct must be a non-negative number', status: 400 } };
      }
    }

    const otherSum = await this.repo.sumWeightageForSession(
      tenantId,
      current.academicSessionId,
      id,
    );
    if (otherSum + weightagePct > 100 + 1e-9) {
      return {
        error: {
          error: 'sum of weightage_pct for session exceeds 100',
          status: 400,
        },
      };
    }

    const term = await this.repo.updateExamTerm(tenantId, id, {
      ...current,
      label,
      startsOn,
      endsOn,
      weightagePct,
    });
    return { term: term! };
  }

  async deleteExamTerm(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteExamTerm(tenantId, id);
    if (!deleted) return { error: { error: 'exam term not found', status: 404 } };
    return { ok: true };
  }

  async createExam(
    tenantId: string,
    input: CreateExamInput,
  ): Promise<{ exam?: Exam; error?: ServiceError }> {
    const examTermId = (input.examTermId || '').trim();
    const courseRef = (input.courseRef || '').trim();
    const sectionRef = (input.sectionRef || '').trim();
    const subjectCode = (input.subjectCode || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const date = (input.date || '').trim();
    const maxMarks = Number(input.maxMarks);
    const kind = input.kind;

    if (!examTermId) return { error: { error: 'exam_term_id is required', status: 400 } };
    if (!courseRef) return { error: { error: 'course_ref is required', status: 400 } };
    if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!ISO_DATE.test(date)) return { error: { error: 'date must be an ISO date', status: 400 } };
    if (!Number.isInteger(maxMarks) || maxMarks < 1) {
      return { error: { error: 'max_marks must be a positive integer', status: 400 } };
    }
    if (!EXAM_KINDS.has(kind)) {
      return { error: { error: 'kind must be formative or summative', status: 400 } };
    }

    const term = await this.repo.getExamTerm(tenantId, examTermId);
    if (!term) return { error: { error: 'exam term not found', status: 404 } };

    const exam = await this.repo.insertExam({
      id: uuidv4(),
      tenantId,
      examTermId,
      courseRef,
      sectionRef,
      subjectCode,
      classLabel,
      date,
      maxMarks,
      kind,
      createdAt: '',
    });
    return { exam };
  }

  async listExams(
    tenantId: string,
    examTermId?: string,
  ): Promise<{ exams: Exam[] }> {
    return { exams: await this.repo.listExams(tenantId, examTermId) };
  }

  async getExam(
    tenantId: string,
    id: string,
  ): Promise<{ exam?: Exam; error?: ServiceError }> {
    const exam = await this.repo.getExam(tenantId, id);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };
    return { exam };
  }

  async patchExam(
    tenantId: string,
    id: string,
    input: PatchExamInput,
  ): Promise<{ exam?: Exam; error?: ServiceError }> {
    const current = await this.repo.getExam(tenantId, id);
    if (!current) return { error: { error: 'exam not found', status: 404 } };

    let courseRef = current.courseRef;
    let sectionRef = current.sectionRef;
    let subjectCode = current.subjectCode;
    let classLabel = current.classLabel;
    let date = current.date;
    let maxMarks = current.maxMarks;
    let kind = current.kind;

    if (input.courseRef !== undefined) {
      courseRef = String(input.courseRef).trim();
      if (!courseRef) return { error: { error: 'course_ref is required', status: 400 } };
    }
    if (input.sectionRef !== undefined) {
      sectionRef = String(input.sectionRef).trim();
      if (!sectionRef) return { error: { error: 'section_ref is required', status: 400 } };
    }
    if (input.subjectCode !== undefined) {
      subjectCode = String(input.subjectCode).trim();
      if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    }
    if (input.classLabel !== undefined) {
      classLabel = String(input.classLabel).trim();
      if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    }
    if (input.date !== undefined) {
      date = String(input.date).trim();
      if (!ISO_DATE.test(date)) {
        return { error: { error: 'date must be an ISO date', status: 400 } };
      }
    }
    if (input.maxMarks !== undefined) {
      maxMarks = Number(input.maxMarks);
      if (!Number.isInteger(maxMarks) || maxMarks < 1) {
        return { error: { error: 'max_marks must be a positive integer', status: 400 } };
      }
    }
    if (input.kind !== undefined) {
      if (!EXAM_KINDS.has(input.kind)) {
        return { error: { error: 'kind must be formative or summative', status: 400 } };
      }
      kind = input.kind;
    }

    const exam = await this.repo.updateExam(tenantId, id, {
      ...current,
      courseRef,
      sectionRef,
      subjectCode,
      classLabel,
      date,
      maxMarks,
      kind,
    });
    return { exam: exam! };
  }

  async deleteExam(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteExam(tenantId, id);
    if (!deleted) return { error: { error: 'exam not found', status: 404 } };
    return { ok: true };
  }

  async putExamMarks(
    tenantId: string,
    examId: string,
    body: Record<string, unknown>,
  ): Promise<{ marks?: Mark[]; error?: ServiceError }> {
    const exam = await this.repo.getExam(tenantId, examId);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };

    const enteredBy = String(body.entered_by ?? body.enteredBy ?? '').trim();
    if (!enteredBy) return { error: { error: 'entered_by is required', status: 400 } };

    const rawMarks = Array.isArray(body.marks) ? body.marks : null;
    if (!rawMarks || rawMarks.length === 0) {
      return { error: { error: 'marks array is required', status: 400 } };
    }

    const parsed: BulkMarksInput['marks'] = [];
    for (let i = 0; i < rawMarks.length; i++) {
      const row = rawMarks[i] as Record<string, unknown>;
      if (!row || typeof row !== 'object') {
        return { error: { error: `marks[${i}] invalid`, status: 400 } };
      }
      if (row.assigned_marks !== undefined || row.assignedMarks !== undefined) {
        return {
          error: { error: 'setting assigned_marks directly is not allowed', status: 400 },
        };
      }
      const studentId = String(row.student_id ?? row.studentId ?? '').trim();
      if (!studentId) {
        return { error: { error: `marks[${i}].student_id is required`, status: 400 } };
      }
      const isAbsent = Boolean(row.is_absent ?? row.isAbsent ?? false);
      const isExempt = Boolean(row.is_exempt ?? row.isExempt ?? false);
      if (isAbsent && isExempt) {
        return {
          error: { error: `marks[${i}]: is_absent and is_exempt are mutually exclusive`, status: 400 },
        };
      }
      const hasDraft =
        row.draft_marks !== undefined ||
        row.draftMarks !== undefined;
      let draftMarks: number | null | undefined = undefined;
      if (hasDraft) {
        const raw = row.draft_marks ?? row.draftMarks;
        draftMarks = raw === null ? null : Number(raw);
        if (draftMarks != null && !Number.isFinite(draftMarks)) {
          return { error: { error: `marks[${i}].draft_marks must be a number`, status: 400 } };
        }
        if (draftMarks != null && (draftMarks < 0 || draftMarks > exam.maxMarks)) {
          return {
            error: {
              error: `marks[${i}].draft_marks must be between 0 and ${exam.maxMarks}`,
              status: 400,
            },
          };
        }
      }
      if ((isAbsent || isExempt) && draftMarks != null) {
        return {
          error: {
            error: `marks[${i}]: absent/exempt mutually exclusive with draft_marks`,
            status: 400,
          },
        };
      }
      parsed.push({
        studentId,
        draftMarks: hasDraft ? draftMarks! : undefined,
        isAbsent,
        isExempt,
      });
    }

    const out: Mark[] = [];
    for (const entry of parsed) {
      const existing = await this.repo.getMarkByExamStudent(
        tenantId,
        examId,
        entry.studentId,
      );
      const isAbsent = entry.isAbsent ?? false;
      const isExempt = entry.isExempt ?? false;
      let draftMarks: number | null;
      if (isAbsent || isExempt) {
        draftMarks = null;
      } else if (entry.draftMarks !== undefined) {
        draftMarks = entry.draftMarks;
      } else if (existing) {
        draftMarks = existing.draftMarks;
      } else {
        draftMarks = null;
      }

      if (existing) {
        const updated = await this.repo.updateMark(tenantId, existing.id, {
          ...existing,
          draftMarks,
          isAbsent,
          isExempt,
          enteredBy,
        });
        out.push(updated!);
      } else {
        const created = await this.repo.insertMark({
          id: uuidv4(),
          tenantId,
          examId,
          studentId: entry.studentId,
          draftMarks,
          assignedMarks: null,
          isAbsent,
          isExempt,
          enteredBy,
          moderatedBy: null,
          publishedAt: null,
          updatedAt: '',
          createdAt: '',
        });
        out.push(created);
      }
    }
    return { marks: out };
  }

  async getExamMarks(
    tenantId: string,
    examId: string,
  ): Promise<{
    marks?: MarkWithPct[];
    stats?: MarksClassStats;
    error?: ServiceError;
  }> {
    const exam = await this.repo.getExam(tenantId, examId);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };
    const rows = await this.repo.listMarksForExam(tenantId, examId);
    return {
      marks: rows.map((m) => ({ ...m, pct: pctFor(m, exam.maxMarks) })),
      stats: computeStats(rows),
    };
  }

  async publishExamMarks(
    tenantId: string,
    examId: string,
    publishedBy: string,
  ): Promise<{ marks?: Mark[]; count?: number; error?: ServiceError }> {
    const by = (publishedBy || '').trim();
    if (!by) return { error: { error: 'published_by is required', status: 400 } };
    const exam = await this.repo.getExam(tenantId, examId);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };

    const rows = await this.repo.listMarksForExam(tenantId, examId);
    if (rows.length === 0) {
      return { error: { error: 'no marks to publish', status: 400 } };
    }

    const missing = rows
      .filter((m) => m.draftMarks == null && !m.isAbsent && !m.isExempt)
      .map((m) => m.studentId);
    if (missing.length > 0) {
      return {
        error: {
          error: 'students missing draft_marks or absent/exempt flag',
          status: 400,
          studentIds: missing,
        },
      };
    }

    const now = new Date().toISOString();
    const published: Mark[] = [];
    for (const m of rows) {
      const assigned =
        m.isAbsent || m.isExempt ? null : m.draftMarks;
      const updated = await this.repo.updateMark(tenantId, m.id, {
        ...m,
        assignedMarks: assigned,
        publishedAt: now,
        enteredBy: m.enteredBy || by,
      });
      published.push(updated!);
    }

    await this.events.publish({
      type: 'school.marks.published',
      tenantId,
      occurredAt: now,
      data: { exam_id: examId, count: published.length, published_by: by },
    });

    return { marks: published, count: published.length };
  }

  async moderateMark(
    tenantId: string,
    markId: string,
    input: ModerateMarkInput,
  ): Promise<{ mark?: Mark; audit?: MarksAudit; error?: ServiceError }> {
    const mark = await this.repo.getMark(tenantId, markId);
    if (!mark) return { error: { error: 'mark not found', status: 404 } };
    if (!mark.publishedAt) {
      return { error: { error: 'mark must be published before moderation', status: 409 } };
    }
    const moderatedBy = (input.moderatedBy || '').trim();
    const reason = (input.reason || '').trim();
    if (!moderatedBy) return { error: { error: 'moderated_by is required', status: 400 } };
    if (!reason) return { error: { error: 'reason is required', status: 400 } };

    const exam = await this.repo.getExam(tenantId, mark.examId);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };
    const assignedMarks = Number(input.assignedMarks);
    if (!Number.isFinite(assignedMarks)) {
      return { error: { error: 'assigned_marks must be a number', status: 400 } };
    }
    if (assignedMarks < 0 || assignedMarks > exam.maxMarks) {
      return {
        error: {
          error: `assigned_marks must be between 0 and ${exam.maxMarks}`,
          status: 400,
        },
      };
    }

    const previousAssigned = mark.assignedMarks;
    const updated = await this.repo.updateMark(tenantId, markId, {
      ...mark,
      assignedMarks,
      moderatedBy,
    });
    const audit = await this.repo.insertMarksAudit({
      id: uuidv4(),
      tenantId,
      markId,
      examId: mark.examId,
      studentId: mark.studentId,
      previousAssigned,
      newAssigned: assignedMarks,
      moderatedBy,
      reason,
      createdAt: '',
    });
    return { mark: updated!, audit };
  }

  async createQuestion(
    tenantId: string,
    input: CreateQuestionInput,
  ): Promise<{ question?: Question; error?: ServiceError }> {
    const subjectCode = (input.subjectCode || '').trim();
    const classLabel = (input.classLabel || '').trim();
    if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!QUESTION_KINDS.has(input.kind)) {
      return { error: { error: 'invalid question kind', status: 400 } };
    }
    const marks = Number(input.marks);
    if (!Number.isInteger(marks) || marks < 1) {
      return { error: { error: 'marks must be a positive integer', status: 400 } };
    }
    if (!input.body || typeof input.body !== 'object') {
      return { error: { error: 'body is required', status: 400 } };
    }
    const provenance = input.provenance ?? 'human';
    if (!PROVENANCES.has(provenance)) {
      return { error: { error: 'invalid provenance', status: 400 } };
    }
    const question = await this.repo.insertQuestion({
      id: uuidv4(),
      tenantId,
      subjectCode,
      classLabel,
      outcomeCode:
        input.outcomeCode != null && String(input.outcomeCode).trim() !== ''
          ? String(input.outcomeCode).trim()
          : null,
      kind: input.kind,
      competencyStyle: Boolean(input.competencyStyle),
      marks,
      body: input.body,
      answer: input.answer ?? null,
      provenance,
      timesUsed: 0,
      createdAt: '',
      updatedAt: '',
    });
    return { question };
  }

  async listQuestions(
    tenantId: string,
    filters: ListQuestionsFilters,
  ): Promise<{ questions: Question[] }> {
    return { questions: await this.repo.listQuestions(tenantId, filters) };
  }

  async getQuestion(
    tenantId: string,
    id: string,
  ): Promise<{ question?: Question; error?: ServiceError }> {
    const question = await this.repo.getQuestion(tenantId, id);
    if (!question) return { error: { error: 'question not found', status: 404 } };
    return { question };
  }

  async patchQuestion(
    tenantId: string,
    id: string,
    input: PatchQuestionInput,
  ): Promise<{ question?: Question; error?: ServiceError }> {
    const current = await this.repo.getQuestion(tenantId, id);
    if (!current) return { error: { error: 'question not found', status: 404 } };

    let subjectCode = current.subjectCode;
    let classLabel = current.classLabel;
    let outcomeCode = current.outcomeCode;
    let kind = current.kind;
    let competencyStyle = current.competencyStyle;
    let marks = current.marks;
    let body = current.body;
    let answer = current.answer;
    let provenance = current.provenance;

    if (input.subjectCode !== undefined) {
      subjectCode = String(input.subjectCode).trim();
      if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    }
    if (input.classLabel !== undefined) {
      classLabel = String(input.classLabel).trim();
      if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    }
    if (input.outcomeCode !== undefined) {
      outcomeCode =
        input.outcomeCode == null || String(input.outcomeCode).trim() === ''
          ? null
          : String(input.outcomeCode).trim();
    }
    if (input.kind !== undefined) {
      if (!QUESTION_KINDS.has(input.kind)) {
        return { error: { error: 'invalid question kind', status: 400 } };
      }
      kind = input.kind;
    }
    if (input.competencyStyle !== undefined) competencyStyle = Boolean(input.competencyStyle);
    if (input.marks !== undefined) {
      marks = Number(input.marks);
      if (!Number.isInteger(marks) || marks < 1) {
        return { error: { error: 'marks must be a positive integer', status: 400 } };
      }
    }
    if (input.body !== undefined) {
      if (!input.body || typeof input.body !== 'object') {
        return { error: { error: 'body is required', status: 400 } };
      }
      body = input.body;
    }
    if (input.answer !== undefined) answer = input.answer;
    if (input.provenance !== undefined) {
      if (!PROVENANCES.has(input.provenance)) {
        return { error: { error: 'invalid provenance', status: 400 } };
      }
      provenance = input.provenance;
    }

    const question = await this.repo.updateQuestion(tenantId, id, {
      ...current,
      subjectCode,
      classLabel,
      outcomeCode,
      kind,
      competencyStyle,
      marks,
      body,
      answer,
      provenance,
    });
    return { question: question! };
  }

  async deleteQuestion(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const deleted = await this.repo.deleteQuestion(tenantId, id);
    if (!deleted) return { error: { error: 'question not found', status: 404 } };
    return { ok: true };
  }

  async createBlueprint(
    tenantId: string,
    input: CreateBlueprintInput,
  ): Promise<{ blueprint?: Blueprint; error?: ServiceError }> {
    const label = (input.label || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const subjectCode = (input.subjectCode || '').trim();
    const totalMarks = Number(input.totalMarks);
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!subjectCode) return { error: { error: 'subject_code is required', status: 400 } };
    if (!Number.isInteger(totalMarks) || totalMarks < 1) {
      return { error: { error: 'total_marks must be a positive integer', status: 400 } };
    }
    if (!Array.isArray(input.rules) || input.rules.length === 0) {
      return { error: { error: 'rules array is required', status: 400 } };
    }
    const rules: BlueprintRule[] = [];
    for (const r of input.rules) {
      if (!BUCKETS.has(r.bucket)) {
        return { error: { error: 'invalid blueprint bucket', status: 400 } };
      }
      const pct = Number(r.pct);
      if (!Number.isFinite(pct) || pct < 0) {
        return { error: { error: 'rule pct must be non-negative', status: 400 } };
      }
      rules.push({ bucket: r.bucket, pct });
    }
    const blueprint = await this.repo.insertBlueprint({
      id: uuidv4(),
      tenantId,
      label,
      classLabel,
      subjectCode,
      totalMarks,
      rules,
      createdAt: '',
    });
    return { blueprint };
  }

  async getBlueprint(
    tenantId: string,
    id: string,
  ): Promise<{ blueprint?: Blueprint; error?: ServiceError }> {
    const blueprint = await this.repo.getBlueprint(tenantId, id);
    if (!blueprint) return { error: { error: 'blueprint not found', status: 404 } };
    return { blueprint };
  }

  async checkPaper(
    tenantId: string,
    blueprintId: string,
    questionIds: string[],
  ): Promise<{ report?: PaperConformanceReport; error?: ServiceError }> {
    const blueprint = await this.repo.getBlueprint(tenantId, blueprintId);
    if (!blueprint) return { error: { error: 'blueprint not found', status: 404 } };
    const uniqueOrder = [...new Set(questionIds)];
    const questions: Question[] = [];
    for (const id of uniqueOrder) {
      const q = await this.repo.getQuestion(tenantId, id);
      if (!q) return { error: { error: `question not found: ${id}`, status: 404 } };
      questions.push(q);
    }
    const report = checkPaperConformance(blueprint, questions, questionIds);
    return { report };
  }

  async createPaper(
    tenantId: string,
    input: CreatePaperInput,
  ): Promise<{ paper?: Paper; report?: PaperConformanceReport; error?: ServiceError }> {
    const blueprintId = (input.blueprintId || '').trim();
    if (!blueprintId) return { error: { error: 'blueprint_id is required', status: 400 } };
    if (!Array.isArray(input.questionIds) || input.questionIds.length === 0) {
      return { error: { error: 'question_ids is required', status: 400 } };
    }
    const checked = await this.checkPaper(tenantId, blueprintId, input.questionIds);
    if (checked.error) return { error: checked.error };
    const report = checked.report!;
    if (!report.pass) {
      return {
        error: { error: 'paper does not conform to blueprint', status: 400, report },
        report,
      };
    }
    const paper = await this.repo.insertPaper({
      id: uuidv4(),
      tenantId,
      blueprintId,
      examRef: input.examRef != null ? String(input.examRef) : null,
      questionIds: input.questionIds,
      generatedVariantOf:
        input.generatedVariantOf != null ? String(input.generatedVariantOf) : null,
      createdAt: '',
    });
    for (const id of [...new Set(input.questionIds)]) {
      await this.repo.incrementQuestionTimesUsed(tenantId, id);
    }
    return { paper, report };
  }

  analyzeQuestionResults(
    results: ItemAnalysisResultRow[],
  ): { items?: ItemAnalysisItem[]; error?: ServiceError } {
    try {
      return { items: analyzeItems(results) };
    } catch {
      return { error: { error: 'invalid analysis vectors', status: 400 } };
    }
  }
}
