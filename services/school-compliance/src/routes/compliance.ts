import { Router, Request, Response, NextFunction } from 'express';
import type { ComplianceService } from '../services/compliance-service';
import type { ExportService } from '../services/export-service';
import type { ApaarService } from '../services/apaar-service';
import type { DsrService } from '../services/dsr-service';
import type { ComplianceStatusState } from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createComplianceRouter(
  service: ComplianceService,
  exports: ExportService,
  apaar: ApaarService,
  dsr: DsrService,
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:tenantId/calendar',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.session === 'string' ? req.query.session : '';
      const today = typeof req.query.today === 'string' ? req.query.today : undefined;
      const result = await service.getCalendar(req.params.tenantId, session, today);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ entries: result.entries });
    }),
  );

  router.get(
    '/:tenantId/overdue',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.session === 'string' ? req.query.session : '';
      const today = typeof req.query.today === 'string' ? req.query.today : undefined;
      const result = await service.listOverdue(req.params.tenantId, session, today);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ entries: result.entries });
    }),
  );

  router.put(
    '/:tenantId/status',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.transitionStatus(req.params.tenantId, {
        itemKey: String(body.item_key ?? body.itemKey ?? ''),
        academicSessionRef: String(
          body.academic_session_ref ?? body.academicSessionRef ?? '',
        ),
        state: String(body.state ?? '') as ComplianceStatusState,
        note:
          body.note !== undefined
            ? body.note == null
              ? null
              : String(body.note)
            : undefined,
        updatedBy: String(body.updated_by ?? body.updatedBy ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.status);
    }),
  );

  router.post(
    '/:tenantId/exports/udise',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await exports.runUdiseExport(req.params.tenantId, {
        sessionRef: String(body.session_ref ?? body.sessionRef ?? ''),
        createdBy: String(body.created_by ?? body.createdBy ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      const status = result.run?.state === 'passed' ? 201 : 200;
      res.status(status).json(result.run);
    }),
  );

  router.get(
    '/:tenantId/exports',
    asyncHandler(async (req, res) => {
      const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
      const result = await exports.listExports(req.params.tenantId, kind);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ runs: result.runs });
    }),
  );

  router.get(
    '/:tenantId/exports/:id',
    asyncHandler(async (req, res) => {
      const result = await exports.getExport(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.run);
    }),
  );

  router.get(
    '/:tenantId/apaar/readiness',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.session === 'string' ? req.query.session : '';
      const result = await apaar.readiness(req.params.tenantId, session, {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        countsByClass: result.countsByClass,
        totals: result.totals,
        students: result.students,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    }),
  );

  router.get(
    '/:tenantId/apaar/fix-list',
    asyncHandler(async (req, res) => {
      const session =
        typeof req.query.session === 'string' ? req.query.session : '';
      const result = await apaar.fixList(req.params.tenantId, session, {
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        students: result.students,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      });
    }),
  );

  router.post(
    '/:tenantId/data-requests/sweep-overdue',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const today =
        typeof body.today === 'string'
          ? body.today
          : typeof req.query.today === 'string'
            ? req.query.today
            : undefined;
      const result = await dsr.sweepOverdue(req.params.tenantId, today);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ emitted: result.emitted });
    }),
  );

  router.post(
    '/:tenantId/data-requests',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const detailsRaw = body.details ?? body.details_json;
      let details: Record<string, unknown> | undefined;
      if (detailsRaw != null) {
        if (typeof detailsRaw === 'string') {
          try {
            details = JSON.parse(detailsRaw) as Record<string, unknown>;
          } catch {
            res.status(400).json({ error: 'details must be an object' });
            return;
          }
        } else if (typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)) {
          details = detailsRaw as Record<string, unknown>;
        } else {
          res.status(400).json({ error: 'details must be an object' });
          return;
        }
      }
      const result = await dsr.create(req.params.tenantId, {
        studentRef: String(body.student_ref ?? body.studentRef ?? ''),
        guardianRef: String(body.guardian_ref ?? body.guardianRef ?? ''),
        kind: String(body.kind ?? ''),
        details,
        createdBy: String(body.created_by ?? body.createdBy ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.request);
    }),
  );

  router.get(
    '/:tenantId/data-requests',
    asyncHandler(async (req, res) => {
      const state =
        typeof req.query.state === 'string' ? req.query.state : undefined;
      const overdue =
        req.query.overdue === 'true' || req.query.overdue === '1';
      const today =
        typeof req.query.today === 'string' ? req.query.today : undefined;
      const result = await dsr.list(req.params.tenantId, {
        state,
        overdue,
        today,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ requests: result.requests });
    }),
  );

  router.get(
    '/:tenantId/data-requests/:id',
    asyncHandler(async (req, res) => {
      const result = await dsr.get(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ request: result.request, audit: result.audit });
    }),
  );

  router.patch(
    '/:tenantId/data-requests/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const detailsRaw = body.details ?? body.details_json;
      let details: Record<string, unknown> | undefined;
      if (detailsRaw != null) {
        if (typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)) {
          details = detailsRaw as Record<string, unknown>;
        } else {
          res.status(400).json({ error: 'details must be an object' });
          return;
        }
      }
      const result = await dsr.transition(req.params.tenantId, req.params.id, {
        state: String(body.state ?? ''),
        resolutionNote:
          body.resolution_note !== undefined || body.resolutionNote !== undefined
            ? String(body.resolution_note ?? body.resolutionNote ?? '')
            : undefined,
        handledBy: String(body.handled_by ?? body.handledBy ?? ''),
        details,
        actor: String(body.actor ?? body.handled_by ?? body.handledBy ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.request);
    }),
  );

  return router;
}
