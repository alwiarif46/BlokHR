import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import bcrypt from 'bcryptjs';

interface BrandingRow {
  [key: string]: unknown;
  setup_complete: number;
  company_name: string;
  tagline: string;
  logo_url: string;
  favicon_url: string;
  primary_color: string;
  card_footer_text: string;
  email_from_name: string;
  email_from_address: string;
  msal_client_id: string;
  msal_tenant_id: string;
  google_oauth_client_id: string;
  license_key: string;
  license_valid: number;
}

/**
 * Setup Wizard service — 3-screen first-run configuration.
 *
 * Screen 1: Company & Branding (name, tagline, logo, colors)
 * Screen 2: Auth Configuration (MSAL + Google OAuth client IDs)
 * Screen 3: License & Admin Setup (license key, first admin, marks setup complete)
 *
 * The wizard checks `branding.setup_complete` to determine if setup is needed.
 * Once complete, these endpoints still work for admin reconfiguration.
 */
export class SetupService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /** Check setup status and determine which step the user is on. */
  async getStatus(): Promise<{
    setupComplete: boolean;
    currentStep: number;
    branding: Record<string, unknown>;
  }> {
    const row = await this.db.get<BrandingRow>('SELECT * FROM branding WHERE id = 1');
    if (!row) {
      return { setupComplete: false, currentStep: 1, branding: {} };
    }

    const setupComplete = row.setup_complete === 1;
    let currentStep = 1;
    if (row.company_name) currentStep = 2;
    if (row.msal_client_id || row.google_oauth_client_id) currentStep = 3;
    if (setupComplete) currentStep = 3;

    return {
      setupComplete,
      currentStep,
      branding: {
        companyName: row.company_name,
        tagline: row.tagline,
        logoUrl: row.logo_url,
        faviconUrl: row.favicon_url,
        primaryColor: row.primary_color,
        cardFooterText: row.card_footer_text,
        emailFromName: row.email_from_name,
        emailFromAddress: row.email_from_address,
        msalClientId: row.msal_client_id,
        msalTenantId: row.msal_tenant_id,
        googleOAuthClientId: row.google_oauth_client_id,
        licenseKey: row.license_key,
        licenseValid: row.license_valid === 1,
        setupComplete,
      },
    };
  }

  /** Step 1: Save company & branding info. */
  async saveStep1(data: {
    companyName: string;
    tagline?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    cardFooterText?: string;
    emailFromName?: string;
    emailFromAddress?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!data.companyName) {
      return { success: false, error: 'Company name is required' };
    }

    await this.db.run(
      `UPDATE branding SET
         company_name = ?,
         tagline = ?,
         logo_url = ?,
         favicon_url = ?,
         primary_color = ?,
         card_footer_text = ?,
         email_from_name = ?,
         email_from_address = ?,
         updated_at = datetime('now')
       WHERE id = 1`,
      [
        data.companyName,
        data.tagline ?? '',
        data.logoUrl ?? '',
        data.faviconUrl ?? '',
        data.primaryColor ?? '#F5A623',
        data.cardFooterText ?? data.companyName,
        data.emailFromName ?? data.companyName,
        data.emailFromAddress ?? '',
      ],
    );

    this.logger.info({ companyName: data.companyName }, 'Setup step 1 saved: Company & Branding');
    return { success: true };
  }

  /** Step 2: Save auth provider configuration. */
  async saveStep2(data: {
    msalClientId?: string;
    msalTenantId?: string;
    googleOAuthClientId?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!data.msalClientId && !data.googleOAuthClientId) {
      return {
        success: false,
        error: 'At least one auth provider (Microsoft or Google) must be configured',
      };
    }

    await this.db.run(
      `UPDATE branding SET
         msal_client_id = ?,
         msal_tenant_id = ?,
         google_oauth_client_id = ?,
         updated_at = datetime('now')
       WHERE id = 1`,
      [data.msalClientId ?? '', data.msalTenantId ?? '', data.googleOAuthClientId ?? ''],
    );

    this.logger.info(
      {
        hasMsal: !!data.msalClientId,
        hasGoogle: !!data.googleOAuthClientId,
      },
      'Setup step 2 saved: Auth Configuration',
    );
    return { success: true };
  }

  /** Step 3: Save license key, create first admin, mark setup complete. */
  async saveStep3(data: {
    licenseKey: string;
    adminEmail: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!data.adminEmail) {
      return { success: false, error: 'Admin email is required' };
    }

    // Validate license key (basic format check — real validation would call a license server)
    const licenseValid = data.licenseKey ? data.licenseKey.length >= 8 : false;

    await this.db.run(
      `UPDATE branding SET
         license_key = ?,
         license_valid = ?,
         setup_complete = 1,
         updated_at = datetime('now')
       WHERE id = 1`,
      [data.licenseKey ?? '', licenseValid ? 1 : 0],
    );

    // Insert the first admin
    await this.db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', [
      data.adminEmail.toLowerCase().trim(),
    ]);

    // Also insert into members table so the admin can clock in and appear on the board
    const adminEmail = data.adminEmail.toLowerCase().trim();
    const adminName = adminEmail.split('@')[0].replace(/[._-]/g, ' ');
    try {
      await this.db.run(
        `INSERT OR IGNORE INTO members (
          id, email, name, role, active, timezone
        ) VALUES (?, ?, ?, 'admin', 1, 'Asia/Kolkata')`,
        [adminEmail, adminEmail, adminName],
      );
      this.logger.info({ adminEmail }, 'Admin seeded into members table');
    } catch (err) {
      this.logger.warn({ err }, 'Could not seed admin into members table');
    }

    // Seed default local credentials (password: 'admin', must change on first login)
    try {
      const hash = await bcrypt.hash('admin', 10);
      await this.db.run(
        `INSERT OR IGNORE INTO auth_credentials (email, password_hash, must_change_password)
         VALUES (?, ?, 1)`,
        [data.adminEmail.toLowerCase().trim(), hash],
      );
      this.logger.info(
        { adminEmail: data.adminEmail },
        'Default admin credentials seeded (password: admin, must change on login)',
      );
    } catch (err) {
      this.logger.warn(
        { err },
        'Could not seed default admin credentials (auth_credentials table may not exist)',
      );
    }

    this.logger.info(
      { adminEmail: data.adminEmail, licenseValid },
      'Setup step 3 saved: License & Admin — Setup complete',
    );
    return { success: true };
  }
}
