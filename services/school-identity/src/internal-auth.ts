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

/** When principal is guardian: require internal secret + optional id match. */
export function enforceGuardianPrincipal(
  req: Request,
  expectedSecret: string,
  opts: { mustMatchGuardianId?: string } = {},
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
  if (
    opts.mustMatchGuardianId != null &&
    opts.mustMatchGuardianId !== guardianId
  ) {
    return { error: 'forbidden', status: 403 };
  }
  return { ok: true, guardianId };
}
