import { Router, Request, Response, NextFunction } from 'express';
import type { GuardianAuthService } from '../services/guardian-auth-service';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createGuardianAuthRouter(auth: GuardianAuthService): Router {
  const router = Router();

  router.post(
    '/set-password',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.setPassword({
        tenantId: String(body.tenant_id ?? body.tenantId ?? ''),
        guardianId: String(body.guardian_id ?? body.guardianId ?? ''),
        password: String(body.password ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.login({
        phone: String(body.phone ?? ''),
        password: String(body.password ?? ''),
        tenantId:
          body.tenant_id != null || body.tenantId != null
            ? String(body.tenant_id ?? body.tenantId)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.tenants ? { tenants: result.tenants } : {}),
        });
        return;
      }
      res.json({
        token: result.token,
        tenant_id: result.tenantId,
        guardian_id: result.guardianId,
        expires_at: result.expiresAt,
      });
    }),
  );

  router.post(
    '/otp/request',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.requestOtp({
        phone: String(body.phone ?? ''),
        purpose: String(body.purpose ?? 'login') as
          | 'login'
          | 'reset'
          | 'claim'
          | 'verify_phone',
        tenantId:
          body.tenant_id != null || body.tenantId != null
            ? String(body.tenant_id ?? body.tenantId)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        ok: true,
        expires_at: result.expiresAt,
        ...(result.debugOtp ? { debug_otp: result.debugOtp } : {}),
      });
    }),
  );

  router.post(
    '/otp/verify',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.verifyOtp({
        phone: String(body.phone ?? ''),
        otp: String(body.otp ?? ''),
        purpose: String(body.purpose ?? 'login') as
          | 'login'
          | 'reset'
          | 'claim'
          | 'verify_phone',
        newPassword:
          body.new_password != null || body.newPassword != null
            ? String(body.new_password ?? body.newPassword)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      if (result.token) {
        res.json({
          token: result.token,
          tenant_id: result.tenantId,
          guardian_id: result.guardianId,
          expires_at: result.expiresAt,
        });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/claim',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.acceptInvitation({
        claimToken: String(body.claim_token ?? body.claimToken ?? ''),
        password: String(body.password ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        token: result.token,
        tenant_id: result.tenantId,
        guardian_id: result.guardianId,
        expires_at: result.expiresAt,
      });
    }),
  );

  router.post(
    '/introspect',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await auth.introspect(String(body.token ?? ''));
      if (result.active) {
        res.json({
          active: true,
          tenant_id: result.tenantId,
          guardian_id: result.guardianId,
        });
        return;
      }
      res.json({ active: false });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      await auth.logout(String(body.token ?? ''));
      res.json({ ok: true });
    }),
  );

  return router;
}
