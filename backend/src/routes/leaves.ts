import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { LeaveRepository } from '../repositories/leave-repository';
import { LeaveService } from '../services/leave-service';
import type { LeaveNotificationService } from '../services/leave-notifications';

/**
 * Leave routes:
 *   POST /api/leave-submit      — submit a leave request
 *   GET  /api/leaves             — get leaves for an employee
 *   POST /api/leave-approve      — manager approves
 *   POST /api/leave-hr-approve   — HR approves
 *   POST /api/leave-reject       — reject
 *   POST /api/leave-delete       — delete or cancel
 *   GET  /api/pto-balance        — get PTO balance
 */
export function createLeaveRouter(
  db: DatabaseEngine,
  logger: Logger,
  notifier?: LeaveNotificationService,
): Router {
  const router = Router();
  const repo = new LeaveRepository(db);
  const service = new LeaveService(repo, logger, notifier);

  /** POST /api/leave-submit */
  router.post(
    '/leave-submit',
    asyncHandler(async (req: Request, res: Response) => {
      const { personName, personEmail, leaveType, kind, startDate, endDate, reason } = req.body as {
        personName?: string;
        personEmail?: string;
        leaveType?: string;
        kind?: string;
        startDate?: string;
        endDate?: string;
        reason?: string;
      };

      if (!personEmail || !leaveType || !startDate || !endDate) {
        throw new AppError('personEmail, leaveType, startDate, and endDate are required', 400);
      }

      const result = await service.submit({
        personName: personName ?? personEmail,
        personEmail: personEmail.toLowerCase().trim(),
        leaveType,
        kind: kind ?? 'FullDay',
        startDate,
        endDate,
        reason: reason ?? '',
      });

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to submit leave', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/leaves?email= */
  router.get(
    '/leaves',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) {
        throw new AppError('email query parameter required', 400);
      }

      const leaves = await service.getLeaves(email.toLowerCase().trim());
      res.json({ leaves });
    }),
  );

  /** POST /api/leave-approve (manager tier) */
  router.post(
    '/leave-approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveId, approverEmail } = req.body as {
        leaveId?: string;
        approverEmail?: string;
      };

      if (!leaveId) throw new AppError('leaveId is required', 400);

      const result = await service.managerApprove(
        leaveId,
        approverEmail ?? req.identity?.email ?? '',
      );

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to approve leave', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/leave-hr-approve (HR tier) */
  router.post(
    '/leave-hr-approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveId, approverEmail } = req.body as {
        leaveId?: string;
        approverEmail?: string;
      };

      if (!leaveId) throw new AppError('leaveId is required', 400);

      const result = await service.hrApprove(leaveId, approverEmail ?? req.identity?.email ?? '');

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to HR-approve leave', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/leave-reject */
  router.post(
    '/leave-reject',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveId, approverEmail, reason } = req.body as {
        leaveId?: string;
        approverEmail?: string;
        reason?: string;
      };

      if (!leaveId) throw new AppError('leaveId is required', 400);

      const result = await service.reject(
        leaveId,
        approverEmail ?? req.identity?.email ?? '',
        reason ?? '',
      );

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to reject leave', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/leave-delete */
  router.post(
    '/leave-delete',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveId, cancelledBy } = req.body as {
        leaveId?: string;
        cancelledBy?: string;
      };

      if (!leaveId) throw new AppError('leaveId is required', 400);

      const result = await service.deleteOrCancel(leaveId, cancelledBy);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to delete leave', 400);
      }
      res.json(result);
    }),
  );

  /** GET /api/pto-balance?email= */
  router.get(
    '/pto-balance',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.query.email as string | undefined;
      if (!email) {
        throw new AppError('email query parameter required', 400);
      }

      const balance = await service.getPtoBalance(email.toLowerCase().trim());
      res.json(balance);
    }),
  );

  return router;
}
