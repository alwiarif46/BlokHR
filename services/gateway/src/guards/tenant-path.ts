/**
 * Extract school API path tenant and enforce match against Host/session tenant.
 *
 * Upstream school paths look like: /api/{domain}/{tenantId}/...
 * e.g. /api/attendance/default/reason-codes
 */

const TENANT_RE = /^[a-z0-9_-]{1,64}$/;

/** Domains that put tenantId as the first segment after /api/{domain}/. */
const TENANTED_API_DOMAINS = new Set([
  'attendance',
  'identity',
  'fees',
  'library',
  'family-ops',
  'assessment',
  'academics',
  'timetable',
  'transport',
  'engagement',
  'compliance',
  'surveys',
]);

/**
 * Parse tenant id from an upstream school path (after /svc/:service strip).
 * Returns null when the path has no tenant segment (health, public, etc.).
 */
export function extractPathTenantId(upstreamPath: string): string | null {
  const pathOnly = String(upstreamPath || '')
    .split('?')[0]
    .replace(/\/+/g, '/');
  const parts = pathOnly.split('/').filter(Boolean);
  // Expect: api, domain, tenantId, ...
  if (parts.length < 3) return null;
  if (parts[0] !== 'api') return null;
  const domain = parts[1];
  if (!TENANTED_API_DOMAINS.has(domain)) return null;
  const tenant = decodeURIComponent(parts[2] || '')
    .trim()
    .toLowerCase();
  if (!tenant || !TENANT_RE.test(tenant)) return null;
  return tenant;
}

export type TenantMatchResult =
  | { ok: true; pathTenant: string | null }
  | { ok: false; error: 'tenant_mismatch'; pathTenant: string; expected: string };

/**
 * Require path tenant (when present) to equal Host-resolved tenant.
 * When sessionTenant is provided (staff/guardian), it must also equal Host tenant.
 */
export function assertTenantPathMatch(opts: {
  upstreamPath: string;
  hostTenant: string;
  /** Active staff/guardian session tenant; must match Host when present. */
  sessionTenant?: string | null;
}): TenantMatchResult {
  const host = String(opts.hostTenant || '')
    .trim()
    .toLowerCase();
  const pathTenant = extractPathTenantId(opts.upstreamPath);

  if (opts.sessionTenant != null && String(opts.sessionTenant).trim() !== '') {
    const session = String(opts.sessionTenant).trim().toLowerCase();
    if (session !== host) {
      return { ok: false, error: 'tenant_mismatch', pathTenant: pathTenant || session, expected: host };
    }
  }

  if (pathTenant == null) {
    return { ok: true, pathTenant: null };
  }

  if (pathTenant !== host) {
    return { ok: false, error: 'tenant_mismatch', pathTenant, expected: host };
  }

  return { ok: true, pathTenant };
}
