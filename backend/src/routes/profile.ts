import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { NotificationDispatcher } from '../services/notification/dispatcher';
import { AppError, asyncHandler } from '../app';
import { ProfileService } from '../services/profile-service';
import { validateProfileFields } from '../services/profile-validators';

/**
 * Employee Profile routes:
 *   PUT   /api/profile/:id           — update profile (field-level access control)
 *   POST  /api/profile/:id/certify   — certify (lock) profile
 *   POST  /api/profile/:id/unlock    — admin unlocks a locked profile
 *   GET   /api/profile/:id/status    — get lock/certification status
 *   POST  /api/profile/validate      — validate fields without saving
 */
export function createProfileRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const service = new ProfileService(db, dispatcher ?? null, logger);

  /** PUT /api/profile/:id — update profile with field-level access control. */
  router.put(
    '/profile/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.params;
      const fields = req.body as Record<string, unknown>;
      const callerEmail = req.identity?.email ?? '';

      if (!callerEmail) throw new AppError('Authentication required', 401);

      // Determine if caller is admin
      const admin = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        callerEmail,
      ]);
      const isAdmin = !!admin;

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
      const callerEmail = req.identity?.email ?? '';

      if (!callerEmail) throw new AppError('Authentication required', 401);

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
      const callerEmail = req.identity?.email ?? '';

      // Admin check
      const admin = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        callerEmail,
      ]);
      if (!admin) {
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
      const { id } = req.params;
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
