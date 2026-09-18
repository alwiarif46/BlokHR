import type { Logger } from 'pino';

/**
 * Legacy Teams SSO helper.
 *
 * Session minting lives on MultiAuthService and requires JWKS signature
 * verification. This path must not decode unsigned JWTs.
 */
export class AuthService {
  constructor(private readonly logger: Logger) {}

  /**
   * Teams SSO identity must be verified by MultiAuthService (JWKS).
   * This legacy path no longer accepts unsigned JWTs.
   */
  resolveTeamsSso(ssoToken: string): {
    success: boolean;
    email?: string;
    name?: string;
    oid?: string;
    tid?: string;
    error?: string;
  } {
    if (!ssoToken) {
      return { success: false, error: 'SSO token is required' };
    }
    this.logger.warn('Legacy Teams SSO decode path rejected — signature verification required');
    return { success: false, error: 'SSO token signature verification is required' };
  }
}
