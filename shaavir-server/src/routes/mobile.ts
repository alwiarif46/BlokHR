import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import {
  MobileService,
  generateDeepLink,
  type BatchApprovalItem,
} from '../services/mobile-service';

/**
 * Mobile-native routes:
 *
 * Device tokens:
 *   POST   /api/mobile/devices                — register device for push
 *   GET    /api/mobile/devices                — list my devices
 *   DELETE /api/mobile/devices                — remove a device token
 *
 * Biometric auth:
 *   POST   /api/auth/biometric/register       — register biometric credential
 *   POST   /api/auth/biometric                — authenticate via biometric
 *   GET    /api/auth/biometric/credentials    — list my credentials
 *   DELETE /api/auth/biometric/:credentialId  — remove a credential
 *
 * Location breadcrumbs:
 *   POST   /api/mobile/location               — record a breadcrumb
 *   GET    /api/mobile/location               — get breadcrumbs for an employee
 *   GET    /api/mobile/location/latest         — get latest location
 *   GET    /api/mobile/location/settings       — tracking settings
 *   PUT    /api/mobile/location/settings       — update tracking settings
 *
 * Expense receipts:
 *   POST   /api/expenses/receipt              — create receipt (photo capture + OCR)
 *   GET    /api/expenses/receipts             — list receipts
 *   GET    /api/expenses/receipts/mine        — my receipts
 *   GET    /api/expenses/receipts/:id         — get receipt
 *   POST   /api/expenses/receipts/:id/submit  — submit receipt
 *   POST   /api/expenses/receipts/:id/approve — approve receipt
 *   POST   /api/expenses/receipts/:id/reject  — reject receipt
 *
 * Batch approvals:
 *   POST   /api/approvals/batch               — batch approve/reject
 *
 * Deep links:
 *   GET    /api/mobile/deep-link              — generate deep link
 */
export function createMobileRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new MobileService(db, logger, auditService);

  // ── Device tokens ──

  router.post(
    '/mobile/devices',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { platform, token, appVersion, deviceName } = req.body as {
        platform?: string;
        token?: string;
        appVersion?: string;
        deviceName?: string;
      };
      if (!platform) throw new AppError('platform is required', 400);
      if (!token) throw new AppError('token is required', 400);

      const result = await service.registerDevice({
        email,
        platform,
        token,
        appVersion,
        deviceName,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ device: result.data });
    }),
  );

  router.get(
    '/mobile/devices',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const devices = await service.getDevicesByEmail(email);
      res.json({ devices });
    }),
  );

  router.delete(
    '/mobile/devices',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { token } = req.body as { token?: string };
      if (!token) throw new AppError('token is required', 400);
      await service.removeDevice(email, token);
      res.json({ success: true });
    }),
  );

  // ── Biometric auth ──

  router.post(
    '/auth/biometric/register',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { credentialId, publicKey, deviceName } = req.body as {
        credentialId?: string;
        publicKey?: string;
        deviceName?: string;
      };
      if (!credentialId) throw new AppError('credentialId is required', 400);
      if (!publicKey) throw new AppError('publicKey is required', 400);

      const result = await service.registerBiometric({
        email,
        credentialId,
        publicKey,
        deviceName,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ credential: result.data });
    }),
  );

  router.post(
    '/auth/biometric',
    asyncHandler(async (req: Request, res: Response) => {
      const { credentialId } = req.body as { credentialId?: string };
      if (!credentialId) throw new AppError('credentialId is required', 400);

      const result = await service.authenticateBiometric(credentialId);
      if (!result.success) throw new AppError(result.error ?? 'Authentication failed', 401);
      res.json(result.data);
    }),
  );

  router.get(
    '/auth/biometric/credentials',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const credentials = await service.getCredentialsByEmail(email);
      res.json({ credentials });
    }),
  );

  router.delete(
    '/auth/biometric/:credentialId',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.removeCredential(req.params.credentialId, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Location breadcrumbs ──

  router.post(
    '/mobile/location',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { latitude, longitude, accuracy } = req.body as {
        latitude?: number;
        longitude?: number;
        accuracy?: number;
      };
      if (latitude === undefined || longitude === undefined)
        throw new AppError('latitude and longitude are required', 400);

      const result = await service.recordBreadcrumb({
        email,
        latitude,
        longitude,
        accuracy,
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ breadcrumb: result.data });
    }),
  );

  router.get(
    '/mobile/location',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.query.email as string) || req.identity?.email;
      if (!email) throw new AppError('email is required', 400);
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const breadcrumbs = await service.getBreadcrumbs(email, startDate, endDate, limit);
      res.json({ breadcrumbs });
    }),
  );

  router.get(
    '/mobile/location/latest',
    asyncHandler(async (req: Request, res: Response) => {
      const email = (req.query.email as string) || req.identity?.email;
      if (!email) throw new AppError('email is required', 400);
      const location = await service.getLatestLocation(email);
      res.json({ location });
    }),
  );

  router.get(
    '/mobile/location/settings',
    asyncHandler(async (_req: Request, res: Response) => {
      const settings = await service.getTrackingSettings();
      res.json({ settings });
    }),
  );

  router.put(
    '/mobile/location/settings',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { enabled, intervalSeconds } = req.body as {
        enabled?: boolean;
        intervalSeconds?: number;
      };
      if (enabled === undefined) throw new AppError('enabled is required', 400);
      const result = await service.updateTrackingSettings(enabled, intervalSeconds, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Expense receipts ──

  router.post(
    '/expenses/receipt',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
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
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
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
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
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
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/receipts/:id/approve',
    asyncHandler(async (req: Request, res: Response) => {
      const approver = req.identity?.email ?? '';
      const result = await service.approveReceipt(req.params.id, approver);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/expenses/receipts/:id/reject',
    asyncHandler(async (req: Request, res: Response) => {
      const rejector = req.identity?.email ?? '';
      const { reason } = req.body as { reason?: string };
      const result = await service.rejectReceipt(req.params.id, rejector, reason ?? '');
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Batch approvals ──

  router.post(
    '/approvals/batch',
    asyncHandler(async (req: Request, res: Response) => {
      const approver = req.identity?.email ?? '';
      const { items } = req.body as { items?: BatchApprovalItem[] };
      if (!items || !Array.isArray(items) || items.length === 0)
        throw new AppError('items array is required (non-empty)', 400);

      const results = await service.batchApprove(items, approver);
      res.json({ results });
    }),
  );

  // ── Deep links ──

  router.get('/mobile/deep-link', (req: Request, res: Response) => {
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    if (!entityType || !entityId) {
      res.status(400).json({ error: 'entityType and entityId are required' });
      return;
    }
    const webBaseUrl = req.query.webBaseUrl as string | undefined;
    const links = generateDeepLink(entityType, entityId, webBaseUrl);
    res.json(links);
  });

  return router;
}
