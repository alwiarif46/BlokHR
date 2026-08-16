import type { RoutePolicy } from './role-guard';

const STAFF4: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const TEACHER_ADMIN: RoutePolicy['roles'] = ['teacher', 'school_admin', 'admin'];

/** school-academics deny-by-default (P12-04). */
export const ACADEMICS_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'GET', pattern: /^\/packs\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/packs\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/packs\/installed\/?$/, roles: STAFF4 },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/packs\/[^/]+\/install\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/syllabus\/upload\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/outcomes\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/outcomes\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/crosswalk\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/crosswalk\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/crosswalk\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/crosswalk\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/courses\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/courses\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/courses\/[^/]+\/tree\/?$/,
    roles: STAFF4,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/courses\/[^/]+\/coverage\/?$/,
    roles: STAFF4,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/courses\/[^/]+\/variance\/?$/,
    roles: STAFF4,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/courses\/[^/]+\/export\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/courses\/[^/]+\/import\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/courses\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/courses\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/courses\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/courses\/[^/]+\/units\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/courses\/[^/]+\/units\/reorder\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'PATCH', pattern: /^\/[^/]+\/units\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/units\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/units\/[^/]+\/topics\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'PATCH', pattern: /^\/[^/]+\/topics\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/topics\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/units\/[^/]+\/outcomes\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'DELETE',
    pattern: /^\/[^/]+\/units\/[^/]+\/outcomes\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/delivery\/infer\/?$/,
    roles: [],
    internalOnly: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/delivery\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'DELETE',
    pattern: /^\/[^/]+\/delivery\/[^/]+\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/lessons\/submit-week\/?$/,
    roles: TEACHER_ADMIN,
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/lessons\/review-sample\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/lessons\/stale\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/lessons\/?$/,
    roles: TEACHER_ADMIN,
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/lessons\/?$/,
    roles: TEACHER_ADMIN,
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/lessons\/[^/]+\/?$/,
    roles: TEACHER_ADMIN,
    requireMemberBinding: true,
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/lessons\/[^/]+\/?$/,
    roles: TEACHER_ADMIN,
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/lessons\/[^/]+\/review\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/assignments\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/assignments\/[^/]+\/submissions\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/assignments\/[^/]+\/stats\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/assignments\/[^/]+\/sweep-missing\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/assignments\/[^/]+\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/submissions\/[^/]+\/turn-in\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/submissions\/[^/]+\/reclaim\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/submissions\/[^/]+\/grade\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/submissions\/[^/]+\/return\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/submissions\/[^/]+\/excuse\/?$/,
    roles: TEACHER_ADMIN,
  },
];
