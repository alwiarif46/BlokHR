import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagCache } from '../src/guards/feature-flags';

describe('Gateway feature flag cache', () => {
  let cache: FeatureFlagCache;

  beforeEach(() => {
    cache = new FeatureFlagCache({
      monolithUrl: 'http://127.0.0.1:3000',
      ttlMs: 60_000,
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { key: 'school_vertical', enabled: true },
            { key: 'school_academics', enabled: false },
            { key: 'school_roll_call', enabled: true },
            { key: 'school_attendance_admin', enabled: false },
            { key: 'time_tracking', enabled: false },
            { key: 'overtime', enabled: true },
          ],
        }),
      })) as typeof fetch,
    });
  });

  it('blocks HR compat paths when time_tracking is off', async () => {
    expect(await cache.isHrCompatEnabled('/api/clients')).toBe(false);
    expect(await cache.isHrCompatEnabled('/api/time-entries/1')).toBe(false);
    expect(await cache.isHrCompatEnabled('/api/overtime/pending')).toBe(true);
  });

  it('blocks school-academics when module flag is off', async () => {
    expect(await cache.isServiceEnabled('school-academics')).toBe(false);
  });

  it('allows school-attendance when roll_call is on', async () => {
    expect(await cache.isServiceEnabled('school-attendance')).toBe(true);
  });

  it('requires school_vertical for unmapped school services', async () => {
    expect(await cache.isServiceEnabled('school-timetable')).toBe(true);
  });
});

describe('Gateway feature flag cache — school-assessment OR-gate', () => {
  it('allows school-assessment when school_exams is on and school_hpc is off', async () => {
    const cache = new FeatureFlagCache({
      monolithUrl: 'http://127.0.0.1:3000',
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { key: 'school_vertical', enabled: true },
            { key: 'school_hpc', enabled: false },
            { key: 'school_exams', enabled: true },
          ],
        }),
      })) as typeof fetch,
    });
    expect(await cache.isServiceEnabled('school-assessment')).toBe(true);
  });

  it('allows school-assessment when school_hpc is on and school_exams is off', async () => {
    const cache = new FeatureFlagCache({
      monolithUrl: 'http://127.0.0.1:3000',
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { key: 'school_vertical', enabled: true },
            { key: 'school_hpc', enabled: true },
            { key: 'school_exams', enabled: false },
          ],
        }),
      })) as typeof fetch,
    });
    expect(await cache.isServiceEnabled('school-assessment')).toBe(true);
  });

  it('blocks school-assessment when both school_hpc and school_exams are off', async () => {
    const cache = new FeatureFlagCache({
      monolithUrl: 'http://127.0.0.1:3000',
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [
            { key: 'school_vertical', enabled: true },
            { key: 'school_hpc', enabled: false },
            { key: 'school_exams', enabled: false },
          ],
        }),
      })) as typeof fetch,
    });
    expect(await cache.isServiceEnabled('school-assessment')).toBe(false);
  });
});

describe('Gateway feature flag cache — school vertical off', () => {
  it('blocks all school services when master switch is off', async () => {
    const cache = new FeatureFlagCache({
      monolithUrl: 'http://127.0.0.1:3000',
      fetchFn: vi.fn(async () => ({
        ok: true,
        json: async () => ({
          features: [{ key: 'school_vertical', enabled: false }],
        }),
      })) as typeof fetch,
    });
    expect(await cache.isServiceEnabled('school-academics')).toBe(false);
    expect(await cache.isServiceEnabled('school-timetable')).toBe(false);
    expect(await cache.isServiceEnabled('school-assessment')).toBe(false);
  });
});
