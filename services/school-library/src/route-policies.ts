import type { RoutePolicy } from './role-guard';

const STAFF4: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/** school-library deny-by-default (P12-04). */
export const LIBRARY_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'POST', pattern: /^\/[^/]+\/titles\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/titles\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/titles\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/titles\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/titles\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/copies\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/copies\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/copies\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/copies\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/copies\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/settings\/?$/, roles: OFFICE_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/settings\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/loans\/mark-overdue\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/loans\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/loans\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/loans\/[^/]+\/return\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/loans\/[^/]+\/renew\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/holds\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/holds\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/holds\/[^/]+\/cancel\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/holds\/[^/]+\/fulfill\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/fines\/assess\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/fines\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/fines\/[^/]+\/pay\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/fines\/[^/]+\/waive\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/library-summary\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/library-summary\/?$/,
    roles: [],
    guardianOk: true,
  },
];
