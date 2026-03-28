import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import { ClockRepository } from '../repositories/clock-repository';
import { ClockService } from '../services/clock-service';
import {
  FaceRecognitionService,
  AzureFaceApiClient,
} from '../services/face-recognition';
import type { FaceApiClient } from '../services/face-recognition';

/**
 * Face recognition routes:
 *   POST   /api/clock/face           — identify + clock in/out via face
 *   POST   /api/face/enroll          — enroll an employee's face
 *   GET    /api/face/status/:email   — check enrollment status
 *   DELETE /api/face/enrollment/:email — remove enrollment
 */
export function createFaceRecognitionRouter(
  db: DatabaseEngine,
  config: AppConfig,
  logger: Logger,
  faceApiOverride?: FaceApiClient,
): Router {
  const router = Router();

  // Build the face API client: use override (for tests), or real Azure, or disabled
  let faceApi: FaceApiClient;
  if (faceApiOverride) {
    faceApi = faceApiOverride;
  } else if (config.azureFaceEndpoint && config.azureFaceKey) {
    faceApi = new AzureFaceApiClient(config.azureFaceEndpoint, config.azureFaceKey, logger);
  } else {
    // Face recognition not configured — all endpoints return 503
    const notConfigured = (_req: Request, _res: Response): void => {
      throw new AppError('Face recognition is not configured. Set AZURE_FACE_ENDPOINT and AZURE_FACE_KEY.', 503);
    };
    router.post('/clock/face', asyncHandler(async (req, res) => notConfigured(req, res)));
    router.post('/face/enroll', asyncHandler(async (req, res) => notConfigured(req, res)));
    router.get('/face/status/:email', asyncHandler(async (req, res) => notConfigured(req, res)));
    router.delete('/face/enrollment/:email', asyncHandler(async (req, res) => notConfigured(req, res)));
    return router;
  }

  const clockRepo = new ClockRepository(db);
  const clockService = new ClockService(clockRepo, logger);
  const faceService = new FaceRecognitionService(db, faceApi, clockService, logger);

  /**
   * POST /api/clock/face
   * Body: { image: string (base64), action: 'in'|'out'|'break'|'back' }
   */
  router.post(
    '/clock/face',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const imageBase64 = (body.image as string) ?? '';
      const action = (body.action as string) ?? '';

      if (!imageBase64) throw new AppError('image (base64) is required', 400);
      if (!action) throw new AppError('action is required (in, out, break, back)', 400);

      let imageBuffer: Buffer;
      try {
        // Strip data URI prefix if present (e.g., "data:image/jpeg;base64,...")
        const rawBase64 = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;
        imageBuffer = Buffer.from(rawBase64, 'base64');
      } catch {
        throw new AppError('Invalid base64 image data', 400);
      }

      if (imageBuffer.length === 0) {
        throw new AppError('Image data is empty', 400);
      }

      const result = await faceService.identifyAndClock(imageBuffer, action);
      if (!result.success) {
        // Return 200 with error in body (consistent with clock route pattern)
        res.json(result);
        return;
      }
      res.json(result);
    }),
  );

  /**
   * POST /api/face/enroll
   * Body: { email: string, image: string (base64) }
   */
  router.post(
    '/face/enroll',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = ((body.email as string) ?? '').toLowerCase().trim();
      const imageBase64 = (body.image as string) ?? '';

      if (!email) throw new AppError('email is required', 400);
      if (!imageBase64) throw new AppError('image (base64) is required', 400);

      let imageBuffer: Buffer;
      try {
        const rawBase64 = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64;
        imageBuffer = Buffer.from(rawBase64, 'base64');
      } catch {
        throw new AppError('Invalid base64 image data', 400);
      }

      if (imageBuffer.length === 0) {
        throw new AppError('Image data is empty', 400);
      }

      const result = await faceService.enrollFace(email, imageBuffer);
      if (!result.success) throw new AppError(result.error ?? 'Enrollment failed', 400);
      res.status(201).json(result);
    }),
  );

  /**
   * GET /api/face/status/:email
   */
  router.get(
    '/face/status/:email',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.params.email.toLowerCase().trim();
      if (!email) throw new AppError('email param is required', 400);
      const status = await faceService.getStatus(email);
      res.json(status);
    }),
  );

  /**
   * DELETE /api/face/enrollment/:email
   */
  router.delete(
    '/face/enrollment/:email',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.params.email.toLowerCase().trim();
      if (!email) throw new AppError('email param is required', 400);
      const result = await faceService.removeEnrollment(email);
      if (!result.success) throw new AppError(result.error ?? 'Removal failed', 404);
      res.json({ success: true });
    }),
  );

  return router;
}
