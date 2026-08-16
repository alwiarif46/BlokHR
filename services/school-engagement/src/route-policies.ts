import type { RoutePolicy } from './role-guard';

/**
 * Deny-by-default staff policy table (P12-04 shape + P13-01 diary).
 * Unmatched method+path ⇒ 403 no_policy.
 */
export const ENGAGEMENT_ROUTE_POLICIES: RoutePolicy[] = [
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardians\/[^/]+\/channels\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/guardians\/[^/]+\/channels\/?$/,
    roles: ['school_admin', 'admin'],
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/settings\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'PUT',
    pattern: /^\/[^/]+\/settings\/?$/,
    roles: ['school_admin', 'admin'],
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/templates\/?$/,
    roles: ['school_admin', 'admin'],
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/messages\/?$/,
    roles: ['office', 'school_admin', 'admin'],
    allowDeviceInternal: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/messages\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/messages\/[^/]+\/ack\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/ingest\/?$/,
    roles: [],
    internalOnly: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/digest\/run\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/pending-escalation\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/threads\/overdue\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/threads\/?$/,
    roles: ['office', 'school_admin', 'admin'],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/threads\/?$/,
    roles: ['office', 'school_admin', 'admin'],
    guardianOk: true,
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/threads\/[^/]+\/?$/,
    roles: ['office', 'school_admin', 'admin'],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/threads\/[^/]+\/reply\/?$/,
    roles: ['teacher', 'office', 'school_admin', 'admin'],
    guardianOk: true,
    requireMemberBinding: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/threads\/[^/]+\/assign\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/threads\/[^/]+\/close\/?$/,
    roles: ['office', 'school_admin', 'admin'],
  },
  // P13-01 diary
  {
    method: 'POST',
    pattern: /^\/[^/]+\/diary\/?$/,
    roles: ['teacher', 'office', 'school_admin', 'admin'],
    scope: 'teacher_section',
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/diary\/?$/,
    roles: ['teacher', 'office', 'school_admin', 'admin'],
    scope: 'teacher_section',
  },
  {
    method: 'PATCH',
    pattern: /^\/[^/]+\/diary\/[^/]+\/?$/,
    roles: ['teacher', 'office', 'school_admin', 'admin'],
  },
  {
    method: 'DELETE',
    pattern: /^\/[^/]+\/diary\/[^/]+\/?$/,
    roles: ['school_admin', 'admin'],
  },
  {
    method: 'GET',
    pattern: /^\/[^/]+\/guardian\/diary\/?$/,
    roles: [],
    guardianOk: true,
  },
  {
    method: 'POST',
    pattern: /^\/[^/]+\/guardian\/diary\/[^/]+\/ack\/?$/,
    roles: [],
    guardianOk: true,
  },
];
