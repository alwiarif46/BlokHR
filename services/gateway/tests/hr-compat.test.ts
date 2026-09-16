import { describe, it, expect } from 'vitest';
import { resolveHrCompatRewrite } from '../src/guards/hr-compat';

describe('HR legacy path rewrites', () => {
  it('maps time-tracking flat contracts', () => {
    expect(resolveHrCompatRewrite('GET', '/api/clients', '', 'acme')).toEqual({
      service: 'time-tracking',
      upstreamPath: '/api/time-tracking/acme/clients',
    });
    expect(resolveHrCompatRewrite('POST', '/api/time-entries', '', 'acme')).toEqual({
      service: 'time-tracking',
      upstreamPath: '/api/time-tracking/acme/time-entries',
    });
    expect(
      resolveHrCompatRewrite('GET', '/api/time-summary', '?email=a@b.c', 'acme'),
    ).toEqual({
      service: 'time-tracking',
      upstreamPath: '/api/time-tracking/acme/time-summary?email=a@b.c',
    });
  });

  it('maps overtime list / pending / log / detect / approve', () => {
    expect(
      resolveHrCompatRewrite(
        'GET',
        '/api/overtime',
        '?email=a%40b.c&startDate=2026-01-01',
        't1',
      ),
    ).toEqual({
      service: 'overtime',
      upstreamPath: '/api/overtime/t1/records/by-email/a%40b.c?start=2026-01-01',
    });
    expect(resolveHrCompatRewrite('GET', '/api/overtime/pending', '', 't1')).toEqual({
      service: 'overtime',
      upstreamPath: '/api/overtime/t1/records/pending',
    });
    expect(resolveHrCompatRewrite('POST', '/api/overtime/log', '', 't1')).toEqual({
      service: 'overtime',
      upstreamPath: '/api/overtime/t1/records',
    });
    expect(resolveHrCompatRewrite('POST', '/api/overtime/detect', '', 't1')).toEqual({
      service: 'overtime',
      upstreamPath: '/api/overtime/t1/detect',
    });
    expect(resolveHrCompatRewrite('POST', '/api/overtime/42/approve', '', 't1')).toEqual({
      service: 'overtime',
      upstreamPath: '/api/overtime/t1/records/42/approve',
    });
  });

  it('ignores unrelated api paths', () => {
    expect(resolveHrCompatRewrite('GET', '/api/leaves', '', 't1')).toBeNull();
  });
});
