import { Router, Request, Response, NextFunction } from 'express';
import type { CaptureService } from '../services/capture-service';
import type { DeviceCapability, Modality, SubjectType } from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface CaptureRouterOptions {
  tenantId?: string;
  isAdmin?: (email: string) => Promise<boolean>;
}

function callerEmail(req: Request): string {
  const raw =
    (req.headers['x-user-email'] as string | undefined) ||
    (req as Request & { identity?: { email?: string } }).identity?.email ||
    '';
  return raw.toLowerCase().trim();
}

export function createCaptureRouter(service: CaptureService, options: CaptureRouterOptions = {}): Router {
  const router = Router();

  async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    if (!options.isAdmin) return true;
    const email = callerEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Authentication required' });
      return false;
    }
    if (!(await options.isAdmin(email))) {
      res.status(403).json({ error: 'Admin access required' });
      return false;
    }
    return true;
  }

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'capture' });
  });

  /** Server-gated modalities — clients must render only what this returns. */
  router.get(
    '/session-token',
    asyncHandler(async (req, res) => {
      const subjectType = String(req.query.subject_type ?? 'staff') as SubjectType;
      const deviceId = typeof req.query.device_id === 'string' ? req.query.device_id : undefined;
      const token = await service.issueSessionToken({ subjectType, deviceId });
      res.json(token);
    }),
  );

  router.post(
    '/enrolments',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as Record<string, unknown>;
      const result = await service.enrol(
        {
          subjectRef: String(body.subject_ref ?? ''),
          subjectType: String(body.subject_type ?? 'staff') as SubjectType,
          modality: String(body.modality ?? '') as Modality,
          payloadB64: String(body.payload_b64 ?? ''),
          algo: typeof body.algo === 'string' ? body.algo : undefined,
          quality: typeof body.quality === 'number' ? body.quality : undefined,
          deviceId: typeof body.device_id === 'string' ? body.device_id : undefined,
          capturedAt: typeof body.captured_at === 'string' ? body.captured_at : undefined,
          consentRef: typeof body.consent_ref === 'string' ? body.consent_ref : undefined,
          fingerSlot:
            body.finger_slot === 1 || body.finger_slot === 2
              ? (body.finger_slot as 1 | 2)
              : body.finger_slot === '1' || body.finger_slot === '2'
                ? (Number(body.finger_slot) as 1 | 2)
                : undefined,
        },
        callerEmail(req),
      );
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/enrolments',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const enrolments = await service.listEnrolments();
      res.json({ enrolments });
    }),
  );

  router.delete(
    '/enrolments/:id',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const result = await service.revokeEnrolment(req.params.id, callerEmail(req));
      if (!result.success) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.post(
    '/events',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.processEvent(
        {
          modality: String(body.modality ?? '') as Modality,
          payloadB64: String(body.payload_b64 ?? ''),
          algo: typeof body.algo === 'string' ? body.algo : undefined,
          deviceId: typeof body.device_id === 'string' ? body.device_id : undefined,
          capturedAt: typeof body.captured_at === 'string' ? body.captured_at : undefined,
          idempotencyKey: String(body.idempotency_key ?? ''),
          context: (body.context as Record<string, unknown>) ?? {},
          subjectTypeHint:
            typeof body.subject_type === 'string' ? (body.subject_type as SubjectType) : undefined,
        },
        callerEmail(req),
      );
      if (result.error && !result.id) {
        res.status(400).json(result);
        return;
      }
      res.json({
        subject_ref: result.subjectRef,
        match_score: result.matchScore,
        decision: result.decision,
        event_id: result.id,
        idempotent_replay: result.idempotentReplay ?? false,
      });
    }),
  );

  router.post(
    '/events/:id/manual-override',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as { subject_ref?: string; reason?: string };
      const result = await service.manualOverride({
        eventId: req.params.id,
        subjectRef: String(body.subject_ref ?? ''),
        reason: String(body.reason ?? ''),
        by: callerEmail(req),
      });
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.post(
    '/devices',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as { id?: string; name?: string; capabilities?: DeviceCapability[] };
      if (!body.id) {
        res.status(400).json({ error: 'id required' });
        return;
      }
      await service.registerDevice(body.id, body.name || body.id, body.capabilities || []);
      res.json({ success: true });
    }),
  );

  router.post(
    '/temporary-qr',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as { subject_ref?: string; subject_type?: string };
      const result = await service.issueTemporaryQr(
        String(body.subject_ref ?? ''),
        String(body.subject_type ?? 'student') as SubjectType,
        callerEmail(req),
      );
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.put(
    '/jurisdiction',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as Record<string, unknown>;
      const j = await service.updateJurisdiction({
        country: typeof body.country === 'string' ? body.country : undefined,
        state: typeof body.state === 'string' ? body.state : undefined,
        vertical: body.vertical === 'school' || body.vertical === 'hr' ? body.vertical : undefined,
        faceAdultsEnabled:
          typeof body.face_adults_enabled === 'boolean' ? body.face_adults_enabled : undefined,
        faceStudentsDpiaRef:
          typeof body.face_students_dpia_ref === 'string' ? body.face_students_dpia_ref : undefined,
        retentionDays: typeof body.retention_days === 'number' ? body.retention_days : undefined,
      });
      res.json({ jurisdiction: j });
    }),
  );

  router.get(
    '/jurisdiction',
    asyncHandler(async (_req, res) => {
      const j = await service.ensureJurisdiction();
      res.json({ jurisdiction: j });
    }),
  );

  router.post(
    '/retention/purge',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const result = await service.runRetentionPurge();
      res.json(result);
    }),
  );

  return router;
}
