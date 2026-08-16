/**
 * Internal secret helpers (P12-01).
 * Copied shape from school-identity — gateway-only callers for /api/auth/introspect.
 */
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
