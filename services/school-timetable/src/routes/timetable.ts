import { Router, Request, Response, NextFunction } from 'express';
import type { TimetableService } from '../services/timetable-service';
import {
  enforceGuardianAccess,
  isGuardianPrincipal,
  resolveInternalSecret,
} from '../internal-auth';
import { assertTeacherMemberMatch, guardRoutes } from '../role-guard';
import { TIMETABLE_ROUTE_POLICIES } from '../route-policies';
import type { IdentityClient } from '../clients/identity-client';

import {
  decodeTimetableImportBase64,
  importTimetableFromWorkbook,
} from '../services/timetable-import';
import type {
  CreateAbsenceInput,
  CreateAllocationInput,
  CreateDaySchemeInput,
  CreateExclusionInput,
  CreateSectionInput,
  CreateSubjectInput,
  CreateTermInput,
  DaySchemeKind,
  ExclusionReason,
  ExclusionScope,
  PatchAllocationInput,
  PatchDaySchemeInput,
  PatchExclusionInput,
  PatchPeriodInstanceInput,
  PatchSectionInput,
  PatchSubjectInput,
  PatchTermInput,
  PeriodDef,
  PeriodInstanceStatus,
  PeriodLostReason,
  SlotInput,
} from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function pickPeriods(raw: unknown): PeriodDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const row = p as Record<string, unknown>;
    return {
      index: Number(row.index),
      label: String(row.label ?? ''),
      startTime: String(row.start_time ?? row.startTime ?? ''),
      endTime: String(row.end_time ?? row.endTime ?? ''),
      isTeaching:
        row.is_teaching === 1 ||
        row.is_teaching === true ||
        row.isTeaching === true ||
        row.isTeaching === 1,
    };
  });
}

