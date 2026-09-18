import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import {
  MultiAuthService,
  FORGOT_PASSWORD_PUBLIC_MESSAGE,
  type AuthMailSender,
  type AuthResult,
} from '../services/multi-auth-service';
import { SettingsRepository } from '../repositories/settings-repository';
import { SettingsService } from '../services/settings-service';
import { requireInternalMatch, resolveInternalSecret } from '../internal-auth';
import { EmailAdapter } from '../services/notification/email-adapter';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionCookie,
} from '../auth/session-cookie';

/**
 * Multi-provider auth routes:
 *   GET    /api/auth/providers                 — list enabled providers for login screen
 *   POST   /api/auth/local                     — email + password login
 *   POST   /api/auth/local/register            — create local credentials (admin)
 *   POST   /api/auth/change-password           — change own password
 *   POST   /api/auth/reset-password            — admin reset (no old password)
 *   POST   /api/auth/forgot-password           — request self-service reset email
 *   POST   /api/auth/forgot-password/confirm   — confirm reset with token + new password
 *   POST   /api/auth/magic-link/request        — request a magic link email
 *   POST   /api/auth/magic-link/verify         — verify magic link token
 *   POST   /api/auth/teams-sso                 — Microsoft MSAL SSO (existing)
 *   POST   /api/auth/google                    — Google OAuth ID token
 *   GET    /api/auth/oidc/authorize             — get OIDC auth redirect URL
 *   POST   /api/auth/oidc/callback             — verify OIDC token after redirect
 *   GET    /api/auth/saml/login                — get SAML login redirect URL
 *   POST   /api/auth/saml/callback             — process SAML assertion
 *   POST   /api/auth/ldap                      — LDAP/AD authentication
 *   POST   /api/auth/introspect                — gateway staff session introspect (P12-01)
 *
 * Long-term owner of session introspect is a future auth service; this router
 * extends the monolith auth domain until extraction.
 */
export interface MultiAuthRouterOptions {
  config?: AppConfig;
  mailSender?: AuthMailSender;
}

async function requireAdmin(req: Request, db: DatabaseEngine): Promise<string> {
  const email = req.identity?.email;
  if (!email) throw new AppError('Authentication required', 401);
  const admin = await db.get<{ email: string }>('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [
    getTenantId(), email,
  ]);
  if (!admin) throw new AppError('Admin access required', 403);
  return email;
}

function createMailSender(config: AppConfig | undefined, logger: Logger): AuthMailSender | undefined {
  if (!config) return undefined;
  return new EmailAdapter(
    config.smtpHost,
    config.smtpPort,
    config.smtpUser,
    config.smtpPass,
    config.smtpFrom,
    config.serverBaseUrl,
    config.actionLinkSecret,
    logger,
  );
}

