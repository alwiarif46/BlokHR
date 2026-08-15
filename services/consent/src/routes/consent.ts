import { Router, Request, Response, NextFunction } from 'express';
import type { ConsentService } from '../services/consent-service';
import type { CreateConsentInput, SubjectType, ConsentModality } from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface ConsentRouterOptions {
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

export function createConsentRouter(service: ConsentService, options: ConsentRouterOptions = {}): Router {
  const router = Router();
  const tenantId = options.tenantId ?? 'default';

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
    res.json({ status: 'ok', service: 'consent' });
  });

  router.post(
    '/consents',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as Record<string, unknown>;
      const input: CreateConsentInput = {
        tenantId,
        subjectRef: String(body.subject_ref ?? body.subjectRef ?? ''),
        subjectType: String(body.subject_type ?? body.subjectType ?? 'staff') as SubjectType,
        modality: String(body.modality ?? '') as ConsentModality,
        legalBasis: typeof body.legal_basis === 'string' ? body.legal_basis : undefined,
        guardianRef: typeof body.guardian_ref === 'string' ? body.guardian_ref : undefined,
        dpiaRef: typeof body.dpia_ref === 'string' ? body.dpia_ref : undefined,
        alternativeAcknowledged:
          body.alternative_acknowledged === true || body.alternativeAcknowledged === true,
      };
      const result = await service.create(input);
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/consents/:id',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const consent = await service.get(tenantId, req.params.id);
      if (!consent) {
        res.status(404).json({ error: 'Consent not found' });
        return;
      }
      res.json({ consent });
    }),
  );

  router.get(
    '/consents/:id/validate',
    asyncHandler(async (req, res) => {
      const modality = String(req.query.modality ?? '');
      const ok = await service.validate(tenantId, req.params.id, modality);
      res.json({ valid: ok });
    }),
  );

  router.post(
    '/consents/:id/revoke',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const result = await service.revoke(tenantId, req.params.id);
      if (!result.success) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/subjects/:subjectRef/consents',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const consents = await service.listForSubject(tenantId, req.params.subjectRef);
      res.json({ consents });
    }),
  );

  return router;
}
