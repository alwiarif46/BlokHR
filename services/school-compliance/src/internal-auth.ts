/**
 * Internal secret helpers (P12). Copied per service — never import across packages.
 */
import type { Request } from 'express';

export function resolveInternalSecret(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const secret = (env.INTERNAL_SECRET ?? '').trim();
  if (secret) return secret;
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'test') {
    return 'test-internal-secret';
  }
  if (nodeEnv === 'production') {
    throw new Error('FATAL: INTERNAL_SECRET is required in production');
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

export function parseStudentsHeader(req: Request): string[] {
  const raw = String(req.headers['x-blok-students'] ?? '');
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

export function enforceGuardianAccess(
  req: Request,
  expectedSecret: string,
  studentId?: string,
): { ok: true; guardianId: string } | { error: string; status: number } {
  if (!isGuardianPrincipal(req)) {
    return { ok: true, guardianId: '' };
  }
  const internal = requireInternalMatch(req, expectedSecret);
  if (!('ok' in internal) || !internal.ok) {
    return internal as { error: string; status: number };
  }
  const guardianId = guardianIdFromHeader(req);
  if (!guardianId) {
    return { error: 'unauthorized', status: 401 };
  }
  if (studentId) {
    const allowed = new Set(parseStudentsHeader(req));
    if (!allowed.has(studentId)) {
      return { error: 'forbidden', status: 403 };
    }
  }
  return { ok: true, guardianId };
}
