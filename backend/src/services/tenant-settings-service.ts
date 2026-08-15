import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { TenantSettingsRepository, SettingsJson, TenantSettingsRow } from '../repositories/tenant-settings-repository';
import {
  HR_DATA_RETENTION_DEFAULTS,
  HR_TERMINOLOGY_DEFAULTS,
  SCHOOL_TERMINOLOGY_DEFAULTS,
  isTenantVertical,
  schoolDataRetentionFromHr,
  validateTerminologySection,
  type TenantVertical,
} from './vertical-defaults';

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

export class SettingsValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'SettingsValidationError';
  }
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
    await this.ensureTerminologySeeded();
    this.cachedSettingsJson = await this.repo.getSettingsJson();
    this.logger.info('Tenant settings loaded');
  }

  async getFullBundle(masked = true): Promise<TenantSettingsBundle> {
    await this.ensureTerminologySeeded();
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

  /**
   * Persist column and/or settings_json updates.
   * When `terminology` is present: validate all keys (tenant-level only — three-tier
   * resolution does not apply to terminology; member/group prefs never override it).
   */
  async updateSettings(
    partial: {
      columns?: Partial<TenantSettingsRow>;
      settingsJson?: Partial<SettingsJson>;
    },
  ): Promise<void> {
    if (partial.settingsJson && 'terminology' in partial.settingsJson) {
      const existing = await this.repo.getSettingsJson();
      const base =
        existing.terminology && typeof existing.terminology === 'object'
          ? (existing.terminology as Record<string, unknown>)
          : { ...HR_TERMINOLOGY_DEFAULTS };
      const incoming = partial.settingsJson.terminology;
      const mergedTerminology =
        incoming !== null && typeof incoming === 'object' && !Array.isArray(incoming)
          ? { ...base, ...(incoming as Record<string, unknown>) }
          : incoming;
      const validated = validateTerminologySection(mergedTerminology);
      if (!validated.ok) {
        throw new SettingsValidationError(validated.error);
      }
      partial = {
        ...partial,
        settingsJson: {
          ...partial.settingsJson,
          terminology: validated.value,
        },
      };
    }

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

  /** Read tenant vertical from settings_json; null until set at setup. */
  async getVertical(): Promise<TenantVertical | null> {
    const json = await this.repo.getSettingsJson();
    const raw = json.vertical;
    return isTenantVertical(raw) ? raw : null;
  }

  /**
   * Persist vertical write-once. Same value → no-op. Different value → conflict.
   * When setting school, also merge terminology + tightened dataRetention.
   */
  async setVerticalWriteOnce(
    vertical: TenantVertical,
  ): Promise<{ ok: true } | { ok: false; error: 'vertical_immutable' }> {
    const json = await this.repo.getSettingsJson();
    const existing = json.vertical;
    if (isTenantVertical(existing)) {
      if (existing === vertical) return { ok: true };
      return { ok: false, error: 'vertical_immutable' };
    }

    const patch: Partial<SettingsJson> = { vertical };
    if (vertical === 'school') {
      patch.terminology = { ...SCHOOL_TERMINOLOGY_DEFAULTS };
      const currentRetention =
        json.dataRetention && typeof json.dataRetention === 'object'
          ? (json.dataRetention as Record<string, unknown>)
          : {};
      const hrBase = {
        ...HR_DATA_RETENTION_DEFAULTS,
        ...Object.fromEntries(
          Object.entries(currentRetention).filter(
            ([, v]) => typeof v === 'number' && Number.isFinite(v),
          ),
        ),
      } as {
        auditLogDays: number;
        chatMessageDays: number;
        clockEventDays: number;
        notificationQueueDays: number;
        webhookLogDays: number;
        eventBusRetentionDays: number;
        attendancePhotoDays: number;
        attendanceGeoDays: number;
      };
      // Ensure photo/geo keys exist on the HR base before halving (single source).
      if (typeof hrBase.attendancePhotoDays !== 'number') {
        hrBase.attendancePhotoDays = HR_DATA_RETENTION_DEFAULTS.attendancePhotoDays;
      }
      if (typeof hrBase.attendanceGeoDays !== 'number') {
        hrBase.attendanceGeoDays = HR_DATA_RETENTION_DEFAULTS.attendanceGeoDays;
      }
      patch.dataRetention = schoolDataRetentionFromHr(hrBase);
    } else {
      // Section #37 base seed — HR terminology (tenant-level only).
      patch.terminology = { ...HR_TERMINOLOGY_DEFAULTS };
    }

    await this.repo.mergeSettingsJson('default', patch);
    this.cachedSettingsJson = await this.repo.getSettingsJson();
    return { ok: true };
  }

  /**
   * Ensure settings_json includes section #37 terminology with HR defaults when absent.
   * Terminology is tenant-level only — three-tier (member → group → tenant) does not apply.
   */
  private async ensureTerminologySeeded(): Promise<void> {
    const json = await this.repo.getSettingsJson();
    const existing = json.terminology;
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      const keys = Object.keys(existing as object);
      if (keys.length > 0) return;
    }
    await this.repo.mergeSettingsJson('default', {
      terminology: { ...HR_TERMINOLOGY_DEFAULTS },
    });
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
