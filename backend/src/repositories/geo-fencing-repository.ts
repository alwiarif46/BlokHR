import type { DatabaseEngine } from '../db/engine';

export interface GeoZoneRow {
  [key: string]: unknown;
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface GeoClockLogRow {
  [key: string]: unknown;
  id: number;
  email: string;
  action: string;
  latitude: number;
  longitude: number;
  accuracy_meters: number | null;
  matched_zone_id: number | null;
  matched_zone_name: string;
  distance_meters: number;
  inside_zone: number;
  allowed: number;
  denial_reason: string;
  created_at: string;
}

export interface GeoSettings {
  enabled: boolean;
  strict: boolean;
}

export class GeoFencingRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Zones ──

  async getActiveZones(): Promise<GeoZoneRow[]> {
    return this.db.all<GeoZoneRow>(
      'SELECT * FROM geo_zones WHERE active = 1 ORDER BY name',
      [],
    );
  }

  async getAllZones(): Promise<GeoZoneRow[]> {
    return this.db.all<GeoZoneRow>('SELECT * FROM geo_zones ORDER BY name', []);
  }

  async getZoneById(id: number): Promise<GeoZoneRow | null> {
    return this.db.get<GeoZoneRow>('SELECT * FROM geo_zones WHERE id = ?', [id]);
  }

  async createZone(data: {
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    address?: string;
  }): Promise<GeoZoneRow> {
    await this.db.run(
      `INSERT INTO geo_zones (name, latitude, longitude, radius_meters, address)
       VALUES (?, ?, ?, ?, ?)`,
      [data.name, data.latitude, data.longitude, data.radiusMeters, data.address ?? ''],
    );
    const row = await this.db.get<GeoZoneRow>(
      'SELECT * FROM geo_zones WHERE name = ? ORDER BY id DESC LIMIT 1',
      [data.name],
    );
    if (!row) throw new Error('Failed to create geo zone');
    return row;
  }

  async updateZone(id: number, fields: Record<string, unknown>): Promise<void> {
    const colMap: Record<string, string> = {
      name: 'name',
      latitude: 'latitude',
      longitude: 'longitude',
      radiusMeters: 'radius_meters',
      address: 'address',
      active: 'active',
    };
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      const col = colMap[key];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE geo_zones SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteZone(id: number): Promise<void> {
    await this.db.run('DELETE FROM geo_zones WHERE id = ?', [id]);
  }

  // ── Logs ──

  async insertLog(data: {
    email: string;
    action: string;
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    matchedZoneId?: number;
    matchedZoneName?: string;
    distanceMeters: number;
    insideZone: boolean;
    allowed: boolean;
    denialReason?: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO geo_clock_logs
         (email, action, latitude, longitude, accuracy_meters,
          matched_zone_id, matched_zone_name, distance_meters,
          inside_zone, allowed, denial_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.email,
        data.action,
        data.latitude,
        data.longitude,
        data.accuracyMeters ?? null,
        data.matchedZoneId ?? null,
        data.matchedZoneName ?? '',
        data.distanceMeters,
        data.insideZone ? 1 : 0,
        data.allowed ? 1 : 0,
        data.denialReason ?? '',
      ],
    );
  }

  async getLogs(filters: {
    email?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<GeoClockLogRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.email) {
      conditions.push('email = ?');
      params.push(filters.email);
    }
    if (filters.startDate) {
      conditions.push('created_at >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('created_at <= ?');
      params.push(filters.endDate + 'T23:59:59');
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit ?? 100;
    return this.db.all<GeoClockLogRow>(
      `SELECT * FROM geo_clock_logs ${where} ORDER BY created_at DESC LIMIT ?`,
      [...params, limit],
    );
  }

  // ── Settings ──

  async getSettings(): Promise<GeoSettings> {
    const row = await this.db.get<{
      geo_fencing_enabled: number;
      geo_fencing_strict: number;
      [key: string]: unknown;
    }>('SELECT geo_fencing_enabled, geo_fencing_strict FROM system_settings WHERE id = 1', []);
    return {
      enabled: (row?.geo_fencing_enabled ?? 0) === 1,
      strict: (row?.geo_fencing_strict ?? 0) === 1,
    };
  }

  async updateSettings(enabled: boolean, strict: boolean): Promise<void> {
    await this.db.run(
      "UPDATE system_settings SET geo_fencing_enabled = ?, geo_fencing_strict = ?, updated_at = datetime('now') WHERE id = 1",
      [enabled ? 1 : 0, strict ? 1 : 0],
    );
  }
}
