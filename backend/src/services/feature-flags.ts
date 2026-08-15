import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { Request, Response, NextFunction } from 'express';

// ── Row type ──

export interface FeatureFlagRow {
  [key: string]: unknown;
  feature_key: string;
  enabled: number;
  label: string;
  description: string;
  category: string;
  admin_only: number;
  updated_by: string;
  updated_at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
  category: string;
  adminOnly: boolean;
  updatedBy: string;
  updatedAt: string;
}

// ── Feature key to route prefix mapping ──

const FEATURE_ROUTE_MAP: Record<string, string[]> = {
  face_recognition: ['/api/face'],
  iris_scan: ['/api/iris'],
  geo_fencing: ['/api/clock/geo', '/api/geo'],
  live_chat: ['/api/channels', '/api/messages', '/api/dm'],
  ai_chatbot: ['/api/chat'],
  time_tracking: ['/api/time-tracking'],
  overtime: ['/api/overtime'],
  bd_meetings: ['/api/bd-meetings'],
  tracked_meetings: ['/api/meetings'],
  training_lms: ['/api/training'],
  org_chart: ['/api/org'],
  document_mgmt: ['/api/documents'],
  surveys: ['/api/surveys'],
  asset_mgmt: ['/api/assets'],
  visitor_mgmt: ['/api/visitors'],
  workflows: ['/api/workflows'],
  file_storage: ['/api/storage'],
  analytics: ['/api/analytics'],
};

// ── Feature key to AI tool category mapping ──

const FEATURE_TOOL_CATEGORIES: Record<string, string[]> = {
  face_recognition: ['face_recognition'],
  iris_scan: ['iris_scan'],
  geo_fencing: ['geo_fencing'],
  ai_chatbot: [],  // The chatbot itself — if off, entire /api/chat is gone
  time_tracking: ['time_tracking'],
  overtime: ['overtime'],
  bd_meetings: ['bd_meetings'],
  tracked_meetings: ['meetings'],
  training_lms: ['training'],
  org_chart: ['org_chart'],
  document_mgmt: ['documents'],
  surveys: ['surveys'],
  asset_mgmt: ['assets'],
  visitor_mgmt: ['visitors'],
  workflows: ['workflows'],
  analytics: ['reports'],
};

const ADMIN_ONLY_ROUTE_PREFIXES: string[] = [
  '/api/analytics',
  '/api/geo/zones', '/api/geo/settings',
  '/api/face/enroll', '/api/face/status', '/api/face/enrollment',
  '/api/iris/enroll', '/api/iris/status', '/api/iris/enrollment',
  '/api/export',
];

/**
 * Feature Flag Service.
 *
 * - Reads flags from the database on startup and caches in memory.
 * - Provides isEnabled() check (O(1) from cache).
 * - Provides Express middleware guard that returns 404 for disabled features.
 * - Provides filter helpers for settings bundle and AI tool list.
 * - Cache refreshes on any toggle update.
 */
