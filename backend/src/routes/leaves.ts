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
      const { personName, leaveType, kind, startDate, endDate, reason } = req.body as {
        personName?: string;
        leaveType?: string;
        kind?: string;
        startDate?: string;
        endDate?: string;
        reason?: string;
      };

      const personEmail = req.identity?.email;

      if (!personEmail) {
        throw new AppError('Authentication required', 401);
      }

      if (!leaveType || !startDate || !endDate) {
        throw new AppError('leaveType, startDate, and endDate are required', 400);
      }

      const result = await service.submit({
        personName: personName ?? req.identity?.name ?? personEmail,
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

      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const targetEmail = email.toLowerCase().trim();

      if (callerEmail.toLowerCase() !== targetEmail) {
        const isAdmin = await repo.isAdmin(callerEmail);
        const member = await repo.getMemberForLeave(targetEmail);
        if (!isAdmin && member?.reports_to?.toLowerCase() !== callerEmail.toLowerCase()) {
          throw new AppError('Unauthorized to view these leaves', 403);
        }
      }

      const leaves = await service.getLeaves(targetEmail);
      res.json({ leaves });
    }),
  );

  /** POST /api/leave-approve (manager tier) */
  router.post(
    '/leave-approve',
    asyncHandler(async (req: Request, res: Response) => {
      const { leaveId } = req.body as { leaveId?: string };
      if (!leaveId) throw new AppError('leaveId is required', 400);

      const approverEmail = req.identity?.email;
      if (!approverEmail) throw new AppError('Authentication required', 401);

      const result = await service.managerApprove(leaveId, approverEmail);

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
      const { leaveId } = req.body as { leaveId?: string };
      if (!leaveId) throw new AppError('leaveId is required', 400);

      const approverEmail = req.identity?.email;
      if (!approverEmail) throw new AppError('Authentication required', 401);

      const result = await service.hrApprove(leaveId, approverEmail);

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
      const { leaveId, reason } = req.body as { leaveId?: string; reason?: string };
      if (!leaveId) throw new AppError('leaveId is required', 400);

      const approverEmail = req.identity?.email;
      if (!approverEmail) throw new AppError('Authentication required', 401);

      const result = await service.reject(leaveId, approverEmail, reason ?? '');

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
      const { leaveId, asAdmin } = req.body as {
        leaveId?: string;
        asAdmin?: boolean;
      };

      if (!leaveId) throw new AppError('leaveId is required', 400);

      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      let cancelledBy: string | undefined = callerEmail;

      if (asAdmin) {
        const admin = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
          callerEmail,
        ]);
        if (!admin) {
          throw new AppError('Only admins can hard-delete leaves', 403);
        }
        cancelledBy = undefined; // Trigger hard-delete in service
      }

      const result = await service.deleteOrCancel(leaveId, cancelledBy, callerEmail);

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

      const callerEmail = req.identity?.email;
      if (!callerEmail) throw new AppError('Authentication required', 401);

      const targetEmail = email.toLowerCase().trim();

      if (callerEmail.toLowerCase() !== targetEmail) {
        const isAdmin = await repo.isAdmin(callerEmail);
        const member = await repo.getMemberForLeave(targetEmail);
        if (!isAdmin && member?.reports_to?.toLowerCase() !== callerEmail.toLowerCase()) {
          throw new AppError('Unauthorized to view this PTO balance', 403);
        }
      }

      const balance = await service.getPtoBalance(targetEmail);
      res.json(balance);
    }),
  );

  return router;
}
