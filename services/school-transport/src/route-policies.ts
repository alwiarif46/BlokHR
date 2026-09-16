import type { RoutePolicy } from './role-guard';

const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/**
 * school-transport deny-by-default (P12-04).
 * Boarding + pings are device/internal-only: AIS140/devices have no staff
 * bearer — gateway PUBLIC_PATHS injects secret only (no X-Blok-Principal).
 */
export const TRANSPORT_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'POST', pattern: /^\/[^/]+\/vehicles\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/vehicles\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/vehicles\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/vehicles\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/vehicles\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/vehicles\/[^/]+\/last-known\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/expiries\/?$/, roles: OFFICE_UP },
  { method: 'POST', pattern: /^\/[^/]+\/routes\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/routes\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/routes\/[^/]+\/?$/, roles: OFFICE_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/routes\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/routes\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/routes\/[^/]+\/stops\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/routes\/[^/]+\/stops\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/routes\/[^/]+\/stops\/resequence\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'PATCH', pattern: /^\/[^/]+\/stops\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/stops\/[^/]+\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/routes\/[^/]+\/students\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/routes\/[^/]+\/students\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'DELETE',
    pattern: /^\/[^/]+\/routes\/[^/]+\/students\/[^/]+\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/bindings\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/bindings\/[^/]+\/deactivate\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/boarding\/?$/,
    roles: [],
    internalOnly: true,
  },
  { method: 'POST', pattern: /^\/[^/]+\/sweep-missed\/?$/, roles: OFFICE_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/routes\/[^/]+\/manifest\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/pings\/prune\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/pings\/?$/,
    roles: [],
    internalOnly: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/routes\/[^/]+\/eta\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/routes\/[^/]+\/check-delay\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/status\/?$/,
    roles: [],
    guardianOk: true,
  },
];
