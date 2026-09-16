/**
 * Legacy HR path rewrites → time-tracking / overtime microservices.
 * Mounted before the monolith `/api` catch-all so existing flat contracts
 * (`/api/clients`, `/api/overtime`, …) keep working during migration.
 */

import type { ServiceName } from '../config';

export interface HrCompatMatch {
  service: ServiceName;
  /** Upstream path including query string (starts with /api/...). */
  upstreamPath: string;
}

function withQuery(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

/**
 * Map a legacy monolith HR path to a tenant-scoped service path.
 * @param method HTTP method
 * @param pathname path without query (e.g. /api/overtime/pending)
 * @param search query including `?` or empty
 * @param tenantId staff tenant from introspect
 */
export function resolveHrCompatRewrite(
  method: string,
  pathname: string,
  search: string,
  tenantId: string,
): HrCompatMatch | null {
  const m = method.toUpperCase();
  const tid = encodeURIComponent(tenantId || 'default');
  const path = pathname.replace(/\/+$/, '') || '/';

  // ── Time tracking ──────────────────────────────────────────────
  if (
    path === '/api/clients' ||
    path.startsWith('/api/clients/') ||
    path === '/api/projects' ||
    path.startsWith('/api/projects/') ||
    path === '/api/time-entries' ||
    path.startsWith('/api/time-entries/') ||
    path === '/api/time-summary'
  ) {
    const rest = path.slice('/api'.length); // /clients...
    return {
      service: 'time-tracking',
      upstreamPath: withQuery(`/api/time-tracking/${tid}${rest}`, search),
    };
  }

  // ── Overtime ───────────────────────────────────────────────────
  if (path === '/api/overtime/detect' && m === 'POST') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(`/api/overtime/${tid}/detect`, search),
    };
  }

  if (path === '/api/overtime/log' && m === 'POST') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(`/api/overtime/${tid}/records`, search),
    };
  }

  if (path === '/api/overtime/pending' && m === 'GET') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(`/api/overtime/${tid}/records/pending`, search),
    };
  }

  if (path === '/api/overtime/summary' && m === 'GET') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const email = params.get('email') || '';
    params.delete('email');
    const q = params.toString();
    const qs = q ? `?${q}` : '';
    if (!email) {
      return {
        service: 'overtime',
        upstreamPath: withQuery(`/api/overtime/${tid}/summary/mine`, qs),
      };
    }
    return {
      service: 'overtime',
      upstreamPath: withQuery(
        `/api/overtime/${tid}/summary/by-email/${encodeURIComponent(email)}`,
        qs,
      ),
    };
  }

  const approveMatch = path.match(/^\/api\/overtime\/([^/]+)\/approve$/);
  if (approveMatch && m === 'POST') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(
        `/api/overtime/${tid}/records/${encodeURIComponent(approveMatch[1])}/approve`,
        search,
      ),
    };
  }

  const rejectMatch = path.match(/^\/api\/overtime\/([^/]+)\/reject$/);
  if (rejectMatch && m === 'POST') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(
        `/api/overtime/${tid}/records/${encodeURIComponent(rejectMatch[1])}/reject`,
        search,
      ),
    };
  }

  if (path === '/api/overtime' && m === 'GET') {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const email = params.get('email') || '';
    params.delete('email');
    // Legacy used startDate/endDate; service accepts start/end
    if (params.has('startDate') && !params.has('start')) {
      params.set('start', params.get('startDate')!);
      params.delete('startDate');
    }
    if (params.has('endDate') && !params.has('end')) {
      params.set('end', params.get('endDate')!);
      params.delete('endDate');
    }
    const q = params.toString();
    const qs = q ? `?${q}` : '';
    if (!email) {
      return {
        service: 'overtime',
        upstreamPath: withQuery(`/api/overtime/${tid}/records/mine`, qs),
      };
    }
    return {
      service: 'overtime',
      upstreamPath: withQuery(
        `/api/overtime/${tid}/records/by-email/${encodeURIComponent(email)}`,
        qs,
      ),
    };
  }

  // Policy / requests (canonical under /api/overtime/* without tenant — rare)
  if (path === '/api/overtime/policy') {
    return {
      service: 'overtime',
      upstreamPath: withQuery(`/api/overtime/${tid}/policy`, search),
    };
  }

  if (path === '/api/overtime/requests' || path.startsWith('/api/overtime/requests/')) {
    const rest = path.slice('/api/overtime'.length);
    return {
      service: 'overtime',
      upstreamPath: withQuery(`/api/overtime/${tid}${rest}`, search),
    };
  }

  return null;
}
