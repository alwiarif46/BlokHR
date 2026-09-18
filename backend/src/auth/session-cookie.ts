/** HttpOnly staff session cookie (set alongside Bearer for SSE / cookie-aware clients). */

export const SESSION_COOKIE_NAME = 'blok_session';
export const SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export function readCookieValue(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      return part.slice(idx + 1).trim();
    }
  }
  return '';
}

export function readSessionCookie(cookieHeader: string | undefined): string {
  return readCookieValue(cookieHeader, SESSION_COOKIE_NAME);
}

function cookieFlags(nodeEnv: string, maxAgeSec: number): string {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (nodeEnv === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function buildSessionCookie(token: string, nodeEnv: string): string {
  const value = encodeURIComponent(token);
  return `${SESSION_COOKIE_NAME}=${value}; ${cookieFlags(nodeEnv, SESSION_COOKIE_MAX_AGE_SEC)}`;
}

export function buildClearedSessionCookie(nodeEnv: string): string {
  return `${SESSION_COOKIE_NAME}=; ${cookieFlags(nodeEnv, 0)}`;
}
