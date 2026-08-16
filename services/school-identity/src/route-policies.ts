import type { RoutePolicy } from './role-guard';

const STAFF4: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];

/**
 * Deny-by-default identity policy table (P12-03).
 * More-specific patterns listed before parameterized siblings.
 */
export const IDENTITY_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'GET', pattern: /^\/state-packs\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/state-packs\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/state-pack\/?$/, roles: STAFF4 },
  { method: 'PUT', pattern: /^\/[^/]+\/state-pack\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/sessions\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/sessions\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/internal\/students\/[^/]+\/section\/?$/,
    roles: [],
    internalOnly: true,
  },
  { method: 'POST', pattern: /^\/[^/]+\/students\/import\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/students\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/students\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/students\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/students\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/students\/[^/]+\/enrol\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/students\/[^/]+\/exit\/?$/, roles: OFFICE_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/guardians\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/students\/[^/]+\/guardians\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'DELETE',
    pattern: /^\/[^/]+\/students\/[^/]+\/guardians\/[^/]+\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/consents\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/students\/[^/]+\/consents\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/guardians\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/guardians\/?$/, roles: OFFICE_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardians\/[^/]+\/students\/?$/,
    roles: OFFICE_UP,
    guardianOk: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/guardians\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/guardians\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/consents\/summary\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/udise\/preflight\/?$/, roles: ADMIN_UP },
];
