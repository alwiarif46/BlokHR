import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import { IrisScanService } from '../services/iris-scan';

/**
 * Iris Scan routes:
 *   POST   /api/clock/iris             — identify via iris + clock in/out
 *   POST   /api/iris/enroll            — enroll an iris template
 *   GET    /api/iris/status/:email     — check enrollment status
 *   DELETE /api/iris/enrollment/:email — remove enrollment
 *
 * Feature flag: iris_scan — when off, these return 404 (handled by guard middleware).
 */
export function createIrisScanRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const clockRepo = new ClockRepository(db);
  const clockService = new ClockService(clockRepo, logger);
  const irisService = new IrisScanService(db, clockService, logger);

  /** POST /api/clock/iris — identify via iris template and clock. */
  router.post(
    '/clock/iris',
    asyncHandler(async (req: Request, res: Response) => {
      const { template, action } = req.body as {
        template?: string;
        action?: string;
      };

      if (!template) throw new AppError('template is required (base64-encoded IrisCode)', 400);
      if (!action) throw new AppError('action is required (in/out/break/back)', 400);

      // Strip optional data URI prefix
      const cleanTemplate = template.replace(/^data:[^;]+;base64,/, '');

      const result = await irisService.identify(cleanTemplate, action);

      if (!result.success) {
        throw new AppError(result.error ?? 'Identification failed', 400);
      }

      res.json({
        success: true,
        email: result.email,
        name: result.name,
        distance: result.distance,
        clockResult: result.clockResult,
      });
    }),
  );

  /** POST /api/iris/enroll — enroll an iris template for an employee. */
  router.post(
    '/iris/enroll',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, template } = req.body as {
        email?: string;
        template?: string;
      };

      if (!email) throw new AppError('email is required', 400);
      if (!template) throw new AppError('template is required (base64-encoded IrisCode)', 400);

      // Strip optional data URI prefix
      const cleanTemplate = template.replace(/^data:[^;]+;base64,/, '');

      const result = await irisService.enroll(email.toLowerCase().trim(), cleanTemplate);

      if (!result.success) {
        throw new AppError(result.error ?? 'Enrollment failed', 400);
      }

      res.json({ success: true, enrollment: result.enrollment });
    }),
  );

  /** GET /api/iris/status/:email — check enrollment status. */
  router.get(
    '/iris/status/:email',
    asyncHandler(async (req: Request, res: Response) => {
      const status = await irisService.getStatus(req.params.email.toLowerCase().trim());
      res.json(status);
    }),
  );

  /** DELETE /api/iris/enrollment/:email — remove enrollment. */
  router.delete(
    '/iris/enrollment/:email',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await irisService.removeEnrollment(req.params.email.toLowerCase().trim());
      if (!result.success) {
        throw new AppError(result.error ?? 'Removal failed', 400);
      }
      res.json({ success: true });
    }),
  );

  return router;
}
