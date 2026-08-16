/**
 * Staff session introspection for /svc/* (P12-02).
 * Mirrors guardian-introspect.ts: HTTP call + positive-only cache.
 * Fail-closed on school data (contrast: monolith staff paths stay fail-open).
 */
import type { Logger } from 'pino';
import { hashBearerToken } from './guardian-introspect';

export type StaffRole =
  | 'employee'
  | 'manager'
  | 'hr'
  | 'teacher'
  | 'office'
  | 'school_admin'
  | 'admin';

const STAFF_ROLES = new Set<string>([
  'employee',
  'manager',
  'hr',
  'teacher',
  'office',
  'school_admin',
  'admin',
]);

export interface StaffIntrospectActive {
  active: true;
  email: string;
  name: string;
  tenantId: string;
  isAdmin: boolean;
  isGlobalManager: boolean;
  isGlobalHR: boolean;
  managerOf: string[];
  hrOf: string[];
  role: StaffRole;
  memberId: string | null;
}

export interface StaffIntrospectInactive {
  active: false;
}

export type StaffIntrospectResult = StaffIntrospectActive | StaffIntrospectInactive;

export type StaffIntrospectFn = (token: string) => Promise<StaffIntrospectResult>;

export class StaffIntrospectUnavailableError extends Error {
  constructor(message = 'introspect_unavailable') {
    super(message);
    this.name = 'StaffIntrospectUnavailableError';
  }
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  result: StaffIntrospectActive;
  expiresAt: number;
}

export function resolveStaffRole(
  directoryRole: string | null | undefined,
  isAdmin: boolean,
): StaffRole {
  const raw = (directoryRole ?? '').trim().toLowerCase();
  if (raw && STAFF_ROLES.has(raw)) {
    return raw as StaffRole;
  }
  return isAdmin ? 'admin' : 'employee';
}

async function lookupDirectoryMember(input: {
  directoryUrl: string;
  internalSecret: string;
  email: string;
}): Promise<{ id: string; role: string; active: boolean } | null> {
  let res: Response;
  try {
    const url = new URL(
      `${input.directoryUrl.replace(/\/$/, '')}/api/directory/members/lookup`,
    );
    url.searchParams.set('email', input.email);
    res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'X-Blok-Internal': input.internalSecret },
    });
  } catch {
    throw new StaffIntrospectUnavailableError('directory_lookup_failed');
  }
  if (!res.ok) {
    throw new StaffIntrospectUnavailableError(`directory HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    member?: { id?: string; role?: string; active?: boolean } | null;
  };
  if (!body.member || body.member.active === false) {
    return null;
  }
  return {
    id: String(body.member.id ?? '').trim(),
    role: String(body.member.role ?? '').trim(),
    active: true,
  };
}

export function createHttpStaffIntrospect(input: {
  monolithUrl: string;
  directoryUrl: string;
  internalSecret: string;
}): StaffIntrospectFn {
  return async (token: string) => {
    let res: Response;
    try {
      res = await fetch(
        `${input.monolithUrl.replace(/\/$/, '')}/api/auth/introspect`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'X-Blok-Internal': input.internalSecret,
          },
          body: JSON.stringify({ token }),
        },
      );
    } catch {
      throw new StaffIntrospectUnavailableError();
    }
    if (!res.ok) {
      throw new StaffIntrospectUnavailableError(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      active?: boolean;
      email?: string;
      name?: string;
      tenantId?: string;
      isAdmin?: boolean;
      isGlobalManager?: boolean;
      isGlobalHR?: boolean;
      managerOf?: string[];
      hrOf?: string[];
    };
    if (body.active !== true || !body.email) {
      return { active: false };
    }

    const isAdmin = body.isAdmin === true;
    const member = await lookupDirectoryMember({
      directoryUrl: input.directoryUrl,
      internalSecret: input.internalSecret,
      email: body.email,
    });
    const role = resolveStaffRole(member?.role, isAdmin);

    return {
      active: true,
      email: body.email,
      name: body.name ?? body.email,
      tenantId: (body.tenantId ?? '').trim() || 'default',
      isAdmin,
      isGlobalManager: body.isGlobalManager === true,
      isGlobalHR: body.isGlobalHR === true,
      managerOf: Array.isArray(body.managerOf) ? body.managerOf : [],
      hrOf: Array.isArray(body.hrOf) ? body.hrOf : [],
      role,
      memberId: member?.id ? member.id : null,
    };
  };
}

/** Positive-only staff introspect cache (60s). Negatives are never cached. */
export class CachedStaffIntrospect {
  private readonly cache = new Map<string, CacheEntry>();
  callCount = 0;

  constructor(
    private readonly underlying: StaffIntrospectFn,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async introspect(token: string): Promise<StaffIntrospectResult> {
    const key = hashBearerToken(token);
    const now = this.clock();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.result;
    }
    this.callCount += 1;
    const result = await this.underlying(token);
    if (result.active) {
      this.cache.set(key, {
        result,
        expiresAt: now + CACHE_TTL_MS,
      });
    }
    return result;
  }
}

export async function safeStaffIntrospect(
  cached: CachedStaffIntrospect,
  token: string,
  logger: Logger,
): Promise<StaffIntrospectResult | 'down'> {
  try {
    return await cached.introspect(token);
  } catch (err) {
    logger.warn({ err }, 'Staff introspect failed');
    return 'down';
  }
}

export function staffBlokHeaders(result: StaffIntrospectActive): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Blok-Principal': 'staff',
    'X-Blok-Email': result.email,
    'X-Blok-Role': result.role,
    'X-Blok-Admin': result.isAdmin || result.role === 'admin' ? '1' : '0',
    'X-Blok-Tenant': result.tenantId,
  };
  if (result.memberId) {
    headers['X-Blok-Member'] = result.memberId;
  }
  return headers;
}
