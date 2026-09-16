import { Router, Request, Response, NextFunction } from 'express';
import type { AcademicsService } from '../services/academics-service';
import {
  enforceGuardianAccess,
  isGuardianPrincipal,
  resolveInternalSecret,
} from '../internal-auth';
import {
  assertTeacherMemberMatch,
  guardRoutes,
  type Role,
} from '../role-guard';
import { ACADEMICS_ROUTE_POLICIES } from '../route-policies';
import type { TimetableClient } from '../clients/timetable-client';
import type { IdentityClient } from '../clients/identity-client';
import { assertTeacherSectionScope } from '../teacher-scope';
import type {
  CourseBoard,
  CreateCrosswalkInput,
  CreateOutcomeInput,
  CrosswalkRelation,
  LessonBody,
  LessonKind,
  LessonProvenance,
  LessonState,
  OutcomeFramework,
  PatchCourseInput,
  PatchCrosswalkInput,
  PatchLessonInput,
  PatchTopicInput,
  PatchUnitInput,
  UnitOutcomeDepth,
  UnitOutcomeField,
} from '../types';

function staffOf(req: Request) {
  return (
    req as Request & {
      staff?: { ok: true; role: Role; memberId: string };
    }
  ).staff;
}

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createAcademicsRouter(
  service: AcademicsService,
  opts: {
    internalSecret?: string;
    timetable?: TimetableClient;
    identity?: IdentityClient;
  } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts.internalSecret ?? resolveInternalSecret();
  const timetable = opts.timetable;
  const identity = opts.identity;
  guardRoutes(router, ACADEMICS_ROUTE_POLICIES, { internalSecret });
  router.get(
    '/packs',
    asyncHandler(async (_req, res) => {
      res.json({ packs: service.listPackSummaries() });
    }),
  );

  router.get(
    '/packs/:id',
    asyncHandler(async (req, res) => {
      const pack = service.getPack(req.params.id);
      if (!pack) {
        res.status(404).json({ error: 'pack not found' });
        return;
      }
      res.json(pack);
    }),
  );

  router.get(
    '/:tenantId/packs/installed',
    asyncHandler(async (req, res) => {
      const installed = await service.listInstalledPacks(req.params.tenantId);
      res.json({ installed });
    }),
  );

  router.post(
    '/:tenantId/packs/:packId/install',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const classes = Array.isArray(body.classes)
        ? body.classes.map((c) => String(c))
        : undefined;
      const subjects = Array.isArray(body.subjects)
        ? body.subjects.map((s) => String(s))
        : undefined;
      const result = await service.installPack(req.params.tenantId, req.params.packId, {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        installedBy: String(body.installed_by ?? body.installedBy ?? ''),
        classes,
        subjects,
      });
      if (result.error) {
        res.status(result.status ?? 400).json({
          error: result.error,
          ...(result.errors ? { errors: result.errors } : {}),
        });
        return;
      }
      res.status(201).json({
        courses_created: result.courses_created,
        courses_skipped: result.courses_skipped,
        installed_pack_id: result.installed_pack_id,
      });
    }),
  );

  router.post(
    '/:tenantId/syllabus/upload',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const filename = String(body.filename ?? '');
      if (!/\.(xlsx|xls|csv)$/i.test(filename)) {
        res.status(400).json({ error: 'filename must end with .xlsx, .xls, or .csv' });
        return;
      }
      const classes = Array.isArray(body.classes)
        ? body.classes.map((c) => String(c))
        : undefined;
      const importLessonPlans =
        body.import_lesson_plans === undefined && body.importLessonPlans === undefined
          ? undefined
          : body.import_lesson_plans === true ||
            body.importLessonPlans === true ||
            body.import_lesson_plans === 'true' ||
            body.importLessonPlans === 'true'
            ? true
            : body.import_lesson_plans === false ||
                body.importLessonPlans === false ||
                body.import_lesson_plans === 'false' ||
                body.importLessonPlans === 'false'
              ? false
              : undefined;
      const result = await service.uploadSyllabus(req.params.tenantId, {
        contentBase64: String(body.contentBase64 ?? body.content_base64 ?? ''),
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        installedBy: String(body.installed_by ?? body.installedBy ?? ''),
        board: String(body.board ?? ''),
        classes,
        importLessonPlans,
      });
      if (result.error) {
        res.status(result.status ?? 400).json({
          error: result.error,
          ...(result.errors ? { errors: result.errors } : {}),
        });
        return;
      }
      res.status(201).json({
        courses_created: result.courses_created,
        courses_skipped: result.courses_skipped,
        classes_in_file: result.classes_in_file,
        lessons_created: result.lessons_created,
        lessons_skipped: result.lessons_skipped,
        lesson_warnings: result.lesson_warnings,
      });
    }),
  );

  router.get(
    '/:tenantId/outcomes',
    asyncHandler(async (req, res) => {
      const filters = {
        classLabel:
          typeof req.query.class === 'string'
            ? req.query.class
            : typeof req.query.class_label === 'string'
              ? req.query.class_label
              : undefined,
        subjectCode:
          typeof req.query.subject === 'string'
            ? req.query.subject
            : typeof req.query.subject_code === 'string'
              ? req.query.subject_code
              : undefined,
        framework: typeof req.query.framework === 'string' ? req.query.framework : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
      };
      const result = await service.listOutcomes(req.params.tenantId, filters);
      res.json({ outcomes: result.outcomes });
    }),
  );

  router.post(
    '/:tenantId/outcomes',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateOutcomeInput = {
        code: String(body.code ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        subjectCode: String(body.subject_code ?? body.subjectCode ?? ''),
        description: String(body.description ?? ''),
        framework:
          body.framework != null
            ? (String(body.framework) as OutcomeFramework)
            : undefined,
      };
      const result = await service.createOutcome(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.outcome);
    }),
  );

  router.get(
    '/:tenantId/crosswalk',
    asyncHandler(async (req, res) => {
      const result = await service.listCrosswalk(req.params.tenantId);
      res.json({ crosswalk: result.crosswalk });
    }),
  );

  router.post(
    '/:tenantId/crosswalk',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateCrosswalkInput = {
        fromOutcomeId: String(body.from_outcome_id ?? body.fromOutcomeId ?? ''),
        toOutcomeId: String(body.to_outcome_id ?? body.toOutcomeId ?? ''),
        relation: String(body.relation ?? '') as CrosswalkRelation,
        note: body.note != null ? String(body.note) : null,
      };
      const result = await service.createCrosswalk(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.crosswalk);
    }),
  );

  router.patch(
    '/:tenantId/crosswalk/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchCrosswalkInput = {};
      if (body.relation !== undefined) {
        input.relation = String(body.relation) as CrosswalkRelation;
      }
      if (body.note !== undefined) {
        input.note = body.note == null ? null : String(body.note);
      }
      const result = await service.patchCrosswalk(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.crosswalk);
    }),
  );

  router.delete(
    '/:tenantId/crosswalk/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteCrosswalk(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/courses',
    asyncHandler(async (req, res) => {
      const result = await service.listCourses(req.params.tenantId);
      res.json({ courses: result.courses });
    }),
  );

  router.post(
    '/:tenantId/courses',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createCourse(req.params.tenantId, {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        board: String(body.board ?? '') as CourseBoard,
        subjectCode: String(body.subject_code ?? body.subjectCode ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        label: String(body.label ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.course);
    }),
  );

  router.get(
    '/:tenantId/courses/:id/tree',
    asyncHandler(async (req, res) => {
      const result = await service.getCourseTree(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.tree);
    }),
  );

  router.get(
    '/:tenantId/courses/:courseId/coverage',
    asyncHandler(async (req, res) => {
      const sectionRef =
        typeof req.query.section_ref === 'string'
          ? req.query.section_ref
          : typeof req.query.sectionRef === 'string'
            ? req.query.sectionRef
            : '';
      const result = await service.getCourseCoverage(
        req.params.tenantId,
        req.params.courseId,
        sectionRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.coverage);
    }),
  );

  router.post(
    '/:tenantId/courses/:courseId/variance',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const instancesRaw = Array.isArray(body.instances) ? body.instances : [];
      const instances = instancesRaw.map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          id: String(row.id ?? ''),
          week: Number(row.week),
          status: String(row.status ?? ''),
          lostReason:
            row.lost_reason != null || row.lostReason != null
              ? String(row.lost_reason ?? row.lostReason)
              : null,
          date: row.date != null ? String(row.date) : undefined,
        };
      });
      const result = await service.getCourseVariance(
        req.params.tenantId,
        req.params.courseId,
        {
          sectionRef: String(body.section_ref ?? body.sectionRef ?? ''),
          instances,
          targetDate:
            body.target_date != null || body.targetDate != null
              ? String(body.target_date ?? body.targetDate)
              : null,
          asOfDate:
            body.as_of_date != null || body.asOfDate != null
              ? String(body.as_of_date ?? body.asOfDate)
              : null,
        },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.report);
    }),
  );

  router.get(
    '/:tenantId/courses/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getCourse(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.course);
    }),
  );

  router.patch(
    '/:tenantId/courses/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchCourseInput = {};
      if (body.academic_session_id !== undefined || body.academicSessionId !== undefined) {
        input.academicSessionId = String(body.academic_session_id ?? body.academicSessionId);
      }
      if (body.board !== undefined) input.board = String(body.board) as CourseBoard;
      if (body.subject_code !== undefined || body.subjectCode !== undefined) {
        input.subjectCode = String(body.subject_code ?? body.subjectCode);
      }
      if (body.class_label !== undefined || body.classLabel !== undefined) {
        input.classLabel = String(body.class_label ?? body.classLabel);
      }
      if (body.label !== undefined) input.label = String(body.label);
      const result = await service.patchCourse(req.params.tenantId, req.params.id, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.course);
    }),
  );

  router.delete(
    '/:tenantId/courses/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteCourse(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/courses/:courseId/units',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createUnit(req.params.tenantId, req.params.courseId, {
        label: String(body.label ?? ''),
        plannedWeeks: Number(body.planned_weeks ?? body.plannedWeeks),
        plannedStartWeek:
          body.planned_start_week !== undefined || body.plannedStartWeek !== undefined
            ? body.planned_start_week === null || body.plannedStartWeek === null
              ? null
              : Number(body.planned_start_week ?? body.plannedStartWeek)
            : undefined,
        summary: body.summary != null ? String(body.summary) : null,
        sequence:
          body.sequence !== undefined ? Number(body.sequence) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.unit);
    }),
  );

  router.put(
    '/:tenantId/courses/:courseId/units/reorder',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const orderedIds = Array.isArray(body.ordered_ids)
        ? body.ordered_ids.map((x) => String(x))
        : Array.isArray(body.orderedIds)
          ? body.orderedIds.map((x) => String(x))
          : [];
      const result = await service.reorderUnits(
        req.params.tenantId,
        req.params.courseId,
        orderedIds,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ units: result.units });
    }),
  );

  router.patch(
    '/:tenantId/units/:unitId',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchUnitInput = {};
      if (body.label !== undefined) input.label = String(body.label);
      if (body.planned_weeks !== undefined || body.plannedWeeks !== undefined) {
        input.plannedWeeks = Number(body.planned_weeks ?? body.plannedWeeks);
      }
      if (body.planned_start_week !== undefined || body.plannedStartWeek !== undefined) {
        input.plannedStartWeek =
          body.planned_start_week === null || body.plannedStartWeek === null
            ? null
            : Number(body.planned_start_week ?? body.plannedStartWeek);
      }
      if (body.summary !== undefined) {
        input.summary = body.summary == null ? null : String(body.summary);
      }
      const result = await service.patchUnit(
        req.params.tenantId,
        req.params.unitId,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.unit);
    }),
  );

  router.delete(
    '/:tenantId/units/:unitId',
    asyncHandler(async (req, res) => {
      const result = await service.deleteUnit(req.params.tenantId, req.params.unitId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/units/:unitId/topics',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createTopic(req.params.tenantId, req.params.unitId, {
        label: String(body.label ?? ''),
        estimatedPeriods:
          body.estimated_periods !== undefined || body.estimatedPeriods !== undefined
            ? Number(body.estimated_periods ?? body.estimatedPeriods)
            : undefined,
        sequence: body.sequence !== undefined ? Number(body.sequence) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.topic);
    }),
  );

  router.patch(
    '/:tenantId/topics/:topicId',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchTopicInput = {};
      if (body.label !== undefined) input.label = String(body.label);
      if (body.estimated_periods !== undefined || body.estimatedPeriods !== undefined) {
        input.estimatedPeriods = Number(body.estimated_periods ?? body.estimatedPeriods);
      }
      const result = await service.patchTopic(
        req.params.tenantId,
        req.params.topicId,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.topic);
    }),
  );

  router.delete(
    '/:tenantId/topics/:topicId',
    asyncHandler(async (req, res) => {
      const result = await service.deleteTopic(req.params.tenantId, req.params.topicId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/units/:unitId/outcomes',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.tagUnitOutcome(req.params.tenantId, req.params.unitId, {
        outcomeId: String(body.outcome_id ?? body.outcomeId ?? ''),
        field: String(body.field ?? '') as UnitOutcomeField,
        depth:
          body.depth != null ? (String(body.depth) as UnitOutcomeDepth) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.tag);
    }),
  );

  router.delete(
    '/:tenantId/units/:unitId/outcomes/:outcomeId',
    asyncHandler(async (req, res) => {
      const fieldRaw =
        typeof req.query.field === 'string' ? req.query.field : String(req.query.field ?? '');
      const result = await service.untagUnitOutcome(
        req.params.tenantId,
        req.params.unitId,
        req.params.outcomeId,
        fieldRaw as UnitOutcomeField,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/delivery/infer',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.inferDelivery(req.params.tenantId, {
        kind: String(body.kind ?? '') as 'assessment' | 'resource',
        topicId: String(body.topic_id ?? body.topicId ?? ''),
        sectionRef: String(body.section_ref ?? body.sectionRef ?? ''),
        date: String(body.date ?? ''),
        ref: String(body.ref ?? ''),
        teacherMemberId:
          body.teacher_member_id != null || body.teacherMemberId != null
            ? String(body.teacher_member_id ?? body.teacherMemberId)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(result.created ? 201 : 200).json({
        ...result.delivery,
        created: result.created === true,
      });
    }),
  );

  router.post(
    '/:tenantId/delivery',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const teacherMemberId = String(
        body.teacher_member_id ?? body.teacherMemberId ?? '',
      );
      const match = assertTeacherMemberMatch(req, teacherMemberId);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const sectionRef = String(body.section_ref ?? body.sectionRef ?? '');
      if (timetable) {
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.assertDelivery(req.params.tenantId, {
        topicId: String(body.topic_id ?? body.topicId ?? ''),
        periodInstanceId: String(
          body.period_instance_id ?? body.periodInstanceId ?? '',
        ),
        sectionRef,
        date: String(body.date ?? ''),
        teacherMemberId,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.delivery);
    }),
  );

  router.delete(
    '/:tenantId/delivery/:id',
    asyncHandler(async (req, res) => {
      if (timetable) {
        const existing = await service.getDelivery(
          req.params.tenantId,
          req.params.id,
        );
        if (existing.error) {
          res.status(existing.error.status).json({ error: existing.error.error });
          return;
        }
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef: existing.delivery!.sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.deleteDelivery(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/lessons/submit-week',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const teacherMemberId = String(
        body.teacher_member_id ?? body.teacherMemberId ?? '',
      );
      const match = assertTeacherMemberMatch(req, teacherMemberId);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const result = await service.submitWeek(
        req.params.tenantId,
        teacherMemberId,
        String(body.week_start ?? body.weekStart ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ lessons: result.lessons });
    }),
  );

  router.get(
    '/:tenantId/lessons/review-sample',
    asyncHandler(async (req, res) => {
      const weekStart =
        typeof req.query.week_start === 'string'
          ? req.query.week_start
          : typeof req.query.weekStart === 'string'
            ? req.query.weekStart
            : '';
      const pctRaw =
        typeof req.query.pct === 'string' ? req.query.pct : String(req.query.pct ?? '20');
      const result = await service.reviewSample(
        req.params.tenantId,
        weekStart,
        Number.parseFloat(pctRaw),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ lessons: result.lessons });
    }),
  );

  router.get(
    '/:tenantId/lessons/stale',
    asyncHandler(async (req, res) => {
      const daysRaw =
        typeof req.query.days === 'string' ? req.query.days : String(req.query.days ?? '21');
      const result = await service.listStaleLessons(
        req.params.tenantId,
        Number.parseInt(daysRaw, 10),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ lessons: result.lessons });
    }),
  );

  router.post(
    '/:tenantId/lessons',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const teacherMemberId = String(
        body.teacher_member_id ?? body.teacherMemberId ?? '',
      );
      const match = assertTeacherMemberMatch(req, teacherMemberId);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const result = await service.createLesson(req.params.tenantId, {
        courseId: String(body.course_id ?? body.courseId ?? ''),
        unitId: String(body.unit_id ?? body.unitId ?? ''),
        topicId:
          body.topic_id !== undefined || body.topicId !== undefined
            ? body.topic_id === null || body.topicId === null
              ? null
              : String(body.topic_id ?? body.topicId)
            : null,
        teacherMemberId,
        weekStart: String(body.week_start ?? body.weekStart ?? ''),
        title: String(body.title ?? ''),
        body: (body.body as LessonBody) ?? undefined,
        kind: body.kind != null ? (String(body.kind) as LessonKind) : undefined,
        provenance:
          body.provenance != null
            ? (String(body.provenance) as LessonProvenance)
            : undefined,
        outcomeIds: Array.isArray(body.outcome_ids)
          ? body.outcome_ids.map((x) => String(x))
          : Array.isArray(body.outcomeIds)
            ? body.outcomeIds.map((x) => String(x))
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.lesson);
    }),
  );

  router.get(
    '/:tenantId/lessons',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      let teacherMemberId:
        | string
        | undefined =
        typeof req.query.teacher_member_id === 'string'
          ? req.query.teacher_member_id
          : typeof req.query.teacherMemberId === 'string'
            ? req.query.teacherMemberId
            : undefined;
      // Teachers only see their own lessons (P12-04).
      if (staff?.ok && staff.role === 'teacher') {
        teacherMemberId = staff.memberId;
      }
      const result = await service.listLessons(req.params.tenantId, {
        teacherMemberId,
        weekStart:
          typeof req.query.week_start === 'string'
            ? req.query.week_start
            : typeof req.query.weekStart === 'string'
              ? req.query.weekStart
              : undefined,
        state:
          typeof req.query.state === 'string'
            ? (req.query.state as LessonState)
            : undefined,
        courseId:
          typeof req.query.course_id === 'string'
            ? req.query.course_id
            : typeof req.query.courseId === 'string'
              ? req.query.courseId
              : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ lessons: result.lessons });
    }),
  );

  router.get(
    '/:tenantId/lessons/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getLesson(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      const match = assertTeacherMemberMatch(
        req,
        result.lesson!.teacherMemberId,
      );
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      res.json(result.lesson);
    }),
  );

  router.patch(
    '/:tenantId/lessons/:id',
    asyncHandler(async (req, res) => {
      const existing = await service.getLesson(req.params.tenantId, req.params.id);
      if (existing.error) {
        res.status(existing.error.status).json({ error: existing.error.error });
        return;
      }
      const match = assertTeacherMemberMatch(
        req,
        existing.lesson!.teacherMemberId,
      );
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const input: PatchLessonInput = {};
      if (body.title !== undefined) input.title = String(body.title);
      if (body.body !== undefined) input.body = body.body as LessonBody;
      if (body.topic_id !== undefined || body.topicId !== undefined) {
        input.topicId =
          body.topic_id === null || body.topicId === null
            ? null
            : String(body.topic_id ?? body.topicId);
      }
      if (body.kind !== undefined) input.kind = String(body.kind) as LessonKind;
      if (body.provenance !== undefined) {
        input.provenance = String(body.provenance) as LessonProvenance;
      }
      if (body.outcome_ids !== undefined || body.outcomeIds !== undefined) {
        const raw = (body.outcome_ids ?? body.outcomeIds) as unknown[];
        input.outcomeIds = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
      }
      const result = await service.patchLesson(req.params.tenantId, req.params.id, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.lesson);
    }),
  );

  router.post(
    '/:tenantId/lessons/:id/review',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.reviewLesson(req.params.tenantId, req.params.id, {
        decision: String(body.decision ?? '') as 'approved' | 'changes_requested',
        reviewedBy: String(body.reviewed_by ?? body.reviewedBy ?? ''),
        reviewNote:
          body.review_note != null || body.reviewNote != null
            ? String(body.review_note ?? body.reviewNote)
            : null,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.lesson);
    }),
  );

  router.post(
    '/:tenantId/assignments',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const studentIds = Array.isArray(body.student_ids)
        ? body.student_ids.map((x) => String(x))
        : Array.isArray(body.studentIds)
          ? body.studentIds.map((x) => String(x))
          : [];
      const sectionRef = String(body.section_ref ?? body.sectionRef ?? '');
      if (timetable) {
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.createAssignment(req.params.tenantId, {
        courseId: String(body.course_id ?? body.courseId ?? ''),
        sectionRef,
        topicId:
          body.topic_id !== undefined || body.topicId !== undefined
            ? body.topic_id === null || body.topicId === null
              ? null
              : String(body.topic_id ?? body.topicId)
            : null,
        title: String(body.title ?? ''),
        instructions:
          body.instructions != null ? String(body.instructions) : null,
        maxPoints:
          body.max_points !== undefined || body.maxPoints !== undefined
            ? body.max_points === null || body.maxPoints === null
              ? null
              : Number(body.max_points ?? body.maxPoints)
            : null,
        dueAt: String(body.due_at ?? body.dueAt ?? ''),
        assignedBy: String(body.assigned_by ?? body.assignedBy ?? ''),
        attachmentRefs: Array.isArray(body.attachment_refs)
          ? body.attachment_refs.map((x) => String(x))
          : Array.isArray(body.attachmentRefs)
            ? body.attachmentRefs.map((x) => String(x))
            : [],
        studentIds,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({
        assignment: result.assignment,
        submissions: result.submissions,
      });
    }),
  );

  router.get(
    '/:tenantId/assignments',
    asyncHandler(async (req, res) => {
      const sectionRef =
        typeof req.query.section_ref === 'string'
          ? req.query.section_ref
          : typeof req.query.sectionRef === 'string'
            ? req.query.sectionRef
            : '';
      if (!sectionRef) {
        res.status(400).json({ error: 'section_ref is required' });
        return;
      }
      if (timetable) {
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const assignments = await service.listAssignmentsForSection(
        req.params.tenantId,
        sectionRef,
      );
      res.json({ assignments });
    }),
  );

  router.get(
    '/:tenantId/assignments/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getAssignment(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.assignment);
    }),
  );

  router.get(
    '/:tenantId/assignments/:id/submissions',
    asyncHandler(async (req, res) => {
      const result = await service.listSubmissions(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ submissions: result.submissions });
    }),
  );

  router.get(
    '/:tenantId/assignments/:id/stats',
    asyncHandler(async (req, res) => {
      const result = await service.getAssignmentStats(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.stats);
    }),
  );

  router.post(
    '/:tenantId/assignments/:id/sweep-missing',
    asyncHandler(async (req, res) => {
      const result = await service.sweepMissing(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ updated: result.updated });
    }),
  );

  router.post(
    '/:tenantId/submissions/:id/turn-in',
    asyncHandler(async (req, res) => {
      const result = await service.turnInSubmission(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.submission);
    }),
  );

  router.post(
    '/:tenantId/submissions/:id/reclaim',
    asyncHandler(async (req, res) => {
      const result = await service.reclaimSubmission(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.submission);
    }),
  );

  router.patch(
    '/:tenantId/submissions/:id/grade',
    asyncHandler(async (req, res) => {
      if (timetable) {
        const sub = await service.getSubmission(req.params.tenantId, req.params.id);
        if (sub.error) {
          res.status(sub.error.status).json({ error: sub.error.error });
          return;
        }
        const asg = await service.getAssignment(
          req.params.tenantId,
          sub.submission!.assignmentId,
        );
        if (asg.error) {
          res.status(asg.error.status).json({ error: asg.error.error });
          return;
        }
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef: asg.assignment!.sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const result = await service.gradeSubmission(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.submission);
    }),
  );

  router.post(
    '/:tenantId/submissions/:id/return',
    asyncHandler(async (req, res) => {
      if (timetable) {
        const sub = await service.getSubmission(req.params.tenantId, req.params.id);
        if (sub.error) {
          res.status(sub.error.status).json({ error: sub.error.error });
          return;
        }
        const asg = await service.getAssignment(
          req.params.tenantId,
          sub.submission!.assignmentId,
        );
        if (asg.error) {
          res.status(asg.error.status).json({ error: asg.error.error });
          return;
        }
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          sectionRef: asg.assignment!.sectionRef,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const body = req.body as Record<string, unknown>;
      const result = await service.returnSubmission(
        req.params.tenantId,
        req.params.id,
        body.feedback != null ? String(body.feedback) : null,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.submission);
    }),
  );

  router.patch(
    '/:tenantId/submissions/:id/excuse',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const excused =
        body.excused === undefined ? true : Boolean(body.excused);
      const result = await service.setSubmissionExcused(
        req.params.tenantId,
        req.params.id,
        excused,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.submission);
    }),
  );

  router.get(
    '/:tenantId/courses/:id/export',
    asyncHandler(async (req, res) => {
      const result = await service.exportSyllabus(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.export);
    }),
  );

  router.post(
    '/:tenantId/courses/:id/import',
    asyncHandler(async (req, res) => {
      const result = await service.importSyllabus(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.errors ? { errors: result.error.errors } : {}),
        });
        return;
      }
      res.json({ units: result.export?.units ?? [], warnings: result.warnings ?? [] });
    }),
  );

  router.get(
    '/:tenantId/guardian/students/:studentRef/assignments',
    asyncHandler(async (req, res) => {
      if (!isGuardianPrincipal(req)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentRef = req.params.studentRef;
      const gate = enforceGuardianAccess(req, internalSecret, studentRef);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      let sectionRef =
        typeof req.query.section_ref === 'string'
          ? req.query.section_ref
          : typeof req.query.sectionRef === 'string'
            ? req.query.sectionRef
            : '';
      if (!sectionRef) {
        if (!identity) {
          res.status(503).json({ error: 'section_unresolvable' });
          return;
        }
        const section = await identity.getStudentSection(
          req.params.tenantId,
          studentRef,
        );
        if ('error' in section) {
          res.status(section.status).json({ error: section.error });
          return;
        }
        sectionRef = section.sectionRef;
      }
      const result = await service.listAssignmentsForGuardianStudent(
        req.params.tenantId,
        sectionRef,
      );
      res.json({
        assignments: result.assignments,
        section_ref: sectionRef,
      });
    }),
  );

  return router;
}
