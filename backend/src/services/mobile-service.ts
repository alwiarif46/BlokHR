import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import {
  MobileRepository,
  type DeviceTokenRow,
  type BiometricCredentialRow,
  type LocationBreadcrumbRow,
} from '../repositories/mobile-repository';
import { TimesheetRepository } from '../repositories/timesheet-repository';
import { TimesheetService } from './timesheet-service';

// ── Result types ──

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

interface SettingsRow {
  [key: string]: unknown;
  location_tracking_enabled: number;
  location_tracking_interval_seconds: number;
}

// ── Batch approval types ──

export interface BatchApprovalItem {
  type: 'leave' | 'regularization' | 'overtime' | 'timesheet';
  id: string;
  action: 'approve' | 'reject';
  role?: string;
  reason?: string;
}

export interface BatchApprovalResult {
  id: string;
  type: string;
  action: string;
  success: boolean;
  error?: string;
}

// ── Deep link generation ──

const APP_SCHEME = 'shaavir';

export function generateDeepLink(
  entityType: string,
  entityId: string,
  webBaseUrl?: string,
): { appLink: string; webLink: string } {
  const appLink = `${APP_SCHEME}://${entityType}/${entityId}`;
  const webLink = webBaseUrl
    ? `${webBaseUrl}/${entityType}/${entityId}`
    : `/${entityType}/${entityId}`;
  return { appLink, webLink };
}

const VALID_PLATFORMS = ['android', 'ios', 'web'];

/**
 * Mobile-native features service.
 * Handles device registration, biometric auth, location tracking,
 * expense receipts, and batch approvals across entity types.
 */
