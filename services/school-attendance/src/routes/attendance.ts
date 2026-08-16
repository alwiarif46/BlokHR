import { Router, Request, Response, NextFunction } from 'express';
import type { AttendanceService } from '../services/attendance-service';
import type {
  AttendanceExcuse,
  AttendanceGranularity,
  AttendanceStatus,
  CaptureDecision,
  CaptureModality,
  CaptureSubjectType,
  CreateCaptureBindingInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  CreateReasonCodeInput,
  CreateReportedAbsenceInput,
  DayDerivation,
  DecideLeaveInput,
  MarkBatchInput,
  MarkItem,
  NudgeRunInput,
  PatchLeaveTypeInput,
  PatchReasonCodeInput,
  PatchRecordInput,
  ReasonBucket,
  RegularizeInput,
  ReportedAbsenceChannel,
  SessionPart,
  StaffAttendanceSource,
  StaffAttendanceStatus,
  StaffBulkMarkInput,
  StaffCheckDirection,
  StaffCheckInput,
  StaffMarkItem,
  UpsertAttendanceSettingsInput,
  UpsertNudgeConfigInput,
} from '../types';
import { enforceGuardianAccess, isGuardianPrincipal } from '../internal-auth';
import { guardRoutes } from '../role-guard';
import { ATTENDANCE_ROUTE_POLICIES } from '../route-policies';
import type { TimetableClient } from '../clients/timetable-client';
import { assertTeacherSectionScope } from '../teacher-scope';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createAttendanceRouter(
  service: AttendanceService,
  opts: { internalSecret?: string; timetable?: TimetableClient } = {},
): Router {
  const internalSecret = opts.internalSecret ?? '';
  const router = Router({ mergeParams: true });
  const timetable = opts.timetable;

  guardRoutes(router, ATTENDANCE_ROUTE_POLICIES, { internalSecret });

  router.get(
    '/:tenantId/reason-codes',
    asyncHandler(async (req, res) => {
      const reasonCodes = await service.listReasonCodes(req.params.tenantId);
      res.json({ reasonCodes });
    }),
  );

  router.post(
    '/:tenantId/reason-codes',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateReasonCodeInput = {
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        bucket: String(body.bucket ?? '') as ReasonBucket,
        isActive:
          body.is_active === undefined && body.isActive === undefined
            ? undefined
            : body.is_active === true || body.isActive === true,
        sort: body.sort != null ? Number(body.sort) : undefined,
      };
      const result = await service.createReasonCode(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.reasonCode);
    }),
  );

  router.patch(
    '/:tenantId/reason-codes/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: PatchReasonCodeInput = {};
      if ('code' in body) patch.code = String(body.code ?? '');
      if ('label' in body) patch.label = String(body.label ?? '');
      if ('bucket' in body) patch.bucket = String(body.bucket ?? '') as ReasonBucket;
      if ('is_active' in body || 'isActive' in body) {
        patch.isActive = body.is_active === true || body.isActive === true;
      }
      if ('sort' in body) patch.sort = Number(body.sort);
      const result = await service.patchReasonCode(
        req.params.tenantId,
        req.params.id,
        patch,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.reasonCode);
    }),
  );

  router.get(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const settings = await service.getSettings(req.params.tenantId);
      res.json(settings);
    }),
  );

  router.put(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: UpsertAttendanceSettingsInput = {};
      if ('granularity' in body) {
        input.granularity = String(body.granularity) as AttendanceGranularity;
      }
      if ('edit_window_minutes' in body || 'editWindowMinutes' in body) {
        input.editWindowMinutes = Number(
          body.edit_window_minutes ?? body.editWindowMinutes,
        );
      }
      if ('late_threshold_minutes' in body || 'lateThresholdMinutes' in body) {
        input.lateThresholdMinutes = Number(
          body.late_threshold_minutes ?? body.lateThresholdMinutes,
        );
      }
      if ('half_day_min_minutes' in body || 'halfDayMinMinutes' in body) {
        input.halfDayMinMinutes = Number(
          body.half_day_min_minutes ?? body.halfDayMinMinutes,
        );
      }
      if ('day_derivation' in body || 'dayDerivation' in body) {
        input.dayDerivation = String(
          body.day_derivation ?? body.dayDerivation,
        ) as DayDerivation;
      }
      const result = await service.putSettings(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.settings);
    }),
  );

  router.post(
    '/:tenantId/mark',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const context = (body.context ?? {}) as Record<string, unknown>;
      const marksRaw = Array.isArray(body.marks) ? body.marks : [];
      const marks: MarkItem[] = marksRaw.map((m) => {
        const row = m as Record<string, unknown>;
        return {
          studentId: String(row.student_id ?? row.studentId ?? ''),
          status: String(row.status ?? '') as AttendanceStatus,
          excuse:
            row.excuse != null ? (String(row.excuse) as AttendanceExcuse) : undefined,
          reasonCodeId:
            row.reason_code_id != null || row.reasonCodeId != null
              ? String(row.reason_code_id ?? row.reasonCodeId)
              : null,
          lateMinutes:
            row.late_minutes != null || row.lateMinutes != null
              ? Number(row.late_minutes ?? row.lateMinutes)
              : null,
        };
      });
      const periodInstanceId =
        context.period_instance_id != null || context.periodInstanceId != null
          ? String(context.period_instance_id ?? context.periodInstanceId)
          : null;
      if (timetable) {
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          periodInstanceId,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const input: MarkBatchInput = {
        context: {
          date: String(context.date ?? ''),
          periodInstanceId,
          sessionPart:
            context.session_part != null || context.sessionPart != null
              ? (String(context.session_part ?? context.sessionPart) as SessionPart)
              : null,
        },
        marks,
        markedBy: String(body.marked_by ?? body.markedBy ?? ''),
        idempotencyKey: String(body.idempotency_key ?? body.idempotencyKey ?? ''),
      };
      const result = await service.markBatch(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(result.replayed ? 200 : 200).json({
        records: result.records,
        replayed: result.replayed === true,
      });
    }),
  );

  router.patch(
    '/:tenantId/records/:id',
    asyncHandler(async (req, res) => {
      if (timetable) {
        const existing = await service.getRecord(req.params.tenantId, req.params.id);
        if (existing.error) {
          res.status(existing.error.status).json({ error: existing.error.error });
          return;
        }
        const scope = await assertTeacherSectionScope(req, timetable, {
          tenantId: req.params.tenantId,
          periodInstanceId: existing.record!.periodInstanceId,
        });
        if (!('ok' in scope)) {
          res.status(scope.status).json({ error: scope.error });
          return;
        }
      }
      const body = req.body as Record<string, unknown>;
      const input: PatchRecordInput = {
        actor: String(body.actor ?? body.marked_by ?? body.markedBy ?? 'editor'),
      };
      if ('status' in body) input.status = String(body.status) as AttendanceStatus;
      if ('excuse' in body) input.excuse = String(body.excuse) as AttendanceExcuse;
      if ('reason_code_id' in body || 'reasonCodeId' in body) {
        input.reasonCodeId =
          body.reason_code_id != null || body.reasonCodeId != null
            ? String(body.reason_code_id ?? body.reasonCodeId)
            : null;
      }
      if ('late_minutes' in body || 'lateMinutes' in body) {
        input.lateMinutes = Number(body.late_minutes ?? body.lateMinutes);
      }
      const result = await service.patchRecord(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        const payload: Record<string, unknown> = { error: result.error.error };
        if (result.error.regularization_required) {
          payload.regularization_required = true;
        }
        res.status(result.error.status).json(payload);
        return;
      }
      res.json(result.record);
    }),
  );

  router.post(
    '/:tenantId/records/:id/regularize',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: RegularizeInput = {
        newStatus: String(body.new_status ?? body.newStatus ?? '') as AttendanceStatus,
        newExcuse: String(body.new_excuse ?? body.newExcuse ?? '') as AttendanceExcuse,
        reasonCodeId: String(body.reason_code_id ?? body.reasonCodeId ?? ''),
        approvedBy: String(body.approved_by ?? body.approvedBy ?? ''),
        note: body.note != null ? String(body.note) : undefined,
      };
      const result = await service.regularizeRecord(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.record);
    }),
  );

  router.get(
    '/:tenantId/register',
    asyncHandler(async (req, res) => {
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const rawIds =
        typeof req.query.student_ids === 'string'
          ? req.query.student_ids
          : typeof req.query.studentIds === 'string'
            ? req.query.studentIds
            : '';
      const studentIds = rawIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await service.getRegister(req.params.tenantId, date, studentIds);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        date: result.date,
        section: typeof req.query.section === 'string' ? req.query.section : undefined,
        register: result.register,
      });
    }),
  );

  router.post(
    '/:tenantId/bindings',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateCaptureBindingInput = {
        subjectType: String(body.subject_type ?? body.subjectType ?? '') as CaptureSubjectType,
        subjectId: String(body.subject_id ?? body.subjectId ?? ''),
        modality: String(body.modality ?? '') as CaptureModality,
        payloadB64: String(body.payload_b64 ?? body.payloadB64 ?? ''),
      };
      const result = await service.createBinding(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.binding);
    }),
  );

  router.post(
    '/:tenantId/bindings/:id/deactivate',
    asyncHandler(async (req, res) => {
      const result = await service.deactivateBinding(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.binding);
    }),
  );

  router.post(
    '/:tenantId/capture',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const context = (body.context ?? {}) as Record<string, unknown>;
      const result = await service.capture(req.params.tenantId, {
        modality: String(body.modality ?? '') as CaptureModality,
        payloadB64: String(body.payload_b64 ?? body.payloadB64 ?? ''),
        deviceId: String(body.device_id ?? body.deviceId ?? ''),
        context: {
          date: String(context.date ?? ''),
          gate:
            context.gate != null ? String(context.gate) : null,
          periodInstanceId:
            context.period_instance_id != null || context.periodInstanceId != null
              ? String(context.period_instance_id ?? context.periodInstanceId)
              : null,
        },
        idempotencyKey: String(body.idempotency_key ?? body.idempotencyKey ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(200).json({
        event: result.event,
        record: result.record ?? null,
        replayed: result.replayed === true,
      });
    }),
  );

  router.get(
    '/:tenantId/capture-events',
    asyncHandler(async (req, res) => {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      const decision =
        typeof req.query.decision === 'string'
          ? (req.query.decision as CaptureDecision)
          : undefined;
      const result = await service.listCaptureEvents(req.params.tenantId, {
        date,
        decision,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ events: result.events });
    }),
  );

  router.get(
    '/:tenantId/staff/leave/types',
    asyncHandler(async (req, res) => {
      const result = await service.listLeaveTypes(req.params.tenantId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ types: result.types });
    }),
  );

  router.post(
    '/:tenantId/staff/leave/types',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateLeaveTypeInput = {
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        annualQuota: Number(body.annual_quota ?? body.annualQuota),
        carryForward:
          body.carry_forward === true ||
          body.carryForward === true ||
          body.carry_forward === 1,
      };
      const result = await service.createLeaveType(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.type);
    }),
  );

  router.patch(
    '/:tenantId/staff/leave/types/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: PatchLeaveTypeInput = {};
      if (body.label !== undefined) input.label = String(body.label);
      if (body.annual_quota !== undefined || body.annualQuota !== undefined) {
        input.annualQuota = Number(body.annual_quota ?? body.annualQuota);
      }
      if (body.carry_forward !== undefined || body.carryForward !== undefined) {
        input.carryForward =
          body.carry_forward === true ||
          body.carryForward === true ||
          body.carry_forward === 1;
      }
      if (body.is_active !== undefined || body.isActive !== undefined) {
        input.isActive =
          body.is_active === true ||
          body.isActive === true ||
          body.is_active === 1;
      }
      const result = await service.patchLeaveType(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.type);
    }),
  );

  router.get(
    '/:tenantId/staff/leave/balances',
    asyncHandler(async (req, res) => {
      const memberId =
        typeof req.query.member_id === 'string'
          ? req.query.member_id
          : typeof req.query.memberId === 'string'
            ? req.query.memberId
            : '';
      const yearRaw =
        typeof req.query.year === 'string' ? req.query.year : String(req.query.year ?? '');
      const year = Number.parseInt(yearRaw, 10);
      const result = await service.listLeaveBalances(req.params.tenantId, memberId, year);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        balances: (result.balances ?? []).map((b) => ({
          leave_type_id: b.leaveTypeId,
          member_id: b.memberId,
          year: b.year,
          opening: b.opening,
          used: b.used,
          remaining: b.remaining,
          leave_type: b.leaveType
            ? {
                id: b.leaveType.id,
                code: b.leaveType.code,
                label: b.leaveType.label,
              }
            : undefined,
        })),
      });
    }),
  );

  router.get(
    '/:tenantId/staff/leave/requests',
    asyncHandler(async (req, res) => {
      const memberId =
        typeof req.query.member_id === 'string'
          ? req.query.member_id
          : typeof req.query.memberId === 'string'
            ? req.query.memberId
            : undefined;
      const state =
        typeof req.query.state === 'string' ? req.query.state : undefined;
      const yearRaw =
        typeof req.query.year === 'string' ? req.query.year : undefined;
      const year = yearRaw != null ? Number.parseInt(yearRaw, 10) : undefined;
      const result = await service.listLeaveRequests(req.params.tenantId, {
        memberId,
        state,
        year: year != null && Number.isFinite(year) ? year : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ requests: result.requests });
    }),
  );

  router.post(
    '/:tenantId/staff/leave/requests',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: CreateLeaveRequestInput = {
        memberId: String(body.member_id ?? body.memberId ?? ''),
        leaveTypeId: String(body.leave_type_id ?? body.leaveTypeId ?? ''),
        fromDate: String(body.from_date ?? body.fromDate ?? ''),
        toDate: String(body.to_date ?? body.toDate ?? ''),
        isHalfDay:
          body.is_half_day === true ||
          body.isHalfDay === true ||
          body.is_half_day === 1,
        reason: body.reason != null ? String(body.reason) : null,
      };
      const result = await service.createLeaveRequest(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.request);
    }),
  );

  router.post(
    '/:tenantId/staff/leave/requests/:id/decide',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: DecideLeaveInput = {
        decision: String(body.decision ?? '') as 'approved' | 'rejected',
        decidedBy: String(body.decided_by ?? body.decidedBy ?? ''),
        decisionNote:
          body.decision_note != null || body.decisionNote != null
            ? String(body.decision_note ?? body.decisionNote)
            : null,
      };
      const result = await service.decideLeaveRequest(
        req.params.tenantId,
        req.params.id,
        input,
      );
      if (result.error) {
        const payload: Record<string, unknown> = { error: result.error.error };
        if (result.error.remaining !== undefined) {
          payload.remaining = result.error.remaining;
        }
        res.status(result.error.status).json(payload);
        return;
      }
      res.json({
        ...result.request,
        skipped_locked: result.skipped_locked ?? [],
      });
    }),
  );

  router.post(
    '/:tenantId/staff/leave/requests/:id/cancel',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const actor = String(body.actor ?? '');
      const result = await service.cancelLeaveRequest(
        req.params.tenantId,
        req.params.id,
        actor,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        ...result.request,
        kept: result.kept ?? [],
      });
    }),
  );

  router.post(
    '/:tenantId/staff/check',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: StaffCheckInput = {
        memberId: String(body.member_id ?? body.memberId ?? ''),
        direction: String(body.direction ?? '') as StaffCheckDirection,
        at: String(body.at ?? ''),
        source: String(body.source ?? '') as StaffAttendanceSource,
        deviceId:
          body.device_id != null || body.deviceId != null
            ? String(body.device_id ?? body.deviceId)
            : null,
      };
      const result = await service.staffCheck(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.record);
    }),
  );

  router.post(
    '/:tenantId/staff/mark',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const marksRaw = Array.isArray(body.marks) ? body.marks : [];
      const marks: StaffMarkItem[] = marksRaw.map((m) => {
        const row = m as Record<string, unknown>;
        return {
          memberId: String(row.member_id ?? row.memberId ?? ''),
          status: String(row.status ?? '') as StaffAttendanceStatus,
        };
      });
      const input: StaffBulkMarkInput = {
        date: String(body.date ?? ''),
        marks,
        markedBy: String(body.marked_by ?? body.markedBy ?? ''),
      };
      const result = await service.staffBulkMark(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ records: result.records });
    }),
  );

  router.get(
    '/:tenantId/staff',
    asyncHandler(async (req, res) => {
      const month = typeof req.query.month === 'string' ? req.query.month : '';
      const memberId =
        typeof req.query.member_id === 'string'
          ? req.query.member_id
          : typeof req.query.memberId === 'string'
            ? req.query.memberId
            : undefined;
      const result = await service.getStaffMonth(req.params.tenantId, month, memberId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.report);
    }),
  );

  router.post(
    '/:tenantId/staff/finalize',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const month = String(body.month ?? '');
      const finalizedBy =
        body.finalized_by != null || body.finalizedBy != null
          ? String(body.finalized_by ?? body.finalizedBy)
          : undefined;
      const result = await service.finalizeStaffMonth(
        req.params.tenantId,
        month,
        finalizedBy,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.report);
    }),
  );

  router.post(
    '/:tenantId/reported-absences',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const studentId = String(body.student_id ?? body.studentId ?? '');
      const gate = enforceGuardianAccess(req, internalSecret, studentId);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const datesRaw = Array.isArray(body.dates) ? body.dates : [];
      const input: CreateReportedAbsenceInput = {
        studentId,
        reportedByGuardianId: gate.guardianId
          ? gate.guardianId
          : String(
              body.reported_by_guardian_id ?? body.reportedByGuardianId ?? '',
            ),
        dates: datesRaw.map((d) => String(d)),
        reasonCodeId: String(body.reason_code_id ?? body.reasonCodeId ?? ''),
        note: body.note != null ? String(body.note) : null,
        channel: String(body.channel ?? '') as ReportedAbsenceChannel,
      };
      const result = await service.createReportedAbsence(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(result.merged ? 200 : 201).json({
        ...result.reportedAbsence,
        merged: result.merged === true,
      });
    }),
  );

  router.get(
    '/:tenantId/guardian/students/:studentId/summary',
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
      const from = typeof req.query.from === 'string' ? req.query.from : '';
      const to = typeof req.query.to === 'string' ? req.query.to : '';
      const result = await service.getGuardianStudentSummary(
        req.params.tenantId,
        studentId,
        from,
        to,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        records: result.records,
        monthly: result.monthly,
        eligibility_pct: result.eligibility_pct,
      });
    }),
  );

  router.post(
    '/:tenantId/reported-absences/:id/attach',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.attachReportedAbsence(
        req.params.tenantId,
        req.params.id,
        String(body.attachment_ref ?? body.attachmentRef ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.reportedAbsence);
    }),
  );

  router.get(
    '/:tenantId/unexplained',
    asyncHandler(async (req, res) => {
      const date = typeof req.query.date === 'string' ? req.query.date : '';
      const result = await service.listUnexplained(req.params.tenantId, date);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ date: result.date, unexplained: result.unexplained });
    }),
  );

  router.post(
    '/:tenantId/rollups/compute',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const month = String(body.month ?? '');
      const workingDays = Number(body.working_days ?? body.workingDays);
      const result = await service.computeRollups(
        req.params.tenantId,
        month,
        workingDays,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ rollups: result.rollups });
    }),
  );

  router.get(
    '/:tenantId/rollups',
    asyncHandler(async (req, res) => {
      const month = typeof req.query.month === 'string' ? req.query.month : '';
      const result = await service.listRollups(req.params.tenantId, month);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ rollups: result.rollups });
    }),
  );

  router.get(
    '/:tenantId/students/:id/rollups',
    asyncHandler(async (req, res) => {
      const result = await service.listStudentRollups(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ rollups: result.rollups });
    }),
  );

  router.get(
    '/:tenantId/students/:id/eligibility',
    asyncHandler(async (req, res) => {
      const sessionFrom =
        typeof req.query.session_from === 'string'
          ? req.query.session_from
          : typeof req.query.sessionFrom === 'string'
            ? req.query.sessionFrom
            : '';
      const sessionTo =
        typeof req.query.session_to === 'string'
          ? req.query.session_to
          : typeof req.query.sessionTo === 'string'
            ? req.query.sessionTo
            : '';
      const thresholdRaw =
        typeof req.query.threshold === 'string' ? Number(req.query.threshold) : 75;
      const result = await service.getStudentEligibility(
        req.params.tenantId,
        req.params.id,
        sessionFrom,
        sessionTo,
        thresholdRaw,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.eligibility);
    }),
  );

  router.get(
    '/:tenantId/nudge/config',
    asyncHandler(async (req, res) => {
      const config = await service.getNudgeConfig(req.params.tenantId);
      res.json(config);
    }),
  );

  router.put(
    '/:tenantId/nudge/config',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const input: UpsertNudgeConfigInput = {};
      if ('enabled' in body) input.enabled = body.enabled === true;
      if ('at_risk_pct' in body || 'atRiskPct' in body) {
        input.atRiskPct = Number(body.at_risk_pct ?? body.atRiskPct);
      }
      if ('chronic_days' in body || 'chronicDays' in body) {
        input.chronicDays = Number(body.chronic_days ?? body.chronicDays);
      }
      if ('holdout_pct' in body || 'holdoutPct' in body) {
        input.holdoutPct = Number(body.holdout_pct ?? body.holdoutPct);
      }
      if ('max_messages_per_term' in body || 'maxMessagesPerTerm' in body) {
        input.maxMessagesPerTerm = Number(
          body.max_messages_per_term ?? body.maxMessagesPerTerm,
        );
      }
      const result = await service.putNudgeConfig(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.config);
    }),
  );

  router.post(
    '/:tenantId/nudge/run',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const classMapRaw =
        (body.class_map as Record<string, unknown>) ??
        (body.classMap as Record<string, unknown>) ??
        {};
      const classMap: Record<string, string> = {};
      if (classMapRaw && typeof classMapRaw === 'object') {
        for (const [k, v] of Object.entries(classMapRaw)) {
          classMap[k] = String(v);
        }
      }
      const input: NudgeRunInput = {
        asOf: String(body.as_of ?? body.asOf ?? ''),
        classMap,
      };
      const result = await service.runNudge(req.params.tenantId, input);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ sent: result.sent, skipped: result.skipped });
    }),
  );

  router.get(
    '/:tenantId/nudge/report',
    asyncHandler(async (req, res) => {
      const result = await service.getNudgeReport(req.params.tenantId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.report);
    }),
  );

  return router;
}
