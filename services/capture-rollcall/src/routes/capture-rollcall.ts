import { Router, Request, Response, NextFunction } from 'express';
import type { CaptureRollcallService, MarkStatus } from '../capture-rollcall-service';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createCaptureRollcallRouter(service: CaptureRollcallService): Router {
  const router = Router();

  // Route prefix stays /api/school-attendance for existing consumers (P2-00).
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'school-attendance' });
  });

  router.get(
    '/classes',
    asyncHandler(async (_req, res) => {
      res.json({ classes: await service.listClasses() });
    }),
  );

  router.post(
    '/classes',
    asyncHandler(async (req, res) => {
      const name = String((req.body as { name?: string }).name ?? '');
      if (!name.trim()) {
        res.status(400).json({ error: 'name required' });
        return;
      }
      res.json({ class: await service.createClass(name) });
    }),
  );

  router.get(
    '/classes/:classId/roster',
    asyncHandler(async (req, res) => {
      res.json({ roster: await service.roster(req.params.classId) });
    }),
  );

  router.post(
    '/classes/:classId/students',
    asyncHandler(async (req, res) => {
      const body = req.body as { display_name?: string; subject_ref?: string };
      const result = await service.addStudent(
        req.params.classId,
        String(body.display_name ?? ''),
        body.subject_ref,
      );
      res.json(result);
    }),
  );

  router.post(
    '/classes/:classId/periods',
    asyncHandler(async (req, res) => {
      const body = req.body as { label?: string; period_date?: string };
      const result = await service.createPeriod(
        req.params.classId,
        String(body.label ?? 'Period'),
        String(body.period_date ?? new Date().toISOString().slice(0, 10)),
      );
      res.json(result);
    }),
  );

  router.get(
    '/classes/:classId/periods',
    asyncHandler(async (req, res) => {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      res.json({ periods: await service.listPeriods(req.params.classId, date) });
    }),
  );

  router.get(
    '/classes/:classId/offline-bundle',
    asyncHandler(async (req, res) => {
      const date =
        typeof req.query.date === 'string'
          ? req.query.date
          : new Date().toISOString().slice(0, 10);
      res.json(await service.offlineBundle(req.params.classId, date));
    }),
  );

  router.post(
    '/marks',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        period_id?: string;
        subject_ref?: string;
        status?: string;
        source?: string;
        idempotency_key?: string;
      };
      const result = await service.mark({
        periodId: String(body.period_id ?? ''),
        subjectRef: String(body.subject_ref ?? ''),
        status: String(body.status ?? 'present') as MarkStatus,
        source: body.source,
        idempotencyKey: String(body.idempotency_key ?? ''),
      });
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  /** Batch sync from offline queue */
  router.post(
    '/marks/sync',
    asyncHandler(async (req, res) => {
      const body = req.body as {
        marks?: Array<{
          period_id: string;
          subject_ref: string;
          status: MarkStatus;
          idempotency_key: string;
          source?: string;
        }>;
      };
      const marks = body.marks ?? [];
      let applied = 0;
      let replayed = 0;
      for (const m of marks) {
        const r = await service.mark({
          periodId: m.period_id,
          subjectRef: m.subject_ref,
          status: m.status,
          idempotencyKey: m.idempotency_key,
          source: m.source || 'roll_call_offline',
        });
        if (r.replay) replayed++;
        else if (r.success) applied++;
      }
      res.json({ success: true, applied, replayed, pending: 0 });
    }),
  );

  router.get(
    '/periods/:periodId/marks',
    asyncHandler(async (req, res) => {
      res.json({ marks: await service.marksForPeriod(req.params.periodId) });
    }),
  );

  return router;
}

/** @deprecated Use createCaptureRollcallRouter */
export const createSchoolAttendanceRouter = createCaptureRollcallRouter;
