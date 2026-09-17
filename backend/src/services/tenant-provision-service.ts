/**
 * Self-serve workspace (tenant) provisioning.
 * Atomically claims a branding.tenant_id slug — never INSERT OR IGNORE.
 */
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import {
  normalizeTenantSlug,
  parseReservedSlugs,
  type TenantHostMap,
} from '../tenant/resolve-tenant';

export type SlugAvailability = 'available' | 'taken' | 'incomplete';

export class TenantProvisionService {
  private readonly reserved: Set<string>;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly options: {
      reservedSlugsRaw?: string;
      subdomainBase?: string;
      /** Used only to build workspaceUrl when subdomainBase is set. */
      hostMap?: TenantHostMap;
    } = {},
  ) {
    this.reserved = parseReservedSlugs(options.reservedSlugsRaw ?? '');
  }

  validateSlug(raw: string): string | null {
    return normalizeTenantSlug(raw, this.reserved);
  }

  workspaceUrl(slug: string): string {
    const base = (this.options.subdomainBase || '').trim().toLowerCase();
    if (base) return `https://${slug}.${base}/`;
    return `/?tenant=${encodeURIComponent(slug)}`;
  }

  async checkSlug(raw: string): Promise<{
    slug: string | null;
    status: SlugAvailability | 'invalid';
  }> {
    const slug = this.validateSlug(raw);
    if (!slug) return { slug: null, status: 'invalid' };

    const row = await this.db.get<{ setup_complete: number }>(
      'SELECT setup_complete FROM branding WHERE tenant_id = ?',
      [slug],
    );
    if (!row) return { slug, status: 'available' };
    if (row.setup_complete === 1) return { slug, status: 'taken' };
    return { slug, status: 'incomplete' };
  }

  /**
   * Atomically claim a slug via INSERT (PRIMARY KEY). Duplicate → slug_taken.
   */
  async claimSlug(raw: string): Promise<{
    success: boolean;
    statusCode: number;
    error?: string;
    tenantId?: string;
    workspaceUrl?: string;
  }> {
    const slug = this.validateSlug(raw);
    if (!slug) {
      return { success: false, statusCode: 400, error: 'invalid_slug' };
    }

    try {
      await this.db.run(
        `INSERT INTO branding (tenant_id, setup_complete, primary_color, auth_local_enabled)
         VALUES (?, 0, '#F5A623', 1)`,
        [slug],
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE|PRIMARY KEY|constraint/i.test(msg)) {
        this.logger.info({ slug }, 'Tenant slug already claimed');
        return { success: false, statusCode: 409, error: 'slug_taken' };
      }
      this.logger.error({ err, slug }, 'Tenant claim insert failed');
      return { success: false, statusCode: 500, error: 'claim_failed' };
    }

    // Ensure tenant_settings row exists for wizard vertical write-once
    await this.db.run('INSERT OR IGNORE INTO tenant_settings (id) VALUES (?)', [slug]);

    this.logger.info({ slug }, 'Tenant slug claimed');
    return {
      success: true,
      statusCode: 201,
      tenantId: slug,
      workspaceUrl: this.workspaceUrl(slug),
    };
  }
}
