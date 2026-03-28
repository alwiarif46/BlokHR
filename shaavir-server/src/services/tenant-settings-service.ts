import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { TenantSettingsRepository, SettingsJson, TenantSettingsRow } from '../repositories/tenant-settings-repository';

export interface TenantSettingsBundle {
  id: string;
  platform_name: string;
  company_legal_name: string | null;
  logo_data_url: string | null;
  login_tagline: string | null;
  primary_timezone: string;
  version: string | null;
  settings_json: SettingsJson;
  created_at: string;
  updated_at: string;
}

/** Fields that should be masked in GET responses. */
const SECRET_KEYS = new Set([
  'botToken', 'appPassword', 'signingSecret', 'apiKey', 'pass',
  'secretAccessKey', 'connectionString', 'token', 'clientSecret',
]);

function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(maskSecrets);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SECRET_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
        result[key] = '****' + value.slice(-4);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = maskSecrets(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

export class TenantSettingsService {
  private readonly repo: TenantSettingsRepository;
  private cachedSettingsJson: SettingsJson | null = null;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {
    this.repo = new TenantSettingsRepository(db);
  }

  async load(): Promise<void> {
    this.cachedSettingsJson = await this.repo.getSettingsJson();
    this.logger.info('Tenant settings loaded');
  }

  async getFullBundle(masked = true): Promise<TenantSettingsBundle> {
    const row = await this.repo.get();
    let settingsJson: SettingsJson;
    try {
      settingsJson = JSON.parse(row.settings_json) as SettingsJson;
    } catch {
      settingsJson = {};
    }
    return {
      id: row.id,
      platform_name: row.platform_name,
      company_legal_name: row.company_legal_name,
      logo_data_url: row.logo_data_url,
      login_tagline: row.login_tagline,
      primary_timezone: row.primary_timezone,
      version: row.version,
      settings_json: masked ? maskSecrets(settingsJson) as SettingsJson : settingsJson,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async updateSettings(
    partial: {
      columns?: Partial<TenantSettingsRow>;
      settingsJson?: Partial<SettingsJson>;
    },
  ): Promise<void> {
    if (partial.columns) {
      await this.repo.update('default', partial.columns);
    }
    if (partial.settingsJson) {
      await this.repo.mergeSettingsJson('default', partial.settingsJson);
    }
    this.cachedSettingsJson = await this.repo.getSettingsJson();
  }

  async getResolved(key: string, email?: string): Promise<unknown> {
    // 3-tier resolution: member → group → tenant_settings
    if (email) {
      // Try member-level override
      const memberPref = await this.db.get<Record<string, unknown>>(
        'SELECT * FROM member_preferences WHERE member_id = ?',
        [email],
      );
      if (memberPref && key in memberPref && memberPref[key] !== null) {
        return memberPref[key];
      }
    }
    // Fall back to tenant settings_json
    const json = await this.repo.getSettingsJson();
    const parts = key.split('.');
    let current: unknown = json;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  getCredential(envKey: string, jsonPath: string): string {
    const envVal = process.env[envKey]?.trim();
    if (envVal) return envVal;
    return this.getNestedJsonValue(jsonPath) ?? '';
  }

  private getNestedJsonValue(path: string): string | undefined {
    const parts = path.split('.');
    let current: unknown = this.cachedSettingsJson;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : undefined;
  }
}
