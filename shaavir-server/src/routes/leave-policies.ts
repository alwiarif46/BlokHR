import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { LeavePolicyRepository } from '../repositories/leave-policy-repository';
import { LeavePolicyService } from '../services/leave-policy-service';

/**
 * Leave Policy admin routes:
 *   GET    /api/leave-policies                    — list active policies
 *   GET    /api/leave-policies/all                — list all (including inactive)
 *   GET    /api/leave-policies/:id                — get one
 *   POST   /api/leave-policies                    — create
 *   PUT    /api/leave-policies/:id                — update
 *   DELETE /api/leave-policies/:id                — soft-delete
 *   GET    /api/leave-types                       — distinct leave type names
 *   GET    /api/leave-clubbing-rules              — list clubbing rules
 *   POST   /api/leave-clubbing-rules              — add clubbing rule
 *   DELETE /api/leave-clubbing-rules              — remove clubbing rule
 */
export function createLeavePolicyRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const repo = new LeavePolicyRepository(db);
  const service = new LeavePolicyService(repo, logger);

  router.get(
    '/leave-policies',
    asyncHandler(async (_req: Request, res: Response) => {
      const policies = await service.getAll();
      res.json({ policies });
    }),
  );

  router.get(
    '/leave-policies/all',
    asyncHandler(async (_req: Request, res: Response) => {
      const policies = await service.getAllAdmin();
      res.json({ policies });
    }),
  );

  router.get(
    '/leave-policies/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid policy ID', 400);
      const policy = await service.getById(id);
      if (!policy) throw new AppError('Policy not found', 404);
      res.json({ policy });
    }),
  );

  router.post(
    '/leave-policies',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.create({
        leaveType: (body.leaveType as string) ?? '',
        memberTypeId: (body.memberTypeId as string) ?? 'fte',
        method: (body.method as string) ?? 'flat',
        config: (body.config as Record<string, unknown>) ?? {},
        maxCarryForward: body.maxCarryForward as number | undefined,
        maxAccumulation: body.maxAccumulation as number | undefined,
        encashable: body.encashable as boolean | undefined,
        encashmentTrigger: body.encashmentTrigger as string | undefined,
        probationMonths: body.probationMonths as number | undefined,
        probationAccrual: body.probationAccrual as number | undefined,
        probationMode: body.probationMode as string | undefined,
        isPaid: body.isPaid as boolean | undefined,
        requiresApproval: body.requiresApproval as boolean | undefined,
        allowNegative: body.allowNegative as boolean | undefined,
        negativeAction: body.negativeAction as string | undefined,
        maxConsecutiveDays: body.maxConsecutiveDays as number | undefined,
        minNoticeDays: body.minNoticeDays as number | undefined,
        medicalCertDays: body.medicalCertDays as number | undefined,
        allowHalfDay: body.allowHalfDay as boolean | undefined,
        sandwichPolicy: body.sandwichPolicy as string | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed to create policy', 400);
      res.json(result);
    }),
  );

  router.put(
    '/leave-policies/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid policy ID', 400);
      const result = await service.update(id, req.body as Record<string, unknown>);
      if (!result.success) throw new AppError(result.error ?? 'Failed to update policy', 400);
      res.json(result);
    }),
  );

  router.delete(
    '/leave-policies/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) throw new AppError('Invalid policy ID', 400);
      const result = await service.remove(id);
      if (!result.success) throw new AppError(result.error ?? 'Failed to delete policy', 400);
      res.json(result);
    }),
  );

  router.get(
    '/leave-types',
    asyncHandler(async (_req: Request, res: Response) => {
      const types = await service.getLeaveTypes();
      res.json({ types });
    }),
  );

  // ── Clubbing rules ──

  router.get(
    '/leave-clubbing-rules',
    asyncHandler(async (_req: Request, res: Response) => {
      const rules = await service.getClubbingRules();
      res.json({ rules });
    }),
  );

  router.post(
    '/leave-clubbing-rules',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveTypeA, leaveTypeB, gapDays } = req.body as {
        leaveTypeA?: string;
        leaveTypeB?: string;
        gapDays?: number;
      };
      if (!leaveTypeA || !leaveTypeB) throw new AppError('leaveTypeA and leaveTypeB required', 400);
      const result = await service.addClubbingRule(leaveTypeA, leaveTypeB, gapDays ?? 0);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  router.delete(
    '/leave-clubbing-rules',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveTypeA, leaveTypeB } = req.body as {
        leaveTypeA?: string;
        leaveTypeB?: string;
      };
      if (!leaveTypeA || !leaveTypeB) throw new AppError('leaveTypeA and leaveTypeB required', 400);
      const result = await service.removeClubbingRule(leaveTypeA, leaveTypeB);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json(result);
    }),
  );

  return router;
}
