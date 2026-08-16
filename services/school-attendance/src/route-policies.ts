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
 * Deny-by-default attendance policy table (P12-03/05).
 * scope:'teacher_section' enforced by assertTeacherSectionScope (P12-05).
 */
export const ATTENDANCE_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'GET', pattern: /^\/[^/]+\/reason-codes\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/reason-codes\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/reason-codes\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/settings\/?$/, roles: STAFF4 },
  { method: 'PUT', pattern: /^\/[^/]+\/settings\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/mark\/?$/,
    roles: STAFF4,
    scope: 'teacher_section', // scope enforced by P12-05
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/records\/[^/]+\/?$/,
    roles: STAFF4,
    scope: 'teacher_section', // scope enforced by P12-05
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/records\/[^/]+\/regularize\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/register\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/bindings\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/bindings\/[^/]+\/deactivate\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/capture\/?$/,
    roles: OFFICE_UP,
    allowDeviceInternal: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/capture-events\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/staff\/leave\/types\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/staff\/leave\/types\/?$/, roles: ADMIN_UP },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/staff\/leave\/types\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/staff\/leave\/balances\/?$/,
    roles: STAFF4,
    scope: 'self',
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/staff\/leave\/requests\/?$/,
    roles: STAFF4,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/staff\/leave\/requests\/?$/,
    roles: STAFF4,
    scope: 'self',
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/staff\/leave\/requests\/[^/]+\/decide\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/staff\/leave\/requests\/[^/]+\/cancel\/?$/,
    roles: STAFF4,
    scope: 'self',
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/staff\/check\/?$/,
    roles: STAFF4,
    scope: 'self',
  },
  { method: 'POST', pattern: /^\/[^/]+\/staff\/mark\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/staff\/?$/, roles: STAFF4 },
  { method: 'POST', pattern: /^\/[^/]+\/staff\/finalize\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/reported-absences\/?$/,
    roles: OFFICE_UP,
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/reported-absences\/[^/]+\/attach\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/summary\/?$/,
    roles: [],
    guardianOk: true,
  },
  { method: 'GET', pattern: /^\/[^/]+\/unexplained\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/rollups\/compute\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/rollups\/?$/, roles: STAFF4 },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/rollups\/?$/,
    roles: STAFF4,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/eligibility\/?$/,
    roles: STAFF4,
  },
  { method: 'GET', pattern: /^\/[^/]+\/nudge\/config\/?$/, roles: ADMIN_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/nudge\/config\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/nudge\/run\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/nudge\/report\/?$/, roles: ADMIN_UP },
];
