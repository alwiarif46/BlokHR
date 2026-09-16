import type { Role, RoutePolicy } from './role-guard';

const EMP_UP: Role[] = ['employee', 'manager', 'hr', 'admin'];
const MGR_UP: Role[] = ['manager', 'hr', 'admin'];
const HR_UP: Role[] = ['hr', 'admin'];

/** time-tracking deny-by-default (P12-04). */
export const TIME_TRACKING_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'GET', pattern: /^\/[^/]+\/clients\/?$/, roles: EMP_UP },
  { method: 'POST', pattern: /^\/[^/]+\/clients\/?$/, roles: HR_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/clients\/[^/]+\/?$/, roles: HR_UP },

  { method: 'GET', pattern: /^\/[^/]+\/projects\/?$/, roles: EMP_UP },
  { method: 'POST', pattern: /^\/[^/]+\/projects\/?$/, roles: HR_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/projects\/[^/]+\/?$/, roles: HR_UP },

  { method: 'GET', pattern: /^\/[^/]+\/time-entries\/?$/, roles: EMP_UP },
  { method: 'POST', pattern: /^\/[^/]+\/time-entries\/?$/, roles: EMP_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/time-entries\/[^/]+\/?$/, roles: EMP_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/time-entries\/[^/]+\/?$/, roles: EMP_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/time-entries\/[^/]+\/approve\/?$/,
    roles: MGR_UP,
  },

  { method: 'GET', pattern: /^\/[^/]+\/time-summary\/?$/, roles: EMP_UP },
];
