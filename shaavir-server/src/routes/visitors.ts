import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { VisitorService } from '../services/visitor-service';

export function createVisitorRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new VisitorService(db, logger, auditService);

  router.post(
    '/visitors',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const b = req.body as Record<string, unknown>;
      if (!b.visitorName) throw new AppError('visitorName is required', 400);
      if (!b.hostEmail) throw new AppError('hostEmail is required', 400);
      if (!b.expectedDate) throw new AppError('expectedDate is required', 400);
      const result = await service.registerVisit(
        {
          visitorName: b.visitorName as string,
          visitorCompany: b.visitorCompany as string | undefined,
          visitorEmail: b.visitorEmail as string | undefined,
          visitorPhone: b.visitorPhone as string | undefined,
          hostEmail: (b.hostEmail as string).toLowerCase().trim(),
          purpose: b.purpose as string | undefined,
          expectedDate: b.expectedDate as string,
          expectedTime: b.expectedTime as string | undefined,
          expectedDurationMinutes: b.expectedDurationMinutes as number | undefined,
        },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ visit: result.data });
    }),
  );

  router.get(
    '/visitors',
    asyncHandler(async (req: Request, res: Response) => {
      const hostEmail = req.query.hostEmail as string | undefined;
      const date = req.query.date as string | undefined;
      const status = req.query.status as string | undefined;
      const visits = await service.listVisits({ hostEmail, date, status });
      res.json({ visits });
    }),
  );

  router.get(
    '/visitors/my-expected',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const visits = await service.getMyExpectedVisitors(email);
      res.json({ visits });
    }),
  );

  router.get(
    '/visitors/checked-in-count',
    asyncHandler(async (_req: Request, res: Response) => {
      const count = await service.countCheckedIn();
      res.json({ count });
    }),
  );

  router.get(
    '/visitors/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const visit = await service.getVisitById(req.params.id);
      if (!visit) throw new AppError('Visit not found', 404);
      res.json({ visit });
    }),
  );

  router.post(
    '/visitors/:id/check-in',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { receptionNotes } = req.body as { receptionNotes?: string };
      const result = await service.checkIn(req.params.id, receptionNotes, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/visitors/:id/check-out',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.checkOut(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/visitors/:id/cancel',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.cancelVisit(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/visitors/:id/forms',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { formType, signatureBase64, fileId } = req.body as {
        formType?: string;
        signatureBase64?: string;
        fileId?: string | null;
      };
      const result = await service.addForm(
        req.params.id,
        { formType, signatureBase64, fileId },
        actor,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ form: result.data });
    }),
  );

  router.get(
    '/visitors/:id/forms',
    asyncHandler(async (req: Request, res: Response) => {
      const forms = await service.getFormsByVisit(req.params.id);
      res.json({ forms });
    }),
  );

  return router;
}
