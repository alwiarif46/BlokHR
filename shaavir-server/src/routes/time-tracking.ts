import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { TimeTrackingRepository } from '../repositories/time-tracking-repository';
import { TimeTrackingService } from '../services/time-tracking-service';

/**
 * Time Tracking routes (billable/non-billable + project time logging):
 *
 *   Clients:  GET /api/clients, POST /api/clients, PUT /api/clients/:id
 *   Projects: GET /api/projects, POST /api/projects, PUT /api/projects/:id
 *   Entries:  GET /api/time-entries, POST /api/time-entries, PUT /api/time-entries/:id,
 *             DELETE /api/time-entries/:id, POST /api/time-entries/:id/approve
 *   Summary:  GET /api/time-summary
 */
export function createTimeTrackingRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new TimeTrackingRepository(db);
  const service = new TimeTrackingService(repo, logger);

  // ── Clients ──

  router.get(
    '/clients',
    asyncHandler(async (_req: Request, res: Response) => {
      const clients = await service.getClients();
      res.json({ clients });
    }),
  );

  router.post(
    '/clients',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createClient({
        id: (body.id as string) ?? '',
        name: (body.name as string) ?? '',
        code: body.code as string | undefined,
        billingRate: body.billingRate as number | undefined,
        currency: body.currency as string | undefined,
        contactName: body.contactName as string | undefined,
        contactEmail: body.contactEmail as string | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.put(
    '/clients/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.updateClient(req.params.id, req.body as Record<string, unknown>);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  // ── Projects ──

  router.get(
    '/projects',
    asyncHandler(async (req: Request, res: Response) => {
      const clientId = req.query.clientId as string | undefined;
      const projects = await service.getProjects(clientId);
      res.json({ projects });
    }),
  );

  router.post(
    '/projects',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createProject({
        id: (body.id as string) ?? '',
        clientId: (body.clientId as string) ?? '',
        name: (body.name as string) ?? '',
        code: body.code as string | undefined,
        billable: body.billable as boolean | undefined,
        billingRate: body.billingRate as number | undefined,
        budgetHours: body.budgetHours as number | undefined,
        budgetAmount: body.budgetAmount as number | undefined,
        startDate: body.startDate as string | undefined,
        endDate: body.endDate as string | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.put(
    '/projects/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.updateProject(
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  // ── Time entries ──

  router.get(
    '/time-entries',
    asyncHandler(async (req: Request, res: Response) => {
      const entries = await service.getEntries({
        email: req.query.email as string | undefined,
        projectId: req.query.projectId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        billable:
          req.query.billable === 'true' ? true : req.query.billable === 'false' ? false : undefined,
      });
      res.json({ entries });
    }),
  );

  router.post(
    '/time-entries',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = (body.email as string) ?? req.identity?.email ?? '';
      const result = await service.logTime({
        email,
        projectId: (body.projectId as string) ?? '',
        date: (body.date as string) ?? '',
        hours: (body.hours as number) ?? 0,
        description: body.description as string | undefined,
        billable: body.billable as boolean | undefined,
        billingRate: body.billingRate as number | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.put(
    '/time-entries/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid entry ID', 400);
      const result = await service.updateEntry(id, req.body as Record<string, unknown>);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.delete(
    '/time-entries/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid entry ID', 400);
      const result = await service.deleteEntry(id);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.post(
    '/time-entries/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid entry ID', 400);
      const approver =
        req.identity?.email ?? (req.body as { approverEmail?: string }).approverEmail ?? '';
      const result = await service.approveEntry(id, approver);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  // ── Summary ──

  router.get(
    '/time-summary',
    asyncHandler(async (req: Request, res: Response) => {
      const summary = await service.getSummary({
        email: req.query.email as string | undefined,
        projectId: req.query.projectId as string | undefined,
        clientId: req.query.clientId as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      res.json(summary);
    }),
  );

  return router;
}
