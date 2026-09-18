import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import type { NotificationDispatcher } from '../services/notification/dispatcher';
import { AppError, asyncHandler } from '../app';
import { ProfileService } from '../services/profile-service';
import { validateProfileFields } from '../services/profile-validators';
import {
  getIdentityVerifyProvider,
  type VerifyField,
} from '../services/identity-verify';

const VERIFY_FIELDS = new Set<VerifyField>([
  'pan',
  'aadhaar',
  'uan',
  'bankAcc',
  'ifsc',
  'bankName',
]);

/**
 * Employee Profile routes:
 *   PUT   /api/profile/:id           — update profile (field-level access control)
 *   POST  /api/profile/:id/certify   — certify (lock) profile
 *   POST  /api/profile/:id/unlock    — admin unlocks a locked profile
 *   GET   /api/profile/:id/status    — get lock/certification status
 *   POST  /api/profile/validate      — validate fields without saving
 *   GET   /api/profiles/me           — current user's profile
 *   PUT   /api/profiles/me           — update current user's profile
 *   GET   /api/profiles/me/status    — certification status
 *   POST  /api/profiles/me/certify   — certify current profile
 *   POST  /api/profiles/me/verify    — format/lookup verify a financial field
 *   GET   /api/profiles/ifsc/:code   — Razorpay IFSC lookup (server proxy)
 */
