import { describe, it, expect } from 'vitest';
import {
  assertTenantPathMatch,
  extractPathTenantId,
} from '../src/guards/tenant-path';

describe('extractPathTenantId', () => {
  it('reads tenant from school API paths', () => {
    expect(extractPathTenantId('/api/attendance/default/reason-codes')).toBe('default');
    expect(extractPathTenantId('/api/identity/si/students')).toBe('si');
    expect(extractPathTenantId('/api/fees/tenant-a/guardian/students/x/ledger')).toBe(
      'tenant-a',
    );
  });

  it('returns null for non-tenanted paths', () => {
    expect(extractPathTenantId('/health')).toBeNull();
    expect(extractPathTenantId('/api/health')).toBeNull();
    expect(extractPathTenantId('/')).toBeNull();
  });
});

describe('assertTenantPathMatch', () => {
  it('allows matching Host and path', () => {
    const r = assertTenantPathMatch({
      upstreamPath: '/api/attendance/tenant-a/reason-codes',
      hostTenant: 'tenant-a',
    });
    expect(r.ok).toBe(true);
  });

  it('denies path tenant different from Host', () => {
    const r = assertTenantPathMatch({
      upstreamPath: '/api/attendance/tenant-b/reason-codes',
      hostTenant: 'tenant-a',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('tenant_mismatch');
      expect(r.pathTenant).toBe('tenant-b');
      expect(r.expected).toBe('tenant-a');
    }
  });

  it('denies session tenant different from Host', () => {
    const r = assertTenantPathMatch({
      upstreamPath: '/api/attendance/tenant-a/reason-codes',
      hostTenant: 'tenant-a',
      sessionTenant: 'tenant-b',
    });
    expect(r.ok).toBe(false);
  });

  it('allows paths without tenant segment', () => {
    const r = assertTenantPathMatch({
      upstreamPath: '/health',
      hostTenant: 'default',
    });
    expect(r.ok).toBe(true);
  });
});
