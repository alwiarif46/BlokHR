/**
 * Monolith /api/* paths that stay reachable without staff introspect.
 * Everything else requires a Bearer session (fail-closed).
 */
export interface PublicApiRule {
  method: string;
  pattern: RegExp;
  comment: string;
}

export const PUBLIC_API_PATHS: PublicApiRule[] = [
  { method: 'GET', pattern: /^\/api\/health\/?$/, comment: 'liveness' },
  { method: 'GET', pattern: /^\/api\/setup\/status\/?$/, comment: 'setup probe' },
  { method: 'POST', pattern: /^\/api\/setup\/step[123]\/?$/, comment: 'setup wizard (claim token in later wave)' },
  { method: 'GET', pattern: /^\/api\/auth\/providers\/?$/, comment: 'login discovery' },
  { method: 'POST', pattern: /^\/api\/auth\/local\/?$/, comment: 'password login' },
  { method: 'POST', pattern: /^\/api\/auth\/logout\/?$/, comment: 'clear session cookie' },
  { method: 'POST', pattern: /^\/api\/auth\/forgot-password\/?$/, comment: 'password reset request' },
  { method: 'POST', pattern: /^\/api\/auth\/forgot-password\/confirm\/?$/, comment: 'password reset confirm' },
  { method: 'POST', pattern: /^\/api\/auth\/magic-link\/(request|verify)\/?$/, comment: 'magic link' },
  { method: 'POST', pattern: /^\/api\/auth\/(teams-sso|google|ldap)\/?$/, comment: 'federated login' },
  { method: 'GET', pattern: /^\/api\/auth\/oidc\/authorize\/?$/, comment: 'OIDC start' },
  { method: 'POST', pattern: /^\/api\/auth\/oidc\/callback\/?$/, comment: 'OIDC callback' },
  { method: 'GET', pattern: /^\/api\/auth\/saml\/login\/?$/, comment: 'SAML start' },
  { method: 'POST', pattern: /^\/api\/auth\/saml\/callback\/?$/, comment: 'SAML callback' },
  { method: 'POST', pattern: /^\/api\/auth\/biometric\/?$/, comment: 'mobile biometric login' },
  { method: 'GET', pattern: /^\/api\/tenants\/check\/[^/]+\/?$/, comment: 'slug availability' },
  { method: 'POST', pattern: /^\/api\/tenants\/?$/, comment: 'workspace claim' },
  { method: 'GET', pattern: /^\/api\/sse(\/stream)?\/?$/, comment: 'EventSource cannot send Bearer' },
  { method: 'GET', pattern: /^\/api\/actions\/[^/]+\/?$/, comment: 'signed email action links' },
  { method: 'POST', pattern: /^\/api\/webhooks\/inbound\/[^/]+\/?$/, comment: 'vendor inbound webhooks' },
  { method: 'POST', pattern: /^\/api\/interactions\/[^/]+\/?$/, comment: 'chat platform action webhooks' },
  { method: 'GET', pattern: /^\/api\/meetings\/calendar\/callback\/[^/]+\/?$/, comment: 'calendar OAuth return' },
  { method: 'GET', pattern: /^\/api\/kiosk\/(status|members)\/?$/, comment: 'kiosk device (device auth later)' },
  { method: 'POST', pattern: /^\/api\/kiosk\/(verify|clock)\/?$/, comment: 'kiosk device (device auth later)' },
  { method: 'GET', pattern: /^\/api\/capture\/session-token\/?$/, comment: 'capture device (device auth later)' },
  { method: 'POST', pattern: /^\/api\/capture\/events\/?$/, comment: 'capture device (device auth later)' },
  { method: 'POST', pattern: /^\/api\/transport\/bus-events\/?$/, comment: 'transport device (device auth later)' },
];

export function isPublicApiPath(method: string, pathname: string): boolean {
  const pathOnly = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const normalized = pathOnly.startsWith('/api') ? pathOnly : `/api${pathOnly === '/' ? '' : pathOnly}`;
  const m = method.toUpperCase();
  return PUBLIC_API_PATHS.some((rule) => rule.method === m && rule.pattern.test(normalized));
}
