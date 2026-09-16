import type { ServiceName } from '../config';

export interface GuardianIdentity {
  tenantId: string;
  guardianId: string;
}

export interface GuardianAllowMatch {
  service: ServiceName;
  /** Upstream path including query string when present. */
  upstreamPath: string;
}

type RouteDef = {
  method: string;
  /** Path without query; supports `:param` segments. */
  pattern: string;
  service: ServiceName;
  upstream: (
    identity: GuardianIdentity,
    params: Record<string, string>,
  ) => string;
};

/**
 * Exact allowlist for guardian principal traffic.
 * Client-supplied tenant/guardian ids are never used — only introspected identity.
 */
const ROUTES: RouteDef[] = [
  {
    method: 'GET',
    pattern: '/guardian/reason-codes',
    service: 'school-attendance',
    upstream: (id) =>
      `/api/attendance/${encodeURIComponent(id.tenantId)}/reason-codes`,
  },
  {
    method: 'GET',
    pattern: '/guardian/me/students',
    service: 'school-identity',
    upstream: (id) =>
      `/api/identity/${encodeURIComponent(id.tenantId)}/guardians/${encodeURIComponent(id.guardianId)}/students`,
  },
  {
    method: 'GET',
    pattern: '/guardian/me/profile',
    service: 'school-identity',
    upstream: (id) =>
      `/api/identity/${encodeURIComponent(id.tenantId)}/guardians/${encodeURIComponent(id.guardianId)}/profile`,
  },
  {
    method: 'PATCH',
    pattern: '/guardian/me/profile',
    service: 'school-identity',
    upstream: (id) =>
      `/api/identity/${encodeURIComponent(id.tenantId)}/guardians/${encodeURIComponent(id.guardianId)}/profile`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/attendance',
    service: 'school-attendance',
    upstream: (id, params) =>
      `/api/attendance/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/summary`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/fees',
    service: 'school-fees',
    upstream: (id, params) =>
      `/api/fees/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/ledger`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/library',
    service: 'school-library',
    upstream: (id, params) =>
      `/api/library/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/library-summary`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/family/:area',
    service: 'school-family-ops',
    upstream: (id, params) =>
      `/api/family-ops/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/${encodeURIComponent(params.area!)}`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/report-cards',
    service: 'school-assessment',
    upstream: (id, params) =>
      `/api/assessment/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/report-cards`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/assignments',
    service: 'school-academics',
    upstream: (id, params) =>
      `/api/academics/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/assignments`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/timetable',
    service: 'school-timetable',
    upstream: (id, params) =>
      `/api/timetable/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/schedule`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/transport',
    service: 'school-transport',
    upstream: (id, params) =>
      `/api/transport/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/status`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/consents',
    service: 'school-identity',
    upstream: (id, params) =>
      `/api/identity/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/consents`,
  },
  {
    method: 'POST',
    pattern: '/guardian/students/:id/consents',
    service: 'school-identity',
    upstream: (id, params) =>
      `/api/identity/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/consents`,
  },
  {
    method: 'POST',
    pattern: '/guardian/reported-absences',
    service: 'school-attendance',
    upstream: (id) =>
      `/api/attendance/${encodeURIComponent(id.tenantId)}/reported-absences`,
  },
  {
    method: 'GET',
    pattern: '/guardian/threads',
    service: 'school-engagement',
    upstream: (id) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/threads`,
  },
  {
    method: 'POST',
    pattern: '/guardian/threads',
    service: 'school-engagement',
    upstream: (id) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/threads`,
  },
  {
    method: 'GET',
    pattern: '/guardian/threads/:id',
    service: 'school-engagement',
    upstream: (id, params) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/threads/${encodeURIComponent(params.id!)}`,
  },
  {
    method: 'POST',
    pattern: '/guardian/threads/:id/reply',
    service: 'school-engagement',
    upstream: (id, params) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/threads/${encodeURIComponent(params.id!)}/reply`,
  },
  {
    method: 'GET',
    pattern: '/guardian/surveys',
    service: 'school-surveys',
    upstream: (id) =>
      `/api/surveys/${encodeURIComponent(id.tenantId)}/guardian/pending`,
  },
  {
    method: 'GET',
    pattern: '/guardian/surveys/:id',
    service: 'school-surveys',
    upstream: (id, params) =>
      `/api/surveys/${encodeURIComponent(id.tenantId)}/guardian/surveys/${encodeURIComponent(params.id!)}`,
  },
  {
    method: 'POST',
    pattern: '/guardian/surveys/:id/respond',
    service: 'school-surveys',
    upstream: (id, params) =>
      `/api/surveys/${encodeURIComponent(id.tenantId)}/guardian/surveys/${encodeURIComponent(params.id!)}/respond`,
  },
  {
    method: 'GET',
    pattern: '/guardian/diary',
    service: 'school-engagement',
    upstream: (id) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/guardian/diary`,
  },
  {
    method: 'POST',
    pattern: '/guardian/diary/:id/ack',
    service: 'school-engagement',
    upstream: (id, params) =>
      `/api/engagement/${encodeURIComponent(id.tenantId)}/guardian/diary/${encodeURIComponent(params.id!)}/ack`,
  },
  {
    method: 'GET',
    pattern: '/guardian/students/:id/dsr',
    service: 'school-compliance',
    upstream: (id, params) =>
      `/api/compliance/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/dsr`,
  },
  {
    method: 'POST',
    pattern: '/guardian/students/:id/dsr',
    service: 'school-compliance',
    upstream: (id, params) =>
      `/api/compliance/${encodeURIComponent(id.tenantId)}/guardian/students/${encodeURIComponent(params.id!)}/dsr`,
  },
  // Public-ish (login-style) — mapped for resolveGuardianAllowlist; gateway also
  // proxies these without bearer before the guardian middleware.
  {
    method: 'POST',
    pattern: '/guardian/claim',
    service: 'school-identity',
    upstream: () => `/api/identity/guardian-auth/claim`,
  },
  {
    method: 'POST',
    pattern: '/guardian/otp/request',
    service: 'school-identity',
    upstream: () => `/api/identity/guardian-auth/otp/request`,
  },
  {
    method: 'POST',
    pattern: '/guardian/otp/verify',
    service: 'school-identity',
    upstream: () => `/api/identity/guardian-auth/otp/verify`,
  },
];

function matchPattern(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const pv = pathParts[i]!;
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(pv);
    } else if (pp !== pv) {
      return null;
    }
  }
  return params;
}

function mergeQuery(upstreamPath: string, incomingSearch: string): string {
  if (!incomingSearch || incomingSearch === '?') return upstreamPath;
  const q = incomingSearch.startsWith('?')
    ? incomingSearch.slice(1)
    : incomingSearch;
  if (!q) return upstreamPath;
  if (upstreamPath.includes('?')) {
    return `${upstreamPath}&${q}`;
  }
  return `${upstreamPath}?${q}`;
}

function forceQueryParam(pathWithQuery: string, key: string, value: string): string {
  const qIdx = pathWithQuery.indexOf('?');
  const pathname = qIdx >= 0 ? pathWithQuery.slice(0, qIdx) : pathWithQuery;
  const params = new URLSearchParams(
    qIdx >= 0 ? pathWithQuery.slice(qIdx + 1) : '',
  );
  params.set(key, value);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function resolveGuardianAllowlist(
  method: string,
  pathWithQuery: string,
  identity: GuardianIdentity,
): GuardianAllowMatch | null {
  const qIdx = pathWithQuery.indexOf('?');
  const pathname = qIdx >= 0 ? pathWithQuery.slice(0, qIdx) : pathWithQuery;
  const search = qIdx >= 0 ? pathWithQuery.slice(qIdx) : '';
  const m = method.toUpperCase();

  for (const route of ROUTES) {
    if (route.method !== m) continue;
    const params = matchPattern(route.pattern, pathname);
    if (!params) continue;
    let upstream = mergeQuery(route.upstream(identity, params), search);
    if (route.pattern === '/guardian/threads' && route.method === 'GET') {
      upstream = forceQueryParam(upstream, 'guardian_ref', identity.guardianId);
    }
    return {
      service: route.service,
      upstreamPath: upstream,
    };
  }
  return null;
}

/**
 * Diary (and similar) student_ref query must be a linked child.
 * Returns false when a student_ref is present and not in linkedIds.
 */
export function isGuardianStudentRefAllowed(
  pathWithQuery: string,
  linkedStudentIds: string[],
): boolean {
  const qIdx = pathWithQuery.indexOf('?');
  const search = qIdx >= 0 ? pathWithQuery.slice(qIdx + 1) : '';
  if (!search) return true;
  const params = new URLSearchParams(search);
  const ref = (params.get('student_ref') || params.get('studentRef') || '').trim();
  if (!ref) return true;
  return linkedStudentIds.includes(ref);
}

export function isGuardianSurfacePath(pathname: string): boolean {
  return pathname === '/guardian' || pathname.startsWith('/guardian/');
}

/** Paths that do not require a guardian bearer (login / claim / OTP). */
export function isGuardianPublicAuthPath(pathname: string): boolean {
  return (
    pathname === '/guardian/login' ||
    pathname === '/guardian/claim' ||
    pathname === '/guardian/otp/request' ||
    pathname === '/guardian/otp/verify'
  );
}
