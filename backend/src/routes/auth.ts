import { Router, Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../app';
import { AuthService } from '../auth/auth-service';

/**
 * Auth routes:
 *   POST /api/auth/teams-sso — resolve user identity from Teams SSO token
 */
export function createAuthRouter(logger: Logger): Router {
  const router = Router();
  const service = new AuthService(logger);

  /**
   * POST /api/auth/teams-sso
   * Body: { ssoToken: string }
   * Returns: { email, name, oid, tid }
   *
   * Called by the frontend's tryTeamsSSO() when running inside Microsoft Teams.
   * Decodes the SSO JWT and returns the user's identity.
   */
  router.post('/auth/teams-sso', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { ssoToken } = req.body as { ssoToken?: string };

      if (!ssoToken) {
        throw new AppError('ssoToken is required', 400);
      }

      const result = service.resolveTeamsSso(ssoToken);

      if (!result.success) {
        throw new AppError(result.error ?? 'SSO resolution failed', 401);
      }

      res.json({
        email: result.email,
        name: result.name,
        oid: result.oid,
        tid: result.tid,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
