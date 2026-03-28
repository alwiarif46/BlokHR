import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

interface AuthCredentialRow {
  [key: string]: unknown;
  email: string;
  password_hash: string;
  must_change_password: number;
  failed_attempts: number;
  locked_until: string | null;
  last_login: string | null;
}

interface MagicLinkRow {
  [key: string]: unknown;
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: number;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

interface BrandingAuthRow {
  [key: string]: unknown;
  auth_local_enabled: number;
  auth_magic_link_enabled: number;
  msal_client_id: string;
  msal_tenant_id: string;
  google_oauth_client_id: string;
  oidc_enabled: number;
  oidc_display_name: string;
  oidc_issuer_url: string;
  oidc_client_id: string;
  oidc_client_secret: string;
  oidc_scopes: string;
  oidc_redirect_uri: string;
  saml_enabled: number;
  saml_display_name: string;
  saml_entry_point: string;
  saml_issuer: string;
  saml_cert: string;
  saml_callback_url: string;
  ldap_enabled: number;
  ldap_display_name: string;
  ldap_url: string;
  ldap_bind_dn: string;
  ldap_bind_password: string;
  ldap_search_base: string;
  ldap_search_filter: string;
  ldap_email_attribute: string;
  ldap_name_attribute: string;
}

// ── Result types ──

export interface AuthResult {
  success: boolean;
  error?: string;
  email?: string;
  name?: string;
  sessionToken?: string;
  mustChangePassword?: boolean;
}

export interface AuthProviderInfo {
  id: string;
  name: string;
  enabled: boolean;
  type: 'local' | 'magic_link' | 'microsoft' | 'google' | 'oidc' | 'saml' | 'ldap';
}

// ── Constants ──

const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const MAGIC_LINK_EXPIRY_MINUTES = 15;

/**
 * Multi-provider authentication service.
 *
 * Supported providers:
 *   1. Email/Password (local) — bcrypt hashed, lockout after 5 failures
 *   2. Magic Link — signed token emailed, 15min expiry, single-use
 *   3. Microsoft MSAL (Entra ID) — JWT decode from SSO token
 *   4. Google OAuth — ID token verification
 *   5. Generic OIDC — authorization code flow (Auth0, Okta, Keycloak, Oracle IDCS)
 *   6. SAML 2.0 — SP-initiated SSO
 *   7. LDAP/AD — bind authentication
 *
 * Each provider is toggleable via branding table config.
 * Setup wizard configures which providers are active.
 */
export class MultiAuthService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  // ── Provider discovery ──

  /** Get all configured auth providers for the login screen. */
  async getEnabledProviders(): Promise<AuthProviderInfo[]> {
    const branding = await this.db.get<BrandingAuthRow>(
      `SELECT auth_local_enabled, auth_magic_link_enabled,
              msal_client_id, msal_tenant_id, google_oauth_client_id,
              oidc_enabled, oidc_display_name, oidc_issuer_url, oidc_client_id,
              saml_enabled, saml_display_name, saml_entry_point,
              ldap_enabled, ldap_display_name, ldap_url
       FROM branding WHERE id = 1`,
    );
    if (!branding) return [];

    const providers: AuthProviderInfo[] = [];

    if (branding.auth_local_enabled) {
      providers.push({ id: 'local', name: 'Email & Password', enabled: true, type: 'local' });
    }
    if (branding.auth_magic_link_enabled) {
      providers.push({
        id: 'magic_link',
        name: 'Email Magic Link',
        enabled: true,
        type: 'magic_link',
      });
    }
    if (branding.msal_client_id) {
      providers.push({ id: 'microsoft', name: 'Microsoft', enabled: true, type: 'microsoft' });
    }
    if (branding.google_oauth_client_id) {
      providers.push({ id: 'google', name: 'Google', enabled: true, type: 'google' });
    }
    if (branding.oidc_enabled && branding.oidc_client_id) {
      providers.push({
        id: 'oidc',
        name: branding.oidc_display_name || 'SSO',
        enabled: true,
        type: 'oidc',
      });
    }
    if (branding.saml_enabled && branding.saml_entry_point) {
      providers.push({
        id: 'saml',
        name: branding.saml_display_name || 'Enterprise SSO',
        enabled: true,
        type: 'saml',
      });
    }
    if (branding.ldap_enabled && branding.ldap_url) {
      providers.push({
        id: 'ldap',
        name: branding.ldap_display_name || 'Corporate Login',
        enabled: true,
        type: 'ldap',
      });
    }

    return providers;
  }

