import { Router, Request, Response, NextFunction } from 'express';
import type { KioskService } from '../services/kiosk-service';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface KioskRouterOptions {
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

function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '';
}

function statusFromError(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode?: number }).statusCode;
    if (typeof code === 'number') return code;
  }
  return 500;
}

export function createKioskRouter(service: KioskService, options: KioskRouterOptions = {}): Router {
  const router = Router();

  async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    if (!options.isAdmin) return true;
    const email = callerEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Authentication required' });
      return false;
    }
    const ok = await options.isAdmin(email);
    if (!ok) {
      res.status(403).json({ error: 'Admin access required' });
      return false;
    }
    return true;
  }

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kiosk' });
  });

  router.get(
    '/status',
    asyncHandler(async (_req, res) => {
      const status = await service.getStatus();
      res.json(status);
    }),
  );

  router.get(
    '/members',
    asyncHandler(async (req, res) => {
      try {
        const q = typeof req.query.q === 'string' ? req.query.q : '';
        const members = await service.searchMembers(q);
        res.json({ members, count: members.length });
      } catch (err) {
        const code = statusFromError(err);
        res.status(code).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    }),
  );

  router.post(
    '/verify',
    asyncHandler(async (req, res) => {
      try {
        const body = req.body as { email?: string; pin?: string };
        const result = await service.verify(
          String(body.email ?? ''),
          String(body.pin ?? ''),
          clientIp(req),
        );
        // Always 200 for credential mismatch — avoid clearing the launcher's app session.
        res.json(result);
      } catch (err) {
        const code = statusFromError(err);
        res.status(code).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    }),
  );

  router.post(
    '/clock',
    asyncHandler(async (req, res) => {
      try {
        const body = req.body as {
          email?: string;
          pin?: string;
          token?: string;
          action?: string;
        };
        const result = await service.clock({
          email: String(body.email ?? ''),
          action: String(body.action ?? ''),
          pin: typeof body.pin === 'string' ? body.pin : undefined,
          token: typeof body.token === 'string' ? body.token : undefined,
          clientIp: clientIp(req),
        });
        res.status(200).json(result);
      } catch (err) {
        const code = statusFromError(err);
        res.status(code).json({ error: err instanceof Error ? err.message : 'Failed' });
      }
    }),
  );

  router.put(
    '/pins/:email',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const email = decodeURIComponent(req.params.email || '');
      const body = req.body as { pin?: string };
      const result = await service.setPin(email, String(body.pin ?? ''));
      if (!result.success) {
        res.status(400).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.delete(
    '/pins/:email',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const email = decodeURIComponent(req.params.email || '');
      const result = await service.clearPin(email);
      if (!result.success) {
        res.status(404).json(result);
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/pins/:email/status',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const email = decodeURIComponent(req.params.email || '');
      const hasPin = await service.hasPin(email);
      res.json({ email: email.toLowerCase().trim(), hasPin });
    }),
  );

  return router;
}
