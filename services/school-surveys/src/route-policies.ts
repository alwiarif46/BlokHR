import type { RoutePolicy } from './role-guard';

const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/** school-surveys deny-by-default (P12-04). */
export const SURVEYS_ROUTE_POLICIES: RoutePolicy[] = [
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/pending\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/surveys\/[^/]+\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/guardian\/surveys\/[^/]+\/respond\/?$/,
    roles: [],
    guardianOk: true,
  },
  { method: 'POST', pattern: /^\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/[^/]+\/publish\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/[^/]+\/close\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/[^/]+\/results\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/[^/]+\/response-rate\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/[^/]+\/?$/, roles: OFFICE_UP },
];