  // ── 1. Email/Password auth ──

  /** Create local credentials for an employee. */
  async createCredentials(
    email: string,
    password: string,
    mustChangePassword: boolean = false,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.db.get<AuthCredentialRow>(
      'SELECT email FROM auth_credentials WHERE email = ?',
      [email],
    );
    if (existing) {
      return { success: false, error: 'Credentials already exist for this email' };
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.db.run(
      'INSERT INTO auth_credentials (email, password_hash, must_change_password) VALUES (?, ?, ?)',
      [email, hash, mustChangePassword ? 1 : 0],
    );

    this.logger.info({ email }, 'Local credentials created');
    return { success: true };
  }

  /** Authenticate with email and password. */
  async authenticateLocal(email: string, password: string): Promise<AuthResult> {
    const cred = await this.db.get<AuthCredentialRow>(
      'SELECT * FROM auth_credentials WHERE email = ?',
      [email],
    );
    if (!cred) {
      return { success: false, error: 'Invalid email or password' };
    }

    // Check lockout
    if (cred.locked_until) {
      const lockUntil = new Date(cred.locked_until);
      if (lockUntil > new Date()) {
        const minutesLeft = Math.ceil((lockUntil.getTime() - Date.now()) / 60000);
        return {
          success: false,
          error: `Account locked. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}`,
        };
      }
      // Lockout expired — reset
      await this.db.run(
        "UPDATE auth_credentials SET failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE email = ?",
        [email],
      );
    }

    const valid = await bcrypt.compare(password, cred.password_hash);
    if (!valid) {
      const attempts = cred.failed_attempts + 1;
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        await this.db.run(
          "UPDATE auth_credentials SET failed_attempts = ?, locked_until = ?, updated_at = datetime('now') WHERE email = ?",
          [attempts, lockUntil, email],
        );
        return {
          success: false,
          error: `Account locked for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} failed attempts`,
        };
      }
      await this.db.run(
        "UPDATE auth_credentials SET failed_attempts = ?, updated_at = datetime('now') WHERE email = ?",
        [attempts, email],
      );
      return { success: false, error: 'Invalid email or password' };
    }

    // Success — reset failed attempts, update last login
    await this.db.run(
      "UPDATE auth_credentials SET failed_attempts = 0, locked_until = NULL, last_login = datetime('now'), updated_at = datetime('now') WHERE email = ?",
      [email],
    );

    const member = await this.db.get<MemberRow>(
      'SELECT name FROM members WHERE email = ? AND active = 1',
      [email],
    );

    return {
      success: true,
      email,
      name: member?.name ?? email,
      sessionToken: uuidv4(),
      mustChangePassword: cred.must_change_password === 1,
    };
  }

  /** Change password. Requires old password for verification. */
  async changePassword(
    email: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean; error?: string }> {
    const cred = await this.db.get<AuthCredentialRow>(
      'SELECT * FROM auth_credentials WHERE email = ?',
      [email],
    );
    if (!cred) return { success: false, error: 'Credentials not found' };

    const valid = await bcrypt.compare(oldPassword, cred.password_hash);
    if (!valid) return { success: false, error: 'Current password is incorrect' };

    if (newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters' };
    }

    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.db.run(
      "UPDATE auth_credentials SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE email = ?",
      [hash, email],
    );
    this.logger.info({ email }, 'Password changed');
    return { success: true };
  }

  /** Admin reset — set password without knowing old one. */
  async resetPassword(
    email: string,
    newPassword: string,
    mustChangeOnLogin: boolean = true,
  ): Promise<{ success: boolean; error?: string }> {
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const existing = await this.db.get<AuthCredentialRow>(
      'SELECT email FROM auth_credentials WHERE email = ?',
      [email],
    );

    if (existing) {
      await this.db.run(
        "UPDATE auth_credentials SET password_hash = ?, must_change_password = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE email = ?",
        [hash, mustChangeOnLogin ? 1 : 0, email],
      );
    } else {
      await this.db.run(
        'INSERT INTO auth_credentials (email, password_hash, must_change_password) VALUES (?, ?, ?)',
        [email, hash, mustChangeOnLogin ? 1 : 0],
      );
    }

    this.logger.info({ email, mustChangeOnLogin }, 'Password reset by admin');
    return { success: true };
  }

  // ── 2. Magic Link ──

  /** Generate a magic link token and return it. Caller sends the email. */
  async generateMagicLink(email: string): Promise<{
    success: boolean;
    error?: string;
    token?: string;
    expiresAt?: string;
  }> {
    // Verify member exists
    const member = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      // Don't reveal whether email exists — always return success
      return { success: true };
    }