export class FeatureFlagService {
  private cache: Map<string, boolean> = new Map();
  private fullCache: Map<string, FeatureFlag> = new Map();
  private loaded = false;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
  ) {}

  /** Load all flags into memory. Call once at startup. */
  async load(): Promise<void> {
    const rows = await this.db.all<FeatureFlagRow>(
      'SELECT * FROM feature_flags ORDER BY category, label', [],
    );
    this.cache.clear();
    this.fullCache.clear();
    for (const row of rows) {
      this.cache.set(row.feature_key, row.enabled === 1);
      this.fullCache.set(row.feature_key, this.toFlag(row));
    }
    this.loaded = true;
    this.logger.info(
      { total: rows.length, enabled: rows.filter(r => r.enabled === 1).length },
      'Feature flags loaded',
    );
  }

  /** Check if a feature is enabled. Returns true if unknown (fail-open for core features). */
  isEnabled(featureKey: string): boolean {
    if (!this.loaded) return true; // Not loaded yet — fail open
    const val = this.cache.get(featureKey);
    return val === undefined ? true : val; // Unknown features are enabled by default
  }

  /** Get all flags. */
  async getAll(): Promise<FeatureFlag[]> {
    if (!this.loaded) await this.load();
    return Array.from(this.fullCache.values());
  }

  /** Get only enabled flags (for frontend discovery). */
  async getEnabled(): Promise<FeatureFlag[]> {
    if (!this.loaded) await this.load();
    return Array.from(this.fullCache.values()).filter(f => f.enabled);
  }

  /** Get flags filtered by user's admin status. Non-admins only see non-adminOnly flags. */
  async getForUser(isAdmin: boolean): Promise<FeatureFlag[]> {
    if (!this.loaded) await this.load();
    const all = Array.from(this.fullCache.values());
    if (isAdmin) return all;
    return all.filter(f => !f.adminOnly);
  }

  /** Check if a feature flag is admin-only. */
  isAdminOnly(featureKey: string): boolean {
    const flag = this.fullCache.get(featureKey);
    return flag?.adminOnly ?? false;
  }

  /**
   * Express middleware factory: returns 403 for admin-only route prefixes when
   * the caller is not an admin. Requires db to look up admin status.
   */
  guardWithAdmin(db: DatabaseEngine): (req: Request, res: Response, next: NextFunction) => void {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const path = req.path;

      // Check feature flag guard first (disabled features → 404)
      for (const [featureKey, prefixes] of Object.entries(FEATURE_ROUTE_MAP)) {
        for (const prefix of prefixes) {
          if (path === prefix || path.startsWith(prefix + '/')) {
            if (!this.isEnabled(featureKey)) {
              res.status(404).json({ error: 'Not found' });
              return;
            }
          }
        }
      }

      // Check admin-only route prefixes
      const isAdminRoute = ADMIN_ONLY_ROUTE_PREFIXES.some(
        prefix => path === prefix || path.startsWith(prefix + '/'),
      );
      if (isAdminRoute) {
        const email = req.identity?.email ?? '';
        if (!email) {
          res.status(403).json({ error: 'Admin access required' });
          return;
        }
        const admin = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
        if (!admin) {
          res.status(403).json({ error: 'Admin access required' });
          return;
        }
      }

      next();
    };
  }

  /** Toggle a feature on or off. Refreshes cache immediately. */
  async toggle(
    featureKey: string,
    enabled: boolean,
    updatedBy: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = this.fullCache.get(featureKey);
    if (!existing) return { success: false, error: `Unknown feature: ${featureKey}` };

    await this.db.run(
      "UPDATE feature_flags SET enabled = ?, updated_by = ?, updated_at = datetime('now') WHERE feature_key = ?",
      [enabled ? 1 : 0, updatedBy, featureKey],
    );

    // Refresh cache immediately
    this.cache.set(featureKey, enabled);
    this.fullCache.set(featureKey, { ...existing, enabled, updatedBy, updatedAt: new Date().toISOString() });

    this.logger.info({ featureKey, enabled, updatedBy }, 'Feature flag toggled');
    return { success: true };
  }

  /** Bulk update multiple flags at once. */
  async bulkUpdate(
    updates: Array<{ key: string; enabled: boolean }>,
    updatedBy: string,
  ): Promise<{ success: boolean; updated: number }> {
    let count = 0;
    for (const u of updates) {
      const result = await this.toggle(u.key, u.enabled, updatedBy);
      if (result.success) count++;
    }
    return { success: true, updated: count };
  }

  /**
   * Express middleware factory: returns 404 for disabled features.
   * Usage: app.use(featureFlags.guard());
   *
   * Must be placed AFTER body parsing but BEFORE route handlers.
   * Checks the request path against FEATURE_ROUTE_MAP.
   */
  guard(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const path = req.path;

      for (const [featureKey, prefixes] of Object.entries(FEATURE_ROUTE_MAP)) {
        for (const prefix of prefixes) {
          if (path === prefix || path.startsWith(prefix + '/')) {
            if (!this.isEnabled(featureKey)) {
              res.status(404).json({ error: 'Not found' });
              return;
            }
          }
        }
      }

      next();
    };
  }

  /**
   * Filter AI tool definitions based on enabled features.
   * Removes tool schemas for disabled features so the LLM never sees them.
   */
  filterTools<T extends { category?: string }>(tools: T[]): T[] {
    const disabledCategories = new Set<string>();
    for (const [featureKey, categories] of Object.entries(FEATURE_TOOL_CATEGORIES)) {
      if (!this.isEnabled(featureKey)) {
        for (const cat of categories) disabledCategories.add(cat);
      }
    }
    if (disabledCategories.size === 0) return tools;
    return tools.filter(t => !t.category || !disabledCategories.has(t.category));
  }

  /**
   * Filter settings bundle keys based on enabled features.
   * Removes config sections for disabled features from the settings response.
   */
  filterSettingsKeys(keys: string[]): string[] {
    const disabledKeys = new Set<string>();
    if (!this.isEnabled('face_recognition')) disabledKeys.add('faceRecognition');
    if (!this.isEnabled('geo_fencing')) disabledKeys.add('geoFencing');
    if (!this.isEnabled('overtime')) disabledKeys.add('overtime');
    if (!this.isEnabled('time_tracking')) disabledKeys.add('timeTracking');
    if (!this.isEnabled('bd_meetings')) disabledKeys.add('bdMeetings');
    if (!this.isEnabled('tracked_meetings')) disabledKeys.add('trackedMeetings');
    if (!this.isEnabled('training_lms')) disabledKeys.add('training');
    if (!this.isEnabled('surveys')) disabledKeys.add('surveys');
    if (!this.isEnabled('asset_mgmt')) disabledKeys.add('assets');
    if (!this.isEnabled('visitor_mgmt')) disabledKeys.add('visitors');
    if (!this.isEnabled('workflows')) disabledKeys.add('workflows');
    if (disabledKeys.size === 0) return keys;
    return keys.filter(k => !disabledKeys.has(k));
  }

  private toFlag(row: FeatureFlagRow): FeatureFlag {
    return {
      key: row.feature_key,
      enabled: row.enabled === 1,
      label: row.label,
      description: row.description,
      category: row.category,
      adminOnly: (row.admin_only ?? 0) === 1,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    };
  }
}
