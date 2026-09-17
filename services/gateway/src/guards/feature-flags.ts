/**
 * Gateway feature-flag cache — reads monolith GET /api/features?all=true.
 * Blocks /svc/* and HR compat rewrites when L2 flags are disabled.
 */

import type { Logger } from 'pino';
import type { ServiceName } from '../config';

export const SCHOOL_VERTICAL_FLAG = 'school_vertical';

/** Per-service flag requirements (all must be enabled). */
const SERVICE_FLAG_REQUIREMENTS: Partial<Record<ServiceName, string[]>> = {
  'school-identity': ['school_vertical', 'school_students'],
  'school-attendance': ['school_vertical', 'school_roll_call', 'school_attendance_admin'],
  'school-academics': ['school_vertical', 'school_academics'],
  'school-assessment': ['school_vertical', 'school_hpc', 'school_exams'],
  'school-library': ['school_vertical', 'school_library'],
  'school-surveys': ['school_vertical', 'school_parent_surveys'],
  'school-family-ops': ['school_vertical', 'parent_hub'],
  'time-tracking': ['time_tracking'],
  overtime: ['overtime'],
};

type FlagMap = Record<string, boolean>;

export interface FeatureFlagCacheOptions {
  monolithUrl: string;
  ttlMs?: number;
  fetchFn?: typeof fetch;
  logger?: Logger;
}

export class FeatureFlagCache {
  private cache: FlagMap = {};
  private loadedAt = 0;
  private readonly ttlMs: number;
  private readonly monolithUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly logger?: Logger;

  constructor(options: FeatureFlagCacheOptions) {
    this.monolithUrl = options.monolithUrl.replace(/\/$/, '');
    this.ttlMs = options.ttlMs ?? 30_000;
    this.fetchFn = options.fetchFn ?? fetch;
    this.logger = options.logger;
  }

  async refresh(force = false): Promise<void> {
    if (!force && this.loadedAt > 0 && Date.now() - this.loadedAt < this.ttlMs) {
      return;
    }
    try {
      const res = await this.fetchFn(`${this.monolithUrl}/api/features?all=true`);
      if (!res.ok) {
        this.logger?.warn({ status: res.status }, 'Feature flag refresh failed');
        return;
      }
      const body = (await res.json()) as { features?: Array<{ key: string; enabled: boolean }> };
      const next: FlagMap = {};
      for (const f of body.features ?? []) {
        next[f.key] = !!f.enabled;
      }
      this.cache = next;
      this.loadedAt = Date.now();
    } catch (err) {
      this.logger?.warn({ err }, 'Feature flag refresh error');
    }
  }

  isEnabled(key: string): boolean {
    if (key === SCHOOL_VERTICAL_FLAG) {
      return this.cache[key] === true;
    }
    const val = this.cache[key];
    return val === undefined ? true : val;
  }

  async allEnabled(keys: string[]): Promise<boolean> {
    await this.refresh();
    return keys.every((key) => this.isEnabled(key));
  }

  /**
   * School services: require school_vertical plus mapped module flags.
   * school-attendance allows roll_call OR attendance_admin.
   * school-assessment allows school_hpc OR school_exams.
   */
  async isServiceEnabled(service: ServiceName): Promise<boolean> {
    await this.refresh();
    const reqs = SERVICE_FLAG_REQUIREMENTS[service];
    if (!reqs) {
      if (service.startsWith('school-') || service === 'learning') {
        return this.isEnabled(SCHOOL_VERTICAL_FLAG);
      }
      return true;
    }
    if (reqs.includes(SCHOOL_VERTICAL_FLAG) && !this.isEnabled(SCHOOL_VERTICAL_FLAG)) {
      return false;
    }
    if (service === 'time-tracking') {
      return this.isEnabled('time_tracking');
    }
    if (service === 'overtime') {
      return this.isEnabled('overtime');
    }
    if (service === 'school-attendance') {
      return (
        this.isEnabled('school_roll_call') || this.isEnabled('school_attendance_admin')
      );
    }
    if (service === 'school-assessment') {
      return this.isEnabled('school_hpc') || this.isEnabled('school_exams');
    }
    const moduleFlags = reqs.filter((key) => key !== SCHOOL_VERTICAL_FLAG);
    return moduleFlags.every((key) => this.isEnabled(key));
  }

  async isHrCompatEnabled(pathname: string): Promise<boolean> {
    await this.refresh();
    if (
      pathname === '/api/clients' ||
      pathname.startsWith('/api/clients/') ||
      pathname === '/api/projects' ||
      pathname.startsWith('/api/projects/') ||
      pathname === '/api/time-entries' ||
      pathname.startsWith('/api/time-entries/') ||
      pathname === '/api/time-summary'
    ) {
      return this.isEnabled('time_tracking');
    }
    if (pathname === '/api/overtime' || pathname.startsWith('/api/overtime/')) {
      return this.isEnabled('overtime');
    }
    return true;
  }
}

export function createFeatureFlagCache(options: FeatureFlagCacheOptions): FeatureFlagCache {
  return new FeatureFlagCache(options);
}
