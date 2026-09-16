import type { RoutePolicy } from './role-guard';

const STAFF4: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const TEACHER_UP: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];

/** school-timetable deny-by-default (P12-04). */
export const TIMETABLE_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'POST', pattern: /^\/[^/]+\/import\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/terms\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/terms\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/terms\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/terms\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/terms\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/day-schemes\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/day-schemes\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/day-schemes\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/day-schemes\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/day-schemes\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exclusions\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/exclusions\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exclusions\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/exclusions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/exclusions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/sections\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/sections\/?$/, roles: ADMIN_UP },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/sections\/[^/]+\/slots\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/sections\/[^/]+\/slots\/?$/,
    roles: STAFF4,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/sections\/[^/]+\/instances\/generate\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/sections\/[^/]+\/instances\/?$/,
    roles: STAFF4,
  },
  { method: 'GET', pattern: /^\/[^/]+\/sections\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/sections\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/sections\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/instances\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/teachers\/[^/]+\/slots\/?$/,
    roles: STAFF4,
    requireMemberBinding: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/subjects\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/subjects\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/subjects\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/subjects\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/subjects\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/allocations\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/allocations\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/allocations\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/allocations\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/allocations\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/absences\/?$/,
    roles: TEACHER_UP,
    requireMemberBinding: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/cover\/fairness\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/cover\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/cover\/[^/]+\/offer\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/cover\/[^/]+\/respond\/?$/,
    roles: STAFF4,
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/cover\/[^/]+\/mark-uncovered\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/internal\/verify-teacher\/?$/,
    roles: [],
    internalOnly: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/schedule\/?$/,
    roles: [],
    guardianOk: true,
  },
];
