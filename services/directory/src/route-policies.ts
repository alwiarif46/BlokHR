import type { RoutePolicy } from './role-guard';

const READ: RoutePolicy['roles'] = ['hr', 'school_admin', 'admin', 'manager'];
const WRITE: RoutePolicy['roles'] = ['admin'];

/**
 * directory deny-by-default (P12-04).
 * Replaces spoofable X-User-Email requireAdmin — security fix.
 */
export const DIRECTORY_ROUTE_POLICIES: RoutePolicy[] = [
  {
    method: 'GET',
    pattern: /^\/members\/lookup\/?$/,
    roles: [],
    internalOnly: true,
  },
  { method: 'GET', pattern: /^\/members\/?$/, roles: READ },
  { method: 'GET', pattern: /^\/members\/[^/]+\/?$/, roles: READ },
  { method: 'POST', pattern: /^\/members\/?$/, roles: WRITE },
  { method: 'PATCH', pattern: /^\/members\/[^/]+\/?$/, roles: WRITE },
  { method: 'DELETE', pattern: /^\/members\/[^/]+\/?$/, roles: WRITE },
];
