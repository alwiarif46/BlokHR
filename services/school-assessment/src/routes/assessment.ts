import { Router, Request, Response, NextFunction } from 'express';
import type { AssessmentService } from '../services/assessment-service';
import type {
  BoardFormat,
  BlueprintBucket,
  ExamKind,
  ExamTermLabel,
  HpcLevel,
  HpcSource,
  HpcStage,
  PatchExamInput,
  PatchExamTermInput,
  QuestionKind,
  QuestionProvenance,
  ReportBlockDefinition,
} from '../types';
import type { CreateHpcInputPayload } from '../types-hpc';
import { resolveInternalSecret } from '../internal-auth';
import { guardRoutes } from '../role-guard';
import { ASSESSMENT_ROUTE_POLICIES } from '../route-policies';
import type { TimetableClient } from '../clients/timetable-client';
import { assertTeacherSectionScope } from '../teacher-scope';


function parseHpcInputBody(body: Record<string, unknown>): CreateHpcInputPayload {
  return {
    studentId: String(body.student_id ?? body.studentId ?? ''),
    competencyId: String(body.competency_id ?? body.competencyId ?? ''),
    activityRef:
      body.activity_ref !== undefined || body.activityRef !== undefined
        ? body.activity_ref === null || body.activityRef === null
          ? null
          : String(body.activity_ref ?? body.activityRef)
        : null,
    source: String(body.source ?? '') as HpcSource,
    level:
      body.level !== undefined && body.level !== null
        ? (String(body.level) as HpcLevel)
        : null,
    statementsCircled:
      body.statements_circled !== undefined || body.statementsCircled !== undefined
        ? body.statements_circled === null || body.statementsCircled === null
          ? null
          : Number(body.statements_circled ?? body.statementsCircled)
        : null,
    observationalChallenge:
      body.observational_challenge != null || body.observationalChallenge != null
        ? String(body.observational_challenge ?? body.observationalChallenge)
        : null,
    observationalResolution:
      body.observational_resolution != null || body.observationalResolution != null
        ? String(body.observational_resolution ?? body.observationalResolution)
        : null,
    evidenceRef:
      body.evidence_ref !== undefined || body.evidenceRef !== undefined
        ? body.evidence_ref === null || body.evidenceRef === null
          ? null
          : String(body.evidence_ref ?? body.evidenceRef)
        : null,
    academicSessionRef:
      body.academic_session_ref !== undefined || body.academicSessionRef !== undefined
        ? body.academic_session_ref === null || body.academicSessionRef === null
          ? null
          : String(body.academic_session_ref ?? body.academicSessionRef)
        : null,
    recordedBy: String(body.recorded_by ?? body.recordedBy ?? ''),
    at: body.at != null ? String(body.at) : undefined,
  };
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createAssessmentRouter(
  service: AssessmentService,
  opts: { internalSecret?: string; timetable?: TimetableClient } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts.internalSecret ?? resolveInternalSecret();
  const timetable = opts.timetable;
  guardRoutes(router, ASSESSMENT_ROUTE_POLICIES, { internalSecret });
  router.post(
    '/:tenantId/exam-terms',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createExamTerm(req.params.tenantId, {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        label: String(body.label ?? '') as ExamTermLabel,
        startsOn: String(body.starts_on ?? body.startsOn ?? ''),
        endsOn: String(body.ends_on ?? body.endsOn ?? ''),
        weightagePct: Number(body.weightage_pct ?? body.weightagePct),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.term);
    }),
  );

  router.get(
    '/:tenantId/exam-terms',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.academic_session_id === 'string'
          ? req.query.academic_session_id
          : typeof req.query.academicSessionId === 'string'
            ? req.query.academicSessionId
            : undefined;
      const result = await service.listExamTerms(req.params.tenantId, session);
      res.json({ terms: result.terms });
    }),
  );

  router.get(
    '/:tenantId/exam-terms/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getExamTerm(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.term);
    }),
  );

  router.patch(
    '/:tenantId/exam-terms/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchExamTermInput = {};
      if (body.label !== undefined) input.label = String(body.label) as ExamTermLabel;
      if (body.starts_on !== undefined || body.startsOn !== undefined) {
        input.startsOn = String(body.starts_on ?? body.startsOn);
      }
      if (body.ends_on !== undefined || body.endsOn !== undefined) {
        input.endsOn = String(body.ends_on ?? body.endsOn);
      }
      if (body.weightage_pct !== undefined || body.weightagePct !== undefined) {
        input.weightagePct = Number(body.weightage_pct ?? body.weightagePct);
      }
      const result = await service.patchExamTerm(req.params.tenantId, req.params.id, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.term);
    }),
  );

  router.delete(
    '/:tenantId/exam-terms/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteExamTerm(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/exams',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createExam(req.params.tenantId, {
        examTermId: String(body.exam_term_id ?? body.examTermId ?? ''),
        courseRef: String(body.course_ref ?? body.courseRef ?? ''),
        sectionRef: String(body.section_ref ?? body.sectionRef ?? ''),
        subjectCode: String(body.subject_code ?? body.subjectCode ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        date: String(body.date ?? ''),
        maxMarks: Number(body.max_marks ?? body.maxMarks),
        kind: String(body.kind ?? '') as ExamKind,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.exam);
    }),
  );

  router.get(
    '/:tenantId/exams',
    asyncHandler(async (req, res) => {
      const examTermId =
        typeof req.query.exam_term_id === 'string'
          ? req.query.exam_term_id
          : typeof req.query.examTermId === 'string'
            ? req.query.examTermId
            : undefined;
      const result = await service.listExams(req.params.tenantId, examTermId);
      res.json({ exams: result.exams });
    }),
  );

  router.get(
    '/:tenantId/exams/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getExam(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.exam);
    }),
  );

  router.patch(
    '/:tenantId/exams/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchExamInput = {};
      if (body.course_ref !== undefined || body.courseRef !== undefined) {
        input.courseRef = String(body.course_ref ?? body.courseRef);
      }
      if (body.section_ref !== undefined || body.sectionRef !== undefined) {
        input.sectionRef = String(body.section_ref ?? body.sectionRef);
      }
      if (body.subject_code !== undefined || body.subjectCode !== undefined) {
        input.subjectCode = String(body.subject_code ?? body.subjectCode);
      }
      if (body.class_label !== undefined || body.classLabel !== undefined) {
        input.classLabel = String(body.class_label ?? body.classLabel);
      }
      if (body.date !== undefined) input.date = String(body.date);
      if (body.max_marks !== undefined || body.maxMarks !== undefined) {
        input.maxMarks = Number(body.max_marks ?? body.maxMarks);
      }
      if (body.kind !== undefined) input.kind = String(body.kind) as ExamKind;
      const result = await service.patchExam(req.params.tenantId, req.params.id, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.exam);
    }),
  );

  router.delete(
    '/:tenantId/exams/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteExam(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.put(
    '/:tenantId/exams/:examId/marks',
    asyncHandler(async (req, res) => {
      if (timetable) {
        const exam = await service.getExam(req.params.tenantId, req.params.examId);
        if (exam.error) {
          res.status(exam.error.status).json({ error: exam.error.error });
          return;
        }
        // section_ref from stored exam only — ignore any forged body field (P12-05).
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef: exam.exam!.sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.putExamMarks(
        req.params.tenantId,
        req.params.examId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.studentIds ? { student_ids: result.error.studentIds } : {}),
        });
        return;
      }
      res.json({ marks: result.marks });
    }),
  );

  router.get(
    '/:tenantId/exams/:examId/marks',
    asyncHandler(async (req, res) => {
      const result = await service.getExamMarks(req.params.tenantId, req.params.examId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ marks: result.marks, stats: result.stats });
    }),
  );

  router.post(
    '/:tenantId/exams/:examId/publish',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.publishExamMarks(
        req.params.tenantId,
        req.params.examId,
        String(body.published_by ?? body.publishedBy ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.studentIds ? { student_ids: result.error.studentIds } : {}),
        });
        return;
      }
      res.json({ marks: result.marks, count: result.count });
    }),
  );

  router.post(
    '/:tenantId/marks/:id/moderate',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.moderateMark(req.params.tenantId, req.params.id, {
        assignedMarks: Number(body.assigned_marks ?? body.assignedMarks),
        moderatedBy: String(body.moderated_by ?? body.moderatedBy ?? ''),
        reason: String(body.reason ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ mark: result.mark, audit: result.audit });
    }),
  );

  router.post(
    '/:tenantId/questions',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createQuestion(req.params.tenantId, {
        subjectCode: String(body.subject_code ?? body.subjectCode ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        outcomeCode:
          body.outcome_code !== undefined || body.outcomeCode !== undefined
            ? body.outcome_code === null || body.outcomeCode === null
              ? null
              : String(body.outcome_code ?? body.outcomeCode)
            : null,
        kind: String(body.kind ?? '') as QuestionKind,
        competencyStyle: Boolean(body.competency_style ?? body.competencyStyle ?? false),
        marks: Number(body.marks),
        body: (body.body as Record<string, unknown>) ?? {},
        answer:
          body.answer === undefined
            ? null
            : body.answer === null
              ? null
              : (body.answer as Record<string, unknown>),
        provenance:
          body.provenance != null
            ? (String(body.provenance) as QuestionProvenance)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.question);
    }),
  );

  router.get(
    '/:tenantId/questions',
    asyncHandler(async (req, res) => {
      const competencyRaw =
        typeof req.query.competency_style === 'string'
          ? req.query.competency_style
          : typeof req.query.competencyStyle === 'string'
            ? req.query.competencyStyle
            : undefined;
      const result = await service.listQuestions(req.params.tenantId, {
        subjectCode:
          typeof req.query.subject === 'string'
            ? req.query.subject
            : typeof req.query.subject_code === 'string'
              ? req.query.subject_code
              : undefined,
        classLabel:
          typeof req.query.class === 'string'
            ? req.query.class
            : typeof req.query.class_label === 'string'
              ? req.query.class_label
              : undefined,
        kind: typeof req.query.kind === 'string' ? (req.query.kind as QuestionKind) : undefined,
        outcomeCode:
          typeof req.query.outcome === 'string'
            ? req.query.outcome
            : typeof req.query.outcome_code === 'string'
              ? req.query.outcome_code
              : undefined,
        competencyStyle:
          competencyRaw === undefined
            ? undefined
            : competencyRaw === '1' || competencyRaw === 'true',
      });
      res.json({ questions: result.questions });
    }),
  );

  router.get(
    '/:tenantId/questions/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getQuestion(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.question);
    }),
  );

  router.patch(
    '/:tenantId/questions/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.patchQuestion(req.params.tenantId, req.params.id, {
        subjectCode:
          body.subject_code !== undefined || body.subjectCode !== undefined
            ? String(body.subject_code ?? body.subjectCode)
            : undefined,
        classLabel:
          body.class_label !== undefined || body.classLabel !== undefined
            ? String(body.class_label ?? body.classLabel)
            : undefined,
        outcomeCode:
          body.outcome_code !== undefined || body.outcomeCode !== undefined
            ? body.outcome_code === null || body.outcomeCode === null
              ? null
              : String(body.outcome_code ?? body.outcomeCode)
            : undefined,
        kind: body.kind !== undefined ? (String(body.kind) as QuestionKind) : undefined,
        competencyStyle:
          body.competency_style !== undefined || body.competencyStyle !== undefined
            ? Boolean(body.competency_style ?? body.competencyStyle)
            : undefined,
        marks: body.marks !== undefined ? Number(body.marks) : undefined,
        body: body.body !== undefined ? (body.body as Record<string, unknown>) : undefined,
        answer:
          body.answer !== undefined
            ? body.answer === null
              ? null
              : (body.answer as Record<string, unknown>)
            : undefined,
        provenance:
          body.provenance !== undefined
            ? (String(body.provenance) as QuestionProvenance)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.question);
    }),
  );

  router.delete(
    '/:tenantId/questions/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteQuestion(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/questions/analysis',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const raw = Array.isArray(body.results) ? body.results : [];
      const results = raw.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          questionId: String(r.question_id ?? r.questionId ?? ''),
          scores: Array.isArray(r.scores) ? r.scores.map((x) => Number(x)) : [],
          max: Number(r.max),
        };
      });
      const result = service.analyzeQuestionResults(results);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ items: result.items });
    }),
  );

  router.post(
    '/:tenantId/blueprints',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const rulesRaw = Array.isArray(body.rules) ? body.rules : [];
      const result = await service.createBlueprint(req.params.tenantId, {
        label: String(body.label ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        subjectCode: String(body.subject_code ?? body.subjectCode ?? ''),
        totalMarks: Number(body.total_marks ?? body.totalMarks),
        rules: rulesRaw.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            bucket: String(row.bucket ?? '') as BlueprintBucket,
            pct: Number(row.pct),
          };
        }),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.blueprint);
    }),
  );

  router.get(
    '/:tenantId/blueprints/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getBlueprint(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.blueprint);
    }),
  );

  router.post(
    '/:tenantId/papers/check',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const questionIds = Array.isArray(body.question_ids)
        ? body.question_ids.map((x) => String(x))
        : Array.isArray(body.questionIds)
          ? body.questionIds.map((x) => String(x))
          : [];
      const result = await service.checkPaper(
        req.params.tenantId,
        String(body.blueprint_id ?? body.blueprintId ?? ''),
        questionIds,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.report);
    }),
  );

  router.post(
    '/:tenantId/papers',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const questionIds = Array.isArray(body.question_ids)
        ? body.question_ids.map((x) => String(x))
        : Array.isArray(body.questionIds)
          ? body.questionIds.map((x) => String(x))
          : [];
      const result = await service.createPaper(req.params.tenantId, {
        blueprintId: String(body.blueprint_id ?? body.blueprintId ?? ''),
        questionIds,
        examRef:
          body.exam_ref !== undefined || body.examRef !== undefined
            ? body.exam_ref === null || body.examRef === null
              ? null
              : String(body.exam_ref ?? body.examRef)
            : null,
        generatedVariantOf:
          body.generated_variant_of !== undefined || body.generatedVariantOf !== undefined
            ? body.generated_variant_of === null || body.generatedVariantOf === null
              ? null
              : String(body.generated_variant_of ?? body.generatedVariantOf)
            : null,
      });
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.report ? { report: result.error.report } : {}),
        });
        return;
      }
      res.status(201).json(result.paper);
    }),
  );

  router.get(
    '/:tenantId/hpc/competencies',
    asyncHandler(async (req, res) => {
      const stage =
        typeof req.query.stage === 'string' ? (req.query.stage as HpcStage) : undefined;
      const result = await service.listCompetencies(req.params.tenantId, stage);
      res.json({ competencies: result.competencies });
    }),
  );

  router.post(
    '/:tenantId/hpc/inputs/bulk',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const raw = Array.isArray(body.inputs)
        ? body.inputs
        : Array.isArray(body)
          ? body
          : [];
      const payloads = raw.map((row) => parseHpcInputBody(row as Record<string, unknown>));
      if (timetable) {
        for (const payload of payloads) {
          const activityRef = (payload.activityRef ?? '').trim();
          if (!activityRef) {
            // Teacher L5 needs a stored exam/activity; admins skip via role check inside helper.
            const scope = await assertTeacherSectionScope(req, timetable, {
              tenantId: req.params.tenantId,
              sectionRef: '',
            });
            if (!('ok' in scope)) {
              res.status(scope.status).json({ error: scope.error });
              return;
            }
            continue;
          }
          const exam = await service.getExam(req.params.tenantId, activityRef);
          if (exam.error) {
            const scope = await assertTeacherSectionScope(req, timetable, {
              tenantId: req.params.tenantId,
              sectionRef: '',
            });
            if (!('ok' in scope)) {
              res.status(403).json({ error: 'scope_denied' });
              return;
            }
            continue;
          }
          const scope = await assertTeacherSectionScope(req, timetable, {
            tenantId: req.params.tenantId,
            sectionRef: exam.exam!.sectionRef,
          });
          if (!('ok' in scope)) {
            res.status(scope.status).json({ error: scope.error });
            return;
          }
        }
      }
      const result = await service.createHpcInputsBulk(req.params.tenantId, payloads);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ inputs: result.inputs });
    }),
  );

  router.post(
    '/:tenantId/hpc/inputs',
    asyncHandler(async (req, res) => {
      const payload = parseHpcInputBody(req.body as Record<string, unknown>);
      if (timetable) {
        const activityRef = (payload.activityRef ?? '').trim();
        let sectionRef = '';
        if (activityRef) {
          const exam = await service.getExam(req.params.tenantId, activityRef);
          if (!exam.error) sectionRef = exam.exam!.sectionRef;
        }
        // Forged body.section_ref is ignored — only stored exam section counts.
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.createHpcInput(req.params.tenantId, payload);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.input);
    }),
  );

  router.get(
    '/:tenantId/hpc/students/:id/matrix',
    asyncHandler(async (req, res) => {
      const result = await service.getHpcStudentMatrix(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ cells: result.cells });
    }),
  );

  router.get(
    '/:tenantId/hpc/students/:id',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.session === 'string'
          ? req.query.session
          : typeof req.query.academic_session_ref === 'string'
            ? req.query.academic_session_ref
            : undefined;
      const result = await service.getHpcStudentView(
        req.params.tenantId,
        req.params.id,
        session,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ competencies: result.competencies });
    }),
  );

  router.get(
    '/:tenantId/hpc/coverage',
    asyncHandler(async (req, res) => {
      let studentIds: string[] = [];
      const raw = req.query.section_students ?? req.query.sectionStudents;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) studentIds = parsed.map((x) => String(x));
          } catch {
            studentIds = [];
          }
        } else if (trimmed.length > 0) {
          studentIds = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(raw)) {
        studentIds = raw.map((x) => String(x));
      }
      const stage =
        typeof req.query.stage === 'string' ? (req.query.stage as HpcStage) : undefined;
      const result = await service.getHpcCoverage(req.params.tenantId, studentIds, stage);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ coverage: result.coverage });
    }),
  );

  router.post(
    '/:tenantId/templates',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const definition = Array.isArray(body.definition)
        ? (body.definition as ReportBlockDefinition[])
        : [];
      const result = await service.createReportTemplate(req.params.tenantId, {
        label: String(body.label ?? ''),
        boardFormat: String(body.board_format ?? body.boardFormat ?? '') as BoardFormat,
        definition,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.template);
    }),
  );

  router.get(
    '/:tenantId/templates',
    asyncHandler(async (req, res) => {
      const result = await service.listReportTemplates(req.params.tenantId);
      res.json({ templates: result.templates });
    }),
  );

  router.get(
    '/:tenantId/templates/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getReportTemplate(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.template);
    }),
  );

  router.patch(
    '/:tenantId/templates/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.patchReportTemplate(req.params.tenantId, req.params.id, {
        label: body.label !== undefined ? String(body.label) : undefined,
        boardFormat:
          body.board_format !== undefined || body.boardFormat !== undefined
            ? (String(body.board_format ?? body.boardFormat) as BoardFormat)
            : undefined,
        definition: Array.isArray(body.definition)
          ? (body.definition as ReportBlockDefinition[])
          : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.template);
    }),
  );

  router.post(
    '/:tenantId/templates/:id/promote',
    asyncHandler(async (req, res) => {
      const result = await service.promoteReportTemplate(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.template);
    }),
  );

  router.post(
    '/:tenantId/templates/:id/clone',
    asyncHandler(async (req, res) => {
      const result = await service.cloneReportTemplate(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.template);
    }),
  );

  router.post(
    '/:tenantId/report-cards/generate',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const studentsRaw = Array.isArray(body.students) ? body.students : [];
      const result = await service.generateReportCards(req.params.tenantId, {
        templateId: String(body.template_id ?? body.templateId ?? ''),
        session: String(body.session ?? body.academic_session_ref ?? ''),
        generatedBy: String(body.generated_by ?? body.generatedBy ?? ''),
        students: studentsRaw.map((row) => {
          const s = row as Record<string, unknown>;
          return {
            studentId: String(s.student_id ?? s.studentId ?? ''),
            attendance:
              s.attendance != null ? (s.attendance as Record<string, unknown>) : null,
            remarks: s.remarks != null ? String(s.remarks) : null,
          };
        }),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ cards: result.cards });
    }),
  );

  router.get(
    '/:tenantId/report-cards',
    asyncHandler(async (req, res) => {
      const result = await service.listReportCards(req.params.tenantId, {
        studentId:
          typeof req.query.student_id === 'string'
            ? req.query.student_id
            : typeof req.query.studentId === 'string'
              ? req.query.studentId
              : undefined,
        session:
          typeof req.query.session === 'string'
            ? req.query.session
            : typeof req.query.academic_session_ref === 'string'
              ? req.query.academic_session_ref
              : undefined,
      });
      res.json({ cards: result.cards });
    }),
  );

  router.get(
    '/:tenantId/report-cards/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getReportCard(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.card);
    }),
  );

  router.post(
    '/:tenantId/feedback/run',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.runFeedbackForExam(
        req.params.tenantId,
        String(body.exam_id ?? body.examId ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ performances: result.performances });
    }),
  );

  router.get(
    '/:tenantId/outcomes/weak',
    asyncHandler(async (req, res) => {
      const thresholdRaw =
        typeof req.query.threshold === 'string' ? req.query.threshold : '50';
      const session =
        typeof req.query.session === 'string'
          ? req.query.session
          : typeof req.query.academic_session_ref === 'string'
            ? req.query.academic_session_ref
            : undefined;
      const result = await service.listWeakOutcomes(
        req.params.tenantId,
        Number(thresholdRaw),
        session,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ outcomes: result.outcomes });
    }),
  );

  return router;
}