export function createMultiAuthRouter(
  db: DatabaseEngine,
  logger: Logger,
  options: MultiAuthRouterOptions = {},
): Router {
  const router = Router();
  const settingsService = new SettingsService(
    new SettingsRepository(db),
    null,
    null,
    null,
    null,
    logger,
  );
  const mailSender = options.mailSender ?? createMailSender(options.config, logger);
  const publicBaseUrl = options.config?.serverBaseUrl ?? '';
  const authService = new MultiAuthService(
    db,
    logger,
    settingsService,
    mailSender,
    publicBaseUrl,
  );
  const internalSecret = resolveInternalSecret();
  const nodeEnv = options.config?.nodeEnv ?? 'development';

  function sendAuthResult(res: Response, result: AuthResult): void {
    if (result.sessionToken) {
      res.append('Set-Cookie', buildSessionCookie(result.sessionToken, nodeEnv));
    }
    res.json(result);
  }

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
      sendAuthResult(res, result);
    }),
  );

  /** POST /api/auth/local/register — create local credentials (admin only). */
  router.post(
    '/auth/local/register',
    asyncHandler(async (req: Request, res: Response) => {
      await requireAdmin(req, db);
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
      await requireAdmin(req, db);
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

  /** POST /api/auth/forgot-password — request self-service reset email. */
  router.post(
    '/auth/forgot-password',
    asyncHandler(async (req: Request, res: Response) => {
      const { email } = req.body as { email?: string };
      if (!email) throw new AppError('email is required', 400);

      const normalized = email.toLowerCase().trim();
      const result = await authService.requestPasswordReset(normalized);
      if (result.token) {
        const link = authService.buildAuthDeepLink('reset', result.token);
        const html =
          '<p>We received a request to reset your BlokHR password.</p>' +
          `<p><a href="${link}">Reset your password</a></p>` +
          '<p>This link expires in 15 minutes. If you did not request this, you can ignore this email.</p>';
        await authService.deliverAuthLinkEmail(
          normalized,
          'Reset your BlokHR password',
          html,
          link,
        );
      }
      res.json({ success: true, message: FORGOT_PASSWORD_PUBLIC_MESSAGE });
    }),
  );

  /** POST /api/auth/forgot-password/confirm — set new password with reset token. */
  router.post(
    '/auth/forgot-password/confirm',
    asyncHandler(async (req: Request, res: Response) => {
      const { token, newPassword } = req.body as { token?: string; newPassword?: string };
      if (!token) throw new AppError('token is required', 400);
      if (!newPassword) throw new AppError('newPassword is required', 400);

      const result = await authService.confirmPasswordReset(token, newPassword);
      if (!result.success) {
        const status = result.error?.includes('8 characters') ? 400 : 401;
        throw new AppError(result.error ?? 'Invalid or expired reset link', status);
      }
      res.json({ success: true });
    }),
  );

  /** POST /api/auth/magic-link/request — request a magic link. */
  router.post(
    '/auth/magic-link/request',
    asyncHandler(async (req: Request, res: Response) => {
      const { email } = req.body as { email?: string };
      if (!email) throw new AppError('email is required', 400);

      const normalized = email.toLowerCase().trim();
      const result = await authService.generateMagicLink(normalized);
      if (result.token) {
        const link = authService.buildAuthDeepLink('magic', result.token);
        const html =
          '<p>Use this link to sign in to BlokHR:</p>' +
          `<p><a href="${link}">Sign in with magic link</a></p>` +
          '<p>This link expires in 15 minutes and can only be used once.</p>';
        await authService.deliverAuthLinkEmail(normalized, 'Your BlokHR sign-in link', html, link);
      }
      res.json({
        success: true,
        message: 'If the email exists, a login link has been sent.',
      });
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
      sendAuthResult(res, result);
    }),
  );

  /** POST /api/auth/teams-sso — Microsoft MSAL SSO. */
  router.post(
    '/auth/teams-sso',
    asyncHandler(async (req: Request, res: Response) => {
      const { ssoToken } = req.body as { ssoToken?: string };
      if (!ssoToken) throw new AppError('ssoToken is required', 400);

      const result = await authService.authenticateMsal(ssoToken);
      if (!result.success) throw new AppError(result.error ?? 'SSO failed', 401);
      sendAuthResult(res, result);
    }),
  );

  /** POST /api/auth/google — Google OAuth ID token. */
  router.post(
    '/auth/google',
    asyncHandler(async (req: Request, res: Response) => {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) throw new AppError('idToken is required', 400);

      const result = await authService.authenticateGoogle(idToken);
      if (!result.success) throw new AppError(result.error ?? 'Google auth failed', 401);
      sendAuthResult(res, result);
    }),
  );

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
  router.post(
    '/auth/oidc/callback',
    asyncHandler(async (req: Request, res: Response) => {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) throw new AppError('idToken is required', 400);

      const result = await authService.authenticateOidcToken(idToken);
      if (!result.success) throw new AppError(result.error ?? 'OIDC auth failed', 401);
      sendAuthResult(res, result);
    }),
  );

  /** GET /api/auth/saml/login — get SAML login redirect URL. */
  router.get(
    '/auth/saml/login',
    asyncHandler(async (_req: Request, res: Response) => {
      const result = await authService.getSamlLoginUrl();
      if (!result.success) throw new AppError(result.error ?? 'SAML not configured', 400);
      res.json({ loginUrl: result.loginUrl });
    }),
  );

  /** POST /api/auth/saml/callback — signed SAMLResponse only (JSON email is rejected). */
  router.post(
    '/auth/saml/callback',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as { email?: string; name?: string; SAMLResponse?: string };
      const result = await authService.authenticateSaml(body);
      if (!result.success) throw new AppError(result.error ?? 'SAML auth failed', 401);
      sendAuthResult(res, result);
    }),
  );

  /** POST /api/auth/ldap — LDAP/AD authentication. */
  router.post(
    '/auth/ldap',
    asyncHandler(async (req: Request, res: Response) => {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email) throw new AppError('email is required', 400);
      if (!password) throw new AppError('password is required', 400);

      const result = await authService.authenticateLdap(email.toLowerCase().trim(), password);
      if (!result.success) throw new AppError(result.error ?? 'LDAP auth failed', 401);
      sendAuthResult(res, result);
    }),
  );

  /** POST /api/auth/logout — revoke server session and clear httpOnly cookie. */
  router.post(
    '/auth/logout',
    asyncHandler(async (req: Request, res: Response) => {
      const headerAuth =
        typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      const bearer = /^Bearer\s+(.+)$/i.exec(headerAuth.trim())?.[1]?.trim() ?? '';
      const token =
        bearer ||
        readSessionCookie(typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined);
      if (token) await authService.revokeSession(token);
      res.append('Set-Cookie', buildClearedSessionCookie(nodeEnv));
      res.json({ success: true });
    }),
  );

  /**
   * POST /api/auth/introspect — staff session claims for the gateway (P12-01).
   * Requires X-Blok-Internal === INTERNAL_SECRET. Never for browsers: gateway strips
   * inbound X-Blok-*, so only the gateway can call this. P12-02 returns 404 for any
   * external hit on this path through the gateway (closes secret-injection exposure).
   */
  router.post(
    '/auth/introspect',
    asyncHandler(async (req: Request, res: Response) => {
      const gate = requireInternalMatch(req, internalSecret);
      if (!('ok' in gate)) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const { token } = req.body as { token?: string };
      const result = await authService.introspect(token ?? '');
      if (!result.active) {
        res.json({ active: false });
        return;
      }
      res.json({
        active: true,
        email: result.email,
        name: result.name,
        tenantId: result.tenantId,
        isAdmin: result.isAdmin,
        isGlobalManager: result.isGlobalManager,
        isGlobalHR: result.isGlobalHR,
        managerOf: result.managerOf,
        hrOf: result.hrOf,
      });
    }),
  );

  return router;
}
