import type { RoutePolicy } from './role-guard';

const READ: RoutePolicy['roles'] = ['hr', 'school_admin', 'admin', 'manager'];
const WRITE: RoutePolicy['roles'] = ['admin'];
/** School roster hub: admins + school_admin/hr can create teachers and bulk-import. */
const SCHOOL_WRITE: RoutePolicy['roles'] = ['admin', 'school_admin', 'hr'];

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
  { method: 'GET', pattern: /^\/members\/import-template\/?$/, roles: SCHOOL_WRITE },
  { method: 'GET', pattern: /^\/members\/[^/]+\/?$/, roles: READ },
  { method: 'POST', pattern: /^\/members\/import\/?$/, roles: SCHOOL_WRITE },
  { method: 'POST', pattern: /^\/members\/?$/, roles: SCHOOL_WRITE },
  { method: 'PATCH', pattern: /^\/members\/[^/]+\/?$/, roles: SCHOOL_WRITE },
  { method: 'DELETE', pattern: /^\/members\/[^/]+\/?$/, roles: WRITE },
];
