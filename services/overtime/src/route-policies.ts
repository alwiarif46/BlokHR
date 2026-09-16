import type { RoutePolicy, Role } from './role-guard';

const EMPLOYEE_UP: Role[] = ['employee', 'manager', 'hr', 'admin'];
const MANAGER_UP: Role[] = ['manager', 'hr', 'admin'];
const HR_UP: Role[] = ['hr', 'admin'];

/** overtime service deny-by-default (P12-04). */
export const OVERTIME_ROUTE_POLICIES: RoutePolicy[] = [
  // Employee self-service
  {
    method: 'GET',
    pattern: /^\/[^/]+\/records\/mine\/?$/,
    roles: EMPLOYEE_UP,
    scope: 'self',
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/summary\/mine\/?$/,
    roles: EMPLOYEE_UP,
    scope: 'self',
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/records\/?$/,
    roles: EMPLOYEE_UP,
  },

  // Requests — employee creates own, everyone up to admin can list
  {
    method: 'POST',
    pattern: /^\/[^/]+\/requests\/?$/,
    roles: EMPLOYEE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/requests\/mine\/?$/,
    roles: EMPLOYEE_UP,
    scope: 'self',
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/requests\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/requests\/[^/]+\/approve\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/requests\/[^/]+\/reject\/?$/,
    roles: MANAGER_UP,
  },

  // Manager+ visibility
  {
    method: 'GET',
    pattern: /^\/[^/]+\/records\/by-email\/[^/]+\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/records\/pending\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/records\/[0-9]+\/approve\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/records\/[0-9]+\/reject\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/detect\/?$/,
    roles: MANAGER_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/summary\/by-email\/[^/]+\/?$/,
    roles: MANAGER_UP,
  },

  // Policy — HR/admin only
  { method: 'GET', pattern: /^\/[^/]+\/policy\/?$/, roles: HR_UP },
  { method: 'PUT', pattern: /^\/[^/]+\/policy\/?$/, roles: HR_UP },

  // Internal-only sync of compensation cache
  {
    method: 'POST',
    pattern: /^\/[^/]+\/internal\/compensation\/?$/,
    roles: [],
    internalOnly: true,
  },
];
