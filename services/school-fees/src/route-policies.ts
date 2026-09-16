import type { RoutePolicy } from './role-guard';

const ADMIN_UP: RoutePolicy['roles'] = ['school_admin', 'admin'];
const OFFICE_UP: RoutePolicy['roles'] = ['office', 'school_admin', 'admin'];

/** school-fees deny-by-default (P12-04). */
export const FEES_ROUTE_POLICIES: RoutePolicy[] = [
  { method: 'POST', pattern: /^\/[^/]+\/heads\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/heads\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/heads\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/heads\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/heads\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/structures\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/structures\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/structures\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/structures\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/structures\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/concessions\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/concessions\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/concessions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'PATCH', pattern: /^\/[^/]+\/concessions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'DELETE', pattern: /^\/[^/]+\/concessions\/[^/]+\/?$/, roles: ADMIN_UP },
  { method: 'POST', pattern: /^\/[^/]+\/assignments\/?$/, roles: ADMIN_UP },
  { method: 'GET', pattern: /^\/[^/]+\/assignments\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/invoices\/generate\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/invoices\/?$/, roles: OFFICE_UP },
  { method: 'GET', pattern: /^\/[^/]+\/rte-claims\/?$/, roles: ADMIN_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/rte-claims\/[^/]+\/submit\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/rte-claims\/[^/]+\/receive\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/rte-claims\/[^/]+\/reject\/?$/,
    roles: ADMIN_UP,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/payments\/reconcile\/?$/,
    roles: OFFICE_UP,
  },
  { method: 'POST', pattern: /^\/[^/]+\/payments\/?$/, roles: OFFICE_UP },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/payments\/[^/]+\/bounce\/?$/,
    roles: ADMIN_UP,
  },
  { method: 'GET', pattern: /^\/[^/]+\/outstanding\/?$/, roles: OFFICE_UP },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/students\/[^/]+\/ledger\/?$/,
    roles: OFFICE_UP,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/students\/[^/]+\/ledger\/?$/,
    roles: [],
    guardianOk: true,
  },
];
