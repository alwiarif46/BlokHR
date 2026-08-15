import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { AcademicsClient } from '../clients/academics-client';
import { NoopAcademicsClient } from '../clients/academics-client';
import type { AssessmentRepository } from '../repositories/assessment-repository';
import type {
  AssessmentInput,
  BoardFormat,
  Blueprint,
  BlueprintBucket,
  BlueprintRule,
  BulkMarksInput,
  Competency,
  CreateBlueprintInput,
  CreateExamInput,
  CreateExamTermInput,
  CreateHpcInputPayload,
  CreatePaperInput,
  CreateQuestionInput,
  CreateReportTemplateInput,
  Exam,
  ExamKind,
  ExamTerm,
  ExamTermLabel,
  GenerateReportCardsInput,
  HpcCoverageRow,
  HpcLevel,
  HpcMatrixCell,
  HpcSource,
  HpcStage,
  HpcStudentCompetencyView,
  ItemAnalysisItem,
  ItemAnalysisResultRow,
  ListQuestionsFilters,
  Mark,
  MarksAggregation,
  MarksAudit,
  MarksClassStats,
  MarkWithPct,
  ModerateMarkInput,
  OutcomePerformance,
  Paper,
  PaperConformanceReport,
  PatchExamInput,
  PatchExamTermInput,
  PatchQuestionInput,
  PatchReportTemplateInput,
  Question,
  QuestionKind,
  QuestionProvenance,
  ReportBlockDefinition,
  ReportBlockType,
  ReportCard,
  ReportTemplate,
  WeakOutcomeRow,
} from '../types';
import { analyzeItems, checkPaperConformance } from './item-analysis';
import { deriveLevelFromCircled, majorityLevel } from './hpc-levels';
import { mapCbse9Point, mapMsbshseSsc } from './grade-maps';

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
const HPC_SOURCES = new Set<HpcSource>(['self', 'peer', 'teacher', 'parent']);
const HPC_LEVELS = new Set<HpcLevel>(['beginner', 'proficient', 'advanced']);
const HPC_STAGES = new Set<HpcStage>([
  'foundational',
  'preparatory',
  'middle',
  'secondary',
]);
const HPC_BULK_MAX = 200;
const BOARD_FORMATS = new Set<BoardFormat>([
  'cbse_9pt',
  'msbshse_ssc',
  'msbshse_hsc',
  'icse',
  'custom',
]);
const BLOCK_TYPES = new Set<ReportBlockType>([
  'marks_table',
  'attendance',
  'hpc_summary',
  'remarks',
  'custom_text',
]);
const AGGREGATIONS = new Set<MarksAggregation>(['sum', 'avg', 'weighted_by_term']);

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
    private readonly academics: AcademicsClient = new NoopAcademicsClient(),
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

    // Coverage feedback: compute outcome performance + optional academics infer
    await this.runFeedbackForExam(tenantId, examId);

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

  async createHpcInput(
    tenantId: string,
    payload: CreateHpcInputPayload,
  ): Promise<{ input?: AssessmentInput; error?: ServiceError }> {
    const studentId = (payload.studentId || '').trim();
    const competencyId = (payload.competencyId || '').trim();
    const recordedBy = (payload.recordedBy || '').trim();
    const source = payload.source;

    if (!studentId) return { error: { error: 'student_id is required', status: 400 } };
    if (!competencyId) return { error: { error: 'competency_id is required', status: 400 } };
    if (!recordedBy) return { error: { error: 'recorded_by is required', status: 400 } };
    if (!HPC_SOURCES.has(source)) {
      return { error: { error: 'invalid source', status: 400 } };
    }

    const competency = await this.repo.getCompetencyVisible(tenantId, competencyId);
    if (!competency) return { error: { error: 'competency not found', status: 404 } };

    const hasCircled =
      payload.statementsCircled !== undefined && payload.statementsCircled !== null;
    const hasLevel = payload.level !== undefined && payload.level !== null;

    let level: HpcLevel | null = null;
    let statementsCircled: number | null = null;

    if (competency.stage === 'middle') {
      if (hasCircled && hasLevel) {
        return {
          error: {
            error: 'middle-stage: send statements_circled or level, not both',
            status: 400,
          },
        };
      }
      if (!hasCircled) {
        return {
          error: {
            error: 'middle-stage requires statements_circled (level is derived)',
            status: 400,
          },
        };
      }
      const circled = Number(payload.statementsCircled);
      const derived = deriveLevelFromCircled(circled);
      if (derived == null) {
        return {
          error: { error: 'statements_circled must be an integer 0–6', status: 400 },
        };
      }
      statementsCircled = circled;
      level = derived;
    } else {
      if (hasCircled) {
        return {
          error: {
            error: 'statements_circled is only valid for middle-stage competencies',
            status: 400,
          },
        };
      }
      if (!hasLevel || !HPC_LEVELS.has(payload.level as HpcLevel)) {
        return { error: { error: 'level is required for non-middle stages', status: 400 } };
      }
      level = payload.level as HpcLevel;
    }

    const at = (payload.at || '').trim() || new Date().toISOString();
    const input = await this.repo.insertAssessmentInput({
      id: uuidv4(),
      tenantId,
      studentId,
      competencyId,
      activityRef: payload.activityRef != null ? String(payload.activityRef) : null,
      source,
      level,
      statementsCircled,
      observationalChallenge:
        payload.observationalChallenge != null
          ? String(payload.observationalChallenge)
          : null,
      observationalResolution:
        payload.observationalResolution != null
          ? String(payload.observationalResolution)
          : null,
      evidenceRef: payload.evidenceRef != null ? String(payload.evidenceRef) : null,
      academicSessionRef:
        payload.academicSessionRef != null
          ? String(payload.academicSessionRef).trim() || null
          : null,
      recordedBy,
      at,
    });
    return { input };
  }

  async createHpcInputsBulk(
    tenantId: string,
    payloads: CreateHpcInputPayload[],
  ): Promise<{ inputs?: AssessmentInput[]; error?: ServiceError }> {
    if (!Array.isArray(payloads) || payloads.length === 0) {
      return { error: { error: 'inputs array is required', status: 400 } };
    }
    if (payloads.length > HPC_BULK_MAX) {
      return {
        error: { error: `bulk limit is ${HPC_BULK_MAX} inputs per call`, status: 400 },
      };
    }
    const inputs: AssessmentInput[] = [];
    for (const p of payloads) {
      const result = await this.createHpcInput(tenantId, p);
      if (result.error) return { error: result.error };
      inputs.push(result.input!);
    }
    return { inputs };
  }

  async getHpcStudentView(
    tenantId: string,
    studentId: string,
    session?: string,
  ): Promise<{ competencies?: HpcStudentCompetencyView[]; error?: ServiceError }> {
    const id = (studentId || '').trim();
    if (!id) return { error: { error: 'student id is required', status: 400 } };
    const rows = await this.repo.listAssessmentInputsForStudent(tenantId, id, session);
    if (rows.length === 0) {
      // Tenant isolation: other tenant's data won't appear; empty is ok for unknown student
      return { competencies: [] };
    }
    // If any rows exist for this tenant, build view. Cross-tenant reads return empty via query.
    const byComp = new Map<string, AssessmentInput[]>();
    for (const row of rows) {
      const list = byComp.get(row.competencyId) ?? [];
      list.push(row);
      byComp.set(row.competencyId, list);
    }
    const views: HpcStudentCompetencyView[] = [];
    for (const [competencyId, inputs] of byComp) {
      const competency = await this.repo.getCompetencyVisible(tenantId, competencyId);
      if (!competency) continue;
      const voices: HpcStudentCompetencyView['voices'] = {
        self: null,
        peer: null,
        teacher: null,
        parent: null,
      };
      const seen = new Set<HpcSource>();
      // inputs already ordered at DESC
      for (const inp of inputs) {
        if (seen.has(inp.source)) continue;
        seen.add(inp.source);
        voices[inp.source] = inp.level;
      }
      views.push({
        competencyId,
        label: competency.label,
        stage: competency.stage,
        ability: competency.ability,
        voices,
        inputCount: inputs.length,
      });
    }
    views.sort((a, b) => a.label.localeCompare(b.label));
    return { competencies: views };
  }

  async getHpcStudentMatrix(
    tenantId: string,
    studentId: string,
  ): Promise<{ cells?: HpcMatrixCell[]; error?: ServiceError }> {
    const id = (studentId || '').trim();
    if (!id) return { error: { error: 'student id is required', status: 400 } };
    const rows = await this.repo.listTeacherInputsForStudentSecondary(tenantId, id);
    const grouped = new Map<string, HpcLevel[]>();
    for (const row of rows) {
      const session = row.academicSessionRef || '';
      const key = `${row.competencyId}::${session}`;
      const list = grouped.get(key) ?? [];
      if (row.level) list.push(row.level);
      grouped.set(key, list);
    }
    const cells: HpcMatrixCell[] = [];
    for (const [key, levels] of grouped) {
      const [competencyId, session] = key.split('::');
      cells.push({
        competencyId: competencyId!,
        session: session ?? '',
        level: majorityLevel(levels),
        teacherInputCount: levels.length,
      });
    }
    cells.sort((a, b) =>
      a.competencyId === b.competencyId
        ? a.session.localeCompare(b.session)
        : a.competencyId.localeCompare(b.competencyId),
    );
    return { cells };
  }

  async getHpcCoverage(
    tenantId: string,
    studentIds: string[],
    stage?: HpcStage,
  ): Promise<{ coverage?: HpcCoverageRow[]; error?: ServiceError }> {
    if (studentIds.length === 0) {
      return { error: { error: 'section_students is required', status: 400 } };
    }
    if (stage && !HPC_STAGES.has(stage)) {
      return { error: { error: 'invalid stage', status: 400 } };
    }
    const competencies = await this.repo.listCompetenciesVisible(tenantId, stage);
    const inputs = await this.repo.listAssessmentInputsForStudents(
      tenantId,
      studentIds,
      stage,
    );
    const coverage: HpcCoverageRow[] = [];
    for (const comp of competencies) {
      let filled = 0;
      for (const studentId of studentIds) {
        const forStudent = inputs.filter(
          (i) => i.studentId === studentId && i.competencyId === comp.id,
        );
        const hasTeacher = forStudent.some((i) => i.source === 'teacher');
        const hasSelf = forStudent.some((i) => i.source === 'self');
        if (hasTeacher && hasSelf) filled += 1;
      }
      const pct =
        studentIds.length === 0
          ? 0
          : Math.round((filled / studentIds.length) * 1000) / 10;
      coverage.push({
        competencyId: comp.id,
        label: comp.label,
        stage: comp.stage,
        studentCount: studentIds.length,
        filledCount: filled,
        pct,
      });
    }
    return { coverage };
  }

  /** Visible for tests / listing seeded competencies. */
  async listCompetencies(
    tenantId: string,
    stage?: HpcStage,
  ): Promise<{ competencies: Competency[] }> {
    return {
      competencies: await this.repo.listCompetenciesVisible(tenantId, stage),
    };
  }

  private validateDefinition(
    definition: ReportBlockDefinition[],
  ): ServiceError | null {
    if (!Array.isArray(definition) || definition.length === 0) {
      return { error: 'definition must be a non-empty array', status: 400 };
    }
    for (const block of definition) {
      if (!BLOCK_TYPES.has(block.type)) {
        return { error: `invalid block type: ${block.type}`, status: 400 };
      }
      if (block.type === 'marks_table') {
        const agg = String(block.config?.aggregation ?? 'avg') as MarksAggregation;
        if (!AGGREGATIONS.has(agg)) {
          return { error: 'invalid marks aggregation', status: 400 };
        }
      }
    }
    return null;
  }

  async createReportTemplate(
    tenantId: string,
    input: CreateReportTemplateInput,
  ): Promise<{ template?: ReportTemplate; error?: ServiceError }> {
    const label = (input.label || '').trim();
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!BOARD_FORMATS.has(input.boardFormat)) {
      return { error: { error: 'invalid board_format', status: 400 } };
    }
    const defErr = this.validateDefinition(input.definition);
    if (defErr) return { error: defErr };
    const template = await this.repo.insertReportTemplate({
      id: uuidv4(),
      tenantId,
      label,
      boardFormat: input.boardFormat,
      state: 'sandbox',
      definition: input.definition,
      version: 1,
      promotedAt: null,
      createdAt: '',
      updatedAt: '',
    });
    return { template };
  }

  async listReportTemplates(
    tenantId: string,
  ): Promise<{ templates: ReportTemplate[] }> {
    return { templates: await this.repo.listReportTemplates(tenantId) };
  }

  async getReportTemplate(
    tenantId: string,
    id: string,
  ): Promise<{ template?: ReportTemplate; error?: ServiceError }> {
    const template = await this.repo.getReportTemplate(tenantId, id);
    if (!template) return { error: { error: 'template not found', status: 404 } };
    return { template };
  }

  async patchReportTemplate(
    tenantId: string,
    id: string,
    input: PatchReportTemplateInput,
  ): Promise<{ template?: ReportTemplate; error?: ServiceError }> {
    const current = await this.repo.getReportTemplate(tenantId, id);
    if (!current) return { error: { error: 'template not found', status: 404 } };
    if (current.state !== 'sandbox') {
      return { error: { error: 'promote_a_sandbox_copy', status: 409 } };
    }
    let label = current.label;
    let boardFormat = current.boardFormat;
    let definition = current.definition;
    if (input.label !== undefined) {
      label = String(input.label).trim();
      if (!label) return { error: { error: 'label is required', status: 400 } };
    }
    if (input.boardFormat !== undefined) {
      if (!BOARD_FORMATS.has(input.boardFormat)) {
        return { error: { error: 'invalid board_format', status: 400 } };
      }
      boardFormat = input.boardFormat;
    }
    if (input.definition !== undefined) {
      const defErr = this.validateDefinition(input.definition);
      if (defErr) return { error: defErr };
      definition = input.definition;
    }
    const template = await this.repo.updateReportTemplate(tenantId, id, {
      ...current,
      label,
      boardFormat,
      definition,
    });
    return { template: template! };
  }

  async promoteReportTemplate(
    tenantId: string,
    id: string,
  ): Promise<{ template?: ReportTemplate; error?: ServiceError }> {
    const current = await this.repo.getReportTemplate(tenantId, id);
    if (!current) return { error: { error: 'template not found', status: 404 } };
    if (current.state !== 'sandbox') {
      return { error: { error: 'only sandbox templates can be promoted', status: 409 } };
    }
    const existingLive = await this.repo.findLiveTemplateByLabel(tenantId, current.label);
    if (existingLive && existingLive.id !== current.id) {
      await this.repo.updateReportTemplate(tenantId, existingLive.id, {
        ...existingLive,
        state: 'retired',
      });
    }
    const template = await this.repo.updateReportTemplate(tenantId, id, {
      ...current,
      state: 'live',
      version: current.version + 1,
      promotedAt: new Date().toISOString(),
    });
    return { template: template! };
  }

  async cloneReportTemplate(
    tenantId: string,
    id: string,
  ): Promise<{ template?: ReportTemplate; error?: ServiceError }> {
    const current = await this.repo.getReportTemplate(tenantId, id);
    if (!current) return { error: { error: 'template not found', status: 404 } };
    const template = await this.repo.insertReportTemplate({
      id: uuidv4(),
      tenantId,
      label: current.label,
      boardFormat: current.boardFormat,
      state: 'sandbox',
      definition: structuredClone(current.definition),
      version: 1,
      promotedAt: null,
      createdAt: '',
      updatedAt: '',
    });
    return { template };
  }

  private mapGrade(boardFormat: BoardFormat, pct: number): Record<string, unknown> {
    switch (boardFormat) {
      case 'cbse_9pt':
        return mapCbse9Point(pct);
      case 'msbshse_ssc':
        return mapMsbshseSsc(pct);
      case 'msbshse_hsc':
        return mapMsbshseSsc(pct);
      case 'icse':
        return mapCbse9Point(pct);
      case 'custom':
        return { grade: null, pass: pct >= 33, pct };
      default: {
        const _exhaustive: never = boardFormat;
        return _exhaustive;
      }
    }
  }

  private async resolveMarksBlock(
    tenantId: string,
    studentId: string,
    session: string,
    boardFormat: BoardFormat,
    config: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown>> {
    const aggregation = String(config?.aggregation ?? 'avg') as MarksAggregation;
    const rows = await this.repo.listPublishedMarksForStudentSession(
      tenantId,
      studentId,
      session,
    );
    const usable = rows.filter(
      (r) => !r.mark.isExempt && !r.mark.isAbsent && r.mark.assignedMarks != null,
    );
    const entries = usable.map((r) => {
      const pct =
        r.exam.maxMarks > 0
          ? round2((r.mark.assignedMarks! / r.exam.maxMarks) * 100)
          : null;
      return {
        examId: r.exam.id,
        subjectCode: r.exam.subjectCode,
        termLabel: r.termLabel,
        termWeightagePct: r.termWeightagePct,
        assignedMarks: r.mark.assignedMarks,
        maxMarks: r.exam.maxMarks,
        pct,
        grade: pct == null ? null : this.mapGrade(boardFormat, pct),
      };
    });

    let aggregate: number | null = null;
    if (entries.length > 0) {
      if (aggregation === 'sum') {
        aggregate = round2(entries.reduce((s, e) => s + (e.assignedMarks ?? 0), 0));
      } else if (aggregation === 'avg') {
        const pcts = entries.map((e) => e.pct).filter((p): p is number => p != null);
        aggregate =
          pcts.length === 0
            ? null
            : round2(pcts.reduce((a, b) => a + b, 0) / pcts.length);
      } else {
        let weighted = 0;
        let weightSum = 0;
        for (const e of entries) {
          if (e.pct == null) continue;
          weighted += e.pct * e.termWeightagePct;
          weightSum += e.termWeightagePct;
        }
        aggregate = weightSum === 0 ? null : round2(weighted / weightSum);
      }
    }

    return {
      aggregation,
      entries,
      aggregate,
      aggregateGrade:
        aggregate == null || aggregation === 'sum'
          ? null
          : this.mapGrade(boardFormat, aggregate),
    };
  }

  async generateReportCards(
    tenantId: string,
    input: GenerateReportCardsInput,
  ): Promise<{ cards?: ReportCard[]; error?: ServiceError }> {
    const templateId = (input.templateId || '').trim();
    const session = (input.session || '').trim();
    const generatedBy = (input.generatedBy || '').trim();
    if (!templateId) return { error: { error: 'template_id is required', status: 400 } };
    if (!session) return { error: { error: 'session is required', status: 400 } };
    if (!generatedBy) return { error: { error: 'generated_by is required', status: 400 } };
    if (!Array.isArray(input.students) || input.students.length === 0) {
      return { error: { error: 'students array is required', status: 400 } };
    }

    const template = await this.repo.getReportTemplate(tenantId, templateId);
    if (!template) return { error: { error: 'template not found', status: 404 } };

    const cards: ReportCard[] = [];
    for (const student of input.students) {
      const studentId = (student.studentId || '').trim();
      if (!studentId) {
        return { error: { error: 'student_id is required', status: 400 } };
      }
      const blocks: Array<Record<string, unknown>> = [];
      for (const block of template.definition) {
        switch (block.type) {
          case 'marks_table':
            blocks.push({
              type: 'marks_table',
              data: await this.resolveMarksBlock(
                tenantId,
                studentId,
                session,
                template.boardFormat,
                block.config,
              ),
            });
            break;
          case 'attendance':
            blocks.push({
              type: 'attendance',
              data: student.attendance ?? block.config ?? {},
            });
            break;
          case 'hpc_summary': {
            const hpc = await this.getHpcStudentView(tenantId, studentId, session);
            blocks.push({
              type: 'hpc_summary',
              data: { competencies: hpc.competencies ?? [] },
            });
            break;
          }
          case 'remarks':
            blocks.push({
              type: 'remarks',
              data: { remarks: student.remarks ?? null },
            });
            break;
          case 'custom_text':
            blocks.push({
              type: 'custom_text',
              data: { text: String(block.config?.text ?? '') },
            });
            break;
          default: {
            const _exhaustive: never = block.type;
            return _exhaustive;
          }
        }
      }

      const payload: Record<string, unknown> = {
        studentId,
        session,
        boardFormat: template.boardFormat,
        templateLabel: template.label,
        templateVersion: template.version,
        blocks,
      };

      const card = await this.repo.insertReportCard({
        id: uuidv4(),
        tenantId,
        studentId,
        templateId: template.id,
        templateVersion: template.version,
        academicSessionRef: session,
        payload,
        generatedAt: '',
        generatedBy,
      });
      cards.push(card);

      await this.events.publish({
        type: 'school.reportcard.generated',
        tenantId,
        occurredAt: new Date().toISOString(),
        data: {
          report_card_id: card.id,
          student_id: studentId,
          template_id: template.id,
          session,
        },
      });
    }

    return { cards };
  }

  async listReportCards(
    tenantId: string,
    filters: { studentId?: string; session?: string },
  ): Promise<{ cards: ReportCard[] }> {
    return { cards: await this.repo.listReportCards(tenantId, filters) };
  }

  async getReportCard(
    tenantId: string,
    id: string,
  ): Promise<{ card?: ReportCard; error?: ServiceError }> {
    const card = await this.repo.getReportCard(tenantId, id);
    if (!card) return { error: { error: 'report card not found', status: 404 } };
    return { card };
  }

  /**
   * Idempotent per exam: recompute outcome_performance from published marks
   * for outcome-tagged questions on the linked paper; notify academics infer.
   */
  async runFeedbackForExam(
    tenantId: string,
    examId: string,
  ): Promise<{
    performances?: OutcomePerformance[];
    error?: ServiceError;
  }> {
    const id = (examId || '').trim();
    if (!id) return { error: { error: 'exam_id is required', status: 400 } };
    const exam = await this.repo.getExam(tenantId, id);
    if (!exam) return { error: { error: 'exam not found', status: 404 } };

    const paper = await this.repo.findPaperByExamRef(tenantId, id);
    if (!paper) {
      await this.repo.deleteOutcomePerformanceForExam(tenantId, id);
      return { performances: [] };
    }

    const questions: Question[] = [];
    for (const qid of paper.questionIds) {
      const q = await this.repo.getQuestion(tenantId, qid);
      if (q) questions.push(q);
    }
    const outcomeCodes = [
      ...new Set(
        questions
          .map((q) => q.outcomeCode)
          .filter((c): c is string => c != null && c.trim() !== ''),
      ),
    ].sort();

    await this.repo.deleteOutcomePerformanceForExam(tenantId, id);

    if (outcomeCodes.length === 0) {
      return { performances: [] };
    }

    const marks = await this.repo.listMarksForExam(tenantId, id);
    const pcts: number[] = [];
    for (const m of marks) {
      if (!m.publishedAt) continue;
      if (m.isExempt || m.isAbsent) continue;
      if (m.assignedMarks == null) continue;
      if (exam.maxMarks <= 0) continue;
      pcts.push(round2((m.assignedMarks / exam.maxMarks) * 100));
    }
    const nStudents = pcts.length;
    const meanPct =
      nStudents === 0
        ? 0
        : round2(pcts.reduce((a, b) => a + b, 0) / nStudents);

    const now = new Date().toISOString();
    const performances: OutcomePerformance[] = [];
    for (const outcomeCode of outcomeCodes) {
      const row: OutcomePerformance = {
        tenantId,
        examId: id,
        outcomeCode,
        meanPct,
        nStudents,
        computedAt: now,
      };
      await this.repo.upsertOutcomePerformance(row);
      performances.push(row);
    }

    // Infer assessment delivery for topic_ids carried on outcome-tagged questions
    const topicIds = new Set<string>();
    for (const q of questions) {
      if (!q.outcomeCode) continue;
      const topicId = String(q.body.topic_id ?? q.body.topicId ?? '').trim();
      if (topicId) topicIds.add(topicId);
    }
    for (const topicId of topicIds) {
      await this.academics.inferAssessmentDelivery({
        tenantId,
        topicId,
        sectionRef: exam.sectionRef,
        date: exam.date,
        ref: id,
      });
    }

    return { performances };
  }

  async listWeakOutcomes(
    tenantId: string,
    threshold: number,
    session?: string,
  ): Promise<{ outcomes?: WeakOutcomeRow[]; error?: ServiceError }> {
    const thr = Number(threshold);
    if (!Number.isFinite(thr)) {
      return { error: { error: 'threshold must be a number', status: 400 } };
    }
    const rows = await this.repo.listWeakOutcomePerformance(
      tenantId,
      thr,
      session,
    );
    const byCode = new Map<string, OutcomePerformance[]>();
    for (const row of rows) {
      const list = byCode.get(row.outcomeCode) ?? [];
      list.push(row);
      byCode.set(row.outcomeCode, list);
    }
    const outcomes: WeakOutcomeRow[] = [];
    for (const [outcomeCode, list] of byCode) {
      const meanPct = round2(
        list.reduce((s, r) => s + r.meanPct, 0) / list.length,
      );
      outcomes.push({
        outcomeCode,
        meanPct,
        exams: list.map((r) => ({
          examId: r.examId,
          meanPct: r.meanPct,
          nStudents: r.nStudents,
        })),
      });
    }
    outcomes.sort((a, b) => a.outcomeCode.localeCompare(b.outcomeCode));
    return { outcomes };
  }
}