export function createProfileRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const service = new ProfileService(db, dispatcher ?? null, logger);

  async function requireCallerEmail(req: Request): Promise<string> {
    const email = (req.identity?.email ?? '').trim();
    if (!email) throw new AppError('Authentication required', 401);
    return email;
  }

  async function isCallerAdmin(email: string): Promise<boolean> {
    const admin = await db.get<{ email: string }>('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [
      getTenantId(), email,
    ]);
    return !!admin;
  }

  /** GET /api/profiles/me */
  router.get(
    '/profiles/me',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireCallerEmail(req);
      const profile = await service.getProfile(callerEmail);
      if (!profile) throw new AppError('Member not found', 404);
      res.json(profile);
    }),
  );

  /** PUT /api/profiles/me */
  router.put(
    '/profiles/me',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireCallerEmail(req);
      const isAdmin = await isCallerAdmin(callerEmail);
      const member = await service.resolveMember(callerEmail);
      if (!member) throw new AppError('Member not found', 404);

      const result = await service.updateProfile(
        member.id,
        req.body as Record<string, unknown>,
        callerEmail,
        isAdmin,
      );

      if (!result.success) {
        if (result.errors) {
          res.status(400).json({ success: false, errors: result.errors });
          return;
        }
        throw new AppError(result.error ?? 'Failed to update profile', 400);
      }

      res.json({
        success: true,
        ...(result.autoFilledBankName ? { autoFilledBankName: result.autoFilledBankName } : {}),
      });
    }),
  );

  /** GET /api/profiles/me/status */
  router.get(
    '/profiles/me/status',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireCallerEmail(req);
      const status = await service.getProfileStatus(callerEmail);
      if (!status.found) throw new AppError('Member not found', 404);
      res.json(status);
    }),
  );

  /** POST /api/profiles/me/certify */
  router.post(
    '/profiles/me/certify',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireCallerEmail(req);
      const member = await service.resolveMember(callerEmail);
      if (!member) throw new AppError('Member not found', 404);

      const result = await service.certifyProfile(member.id, callerEmail);
      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to certify profile', 400);
      }
      res.json(result);
    }),
  );

  /** POST /api/profiles/me/verify */
  router.post(
    '/profiles/me/verify',
    asyncHandler(async (req: Request, res: Response) => {
      await requireCallerEmail(req);
      const body = req.body as { field?: string; value?: string; ifsc?: string };
      const field = body.field as VerifyField | undefined;
      if (!field || !VERIFY_FIELDS.has(field)) {
        throw new AppError(
          'field must be one of: pan, aadhaar, uan, bankAcc, ifsc, bankName',
          400,
        );
      }

      const provider = getIdentityVerifyProvider();
      const result = await provider.verify({
        field,
        value: body.value ?? '',
        ifsc: body.ifsc,
      });
      res.json(result);
    }),
  );

  /** GET /api/profiles/ifsc/:code — server-side Razorpay IFSC proxy */
  router.get(
    '/profiles/ifsc/:code',
    asyncHandler(async (req: Request, res: Response) => {
      await requireCallerEmail(req);
      const code = String(req.params.code || '')
        .toUpperCase()
        .trim();
      if (!code) throw new AppError('IFSC code required', 400);

      const provider = getIdentityVerifyProvider();
      const result = await provider.lookupIfsc(code);
      if (!result.valid) {
        res.status(404).json({
          valid: false,
          error: result.error ?? 'IFSC not found',
        });
        return;
      }

      res.json({
        valid: true,
        bankName: result.bankName ?? '',
        branch: result.branch ?? '',
        city: result.city ?? '',
        state: result.state ?? '',
        address: result.address ?? '',
        displayName: result.displayName ?? '',
        ...(result.lookupFailed ? { lookupFailed: true } : {}),
      });
    }),
  );

  /** PUT /api/profile/:id — update profile with field-level access control. */
  router.put(
    '/profile/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const fields = req.body as Record<string, unknown>;
      const callerEmail = await requireCallerEmail(req);
      const isAdmin = await isCallerAdmin(callerEmail);

      const result = await service.updateProfile(id, fields, callerEmail, isAdmin);

      if (!result.success) {
        if (result.errors) {
          res.status(400).json({ success: false, errors: result.errors });
          return;
        }
        throw new AppError(result.error ?? 'Failed to update profile', 400);
      }

      res.json({
        success: true,
        ...(result.autoFilledBankName ? { autoFilledBankName: result.autoFilledBankName } : {}),
      });
    }),
  );

  /** POST /api/profile/:id/certify — employee certifies their profile (locks it). */
  router.post(
    '/profile/:id/certify',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const callerEmail = await requireCallerEmail(req);

      const result = await service.certifyProfile(id, callerEmail);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to certify profile', 400);
      }

      res.json(result);
    }),
  );

  /** POST /api/profile/:id/unlock — admin unlocks a certified profile. */
  router.post(
    '/profile/:id/unlock',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const callerEmail = await requireCallerEmail(req);

      if (!(await isCallerAdmin(callerEmail))) {
        throw new AppError('Only admins can unlock profiles', 403);
      }

      const result = await service.unlockProfile(id);

      if (!result.success) {
        throw new AppError(result.error ?? 'Failed to unlock profile', 400);
      }

      res.json(result);
    }),
  );

  /** GET /api/profile/:id/status — get certification/lock status. */
  router.get(
    '/profile/:id/status',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = await requireCallerEmail(req);
      const { id } = req.params;
      const member = await service.resolveMember(id);
      if (!member) {
        throw new AppError('Member not found', 404);
      }
      const isSelf = callerEmail.toLowerCase() === member.email.toLowerCase();
      if (!isSelf && !(await isCallerAdmin(callerEmail))) {
        throw new AppError('Forbidden', 403);
      }
      const status = await service.getProfileStatus(id);

      if (!status.found) {
        throw new AppError('Member not found', 404);
      }

      res.json(status);
    }),
  );

  /**
   * POST /api/profile/validate — validate fields without saving.
   * Returns validation errors + IFSC lookup data if applicable.
   */
  router.post(
    '/profile/validate',
    asyncHandler(async (req: Request, res: Response) => {
      await requireCallerEmail(req);
      const fields = req.body as {
        name?: string;
        phone?: string;
        pan?: string;
        aadhaar?: string;
        uan?: string;
        ifsc?: string;
        bankAccount?: string;
        email?: string;
      };

      const result = await validateProfileFields(fields);

      res.json({
        valid: Object.keys(result.errors).length === 0,
        errors: result.errors,
        ...(result.ifscData ? { ifscData: result.ifscData } : {}),
      });
    }),
  );

  return router;
}
