import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { MultiAuthService } from '../services/multi-auth-service';

/**
 * Multi-provider auth routes:
 *   GET    /api/auth/providers                 — list enabled providers for login screen
 *   POST   /api/auth/local                     — email + password login
 *   POST   /api/auth/local/register            — create local credentials
 *   POST   /api/auth/change-password           — change own password
 *   POST   /api/auth/reset-password            — admin reset (no old password)
 *   POST   /api/auth/magic-link/request        — request a magic link email
 *   POST   /api/auth/magic-link/verify         — verify magic link token
 *   POST   /api/auth/teams-sso                 — Microsoft MSAL SSO (existing)
 *   POST   /api/auth/google                    — Google OAuth ID token
 *   GET    /api/auth/oidc/authorize             — get OIDC auth redirect URL
 *   POST   /api/auth/oidc/callback             — verify OIDC token after redirect
 *   GET    /api/auth/saml/login                — get SAML login redirect URL
 *   POST   /api/auth/saml/callback             — process SAML assertion
 *   POST   /api/auth/ldap                      — LDAP/AD authentication
 */
export function createMultiAuthRouter(db: DatabaseEngine, logger: Logger): Router {
  const router = Router();
  const authService = new MultiAuthService(db, logger);

  /** GET /api/auth/providers — list enabled auth providers for login screen. */
  router.get(
    '/auth/providers',
    asyncHandler(async (_req: Request, res: Response) => {
      const providers = await authService.getEnabledProviders();
      res.json({ providers });
    }),
  );

  /** POST /api/auth/local — email + password login. */
  router.post(
    '/auth/local',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email) throw new AppError('email is required', 400);
      if (!password) throw new AppError('password is required', 400);

      const result = await authService.authenticateLocal(email.toLowerCase().trim(), password);
      if (!result.success) throw new AppError(result.error ?? 'Authentication failed', 401);
      res.json(result);
    }),
  );

  /** POST /api/auth/local/register — create local credentials. */
  router.post(
    '/auth/local/register',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password, mustChangePassword } = req.body as {
        email?: string;
        password?: string;
        mustChangePassword?: boolean;
      };
      if (!email) throw new AppError('email is required', 400);
      if (!password) throw new AppError('password is required', 400);
      if (password.length < 8) throw new AppError('Password must be at least 8 characters', 400);

      const result = await authService.createCredentials(
        email.toLowerCase().trim(),
        password,
        mustChangePassword,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json({ success: true });
    }),
  );

  /** POST /api/auth/change-password — change own password. */
  router.post(
    '/auth/change-password',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const { oldPassword, newPassword } = req.body as {
        oldPassword?: string;
        newPassword?: string;
      };
      if (!oldPassword) throw new AppError('oldPassword is required', 400);
      if (!newPassword) throw new AppError('newPassword is required', 400);

      const result = await authService.changePassword(email, oldPassword, newPassword);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  /** POST /api/auth/reset-password — admin reset. */
  router.post(
    '/auth/reset-password',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, newPassword, mustChangeOnLogin } = req.body as {
        email?: string;
        newPassword?: string;
        mustChangeOnLogin?: boolean;
      };
      if (!email) throw new AppError('email is required', 400);
      if (!newPassword) throw new AppError('newPassword is required', 400);

      const result = await authService.resetPassword(
        email.toLowerCase().trim(),
        newPassword,
        mustChangeOnLogin ?? true,
      );
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  /** POST /api/auth/magic-link/request — request a magic link. */
  router.post(
    '/auth/magic-link/request',
    asyncHandler(async (req: Request, res: Response) => {
      const { email } = req.body as { email?: string };
      if (!email) throw new AppError('email is required', 400);

      const result = await authService.generateMagicLink(email.toLowerCase().trim());
      // Always return success (don't leak whether email exists)
      res.json({ success: true, message: 'If the email exists, a login link has been sent.' });
      // In production, the caller would send the email with result.token
      void result;
    }),
  );

  /** POST /api/auth/magic-link/verify — verify a magic link token. */
  router.post(
    '/auth/magic-link/verify',
    asyncHandler(async (req: Request, res: Response) => {
      const { token } = req.body as { token?: string };
      if (!token) throw new AppError('token is required', 400);

      const result = await authService.verifyMagicLink(token);
      if (!result.success) throw new AppError(result.error ?? 'Invalid link', 401);
      res.json(result);
    }),
  );

  /** POST /api/auth/teams-sso — Microsoft MSAL SSO. */
  router.post('/auth/teams-sso', (req: Request, res: Response) => {
    const { ssoToken } = req.body as { ssoToken?: string };
    if (!ssoToken) {
      res.status(400).json({ error: 'ssoToken is required' });
      return;
    }

    const result = authService.authenticateMsal(ssoToken);
    if (!result.success) {
      res.status(401).json({ error: result.error ?? 'SSO failed' });
      return;
    }
    res.json(result);
  });

  /** POST /api/auth/google — Google OAuth ID token. */
  router.post('/auth/google', (req: Request, res: Response) => {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    const result = authService.authenticateGoogle(idToken);
    if (!result.success) {
      res.status(401).json({ error: result.error ?? 'Google auth failed' });
      return;
    }
    res.json(result);
  });

  /** GET /api/auth/oidc/authorize — get OIDC authorization URL. */
  router.get(
    '/auth/oidc/authorize',
    asyncHandler(async (req: Request, res: Response) => {
      const state = req.query.state as string | undefined;
      const result = await authService.getOidcAuthUrl(state);
      if (!result.success) throw new AppError(result.error ?? 'OIDC not configured', 400);
      res.json({ authUrl: result.authUrl });
    }),
  );

  /** POST /api/auth/oidc/callback — verify OIDC token after redirect. */
  router.post('/auth/oidc/callback', (req: Request, res: Response) => {
    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    const result = authService.authenticateOidcToken(idToken);
    if (!result.success) {
      res.status(401).json({ error: result.error ?? 'OIDC auth failed' });
      return;
    }
    res.json(result);
  });

  /** GET /api/auth/saml/login — get SAML login redirect URL. */
  router.get(
    '/auth/saml/login',
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await authService.getSamlLoginUrl();
      if (!result.success) throw new AppError(result.error ?? 'SAML not configured', 400);
      res.json({ loginUrl: result.loginUrl });
    }),
  );

  /** POST /api/auth/saml/callback — process SAML assertion. */
  router.post('/auth/saml/callback', (req: Request, res: Response) => {
    const { email, name } = req.body as { email?: string; name?: string };
    if (!email) {
      res.status(400).json({ error: 'email is required in SAML assertion' });
      return;
    }

    const result = authService.authenticateSaml({ email, name });
    if (!result.success) {
      res.status(401).json({ error: result.error ?? 'SAML auth failed' });
      return;
    }
    res.json(result);
  });

  /** POST /api/auth/ldap — LDAP/AD authentication. */
  router.post(
    '/auth/ldap',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email) throw new AppError('email is required', 400);
      if (!password) throw new AppError('password is required', 400);

      const result = await authService.authenticateLdap(email.toLowerCase().trim(), password);
      if (!result.success) throw new AppError(result.error ?? 'LDAP auth failed', 401);
      res.json(result);
    }),
  );

  return router;
}
