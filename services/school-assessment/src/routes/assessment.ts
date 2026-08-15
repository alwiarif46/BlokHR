import { Router, Request, Response, NextFunction } from 'express';
import type { AssessmentService } from '../services/assessment-service';
import type {
  BlueprintBucket,
  ExamKind,
  ExamTermLabel,
  PatchExamInput,
  PatchExamTermInput,
  QuestionKind,
  QuestionProvenance,
} from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createAssessmentRouter(service: AssessmentService): Router {
  const router = Router({ mergeParams: true });

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

  return router;
}
