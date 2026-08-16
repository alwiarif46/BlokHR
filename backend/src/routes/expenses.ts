import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { ExpenseService } from '../services/expense-service';
import type { NotificationDispatcher } from '../services/notification/dispatcher';

export function createExpenseRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new ExpenseService(db, logger, auditService, dispatcher ?? null);

  async function requireAuth(req: Request): Promise<string> {
    const email = req.identity?.email;
    if (!email) throw new AppError('Authentication required', 401);
    return email;
  }

  async function requireAdmin(req: Request): Promise<string> {
    const email = await requireAuth(req);
    const isAdmin = await service.isAdmin(email);
    if (!isAdmin) throw new AppError('Admin access required', 403);
    return email;
  }

  function throwResult(result: { success: boolean; error?: string; statusCode?: number }): never {
    throw new AppError(result.error ?? 'Failed', result.statusCode ?? 400);
  }

  // ── Policies (before :id routes) ──

  router.get(
    '/expense-policies',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAuth(req);
      const policies = await service.listPolicies();
      res.json({ policies });
    }),
  );

  router.put(
    '/expense-policies/:category',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAdmin(req);
      const b = req.body as Record<string, unknown>;
      const result = await service.updatePolicy(
        req.params.category,
        {
          maxAmountPerClaim: b.maxAmountPerClaim as number | undefined,
          monthlyCap: b.monthlyCap as number | undefined,
          requiresReceipt: b.requiresReceipt as boolean | number | undefined,
          active: b.active as boolean | number | undefined,
        },
        actor,
      );
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  // ── List / mine / pending ──

  router.get(
    '/expenses',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req);
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const expenses = await service.listExpenses({ status, category });
      res.json({ expenses });
    }),
  );

  router.get(
    '/expenses/mine',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const expenses = await service.getReceiptsByEmail(email);
      res.json({ expenses });
    }),
  );

  router.get(
    '/expenses/pending-approvals',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAuth(req);
      const expenses = await service.listPendingApprovals();
      res.json({ expenses });
    }),
  );

  // ── Legacy receipt aliases (keep mobile clients working) ──

  router.post(
    '/expenses/receipt',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const b = req.body as Record<string, unknown>;
      const result = await service.createReceipt({
        email,
        fileId: b.fileId as string | null | undefined,
        vendor: b.vendor as string | undefined,
        amount: b.amount as number | undefined,
        currency: b.currency as string | undefined,
        receiptDate: b.receiptDate as string | undefined,
        category: b.category as string | undefined,
        description: b.description as string | undefined,
      });
      if (!result.success) throwResult(result);
      res.status(201).json({ receipt: result.data });
    }),
  );

  router.get(
    '/expenses/receipts',
    asyncHandler(async (req: Request, res: Response) => {
      const status = req.query.status as string | undefined;
      const receipts = await service.listReceipts(status);
      res.json({ receipts });
    }),
  );

  router.get(
    '/expenses/receipts/mine',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const receipts = await service.getReceiptsByEmail(email);
      res.json({ receipts });
    }),
  );

  router.get(
    '/expenses/receipts/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const receipt = await service.getReceiptById(req.params.id);
      if (!receipt) throw new AppError('Receipt not found', 404);
      res.json({ receipt });
    }),
  );

  router.post(
    '/expenses/receipts/:id/submit',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.submitReceipt(req.params.id, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/receipts/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const approver = req.identity?.email ?? '';
      const result = await service.approveReceipt(req.params.id, approver);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/receipts/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const rejector = req.identity?.email ?? '';
      const { reason } = req.body as { reason?: string };
      const result = await service.rejectReceipt(req.params.id, rejector, reason ?? '');
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  // ── Modern CRUD ──

  router.post(
    '/expenses',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const b = req.body as Record<string, unknown>;
      const result = await service.createExpense(
        {
          email: actor,
          fileId: b.fileId as string | null | undefined,
          vendor: b.vendor as string | undefined,
          amount: b.amount as number | undefined,
          currency: b.currency as string | undefined,
          receiptDate: b.receiptDate as string | undefined,
          category: b.category as string | undefined,
          description: b.description as string | undefined,
        },
        actor,
      );
      if (!result.success) throwResult(result);
      res.status(201).json({ expense: result.data });
    }),
  );

  router.get(
    '/expenses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAuth(req);
      const detail = await service.getExpenseById(req.params.id);
      if (!detail) throw new AppError('Expense not found', 404);
      res.json(detail);
    }),
  );

  router.put(
    '/expenses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const isAdmin = await service.isAdmin(actor);
      const result = await service.updateExpense(
        req.params.id,
        req.body as Record<string, unknown>,
        actor,
        isAdmin,
      );
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/expenses/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const isAdmin = await service.isAdmin(actor);
      const result = await service.deleteExpense(req.params.id, actor, isAdmin);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/:id/submit',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const result = await service.submitExpense(req.params.id, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const result = await service.approveExpense(req.params.id, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const { reason } = req.body as { reason?: string };
      const result = await service.rejectExpense(req.params.id, actor, reason ?? '');
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/:id/reimburse',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = await requireAuth(req);
      const result = await service.reimburseExpense(req.params.id, actor);
      if (!result.success) throwResult(result);
      res.json({ success: true });
    }),
  );

  return router;
}
