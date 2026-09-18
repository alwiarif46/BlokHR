/**
 * L4 role policy — deny-by-default (P12-03/04).
 * Driven ONLY by gateway-set X-Blok-* headers + internal secret.
 * Copy per service — never import across services.
 */
import type { Request, Response, NextFunction, Router } from 'express';
import { requireInternalMatch } from './internal-auth';

export type Role =
  | 'employee'
  | 'manager'
  | 'hr'
  | 'teacher'
  | 'office'
  | 'school_admin'
  | 'admin'
  | 'parent';

export interface RoutePolicy {
  method: string;
  pattern: RegExp;
  roles: Role[];
  /** L5 tag — scope enforced by P12-05 when role==='teacher' */
  scope?: 'teacher_section' | 'self';
  /** Internal-only: secret + no X-Blok-Principal */
  internalOnly?: boolean;
  /** Device/service path: secret + no principal, OR staff in roles */
  allowDeviceInternal?: boolean;
  /** Guardian principal may access (P9 validates on the route) */
  guardianOk?: boolean;
  /** Teacher without X-Blok-Member → 403 no_member_binding */
  requireMemberBinding?: boolean;
}

const ROLE_SET = new Set<string>([
  'employee',
  'manager',
  'hr',
  'teacher',
  'office',
  'school_admin',
  'admin',
  'parent',
]);

export type StaffClaims =
  | {
      ok: true;
      email: string;
      role: Role;
      isAdmin: boolean;
      memberId: string;
    }
  | { status: number; error: string };

export function staffFromHeaders(
  req: Request,
  expectedSecret: string,
): StaffClaims {
  const internal = requireInternalMatch(req, expectedSecret);
  if (!('ok' in internal) || !internal.ok) {
    return { status: 401, error: 'unauthorized' };
  }
  const principal = String(req.headers['x-blok-principal'] ?? '')
    .trim()
    .toLowerCase();
  if (principal !== 'staff') {
    return { status: 403, error: 'role_denied' };
  }
  let role = String(req.headers['x-blok-role'] ?? '')
    .trim()
    .toLowerCase() as Role;
  const isAdmin =
    String(req.headers['x-blok-admin'] ?? '') === '1' || role === 'admin';
  if (isAdmin) role = 'admin';
  if (!ROLE_SET.has(role)) {
    return { status: 403, error: 'role_denied' };
  }
  const email = String(req.headers['x-blok-email'] ?? '').trim();
  const memberId = String(req.headers['x-blok-member'] ?? '').trim();
  return { ok: true, email, role, isAdmin, memberId };
}

/** Teacher memberId param/body must match X-Blok-Member. */
export function assertTeacherMemberMatch(
  req: Request,
  claimedMemberId: string,
): { ok: true } | { status: number; error: string } {
  const staff = (req as Request & { staff?: StaffClaims }).staff;
  if (!staff || !('ok' in staff) || !staff.ok) {
    return { status: 403, error: 'role_denied' };
  }
  if (staff.role !== 'teacher') return { ok: true };
  if (!staff.memberId) {
    return { status: 403, error: 'no_member_binding' };
  }
  if (staff.memberId !== claimedMemberId) {
    return { status: 403, error: 'role_denied' };
  }
  return { ok: true };
}

function matchPolicy(
  policies: RoutePolicy[],
  method: string,
  path: string,
): RoutePolicy | undefined {
  const m = method.toUpperCase();
  return policies.find((p) => p.method.toUpperCase() === m && p.pattern.test(path));
}

/** Deny-by-default staff guard. Unmatched path+method ⇒ 403 no_policy. */
export function guardRoutes(
  router: Router,
  policies: RoutePolicy[],
  opts: { internalSecret: string },
): void {
  router.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path || '/';
    const policy = matchPolicy(policies, req.method, path);
    const principal = String(req.headers['x-blok-principal'] ?? '')
      .trim()
      .toLowerCase();

    if (!policy) {
      res.status(403).json({ error: 'no_policy' });
      return;
    }

    // Defense in depth: path :tenantId must match gateway X-Blok-Tenant when both present.
    const pathTenant = String((req.params as { tenantId?: string }).tenantId ?? '')
      .trim()
      .toLowerCase();
    const headerTenant = String(req.headers['x-blok-tenant'] ?? '')
      .trim()
      .toLowerCase();
    if (pathTenant && headerTenant && pathTenant !== headerTenant) {
      res.status(403).json({ error: 'tenant_mismatch' });
      return;
    }

    if (policy.internalOnly) {
      const internal = requireInternalMatch(req, opts.internalSecret);
      if (!('ok' in internal) || !internal.ok) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      if (principal) {
        res.status(403).json({ error: 'internal_only' });
        return;
      }
      next();
      return;
    }

    if (policy.allowDeviceInternal && !principal) {
      // Public device path until dedicated device credentials land.
      next();
      return;
    }

    if (principal === 'guardian') {
      if (policy.guardianOk) {
        next();
        return;
      }
      res.status(403).json({ error: 'role_denied' });
      return;
    }

    const staff = staffFromHeaders(req, opts.internalSecret);
    if (!('ok' in staff) || !staff.ok) {
      const denied = staff as { status: number; error: string };
      res.status(denied.status).json({ error: denied.error });
      return;
    }

    if (!policy.roles.includes(staff.role)) {
      res.status(403).json({ error: 'role_denied', required: policy.roles });
      return;
    }

    if (
      policy.requireMemberBinding &&
      staff.role === 'teacher' &&
      !staff.memberId
    ) {
      res.status(403).json({ error: 'no_member_binding' });
      return;
    }

    (req as Request & { staff?: typeof staff }).staff = staff;
    next();
  });
}

/** Test helper: staff headers for a role. */
export function asRole(
  role: Role,
  opts: {
    secret?: string;
    email?: string;
    memberId?: string | null;
    tenantId?: string;
  } = {},
): Record<string, string> {
  const secret = opts.secret ?? 'test-internal-secret';
  const h: Record<string, string> = {
    'X-Blok-Internal': secret,
    'X-Blok-Principal': 'staff',
    'X-Blok-Role': role,
    'X-Blok-Admin': role === 'admin' ? '1' : '0',
    'X-Blok-Email': opts.email ?? `${role}@school.test`,
    'X-Blok-Tenant': opts.tenantId ?? 't1',
  };
  if (opts.memberId === null) {
    // omit member header — tests no_member_binding
  } else {
    h['X-Blok-Member'] =
      opts.memberId ??
      (role === 'teacher' ? 'member-teacher-1' : `member-${role}`);
  }
  return h;
}
