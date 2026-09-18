import { describe, it, expect } from 'vitest';
import { resolveInternalSecret } from '../../src/internal-auth';

describe('resolveInternalSecret', () => {
  it('returns the configured secret', () => {
    expect(resolveInternalSecret({ INTERNAL_SECRET: '  real-secret  ' })).toBe('real-secret');
  });

  it('uses the test placeholder when NODE_ENV=test', () => {
    expect(resolveInternalSecret({ NODE_ENV: 'test' })).toBe('test-internal-secret');
  });

  it('allows an empty secret in development', () => {
    expect(resolveInternalSecret({ NODE_ENV: 'development' })).toBe('');
  });

  it('fails fast in production when INTERNAL_SECRET is missing', () => {
    expect(() => resolveInternalSecret({ NODE_ENV: 'production' })).toThrow(
      /INTERNAL_SECRET/,
    );
  });
});
