import type { RoutePolicy } from './role-guard';

const STAFF4: RoutePolicy['roles'] = [
  'teacher',
  'office',
  'school_admin',
  'admin',
];
const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const TEACHER_ADMIN: RoutePolicy['roles'] = ['teacher', 'school_admin', 'admin'];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/** school-assessment deny-by-default (P12-04). */
export const ASSESSMENT_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'POST', pattern: /^\/[^/]+\/exam-terms\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exam-terms\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/exam-terms\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/exam-terms\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/exam-terms\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/exams\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/exams\/?$/, roles: STAFF4 },
  { method: 'GET', pattern: /^\/[^/]+\/exams\/[^/]+\/?$/, roles: STAFF4 },
  { method: 'PATCH', pattern: /^\/[^/]+\/exams\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/exams\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/exams\/[^/]+\/marks\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/exams\/[^/]+\/marks\/import\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/exams\/[^/]+\/marks\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/exams\/[^/]+\/publish\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/exams\/[^/]+\/unlock\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/exams\/[^/]+\/sittings\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/exams\/[^/]+\/sittings\/?$/,
    roles: STAFF4,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/exams\/[^/]+\/paper\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/sittings\/[^/]+\/issue-tickets\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/sittings\/[^/]+\/tickets\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/sittings\/[^/]+\/open\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/sittings\/[^/]+\/attempts\/start\/?$/,
    roles: STAFF4,
  },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/attempts\/[^/]+\/answers\/?$/,
    roles: STAFF4,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/attempts\/[^/]+\/submit\/?$/,
    roles: STAFF4,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/marks\/[^/]+\/moderate\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/questions\/?$/, roles: TEACHER_ADMIN },
  { method: 'GET', pattern: /^\/[^/]+\/questions\/?$/, roles: TEACHER_ADMIN },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/questions\/analysis\/?$/,
    roles: TEACHER_ADMIN,
  },
  { method: 'GET', pattern: /^\/[^/]+\/questions\/[^/]+\/?$/, roles: TEACHER_ADMIN },
  { method: 'PATCH', pattern: /^\/[^/]+\/questions\/[^/]+\/?$/, roles: TEACHER_ADMIN },
  { method: 'DELETE', pattern: /^\/[^/]+\/questions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/blueprints\/?$/, roles: TEACHER_ADMIN },
  { method: 'GET', pattern: /^\/[^/]+\/blueprints\/[^/]+\/?$/, roles: TEACHER_ADMIN },
  { method: 'POST', pattern: /^\/[^/]+\/papers\/check\/?$/, roles: TEACHER_ADMIN },
  { method: 'POST', pattern: /^\/[^/]+\/papers\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/hpc\/competencies\/?$/, roles: TEACHER_ADMIN },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/hpc\/inputs\/bulk\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/hpc\/inputs\/?$/,
    roles: TEACHER_ADMIN,
    scope: 'teacher_section',
    requireMemberBinding: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/hpc\/students\/[^/]+\/matrix\/?$/,
    roles: TEACHER_ADMIN,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/hpc\/students\/[^/]+\/?$/,
    roles: TEACHER_ADMIN,
  },
  { method: 'GET', pattern: /^\/[^/]+\/hpc\/coverage\/?$/, roles: TEACHER_ADMIN },
  { method: 'POST', pattern: /^\/[^/]+\/templates\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/templates\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/templates\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/templates\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/templates\/[^/]+\/promote\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/templates\/[^/]+\/clone\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/report-cards\/generate\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/report-cards\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/report-cards\/[^/]+\/?$/, roles: OFFICE_UP },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/report-cards\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/report-cards\/?$/,
    roles: [],
    guardianOk: true,
  },
  { method: 'POST', pattern: /^\/[^/]+\/feedback\/run\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/outcomes\/weak\/?$/, roles: TEACHER_ADMIN },
];