export function createTimetableRouter(
  service: TimetableService,
  opts: { internalSecret?: string; identity?: IdentityClient } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts?.internalSecret ?? resolveInternalSecret();
  const identity = opts.identity;
  guardRoutes(router, TIMETABLE_ROUTE_POLICIES, { internalSecret });
  router.post(
    '/:tenantId/import',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const filename = String(body.filename ?? '');
      const contentBase64 = String(body.contentBase64 ?? body.content_base64 ?? '');
      const academicSessionId = String(
        body.academic_session_id ?? body.academicSessionId ?? '',
      );
      if (!/\.(xlsx|xls|csv)$/i.test(filename)) {
        res.status(400).json({ error: 'filename must end with .xlsx, .xls, or .csv' });
        return;
      }
      const decoded = decodeTimetableImportBase64(contentBase64);
      if ('error' in decoded) {
        res.status(400).json({ error: decoded.error });
        return;
      }
      const result = await importTimetableFromWorkbook(
        service,
        req.params.tenantId,
        decoded,
        academicSessionId,
      );
      res.json({ success: true, ...result });
    }),
  );

  router.get(
    '/:tenantId/terms',
    asyncHandler(async (req, res) => {
      const terms = await service.listTerms(req.params.tenantId);
      res.json({ terms });
    }),
  );

  router.post(
    '/:tenantId/terms',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateTermInput = {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        label: String(body.label ?? ''),
        startsOn: String(body.starts_on ?? body.startsOn ?? ''),
        endsOn: String(body.ends_on ?? body.endsOn ?? ''),
      };
      const result = await service.createTerm(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.term);
    }),
  );

  router.get(
    '/:tenantId/terms/:id',
    asyncHandler(async (req, res) => {
      const term = await service.getTerm(req.params.tenantId, req.params.id);
      if (!term) {
        res.status(404).json({ error: 'Term not found' });
        return;
      }
      res.json(term);
    }),
  );

  router.patch(
    '/:tenantId/terms/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchTermInput = {};
      if ('academic_session_id' in body || 'academicSessionId' in body) {
        patch.academicSessionId = String(body.academic_session_id ?? body.academicSessionId ?? '');
      }
      if ('label' in body) patch.label = String(body.label ?? '');
      if ('starts_on' in body || 'startsOn' in body) {
        patch.startsOn = String(body.starts_on ?? body.startsOn ?? '');
      }
      if ('ends_on' in body || 'endsOn' in body) {
        patch.endsOn = String(body.ends_on ?? body.endsOn ?? '');
      }
      const result = await service.patchTerm(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.term);
    }),
  );

  router.delete(
    '/:tenantId/terms/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteTerm(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/day-schemes',
    asyncHandler(async (req, res) => {
      const daySchemes = await service.listDaySchemes(req.params.tenantId);
      res.json({ daySchemes });
    }),
  );

  router.post(
    '/:tenantId/day-schemes',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateDaySchemeInput = {
        label: String(body.label ?? ''),
        kind: String(body.kind ?? '') as DaySchemeKind,
        cycleLength:
          body.cycle_length != null || body.cycleLength != null
            ? Number(body.cycle_length ?? body.cycleLength)
            : null,
        periods: pickPeriods(body.periods ?? body.periods_json),
      };
      const result = await service.createDayScheme(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.dayScheme);
    }),
  );

  router.get(
    '/:tenantId/day-schemes/:id',
    asyncHandler(async (req, res) => {
      const dayScheme = await service.getDayScheme(req.params.tenantId, req.params.id);
      if (!dayScheme) {
        res.status(404).json({ error: 'Day scheme not found' });
        return;
      }
      res.json(dayScheme);
    }),
  );

  router.patch(
    '/:tenantId/day-schemes/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchDaySchemeInput = {};
      if ('label' in body) patch.label = String(body.label ?? '');
      if ('kind' in body) patch.kind = String(body.kind ?? '') as DaySchemeKind;
      if ('cycle_length' in body || 'cycleLength' in body) {
        patch.cycleLength =
          body.cycle_length != null || body.cycleLength != null
            ? Number(body.cycle_length ?? body.cycleLength)
            : null;
      }
      if ('periods' in body || 'periods_json' in body) {
        patch.periods = pickPeriods(body.periods ?? body.periods_json);
      }
      const result = await service.patchDayScheme(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.dayScheme);
    }),
  );

  router.delete(
    '/:tenantId/day-schemes/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteDayScheme(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/exclusions',
    asyncHandler(async (req, res) => {
      const result = await service.listExclusions(req.params.tenantId, {
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ exclusions: result.exclusions });
    }),
  );

  router.post(
    '/:tenantId/exclusions',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateExclusionInput = {
        date: String(body.date ?? ''),
        scope: String(body.scope ?? '') as ExclusionScope,
        classLabel:
          body.class_label != null || body.classLabel != null
            ? String(body.class_label ?? body.classLabel)
            : null,
        reason: String(body.reason ?? '') as ExclusionReason,
        label: String(body.label ?? ''),
      };
      const result = await service.createExclusion(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.exclusion);
    }),
  );

  router.get(
    '/:tenantId/exclusions/:id',
    asyncHandler(async (req, res) => {
      const exclusion = await service.getExclusion(req.params.tenantId, req.params.id);
      if (!exclusion) {
        res.status(404).json({ error: 'Exclusion not found' });
        return;
      }
      res.json(exclusion);
    }),
  );

  router.patch(
    '/:tenantId/exclusions/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchExclusionInput = {};
      if ('date' in body) patch.date = String(body.date ?? '');
      if ('scope' in body) patch.scope = String(body.scope ?? '') as ExclusionScope;
      if ('class_label' in body || 'classLabel' in body) {
        patch.classLabel =
          body.class_label != null || body.classLabel != null
            ? String(body.class_label ?? body.classLabel)
            : null;
      }
      if ('reason' in body) patch.reason = String(body.reason ?? '') as ExclusionReason;
      if ('label' in body) patch.label = String(body.label ?? '');
      const result = await service.patchExclusion(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.exclusion);
    }),
  );

  router.delete(
    '/:tenantId/exclusions/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteExclusion(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/sections',
    asyncHandler(async (req, res) => {
      const sections = await service.listSections(req.params.tenantId);
      res.json({ sections });
    }),
  );

  router.post(
    '/:tenantId/sections',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateSectionInput = {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        section: String(body.section ?? ''),
        daySchemeId: String(body.day_scheme_id ?? body.daySchemeId ?? ''),
        classTeacherMemberId:
          body.class_teacher_member_id != null || body.classTeacherMemberId != null
            ? String(body.class_teacher_member_id ?? body.classTeacherMemberId)
            : null,
      };
      const result = await service.createSection(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.section);
    }),
  );

  router.get(
    '/:tenantId/sections/:id',
    asyncHandler(async (req, res) => {
      const section = await service.getSection(req.params.tenantId, req.params.id);
      if (!section) {
        res.status(404).json({ error: 'Section not found' });
        return;
      }
      res.json(section);
    }),
  );

  router.put(
    '/:tenantId/sections/:sectionId/slots',
    asyncHandler(async (req, res) => {
      const body = Array.isArray(req.body) ? req.body : [];
      const inputs: SlotInput[] = body.map((row: Record<string, unknown>) => ({
        dayRef: String(row.day_ref ?? row.dayRef ?? ''),
        periodIndex: Number(row.period_index ?? row.periodIndex),
        allocationId: String(row.allocation_id ?? row.allocationId ?? ''),
      }));
      const result = await service.replaceSectionSlots(
        req.params.tenantId,
        req.params.sectionId,
        inputs,
      );
      if (result.error) {
        const payload: Record<string, unknown> = { error: result.error.error };
        if (result.error.clashes) payload.clashes = result.error.clashes;
        res.status(result.error.status).json(payload);
        return;
      }
      res.json({ slots: result.slots });
    }),
  );

  router.get(
    '/:tenantId/sections/:sectionId/slots',
    asyncHandler(async (req, res) => {
      const result = await service.getSectionSlots(
        req.params.tenantId,
        req.params.sectionId,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ slots: result.slots });
    }),
  );

  router.post(
    '/:tenantId/sections/:sectionId/instances/generate',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.generateSectionInstances(
        req.params.tenantId,
        req.params.sectionId,
        String(body.from ?? ''),
        String(body.to ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.result);
    }),
  );

  router.get(
    '/:tenantId/sections/:sectionId/instances',
    asyncHandler(async (req, res) => {
      const result = await service.listSectionInstances(
        req.params.tenantId,
        req.params.sectionId,
        {
          from: typeof req.query.from === 'string' ? req.query.from : undefined,
          to: typeof req.query.to === 'string' ? req.query.to : undefined,
          status:
            typeof req.query.status === 'string'
              ? (req.query.status as PeriodInstanceStatus)
              : undefined,
        },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ instances: result.instances });
    }),
  );

  router.patch(
    '/:tenantId/instances/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchPeriodInstanceInput = {
        status: String(body.status ?? '') as PeriodInstanceStatus,
        lostReason:
          body.lost_reason != null || body.lostReason != null
            ? (String(body.lost_reason ?? body.lostReason) as PeriodLostReason)
            : undefined,
      };
      const result = await service.patchPeriodInstance(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.instance);
    }),
  );

  router.get(
    '/:tenantId/teachers/:memberId/slots',
    asyncHandler(async (req, res) => {
      const match = assertTeacherMemberMatch(req, req.params.memberId);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const result = await service.getTeacherSlots(
        req.params.tenantId,
        req.params.memberId,
      );
      res.json({ slots: result.slots });
    }),
  );

  router.patch(
    '/:tenantId/sections/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchSectionInput = {};
      if ('academic_session_id' in body || 'academicSessionId' in body) {
        patch.academicSessionId = String(body.academic_session_id ?? body.academicSessionId ?? '');
      }
      if ('class_label' in body || 'classLabel' in body) {
        patch.classLabel = String(body.class_label ?? body.classLabel ?? '');
      }
      if ('section' in body) patch.section = String(body.section ?? '');
      if ('day_scheme_id' in body || 'daySchemeId' in body) {
        patch.daySchemeId = String(body.day_scheme_id ?? body.daySchemeId ?? '');
      }
      if ('class_teacher_member_id' in body || 'classTeacherMemberId' in body) {
        patch.classTeacherMemberId =
          body.class_teacher_member_id != null || body.classTeacherMemberId != null
            ? String(body.class_teacher_member_id ?? body.classTeacherMemberId)
            : null;
      }
      const result = await service.patchSection(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.section);
    }),
  );

  router.delete(
    '/:tenantId/sections/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteSection(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/subjects',
    asyncHandler(async (req, res) => {
      const subjects = await service.listSubjects(req.params.tenantId);
      res.json({ subjects });
    }),
  );

  router.post(
    '/:tenantId/subjects',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateSubjectInput = {
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        isElective: body.is_elective === true || body.isElective === true,
      };
      const result = await service.createSubject(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.subject);
    }),
  );

  router.get(
    '/:tenantId/subjects/:id',
    asyncHandler(async (req, res) => {
      const subject = await service.getSubject(req.params.tenantId, req.params.id);
      if (!subject) {
        res.status(404).json({ error: 'Subject not found' });
        return;
      }
      res.json(subject);
    }),
  );

  router.patch(
    '/:tenantId/subjects/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchSubjectInput = {};
      if ('code' in body) patch.code = String(body.code ?? '');
      if ('label' in body) patch.label = String(body.label ?? '');
      if ('is_elective' in body || 'isElective' in body) {
        patch.isElective = body.is_elective === true || body.isElective === true;
      }
      const result = await service.patchSubject(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.subject);
    }),
  );

  router.delete(
    '/:tenantId/subjects/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteSubject(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/allocations',
    asyncHandler(async (req, res) => {
      const allocations = await service.listAllocations(req.params.tenantId);
      res.json({ allocations });
    }),
  );

  router.post(
    '/:tenantId/allocations',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateAllocationInput = {
        sectionId: String(body.section_id ?? body.sectionId ?? ''),
        subjectId: String(body.subject_id ?? body.subjectId ?? ''),
        teacherMemberId: String(body.teacher_member_id ?? body.teacherMemberId ?? ''),
        periodsPerWeek: Number(body.periods_per_week ?? body.periodsPerWeek ?? 0),
        room: body.room != null ? String(body.room) : null,
      };
      const result = await service.createAllocation(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.allocation);
    }),
  );

  router.get(
    '/:tenantId/allocations/:id',
    asyncHandler(async (req, res) => {
      const allocation = await service.getAllocation(req.params.tenantId, req.params.id);
      if (!allocation) {
        res.status(404).json({ error: 'Allocation not found' });
        return;
      }
      res.json(allocation);
    }),
  );

  router.patch(
    '/:tenantId/allocations/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchAllocationInput = {};
      if ('section_id' in body || 'sectionId' in body) {
        patch.sectionId = String(body.section_id ?? body.sectionId ?? '');
      }
      if ('subject_id' in body || 'subjectId' in body) {
        patch.subjectId = String(body.subject_id ?? body.subjectId ?? '');
      }
      if ('teacher_member_id' in body || 'teacherMemberId' in body) {
        patch.teacherMemberId = String(body.teacher_member_id ?? body.teacherMemberId ?? '');
      }
      if ('periods_per_week' in body || 'periodsPerWeek' in body) {
        patch.periodsPerWeek = Number(body.periods_per_week ?? body.periodsPerWeek ?? 0);
      }
      if ('room' in body) {
        patch.room = body.room != null ? String(body.room) : null;
      }
      const result = await service.patchAllocation(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.allocation);
    }),
  );

  router.delete(
    '/:tenantId/allocations/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteAllocation(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.post(
    '/:tenantId/absences',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      let periodIndexes: number[] | null | undefined;
      if ('period_indexes' in body || 'periodIndexes' in body) {
        const raw = body.period_indexes ?? body.periodIndexes;
        periodIndexes = raw == null ? null : (raw as number[]);
      }
      const teacherMemberId = String(
        body.teacher_member_id ?? body.teacherMemberId ?? '',
      );
      const match = assertTeacherMemberMatch(req, teacherMemberId);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const input: CreateAbsenceInput = {
        teacherMemberId,
        date: String(body.date ?? ''),
        periodIndexes,
        reason: String(body.reason ?? ''),
      };
      const result = await service.createAbsence(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ absence: result.absence, covers: result.covers });
    }),
  );

  router.get(
    '/:tenantId/cover/fairness',
    asyncHandler(async (req, res) => {
      const result = await service.coverFairness(
        req.params.tenantId,
        typeof req.query.from === 'string' ? req.query.from : '',
        typeof req.query.to === 'string' ? req.query.to : '',
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ fairness: result.fairness });
    }),
  );

  router.get(
    '/:tenantId/cover',
    asyncHandler(async (req, res) => {
      const result = await service.listCover(req.params.tenantId, {
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
        state: typeof req.query.state === 'string' ? req.query.state : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ covers: result.covers });
    }),
  );

  router.post(
    '/:tenantId/cover/:id/offer',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.offerCover(
        req.params.tenantId,
        req.params.id,
        String(body.cover_teacher_member_id ?? body.coverTeacherMemberId ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.cover);
    }),
  );

  router.post(
    '/:tenantId/cover/:id/respond',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const accept = body.accept === true;
      const existing = await service.getCover(req.params.tenantId, req.params.id);
      if (existing.error) {
        res.status(existing.error.status).json({ error: existing.error.error });
        return;
      }
      const offered = existing.cover!.coverTeacherMemberId ?? '';
      const match = assertTeacherMemberMatch(req, offered);
      if (!('ok' in match)) {
        res.status(match.status).json({ error: match.error });
        return;
      }
      const result = await service.respondCover(req.params.tenantId, req.params.id, accept);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.cover);
    }),
  );

  router.post(
    '/:tenantId/cover/:id/mark-uncovered',
    asyncHandler(async (req, res) => {
      const result = await service.markCoverUncovered(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ cover: result.cover, instance: result.instance });
    }),
  );

  /** Service→service L5 scope check (P12-05). Internal secret only. */
  router.post(
    '/:tenantId/internal/verify-teacher',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.verifyTeacher(req.params.tenantId, {
        teacherMemberId: String(
          body.teacher_member_id ?? body.teacherMemberId ?? '',
        ),
        periodInstanceId:
          body.period_instance_id != null || body.periodInstanceId != null
            ? String(body.period_instance_id ?? body.periodInstanceId)
            : null,
        sectionRef:
          body.section_ref != null || body.sectionRef != null
            ? String(body.section_ref ?? body.sectionRef)
            : null,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ allowed: result.allowed });
    }),
  );

  router.get(
    '/:tenantId/guardian/students/:studentId/schedule',
    asyncHandler(async (req, res) => {
      if (!isGuardianPrincipal(req)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentId = req.params.studentId;
      const gate = enforceGuardianAccess(req, internalSecret, studentId);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      let sectionRef =
        typeof req.query.section_ref === 'string'
          ? req.query.section_ref.trim()
          : typeof req.query.sectionRef === 'string'
            ? req.query.sectionRef.trim()
            : '';
      if (!sectionRef) {
        if (!identity) {
          res.status(503).json({ error: 'section_unresolvable' });
          return;
        }
        const sectionInfo = await identity.getStudentSection(
          req.params.tenantId,
          studentId,
        );
        if ('error' in sectionInfo) {
          res.status(sectionInfo.status).json({ error: sectionInfo.error });
          return;
        }
        sectionRef = sectionInfo.sectionRef;
      }
      const result = await service.getGuardianStudentSchedule(
        req.params.tenantId,
        sectionRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        section_ref: sectionRef,
        section: result.section,
        slots: result.slots,
      });
    }),
  );

  return router;
}
