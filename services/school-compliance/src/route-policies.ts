import type { RoutePolicy } from './role-guard';

const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const DSR: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/** school-compliance deny-by-default (P12-04). */
export const COMPLIANCE_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'GET', pattern: /^\/[^/]+\/calendar\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/overdue\/?$/, roles: ADMIN_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/status\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/exports\/udise\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exports\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exports\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/apaar\/readiness\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/apaar\/form-list\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/data-requests\/sweep-overdue\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/data-requests\/?$/, roles: DSR },
  { method: 'GET', pattern: /^\/[^/]+\/data-requests\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/data-requests\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/data-requests\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/dsr\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/dsr\/?$/,
    roles: [],
    guardianOk: true,
  },
];
