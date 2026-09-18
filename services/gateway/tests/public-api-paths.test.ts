import { describe, it, expect } from 'vitest';
import { isPublicApiPath } from '../src/guards/public-api-paths';

describe('isPublicApiPath', () => {
  it('allows login and setup probes', () => {
    expect(isPublicApiPath('GET', '/api/auth/providers')).toBe(true);
    expect(isPublicApiPath('POST', '/api/auth/local')).toBe(true);
    expect(isPublicApiPath('POST', '/api/auth/logout')).toBe(true);
    expect(isPublicApiPath('GET', '/api/setup/status')).toBe(true);
    expect(isPublicApiPath('POST', '/api/setup/step3')).toBe(true);
  });

  it('does not allow admin register or clock', () => {
    expect(isPublicApiPath('POST', '/api/auth/local/register')).toBe(false);
    expect(isPublicApiPath('POST', '/api/clock')).toBe(false);
    expect(isPublicApiPath('GET', '/api/attendance')).toBe(false);
    expect(isPublicApiPath('GET', '/api/settings')).toBe(false);
  });

  it('allows kiosk and SSE device constraints', () => {
    expect(isPublicApiPath('GET', '/api/sse')).toBe(true);
    expect(isPublicApiPath('GET', '/api/kiosk/members')).toBe(true);
    expect(isPublicApiPath('POST', '/api/kiosk/pins/alice@x.com')).toBe(false);
  });
});
