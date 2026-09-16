import type { RoutePolicy } from './role-guard';

const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];

/** school-family-ops deny-by-default (P12-04). */
export const FAMILY_OPS_ROUTE_POLICIES: RoutePolicy[] = [
  {
    method: 'GET',
    pattern: /^\/[^/]+\/modules\/?$/,
    roles: OFFICE_UP,
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/health\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/meals\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/activities\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/pickup\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/pickup\/?$/,
    roles: [],
    guardianOk: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/health\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/meals\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/activities\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/pickup\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/community\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/fundraising\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/ai\/draft\/?$/, roles: ADMIN_UP },
];
