/**
 * Internal secret helpers (P12-02).
 * Copied shape from school-identity — never import across services.
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
