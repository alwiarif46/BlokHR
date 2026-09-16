import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('api upstream_unavailable mapping', () => {
  beforeEach(() => {
    vi.resetModules();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formatUpstreamUnavailable uses friendly service labels', async () => {
    const { formatUpstreamUnavailable } = await import('../../shared/api.js');
    expect(formatUpstreamUnavailable('school-attendance')).toBe(
      'Attendance service is unavailable. Start the school stack and retry.',
    );
    expect(formatUpstreamUnavailable('school-library')).toMatch(/Library service is unavailable/);
    expect(formatUpstreamUnavailable(undefined)).toMatch(/A school service is unavailable/);
  });

  it('preserves service and rewrites upstream_unavailable message on failed responses', async () => {
    vi.doMock('../../shared/toast.js', () => ({
      toast: vi.fn(),
      setToastDuration: () => {},
    }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'a@b.c', name: 'A' }),
      clearSession: () => {},
      getGuardianSession: () => null,
      clearGuardianSession: () => {},
    }));

    const { initApi, api } = await import('../../shared/api.js');
    initApi({ base: 'http://localhost:8080', mockMode: false });

    global.fetch.mockResolvedValue({
      status: 502,
      ok: false,
      text: async () =>
        JSON.stringify({ error: 'upstream_unavailable', service: 'school-attendance' }),
    });

    const result = await api.get('/svc/school-attendance/api/attendance/t1/register');
    expect(result._error).toBe(true);
    expect(result.status).toBe(502);
    expect(result.error).toBe('upstream_unavailable');
    expect(result.service).toBe('school-attendance');
    expect(result.message).toBe(
      'Attendance service is unavailable. Start the school stack and retry.',
    );
  });
});
