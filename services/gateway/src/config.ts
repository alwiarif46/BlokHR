/**
 * Gateway config — env-driven, fail-fast on malformed values.
 * SERVICE_MAP is the single source of truth for school service ports.
 */

import path from 'path';

/** Hardcoded default ports — override per service via SVC_<NAME>_URL. */
export const SERVICE_MAP = {
  'school-identity': 3011,
  'school-timetable': 3012,
  'school-attendance': 3013,
  'school-academics': 3014,
  'school-assessment': 3015,
  'school-engagement': 3016,
  'school-fees': 3017,
  'school-transport': 3018,
  'school-compliance': 3019,
  'school-library': 3020,
  learning: 3021,
  'school-surveys': 3022,
} as const;

export type ServiceName = keyof typeof SERVICE_MAP;

export const SERVICE_NAMES = Object.keys(SERVICE_MAP) as ServiceName[];

export interface GatewayConfig {
  port: number;
  monolithUrl: string;
  frontendDir: string;
  /** Shared secret injected as X-Blok-Internal on every proxied request. */
  internalSecret: string;
  /** school-identity base URL for guardian token introspection. */
  identityUrl: string;
  /** Directory base URL for staff member/role lookup (defaults to monolith). */
  directoryUrl: string;
  /** Absolute upstream base URLs keyed by service name. */
  serviceUrls: Record<ServiceName, string>;
}

function assertHttpUrl(label: string, value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} is malformed: ${value}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${label} must be http(s): ${value}`);
  }
  return value.replace(/\/$/, '');
}

function serviceEnvKey(name: ServiceName): string {
  return `SVC_${name.replace(/-/g, '_').toUpperCase()}_URL`;
}

function resolveInternalSecret(env: NodeJS.ProcessEnv): string {
  const secret = (env.INTERNAL_SECRET ?? '').trim();
  if (secret) return secret;
  const nodeEnv = env.NODE_ENV ?? 'development';
  if (nodeEnv === 'test') {
    return 'test-internal-secret';
  }
  throw new Error('INTERNAL_SECRET is required');
}

/**
 * Load gateway config from env (or an injected env bag for tests).
 * @param packageRoot — services/gateway (defaults to parent of src/)
 */
export function loadGatewayConfig(
  env: NodeJS.ProcessEnv = process.env,
  packageRoot: string = path.resolve(__dirname, '..'),
): GatewayConfig {
  const portRaw = env.PORT ?? '8080';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer 1–65535, got: ${portRaw}`);
  }

  const monolithUrl = assertHttpUrl(
    'MONOLITH_URL',
    env.MONOLITH_URL ?? 'http://localhost:3000',
  );

  const frontendDir = path.resolve(packageRoot, env.FRONTEND_DIR ?? '../../frontend');
  const internalSecret = resolveInternalSecret(env);

  const serviceUrls = {} as Record<ServiceName, string>;
  for (const name of SERVICE_NAMES) {
    const envName = serviceEnvKey(name);
    const fallback = `http://localhost:${SERVICE_MAP[name]}`;
    serviceUrls[name] = assertHttpUrl(envName, env[envName] ?? fallback);
  }

  const identityUrl = assertHttpUrl(
    'IDENTITY_URL',
    env.IDENTITY_URL ?? serviceUrls['school-identity'],
  );

  const directoryUrl = assertHttpUrl(
    'DIRECTORY_URL',
    env.DIRECTORY_URL ?? monolithUrl,
  );

  return {
    port,
    monolithUrl,
    frontendDir,
    internalSecret,
    identityUrl,
    directoryUrl,
    serviceUrls,
  };
}

export function isKnownService(name: string): name is ServiceName {
  return Object.prototype.hasOwnProperty.call(SERVICE_MAP, name);
}
