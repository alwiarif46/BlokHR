import { describe, it, expect } from 'vitest';
import {
  SESSION_COOKIE_NAME,
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionCookie,
} from '../../src/auth/session-cookie';

describe('session cookie', () => {
  it('round-trips a token from Cookie header', () => {
    const set = buildSessionCookie('tok-abc', 'development');
    expect(set).toContain(`${SESSION_COOKIE_NAME}=tok-abc`);
    expect(set).toContain('HttpOnly');
    expect(set).toContain('SameSite=Lax');
    expect(set).not.toContain('Secure');
    expect(readSessionCookie(`other=1; ${SESSION_COOKIE_NAME}=tok-abc`)).toBe('tok-abc');
  });

  it('sets Secure in production', () => {
    expect(buildSessionCookie('x', 'production')).toContain('Secure');
  });

  it('clears the cookie', () => {
    const cleared = buildClearedSessionCookie('development');
    expect(cleared).toContain('Max-Age=0');
    expect(readSessionCookie(`${SESSION_COOKIE_NAME}=`)).toBe('');
  });
});
