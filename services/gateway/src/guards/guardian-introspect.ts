import { createHash } from 'crypto';
import type { Logger } from 'pino';

export interface IntrospectActive {
  active: true;
  tenantId: string;
  guardianId: string;
  studentIds: string[];
}

export interface IntrospectInactive {
  active: false;
}

export type IntrospectResult = IntrospectActive | IntrospectInactive;

export type IntrospectFn = (token: string) => Promise<IntrospectResult>;

export class IntrospectUnavailableError extends Error {
  constructor(message = 'introspect_unavailable') {
    super(message);
    this.name = 'IntrospectUnavailableError';
  }
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  result: IntrospectActive;
  expiresAt: number;
}

export function hashBearerToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function fetchLinkedStudentIds(input: {
  identityUrl: string;
  internalSecret: string;
  tenantId: string;
  guardianId: string;
}): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(
      `${input.identityUrl.replace(/\/$/, '')}/api/identity/${encodeURIComponent(input.tenantId)}/guardians/${encodeURIComponent(input.guardianId)}/students`,
      {
        method: 'GET',
        headers: {
          'X-Blok-Internal': input.internalSecret,
          'X-Blok-Principal': 'guardian',
          'X-Blok-Guardian': input.guardianId,
          'X-Blok-Tenant': input.tenantId,
        },
      },
    );
  } catch {
    throw new IntrospectUnavailableError('students_fetch_failed');
  }
  if (!res.ok) {
    throw new IntrospectUnavailableError(`students HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    students?: Array<{ id?: string }>;
  };
  return (body.students ?? [])
    .map((s) => String(s.id ?? '').trim())
    .filter(Boolean);
}

export function createHttpIntrospect(input: {
  identityUrl: string;
  internalSecret: string;
}): IntrospectFn {
  return async (token: string) => {
    let res: Response;
    try {
      res = await fetch(
        `${input.identityUrl.replace(/\/$/, '')}/api/identity/guardian-auth/introspect`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        },
      );
    } catch {
      throw new IntrospectUnavailableError();
    }
    if (!res.ok) {
      throw new IntrospectUnavailableError(`HTTP ${res.status}`);
    }
    const body = (await res.json()) as {
      active?: boolean;
      tenant_id?: string;
      guardian_id?: string;
    };
    if (body.active === true && body.tenant_id && body.guardian_id) {
      const studentIds = await fetchLinkedStudentIds({
        identityUrl: input.identityUrl,
        internalSecret: input.internalSecret,
        tenantId: body.tenant_id,
        guardianId: body.guardian_id,
      });
      return {
        active: true,
        tenantId: body.tenant_id,
        guardianId: body.guardian_id,
        studentIds,
      };
    }
    return { active: false };
  };
}

/** Positive-only introspect cache (60s). Negatives are never cached. */
export class CachedIntrospect {
  private readonly cache = new Map<string, CacheEntry>();
  /** Test/metrics: how many times the underlying fn ran. */
  callCount = 0;

  constructor(
    private readonly underlying: IntrospectFn,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  async introspect(token: string): Promise<IntrospectResult> {
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

export function parseBearer(
  authorization: string | undefined,
): string | null {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return m?.[1] ?? null;
}

export async function safeIntrospect(
  cached: CachedIntrospect,
  token: string,
  logger: Logger,
): Promise<IntrospectResult | 'down'> {
  try {
    return await cached.introspect(token);
  } catch (err) {
    logger.warn({ err }, 'Guardian introspect failed');
    return 'down';
  }
}
