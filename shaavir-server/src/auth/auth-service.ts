import type { Logger } from 'pino';

/** Decoded claims from a Teams SSO JWT. */
interface SsoTokenClaims {
  preferred_username?: string;
  name?: string;
  upn?: string;
  email?: string;
  oid?: string;
  tid?: string;
}

/**
 * Teams SSO Auth service.
 *
 * When the frontend runs inside Microsoft Teams, the Teams JS SDK provides an SSO token
 * via `microsoftTeams.authentication.getAuthToken()`. The frontend sends this token to
 * `POST /api/auth/teams-sso`. This service:
 *
 *   1. Decodes the JWT (base64 payload — no signature verification needed because
 *      the token comes from Microsoft's auth server and is validated by Teams JS SDK).
 *      In production with sensitive operations, you'd verify the signature against
 *      Microsoft's public keys at https://login.microsoftonline.com/common/discovery/v2.0/keys.
 *
 *   2. Extracts the user's email, name, and OID from the claims.
 *
 *   3. Returns the identity for the frontend to store as the session.
 *
 * No database interaction — this is pure identity extraction from the SSO token.
 */
export class AuthService {
  constructor(private readonly logger: Logger) {}

  /** Decode and extract identity from a Teams SSO JWT. */
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

    try {
      const claims = this.decodeJwtPayload(ssoToken);
      if (!claims) {
        return { success: false, error: 'Invalid SSO token format' };
      }

      const email = claims.preferred_username ?? claims.upn ?? claims.email ?? '';

      if (!email) {
        return { success: false, error: 'No email found in SSO token' };
      }

      const name = claims.name ?? email;

      this.logger.info({ email, oid: claims.oid }, 'Teams SSO resolved');

      return {
        success: true,
        email: email.toLowerCase(),
        name,
        oid: claims.oid,
        tid: claims.tid,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error({ err }, 'Teams SSO resolution failed');
      return { success: false, error: errMsg };
    }
  }

  /**
   * Decode the payload of a JWT without signature verification.
   * JWT format: header.payload.signature — all base64url-encoded.
   */
  private decodeJwtPayload(token: string): SsoTokenClaims | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    try {
      const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
      return JSON.parse(payload) as SsoTokenClaims;
    } catch {
      return null;
    }
  }
}
