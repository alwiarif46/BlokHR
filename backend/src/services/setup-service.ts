import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { EntitlementsService } from '@blokhr/entitlements';
import type { DirectoryService } from '@blokhr/directory';
import { DIRECTORY_DEFAULTS } from '@blokhr/directory';
import bcrypt from 'bcryptjs';
import { TenantSettingsService } from './tenant-settings-service';
import { isTenantVertical, type TenantVertical } from './vertical-defaults';
import { getTenantId } from '../tenant/context';
import { ensureBrandingRow, getBrandingForTenant } from '../tenant/branding-access';

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
  auth_local_enabled: number;
  auth_magic_link_enabled: number;
  license_key: string;
  license_valid: number;
}

function setupStep2Key(tenantId: string): string {
  return 'setup_step2_complete:' + tenantId;
}

export type DeploymentMode = 'cloud' | 'self_hosted';

/**
 * Setup Wizard service — 3-screen first-run configuration (per tenant).
 */
export class SetupService {
  private readonly tenantSettings: TenantSettingsService;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly options: {
      deploymentMode: DeploymentMode;
      tenantId: string;
      trialSeatLimit: number;
      entitlements?: EntitlementsService;
      directory?: DirectoryService;
      tenantSettings?: TenantSettingsService;
    },
  ) {
    this.tenantSettings =
      options.tenantSettings ?? new TenantSettingsService(db, logger);
  }

  private tid(): string {
    return getTenantId(this.options.tenantId);
  }

  /** Reject further wizard writes once this Host's tenant is already configured. */
  private async assertNotComplete(): Promise<{
    success: false;
    error: string;
    statusCode: number;
  } | null> {
    const tenantId = this.tid();
    await ensureBrandingRow(this.db, tenantId);
    const row = await getBrandingForTenant<BrandingRow>(this.db, tenantId);
    if (row && row.setup_complete === 1) {
      return { success: false, error: 'already_configured', statusCode: 409 };
    }
    return null;
  }

  async getStatus(): Promise<{
    setupComplete: boolean;
    currentStep: number;
    deploymentMode: DeploymentMode;
    vertical: TenantVertical | null;
    tenantId: string;
    branding: Record<string, unknown>;
  }> {
    const tenantId = this.tid();
    await ensureBrandingRow(this.db, tenantId);
    const row = await getBrandingForTenant<BrandingRow>(this.db, tenantId);
    const vertical = await this.tenantSettings.getVertical();
    if (!row) {
      return {
        setupComplete: false,
        currentStep: 1,
        deploymentMode: this.options.deploymentMode,
        vertical,
        tenantId,
        branding: {},
      };
    }

    const setupComplete = row.setup_complete === 1;
    const step2Done = await this.db.get<{ value_json: string }>(
      'SELECT value_json FROM kv_store WHERE key = ?',
      [setupStep2Key(tenantId)],
    );
    let currentStep = 1;
    if (row.company_name) currentStep = 2;
    if (
      row.msal_client_id ||
      row.google_oauth_client_id ||
      step2Done?.value_json === 'true'
    ) {
      currentStep = 3;
    }
    if (setupComplete) currentStep = 3;

    let entitlement: Record<string, unknown> | null = null;
    if (this.options.entitlements) {
      const ent = await this.options.entitlements.get(tenantId);
      if (ent) entitlement = ent as unknown as Record<string, unknown>;
    }

    return {
      setupComplete,
      currentStep,
      deploymentMode: this.options.deploymentMode,
      vertical,
      tenantId,
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
        authLocalEnabled: row.auth_local_enabled !== 0,
        authMagicLinkEnabled: row.auth_magic_link_enabled === 1,
        licenseKey: row.license_key,
        licenseValid: row.license_valid === 1,
        setupComplete,
        entitlement,
      },
    };
  }

  async saveStep1(data: {
    companyName: string;
    tagline?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    cardFooterText?: string;
    emailFromName?: string;
    emailFromAddress?: string;
  }): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    if (!data.companyName) {
      return { success: false, error: 'Company name is required' };
    }

    const blocked = await this.assertNotComplete();
    if (blocked) return blocked;

    const tenantId = this.tid();
    await ensureBrandingRow(this.db, tenantId);
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
       WHERE tenant_id = ?`,
      [
        data.companyName,
        data.tagline ?? '',
        data.logoUrl ?? '',
        data.faviconUrl ?? '',
        data.primaryColor ?? '#F5A623',
        data.cardFooterText ?? data.companyName,
        data.emailFromName ?? data.companyName,
        data.emailFromAddress ?? '',
        tenantId,
      ],
    );

    this.logger.info(
      { companyName: data.companyName, tenantId },
      'Setup step 1 saved: Company & Branding',
    );
    return { success: true };
  }

  async saveStep2(data: {
    authLocalEnabled?: boolean;
    authMagicLinkEnabled?: boolean;
    msalClientId?: string;
    msalTenantId?: string;
    googleOAuthClientId?: string;
  }): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    const blocked = await this.assertNotComplete();
    if (blocked) return blocked;

    const localOn = data.authLocalEnabled === true;
    const magicOn = data.authMagicLinkEnabled === true;
    const hasMsal = !!data.msalClientId;
    const hasGoogle = !!data.googleOAuthClientId;

    if (!localOn && !magicOn && !hasMsal && !hasGoogle) {
      return {
        success: false,
        error: 'At least one auth provider must be configured',
      };
    }

    const authLocalEnabled = data.authLocalEnabled === false ? 0 : 1;
    const authMagicLinkEnabled = magicOn ? 1 : 0;
    const tenantId = this.tid();
    await ensureBrandingRow(this.db, tenantId);

    await this.db.run(
      `UPDATE branding SET
         auth_local_enabled = ?,
         auth_magic_link_enabled = ?,
         msal_client_id = ?,
         msal_tenant_id = ?,
         google_oauth_client_id = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ?`,
      [
        authLocalEnabled,
        authMagicLinkEnabled,
        data.msalClientId ?? '',
        data.msalTenantId ?? '',
        data.googleOAuthClientId ?? '',
        tenantId,
      ],
    );

    await this.db.run(
      `INSERT OR REPLACE INTO kv_store (key, value_json, updated_at)
       VALUES (?, 'true', datetime('now'))`,
      [setupStep2Key(tenantId)],
    );

    this.logger.info(
      {
        tenantId,
        authLocalEnabled: authLocalEnabled === 1,
        authMagicLinkEnabled: magicOn,
        hasMsal,
        hasGoogle,
      },
      'Setup step 2 saved: Auth Configuration',
    );
    return { success: true };
  }

  async saveStep3(data: {
    adminEmail: string;
    licenseToken?: string;
    vertical?: TenantVertical;
  }): Promise<{
    success: boolean;
    error?: string;
    statusCode?: number;
    entitlement?: unknown;
  }> {
    if (!data.adminEmail) {
      return { success: false, error: 'Admin email is required' };
    }

    const blocked = await this.assertNotComplete();
    if (blocked) return blocked;

    const tenantId = this.tid();
    const vertical: TenantVertical =
      data.vertical !== undefined ? data.vertical : 'hr';
    if (!isTenantVertical(vertical)) {
      return { success: false, error: 'vertical must be hr or school', statusCode: 400 };
    }

    const verticalResult = await this.tenantSettings.setVerticalWriteOnce(vertical);
    if (!verticalResult.ok) {
      return {
        success: false,
        error: 'vertical_immutable',
        statusCode: 409,
      };
    }

    if (!this.options.entitlements) {
      return { success: false, error: 'Entitlements service is not available' };
    }

    let entitlement: unknown;
    let licenseValid = 0;
    let licenseKeyStored = '';

    if (this.options.deploymentMode === 'self_hosted') {
      const token = data.licenseToken?.trim() || '';
      if (!token) {
        return { success: false, error: 'Signed license token is required for self-hosted setup' };
      }
      const activated = await this.options.entitlements.activateSignedLicense(tenantId, token);
      if (!activated.success) {
        return { success: false, error: activated.error ?? 'Invalid license' };
      }
      entitlement = activated.entitlement;
      licenseValid = 1;
      licenseKeyStored = token;
    } else {
      entitlement = await this.options.entitlements.startCloudTrial(
        tenantId,
        this.options.trialSeatLimit,
        vertical,
      );
      licenseValid = 1;
      licenseKeyStored = 'cloud-trial';
    }

    await ensureBrandingRow(this.db, tenantId);
    await this.db.run(
      `UPDATE branding SET
         license_key = ?,
         license_valid = ?,
         setup_complete = 1,
         updated_at = datetime('now')
       WHERE tenant_id = ?`,
      [licenseKeyStored, licenseValid, tenantId],
    );

    await this.db.run('INSERT OR IGNORE INTO admins (tenant_id, email) VALUES (?, ?)', [
      tenantId,
      data.adminEmail.toLowerCase().trim(),
    ]);

    const adminEmail = data.adminEmail.toLowerCase().trim();
    const adminName = adminEmail.split('@')[0].replace(/[._-]/g, ' ');

    const tzRow = await this.db.get<{ primary_timezone: string }>(
      'SELECT primary_timezone FROM tenant_settings WHERE id = ?',
      [tenantId],
    );
    const tz = tzRow?.primary_timezone || 'Asia/Kolkata';

    await this.db.run(
      `INSERT OR IGNORE INTO groups (id, name, shift_start, shift_end, timezone)
       VALUES (?, 'General', ?, ?, ?)`,
      [
        DIRECTORY_DEFAULTS.DEFAULT_GROUP_ID,
        DIRECTORY_DEFAULTS.DEFAULT_SHIFT_START,
        DIRECTORY_DEFAULTS.DEFAULT_SHIFT_END,
        tz,
      ],
    );

    if (this.options.directory) {
      const existing = await this.options.directory.getMember(adminEmail, tenantId);
      if (!existing) {
        const created = await this.options.directory.createMember({
          tenantId,
          email: adminEmail,
          name: adminName,
          role: 'admin',
          groupId: DIRECTORY_DEFAULTS.DEFAULT_GROUP_ID,
          timezone: tz,
          temporaryPassword: 'admin',
          skipSeatCheck: true,
        });
        if (!created.success) {
          this.logger.warn({ err: created.error }, 'Directory admin seed failed; falling back');
        } else {
          this.logger.info({ adminEmail, tenantId }, 'Admin seeded via directory service');
        }
      } else {
        await this.options.directory.updateMember(
          existing.id,
          {
            role: 'admin',
            groupId: DIRECTORY_DEFAULTS.DEFAULT_GROUP_ID,
            individualShiftStart: DIRECTORY_DEFAULTS.DEFAULT_SHIFT_START,
            individualShiftEnd: DIRECTORY_DEFAULTS.DEFAULT_SHIFT_END,
            active: true,
          },
          tenantId,
        );
        this.logger.info({ adminEmail, tenantId }, 'Existing directory admin updated');
      }
    } else {
      try {
        await this.db.run(
          `INSERT OR IGNORE INTO members (
            tenant_id, id, email, name, role, active, timezone, group_id,
            individual_shift_start, individual_shift_end
          ) VALUES (?, ?, ?, ?, 'admin', 1, ?, ?, ?, ?)`,
          [
            tenantId,
            adminEmail,
            adminEmail,
            adminName,
            tz,
            DIRECTORY_DEFAULTS.DEFAULT_GROUP_ID,
            DIRECTORY_DEFAULTS.DEFAULT_SHIFT_START,
            DIRECTORY_DEFAULTS.DEFAULT_SHIFT_END,
          ],
        );
        this.logger.info({ adminEmail }, 'Admin seeded into members table');
      } catch (err) {
        this.logger.warn({ err }, 'Could not seed admin into members table');
      }

      try {
        const hash = await bcrypt.hash('admin', 10);
        await this.db.run(
          `INSERT OR IGNORE INTO auth_credentials (tenant_id, email, password_hash, must_change_password)
           VALUES (?, ?, ?, 1)`,
          [tenantId, adminEmail, hash],
        );
        this.logger.info(
          { adminEmail, tenantId },
          'Default admin credentials seeded (password: admin, must change on login)',
        );
      } catch (err) {
        this.logger.warn(
          { err },
          'Could not seed default admin credentials (auth_credentials table may not exist)',
        );
      }
    }

    this.logger.info(
      {
        adminEmail: data.adminEmail,
        tenantId,
        deploymentMode: this.options.deploymentMode,
        licenseValid: licenseValid === 1,
      },
      'Setup step 3 saved: Admin & plan — Setup complete',
    );
    return { success: true, entitlement };
  }
}
