/**
 * Resolve BlokHR tenant id from Host / forwarded headers / env map.
 * Never trust client-supplied X-Blok-Tenant alone for public routes —
 * gateway may inject it after Host lookup.
 *
 * Keep in sync with services/gateway/src/resolve-tenant.ts.
 */

export type TenantHostMap = Record<string, string>;

/** Default reserved labels that must never become tenant ids. */
export const DEFAULT_RESERVED_SLUGS = [
  'www',
  'default',
  'api',
  'gateway',
  'admin',
  'app',
  'mail',
  'static',
  'cdn',
  'status',
  'docs',
] as const;

/** Slug shape: 3–64 chars, starts/ends alphanumeric, middle may include hyphens. */
export const TENANT_SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;


/** Parse TENANT_HOST_MAP JSON env: {"blokhr.vercel.app":"default","si.example.com":"si"} */
export function parseTenantHostMap(raw: string | undefined | null): TenantHostMap {
  if (!raw || !String(raw).trim()) return {};
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: TenantHostMap = {};
    for (const [host, tenant] of Object.entries(parsed as Record<string, unknown>)) {
      const h = String(host).trim().toLowerCase();
      const t = String(tenant ?? '')
        .trim()
        .toLowerCase();
      if (h && t) out[h] = t;
    }
    return out;
  } catch {
    return {};
  }
}

/** Parse comma-separated host list (TENANT_APEX_HOSTS). */
export function parseHostList(raw: string | undefined | null): Set<string> {
  const out = new Set<string>();
  if (!raw || !String(raw).trim()) return out;
  for (const part of String(raw).split(',')) {
    const h = normalizeHost(part);
    if (h) out.add(h);
  }
  return out;
}

/** Parse comma-separated reserved slug list. */
export function parseReservedSlugs(raw: string | undefined | null): Set<string> {
  const out = new Set<string>(DEFAULT_RESERVED_SLUGS);
  if (!raw || !String(raw).trim()) return out;
  for (const part of String(raw).split(',')) {
    const s = part.trim().toLowerCase();
    if (s) out.add(s);
  }
  return out;
}

function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] ?? '');
  return String(raw ?? '');
}

/** Strip port and lowercase host. */
export function normalizeHost(host: string): string {
  return String(host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '');
}

/** True if host is listed as an apex signup portal host. */
export function isApexHost(host: string, apexHosts: Set<string>): boolean {
  const h = normalizeHost(host);
  return !!h && apexHosts.has(h);
}

/**
 * Validate a workspace slug (tenant id).
 * Returns normalized slug or null if invalid / reserved.
 */
export function normalizeTenantSlug(
  raw: string,
  reserved: Set<string> = new Set(DEFAULT_RESERVED_SLUGS),
): string | null {
  const slug = String(raw || '')
    .trim()
    .toLowerCase();
  if (!slug || slug.length < 3 || slug.length > 64) return null;
  if (!TENANT_SLUG_RE.test(slug)) return null;
  if (reserved.has(slug)) return null;
  return slug;
}

/**
 * If Host is `{slug}.{subdomainBase}` with a single label prefix, return slug.
 * Apex hosts (exact base or listed) and reserved labels return null.
 */
export function extractSubdomainTenant(
  host: string,
  subdomainBase: string,
  reserved: Set<string>,
  apexHosts?: Set<string>,
): string | null {
  const h = normalizeHost(host);
  const base = normalizeHost(subdomainBase);
  if (!h || !base) return null;
  if (apexHosts && apexHosts.has(h)) return null;
  if (h === base) return null;
  const suffix = `.${base}`;
  if (!h.endsWith(suffix)) return null;
  const prefix = h.slice(0, -suffix.length);
  // Single label only (no nested.sub.base)
  if (!prefix || prefix.includes('.')) return null;
  return normalizeTenantSlug(prefix, reserved);
}

function candidateHosts(
  headers: Record<string, string | string[] | undefined>,
): string[] {
  const forwarded = normalizeHost(firstHeader(headers, 'x-forwarded-host'));
  const host = normalizeHost(firstHeader(headers, 'host'));
  const originHost = normalizeHost(
    (() => {
      const origin = firstHeader(headers, 'origin');
      if (!origin) return '';
      try {
        return new URL(origin).host;
      } catch {
        return '';
      }
    })(),
  );
  const refererHost = normalizeHost(
    (() => {
      const ref = firstHeader(headers, 'referer');
      if (!ref) return '';
      try {
        return new URL(ref).host;
      } catch {
        return '';
      }
    })(),
  );
  /* Do not read X-Blok-Client-Host: any client can set it and switch tenants.
   * Vercel→Railway rewrites are covered by Origin / Referer / X-Forwarded-Host. */
  const usefulForwarded = forwarded && forwarded !== host ? forwarded : '';
  const ordered = [
    usefulForwarded,
    originHost,
    refererHost,
    host,
    forwarded,
  ].filter(Boolean);
  return [...new Set(ordered)];
}

/**
 * Public Host for apex signupPortal detection behind gateway/Vercel proxies.
 * Prefer browser Origin/Referer when X-Forwarded-Host merely echoes Host
 * (Railway edge on *.up.railway.app).
 */
export function resolvePublicHost(
  headers: Record<string, string | string[] | undefined>,
): string {
  return candidateHosts(headers)[0] || '';
}

/**
 * Resolve tenant id for an HTTP request.
 * Order: TENANT_HOST_MAP → subdomain rule → trusted X-Blok-Tenant → fallback.
 */
export function resolveTenantId(opts: {
  headers: Record<string, string | string[] | undefined>;
  hostMap?: TenantHostMap;
  /** When true, accept inbound X-Blok-Tenant (gateway already resolved). */
  trustBlokTenantHeader?: boolean;
  fallback?: string;
  /** Base domain for `{slug}.base` → tenant slug (e.g. 13blok.com). */
  subdomainBase?: string;
  /** Reserved labels that cannot be tenants. */
  reservedSlugs?: Set<string>;
  /** Apex hosts that are signup portals, not workspace tenants. */
  apexHosts?: Set<string>;
}): string {
  const fallback = (opts.fallback || 'default').trim() || 'default';
  const map = opts.hostMap ?? {};
  const reserved = opts.reservedSlugs ?? new Set(DEFAULT_RESERVED_SLUGS);
  const apexHosts = opts.apexHosts ?? new Set<string>();
  const subdomainBase = (opts.subdomainBase || '').trim().toLowerCase();

  const hosts = candidateHosts(opts.headers);

  for (const candidate of hosts) {
    if (candidate && map[candidate]) return map[candidate];
  }

  if (subdomainBase) {
    for (const candidate of hosts) {
      const slug = extractSubdomainTenant(candidate, subdomainBase, reserved, apexHosts);
      if (slug) return slug;
    }
  }

  if (opts.trustBlokTenantHeader) {
    const fromHeader = firstHeader(opts.headers, 'x-blok-tenant').trim().toLowerCase();
    if (fromHeader && /^[a-z0-9_-]{1,64}$/.test(fromHeader)) return fromHeader;
  }

  return fallback;
}
