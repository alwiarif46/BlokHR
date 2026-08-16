import type { Request } from 'express';

export function resolveInternalSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = (env.INTERNAL_SECRET ?? '').trim();
  if (secret) return secret;
  if ((env.NODE_ENV ?? 'development') === 'test') {
    return 'test-internal-secret';
  }
  return '';
}

export function isGuardianPrincipal(req: Request): boolean {
  return (
    String(req.headers['x-blok-principal'] ?? '')
      .trim()
      .toLowerCase() === 'guardian'
  );
}

export function guardianIdFromHeader(req: Request): string {
  return String(req.headers['x-blok-guardian'] ?? '').trim();
}

export function requireInternalMatch(
  req: Request,
  expectedSecret: string,
): { ok: true } | { error: string; status: number } {
  const got = String(req.headers['x-blok-internal'] ?? '');
  if (!expectedSecret || got !== expectedSecret) {
    return { error: 'unauthorized', status: 401 };
  }
  return { ok: true };
}

export function enforceGuardianPrincipal(
  req: Request,
  expectedSecret: string,
): { ok: true; guardianId: string | null } | { error: string; status: number } {
  if (!isGuardianPrincipal(req)) {
    return { ok: true, guardianId: null };
  }
  const internal = requireInternalMatch(req, expectedSecret);
  if (!('ok' in internal) || !internal.ok) {
    return internal as { error: string; status: number };
  }
  const guardianId = guardianIdFromHeader(req);
  if (!guardianId) {
    return { error: 'unauthorized', status: 401 };
  }
  return { ok: true, guardianId };
}