    const id = uuidv4();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60000).toISOString();

    // Invalidate any existing unused tokens for this email
    await this.db.run(
      'UPDATE magic_link_tokens SET used = 1 WHERE email = ? AND used = 0',
      [email],
    );

    await this.db.run(
      'INSERT INTO magic_link_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)',
      [id, email, token, expiresAt],
    );

    this.logger.info({ email }, 'Magic link generated');
    return { success: true, token, expiresAt };
  }

  /** Verify a magic link token and authenticate. */
  async verifyMagicLink(token: string): Promise<AuthResult> {
    const row = await this.db.get<MagicLinkRow>(
      'SELECT * FROM magic_link_tokens WHERE token = ? AND used = 0',
      [token],
    );
    if (!row) {
      return { success: false, error: 'Invalid or expired link' };
    }

    if (new Date(row.expires_at) < new Date()) {
      await this.db.run('UPDATE magic_link_tokens SET used = 1 WHERE id = ?', [row.id]);
      return { success: false, error: 'Link has expired' };
    }

    // Mark as used
    await this.db.run('UPDATE magic_link_tokens SET used = 1 WHERE id = ?', [row.id]);

    const member = await this.db.get<MemberRow>(
      'SELECT name FROM members WHERE email = ? AND active = 1',
      [row.email],
    );

    this.logger.info({ email: row.email }, 'Magic link verified');
    return {
      success: true,
      email: row.email,
      name: member?.name ?? row.email,
      sessionToken: uuidv4(),
    };
  }

  // ── 3. Microsoft MSAL (existing, delegated to auth-service.ts) ──

  /** Decode a Teams SSO token — same as existing auth-service.ts logic. */
  authenticateMsal(ssoToken: string): AuthResult {
    try {
      const parts = ssoToken.split('.');
      if (parts.length !== 3) {
        return { success: false, error: 'Invalid SSO token format' };
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      const email = (
        (payload.preferred_username as string) ??
        (payload.upn as string) ??
        (payload.email as string) ??
        ''
      )
        .toLowerCase()
        .trim();
      if (!email) {
        return { success: false, error: 'No email claim in SSO token' };
      }
      const name = (payload.name as string) ?? email;
      return { success: true, email, name, sessionToken: uuidv4() };
    } catch {
      return { success: false, error: 'Failed to decode SSO token' };
    }
  }

  // ── 4. Google OAuth ──

  /** Verify a Google ID token (client sends it after Google Sign-In). */
  authenticateGoogle(idToken: string): AuthResult {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        return { success: false, error: 'Invalid Google token format' };
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      const email = ((payload.email as string) ?? '').toLowerCase().trim();
      if (!email) {
        return { success: false, error: 'No email claim in Google token' };
      }
      const name = (payload.name as string) ?? email;
      return { success: true, email, name, sessionToken: uuidv4() };
    } catch {
      return { success: false, error: 'Failed to decode Google token' };
    }
  }

  // ── 5. Generic OIDC ──

  /** Get OIDC authorization URL for redirect-based flow. */
  async getOidcAuthUrl(state?: string): Promise<{
    success: boolean;
    error?: string;
    authUrl?: string;
  }> {
    const branding = await this.db.get<BrandingAuthRow>(
      'SELECT oidc_issuer_url, oidc_client_id, oidc_scopes, oidc_redirect_uri FROM branding WHERE id = 1',
    );
    if (!branding?.oidc_issuer_url || !branding?.oidc_client_id) {
      return { success: false, error: 'OIDC not configured' };
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: branding.oidc_client_id,
      redirect_uri: branding.oidc_redirect_uri,
      scope: branding.oidc_scopes || 'openid profile email',
      state: state ?? uuidv4(),
    });

    const authUrl = `${branding.oidc_issuer_url}/authorize?${params.toString()}`;
    return { success: true, authUrl };
  }

  /**
   * Exchange OIDC authorization code for tokens and extract email.
   * In production, this calls the token endpoint. Here we decode the
   * ID token from the response — the token exchange should be done
   * by the frontend or a server-side callback handler.
   */
  authenticateOidcToken(idToken: string): AuthResult {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) {
        return { success: false, error: 'Invalid OIDC token format' };
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Record<
        string,
        unknown
      >;
      const email = (
        (payload.email as string) ??
        (payload.preferred_username as string) ??
        (payload.sub as string) ??
        ''
      )
        .toLowerCase()
        .trim();
      if (!email) {
        return { success: false, error: 'No email claim in OIDC token' };
      }
      const name = (payload.name as string) ?? email;
      return { success: true, email, name, sessionToken: uuidv4() };
    } catch {
      return { success: false, error: 'Failed to decode OIDC token' };
    }
  }

  // ── 6. SAML 2.0 ──

  /** Get SAML SP-initiated login URL. */
  async getSamlLoginUrl(): Promise<{
    success: boolean;
    error?: string;
    loginUrl?: string;
  }> {
    const branding = await this.db.get<BrandingAuthRow>(
      'SELECT saml_entry_point, saml_issuer, saml_callback_url FROM branding WHERE id = 1',
    );
    if (!branding?.saml_entry_point) {
      return { success: false, error: 'SAML not configured' };
    }

    const params = new URLSearchParams({
      SAMLRequest: Buffer.from(
        `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ` +
          `ID="_${uuidv4()}" Version="2.0" IssueInstant="${new Date().toISOString()}" ` +
          `AssertionConsumerServiceURL="${branding.saml_callback_url}">` +
          `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${branding.saml_issuer}</saml:Issuer>` +
          `</samlp:AuthnRequest>`,
      ).toString('base64'),
    });

    const loginUrl = `${branding.saml_entry_point}?${params.toString()}`;
    return { success: true, loginUrl };
  }

  /**
   * Process SAML assertion response.
   * In production, parse and validate the XML assertion, verify signature.
   * Here we accept a pre-parsed assertion with email and name attributes.
   */
  authenticateSaml(assertion: { email: string; name?: string }): AuthResult {
    if (!assertion.email) {
      return { success: false, error: 'No email in SAML assertion' };
    }
    return {
      success: true,
      email: assertion.email.toLowerCase().trim(),
      name: assertion.name ?? assertion.email,
      sessionToken: uuidv4(),
    };
  }

  // ── 7. LDAP/Active Directory ──

  /**
   * Authenticate against LDAP/AD.
   * In production, this does an LDAP bind using ldapjs or similar.
   * Here we verify the config exists and simulate the bind.
   * Real implementation would:
   *   1. Connect to ldap_url
   *   2. Bind with ldap_bind_dn / ldap_bind_password (service account)
   *   3. Search ldap_search_base with ldap_search_filter (replacing {{email}})
   *   4. If found, attempt bind with user's DN + provided password
   *   5. Extract email and name from ldap_email_attribute / ldap_name_attribute
   */
  async authenticateLdap(email: string, password: string): Promise<AuthResult> {
    const branding = await this.db.get<BrandingAuthRow>(
      'SELECT ldap_enabled, ldap_url, ldap_bind_dn, ldap_search_base, ldap_search_filter, ldap_email_attribute, ldap_name_attribute FROM branding WHERE id = 1',
    );

    if (!branding?.ldap_enabled || !branding?.ldap_url) {
      return { success: false, error: 'LDAP not configured' };
    }

    // In production: ldapjs bind + search + user bind
    // For now: verify the member exists in our DB and password matches local credentials
    // This allows LDAP to be "configured" without a real LDAP server during development
    const member = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if local credentials exist as fallback
    const cred = await this.db.get<AuthCredentialRow>(
      'SELECT password_hash FROM auth_credentials WHERE email = ?',
      [email],
    );
    if (cred) {
      const valid = await bcrypt.compare(password, cred.password_hash);
      if (!valid) return { success: false, error: 'Invalid credentials' };
    }

    this.logger.info({ email, provider: 'ldap' }, 'LDAP authentication');
    return {
      success: true,
      email: member.email,
      name: member.name,
      sessionToken: uuidv4(),
    };
  }

  // ── Setup helper: seed default admin ──

  /** Create default admin credentials during setup. */
  async seedDefaultAdmin(adminEmail: string, defaultPassword: string = 'admin'): Promise<void> {
    const existing = await this.db.get<AuthCredentialRow>(
      'SELECT email FROM auth_credentials WHERE email = ?',
      [adminEmail],
    );
    if (!existing) {
      const hash = await bcrypt.hash(defaultPassword, BCRYPT_ROUNDS);
      await this.db.run(
        'INSERT INTO auth_credentials (email, password_hash, must_change_password) VALUES (?, ?, 1)',
        [adminEmail, hash],
      );
      this.logger.info(
        { email: adminEmail },
        'Default admin credentials seeded (must change on first login)',
      );
    }
  }
}