export class MobileService {
  private readonly repo: MobileRepository;
  private readonly timesheetService: TimesheetService;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
  ) {
    this.repo = new MobileRepository(db);
    this.timesheetService = new TimesheetService(new TimesheetRepository(db), logger);
  }

  // ── Device registration ──

  async registerDevice(data: {
    email: string;
    platform: string;
    token: string;
    appVersion?: string;
    deviceName?: string;
  }): Promise<ServiceResult<DeviceTokenRow>> {
    if (!data.email) return { success: false, error: 'email is required' };
    if (!data.token) return { success: false, error: 'token is required' };
    if (!VALID_PLATFORMS.includes(data.platform)) {
      return {
        success: false,
        error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}`,
      };
    }

    const member = await this.db.get<MemberRow>(
      'SELECT email FROM members WHERE email = ? AND active = 1',
      [data.email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    const device = await this.repo.registerDevice(data);
    this.logger.info({ email: data.email, platform: data.platform }, 'Device registered');
    return { success: true, data: device };
  }

  async getDevicesByEmail(email: string): Promise<DeviceTokenRow[]> {
    return this.repo.getDevicesByEmail(email);
  }

  async removeDevice(email: string, token: string): Promise<ServiceResult> {
    await this.repo.removeDevice(email, token);
    return { success: true };
  }

  /**
   * Get push tokens for a list of recipient emails.
   * Used by notification adapters (FCM/APNs) to resolve tokens.
   */
  async getTokensForRecipients(emails: string[]): Promise<DeviceTokenRow[]> {
    return this.repo.getTokensByEmails(emails);
  }

  // ── Biometric auth ──

  async registerBiometric(data: {
    email: string;
    credentialId: string;
    publicKey: string;
    deviceName?: string;
  }): Promise<ServiceResult<BiometricCredentialRow>> {
    if (!data.credentialId) return { success: false, error: 'credentialId is required' };
    if (!data.publicKey) return { success: false, error: 'publicKey is required' };

    const member = await this.db.get<MemberRow>(
      'SELECT email FROM members WHERE email = ? AND active = 1',
      [data.email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    // Check for duplicate credential ID
    const existing = await this.repo.getCredentialById(data.credentialId);
    if (existing) return { success: false, error: 'Credential ID already registered' };

    const cred = await this.repo.registerCredential(data);
    this.logger.info(
      { email: data.email, credentialId: data.credentialId },
      'Biometric credential registered',
    );
    this.logAudit('biometric_credential', data.credentialId, 'registered', data.email, {});
    return { success: true, data: cred };
  }

  /**
   * Authenticate via biometric credential.
   * In production, the client sends a signed challenge; the server verifies
   * the signature against the stored public key. Here we validate the
   * credential exists and belongs to an active member, then issue a session token.
   */
  async authenticateBiometric(
    credentialId: string,
  ): Promise<ServiceResult<{ email: string; name: string; sessionToken: string }>> {
    const cred = await this.repo.getCredentialById(credentialId);
    if (!cred) return { success: false, error: 'Credential not found' };

    const member = await this.db.get<MemberRow>(
      'SELECT email, name FROM members WHERE email = ? AND active = 1',
      [cred.email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    // Touch last_used
    await this.repo.touchCredential(credentialId);

    // Generate a session token (in production, this would be a JWT)
    const sessionToken = uuidv4();

    this.logger.info({ email: member.email, credentialId }, 'Biometric authentication successful');

    return {
      success: true,
      data: {
        email: member.email,
        name: member.name,
        sessionToken,
      },
    };
  }

  async getCredentialsByEmail(email: string): Promise<BiometricCredentialRow[]> {
    return this.repo.getCredentialsByEmail(email);
  }

  async removeCredential(credentialId: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getCredentialById(credentialId);
    if (!existing) return { success: false, error: 'Credential not found' };

    await this.repo.removeCredential(credentialId);
    this.logAudit('biometric_credential', credentialId, 'removed', actorEmail, {});
    return { success: true };
  }

  // ── Location breadcrumbs ──

  async recordBreadcrumb(data: {
    email: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }): Promise<ServiceResult<LocationBreadcrumbRow>> {
    // Check if tracking is enabled
    const settings = await this.db.get<SettingsRow>(
      'SELECT location_tracking_enabled FROM system_settings WHERE id = 1',
    );
    if (!settings?.location_tracking_enabled) {
      return { success: false, error: 'Location tracking is not enabled' };
    }

    // Validate coordinates
    if (
      data.latitude < -90 ||
      data.latitude > 90 ||
      data.longitude < -180 ||
      data.longitude > 180
    ) {
      return { success: false, error: 'Invalid coordinates' };
    }

    const breadcrumb = await this.repo.recordBreadcrumb(data);
    return { success: true, data: breadcrumb };
  }

  async getBreadcrumbs(
    email: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
  ): Promise<LocationBreadcrumbRow[]> {
    return this.repo.getBreadcrumbs(email, startDate, endDate, limit);
  }

  async getLatestLocation(email: string): Promise<LocationBreadcrumbRow | null> {
    return this.repo.getLatestBreadcrumb(email);
  }

  async getTrackingSettings(): Promise<{
    enabled: boolean;
    intervalSeconds: number;
  }> {
    const settings = await this.db.get<SettingsRow>(
      'SELECT location_tracking_enabled, location_tracking_interval_seconds FROM system_settings WHERE id = 1',
    );
    return {
      enabled: !!settings?.location_tracking_enabled,
      intervalSeconds: settings?.location_tracking_interval_seconds ?? 300,
    };
  }

  async updateTrackingSettings(
    enabled: boolean,
    intervalSeconds?: number,
    actorEmail?: string,
  ): Promise<ServiceResult> {
    const sets: string[] = ['location_tracking_enabled = ?'];
    const vals: unknown[] = [enabled ? 1 : 0];
    if (intervalSeconds !== undefined) {
      sets.push('location_tracking_interval_seconds = ?');
      vals.push(intervalSeconds);
    }
    await this.db.run(
      `UPDATE system_settings SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = 1`,
      vals,
    );
    this.logAudit('system_settings', 'location_tracking', 'updated', actorEmail ?? 'system', {
      enabled,
      intervalSeconds,
    });
    return { success: true };
  }

  // ── Batch approvals ──

  /**
   * Process multiple approvals/rejections across entity types in a single call.
   * Each item is processed independently — one failure does not abort the batch.
   * Returns per-item results so the client knows which succeeded and which failed.
   */
  async batchApprove(
    items: BatchApprovalItem[],
    approverEmail: string,
  ): Promise<BatchApprovalResult[]> {
    const results: BatchApprovalResult[] = [];

    for (const item of items) {
      try {
        let success = false;
        let error: string | undefined;

        if (item.type === 'leave') {
          const r = await this.approveOrRejectGeneric('leave_requests', item, approverEmail);
          success = r.success;
          error = r.error;
        } else if (item.type === 'regularization') {
          const r = await this.approveOrRejectGeneric('regularizations', item, approverEmail);
          success = r.success;
          error = r.error;
        } else if (item.type === 'overtime') {
          const r = await this.approveOrRejectGeneric('overtime_records', item, approverEmail);
          success = r.success;
          error = r.error;
        } else if (item.type === 'timesheet') {
          const r = await this.approveOrRejectTimesheet(item, approverEmail);
          success = r.success;
          error = r.error;
        } else {
          error = `Unknown type: ${item.type as string}`;
        }

        results.push({
          id: item.id,
          type: item.type,
          action: item.action,
          success,
          error,
        });
      } catch (err) {
        results.push({
          id: item.id,
          type: item.type,
          action: item.action,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    this.logger.info(
      {
        total: items.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        approver: approverEmail,
      },
      'Batch approval processed',
    );

    return results;
  }

  /**
   * Timesheets go through TimesheetService so a batch decision applies the same
   * status guards, approver checks, audit fields, and events as the single-item route.
   */
  private async approveOrRejectTimesheet(
    item: BatchApprovalItem,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    let result: { success: boolean; error?: string };
    if (item.action === 'approve') {
      result = await this.timesheetService.approve(item.id, approverEmail);
    } else if (item.action === 'reject') {
      result = await this.timesheetService.reject(item.id, approverEmail, item.reason ?? '');
    } else {
      return { success: false, error: 'Invalid action' };
    }

    if (result.success) {
      this.logAudit(item.type, item.id, `batch_${item.action}`, approverEmail, {
        reason: item.reason ?? '',
      });
    }
    return result;
  }

  /**
   * Generic approve/reject for tables that use a status column.
   * For leaves and regularizations, the actual approval logic should go through
   * the existing LeaveService/RegularizationService. This is a simplified path
   * for batch mobile approvals — it directly updates the status column.
   * In production, this would call the service methods; for now it demonstrates
   * the batch pattern with direct DB updates.
   */
  private async approveOrRejectGeneric(
    table: string,
    item: BatchApprovalItem,
    approverEmail: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Verify the row exists
    const row = await this.db.get<{ id: string; status: string; [key: string]: unknown }>(
      `SELECT id, status FROM ${table} WHERE id = ?`,
      [item.id],
    );
    if (!row) return { success: false, error: `${item.type} not found` };

    // Different tables use different status value conventions
    const statusMap: Record<string, { approve: string; reject: string }> = {
      leave_requests: { approve: 'Approved', reject: 'Rejected' },
      regularizations: { approve: 'approved', reject: 'rejected' },
      overtime_records: { approve: 'approved', reject: 'rejected' },
    };
    const statuses = statusMap[table] ?? { approve: 'approved', reject: 'rejected' };

    if (item.action === 'approve') {
      await this.db.run(
        `UPDATE ${table} SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [statuses.approve, item.id],
      );
    } else if (item.action === 'reject') {
      await this.db.run(
        `UPDATE ${table} SET status = ?, updated_at = datetime('now') WHERE id = ?`,
        [statuses.reject, item.id],
      );
    } else {
      return { success: false, error: 'Invalid action' };
    }

    this.logAudit(item.type, item.id, `batch_${item.action}`, approverEmail, {
      reason: item.reason ?? '',
    });
    return { success: true };
  }

  // ── Deep links ──

  generateDeepLink(
    entityType: string,
    entityId: string,
    webBaseUrl?: string,
  ): { appLink: string; webLink: string } {
    return generateDeepLink(entityType, entityId, webBaseUrl);
  }

  // ── Audit helper ──

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}
