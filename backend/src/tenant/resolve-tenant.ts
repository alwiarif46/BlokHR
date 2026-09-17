/**
 * Resolve BlokHR tenant id from Host / forwarded headers / env map.
 * Never trust client-supplied X-Blok-Tenant alone for public routes —
 * gateway may inject it after Host lookup.
 */

export type TenantHostMap = Record<string, string>;

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

/**
 * Resolve tenant id for an HTTP request.
 * Order: TENANT_HOST_MAP[X-Forwarded-Host|Host] → trusted X-Blok-Tenant (gateway) → fallback.
 */
export function resolveTenantId(opts: {
  headers: Record<string, string | string[] | undefined>;
  hostMap?: TenantHostMap;
  /** When true, accept inbound X-Blok-Tenant (gateway already resolved). */
  trustBlokTenantHeader?: boolean;
  fallback?: string;
}): string {
  const fallback = (opts.fallback || 'default').trim() || 'default';
  const map = opts.hostMap ?? {};

  const forwarded = normalizeHost(firstHeader(opts.headers, 'x-forwarded-host'));
  const host = normalizeHost(firstHeader(opts.headers, 'host'));
  const originHost = normalizeHost(
    (() => {
      const origin = firstHeader(opts.headers, 'origin');
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
      const ref = firstHeader(opts.headers, 'referer');
      if (!ref) return '';
      try {
        return new URL(ref).host;
      } catch {
        return '';
      }
    })(),
  );

  for (const candidate of [forwarded, originHost, refererHost, host]) {
    if (candidate && map[candidate]) return map[candidate];
  }

  if (opts.trustBlokTenantHeader) {
    const fromHeader = firstHeader(opts.headers, 'x-blok-tenant').trim().toLowerCase();
    if (fromHeader && /^[a-z0-9_-]{1,64}$/.test(fromHeader)) return fromHeader;
  }

  return fallback;
}
