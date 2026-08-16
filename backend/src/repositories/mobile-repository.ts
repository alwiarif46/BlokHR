import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface DeviceTokenRow {
  [key: string]: unknown;
  id: number;
  email: string;
  platform: string;
  token: string;
  app_version: string;
  device_name: string;
  last_active: string;
  created_at: string;
}

export interface BiometricCredentialRow {
  [key: string]: unknown;
  id: number;
  email: string;
  credential_id: string;
  public_key: string;
  device_name: string;
  last_used: string | null;
  created_at: string;
}

export interface LocationBreadcrumbRow {
  [key: string]: unknown;
  id: number;
  email: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  recorded_at: string;
}

export class MobileRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Device tokens ──

  async registerDevice(data: {
    email: string;
    platform: string;
    token: string;
    appVersion?: string;
    deviceName?: string;
  }): Promise<DeviceTokenRow> {
    // Upsert: if same email+token exists, update last_active
    await this.db.run(
      `INSERT INTO device_tokens (email, platform, token, app_version, device_name)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email, token) DO UPDATE SET
       platform = excluded.platform, app_version = excluded.app_version,
       device_name = excluded.device_name, last_active = datetime('now')`,
      [data.email, data.platform, data.token, data.appVersion ?? '', data.deviceName ?? ''],
    );
    const row = await this.db.get<DeviceTokenRow>(
      'SELECT * FROM device_tokens WHERE email = ? AND token = ?',
      [data.email, data.token],
    );
    if (!row) throw new Error('Failed to register device');
    return row;
  }

  async getDevicesByEmail(email: string): Promise<DeviceTokenRow[]> {
    return this.db.all<DeviceTokenRow>(
      'SELECT * FROM device_tokens WHERE email = ? ORDER BY last_active DESC',
      [email],
    );
  }

  async getTokensByEmails(emails: string[]): Promise<DeviceTokenRow[]> {
    if (emails.length === 0) return [];
    const placeholders = emails.map(() => '?').join(',');
    return this.db.all<DeviceTokenRow>(
      `SELECT * FROM device_tokens WHERE email IN (${placeholders}) ORDER BY email`,
      emails,
    );
  }

  async removeDevice(email: string, token: string): Promise<void> {
    await this.db.run('DELETE FROM device_tokens WHERE email = ? AND token = ?', [email, token]);
  }

  async removeAllDevices(email: string): Promise<void> {
    await this.db.run('DELETE FROM device_tokens WHERE email = ?', [email]);
  }

  // ── Biometric credentials ──

  async registerCredential(data: {
    email: string;
    credentialId: string;
    publicKey: string;
    deviceName?: string;
  }): Promise<BiometricCredentialRow> {
    await this.db.run(
      `INSERT INTO biometric_credentials (email, credential_id, public_key, device_name)
       VALUES (?, ?, ?, ?)`,
      [data.email, data.credentialId, data.publicKey, data.deviceName ?? ''],
    );
    const row = await this.db.get<BiometricCredentialRow>(
      'SELECT * FROM biometric_credentials WHERE credential_id = ?',
      [data.credentialId],
    );
    if (!row) throw new Error('Failed to register credential');
    return row;
  }

  async getCredentialById(credentialId: string): Promise<BiometricCredentialRow | null> {
    return this.db.get<BiometricCredentialRow>(
      'SELECT * FROM biometric_credentials WHERE credential_id = ?',
      [credentialId],
    );
  }

  async getCredentialsByEmail(email: string): Promise<BiometricCredentialRow[]> {
    return this.db.all<BiometricCredentialRow>(
      'SELECT * FROM biometric_credentials WHERE email = ? ORDER BY created_at DESC',
      [email],
    );
  }

  async touchCredential(credentialId: string): Promise<void> {
    await this.db.run(
      "UPDATE biometric_credentials SET last_used = datetime('now') WHERE credential_id = ?",
      [credentialId],
    );
  }

  async removeCredential(credentialId: string): Promise<void> {
    await this.db.run('DELETE FROM biometric_credentials WHERE credential_id = ?', [credentialId]);
  }

  // ── Location breadcrumbs ──

  async recordBreadcrumb(data: {
    email: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
  }): Promise<LocationBreadcrumbRow> {
    const result = await this.db.run(
      'INSERT INTO location_breadcrumbs (email, latitude, longitude, accuracy) VALUES (?, ?, ?, ?)',
      [data.email, data.latitude, data.longitude, data.accuracy ?? 0],
    );
    const row = await this.db.get<LocationBreadcrumbRow>(
      'SELECT * FROM location_breadcrumbs WHERE id = ?',
      [result.lastInsertRowid],
    );
    if (!row) throw new Error('Failed to record breadcrumb');
    return row;
  }

  async getBreadcrumbs(
    email: string,
    startDate?: string,
    endDate?: string,
    limit?: number,
  ): Promise<LocationBreadcrumbRow[]> {
    const conds: string[] = ['email = ?'];
    const params: unknown[] = [email];
    if (startDate) {
      conds.push('recorded_at >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conds.push('recorded_at <= ?');
      params.push(endDate + 'T23:59:59');
    }
    const lim = limit ?? 500;
    return this.db.all<LocationBreadcrumbRow>(
      `SELECT * FROM location_breadcrumbs WHERE ${conds.join(' AND ')} ORDER BY recorded_at DESC LIMIT ?`,
      [...params, lim],
    );
  }

  async getLatestBreadcrumb(email: string): Promise<LocationBreadcrumbRow | null> {
    return this.db.get<LocationBreadcrumbRow>(
      'SELECT * FROM location_breadcrumbs WHERE email = ? ORDER BY recorded_at DESC, id DESC LIMIT 1',
      [email],
    );
  }
}
