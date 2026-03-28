import type { DatabaseEngine } from '../db/engine';

export interface TenantSettingsRow {
  [key: string]: unknown;
  id: string;
  platform_name: string;
  company_legal_name: string | null;
  logo_data_url: string | null;
  login_tagline: string | null;
  primary_timezone: string;
  version: string | null;
  settings_json: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsJson {
  [key: string]: unknown;
}

export class TenantSettingsRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async get(id = 'default'): Promise<TenantSettingsRow> {
    const row = await this.db.get<TenantSettingsRow>(
      'SELECT * FROM tenant_settings WHERE id = ?',
      [id],
    );
    if (!row) {
      return {
        id,
        platform_name: 'BlokHR',
        company_legal_name: null,
        logo_data_url: null,
        login_tagline: null,
        primary_timezone: 'Asia/Kolkata',
        version: null,
        settings_json: '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return row;
  }

  async update(id: string, fields: Partial<TenantSettingsRow>): Promise<void> {
    const allowed = [
      'platform_name', 'company_legal_name', 'logo_data_url',
      'login_tagline', 'primary_timezone', 'version', 'settings_json',
    ] as const;
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const key of allowed) {
      if (key in fields) {
        sets.push(`${key} = ?`);
        params.push(fields[key as keyof TenantSettingsRow]);
      }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    params.push(id);
    await this.db.run(
      `UPDATE tenant_settings SET ${sets.join(', ')} WHERE id = ?`,
      params,
    );
  }

  async getSettingsJson(id = 'default'): Promise<SettingsJson> {
    const row = await this.get(id);
    try {
      return JSON.parse(row.settings_json) as SettingsJson;
    } catch {
      return {};
    }
  }

  async mergeSettingsJson(id: string, partial: Partial<SettingsJson>): Promise<void> {
    const existing = await this.getSettingsJson(id);
    const merged = deepMerge(existing, partial);
    await this.update(id, { settings_json: JSON.stringify(merged) });
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}
