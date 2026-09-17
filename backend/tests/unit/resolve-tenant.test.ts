import { describe, it, expect } from 'vitest';
import {
  normalizeHost,
  parseTenantHostMap,
  resolveTenantId,
} from '../../src/tenant/resolve-tenant';

describe('resolveTenantId', () => {
  const map = parseTenantHostMap(
    JSON.stringify({
      'blokhr.vercel.app': 'default',
      'si.blokhr.app': 'si',
      'acme.example.com': 'acme',
    }),
  );

  it('parses TENANT_HOST_MAP JSON', () => {
    expect(map['blokhr.vercel.app']).toBe('default');
    expect(map['si.blokhr.app']).toBe('si');
    expect(parseTenantHostMap('')).toEqual({});
    expect(parseTenantHostMap('not-json')).toEqual({});
  });

  it('normalizes host with port', () => {
    expect(normalizeHost('Acme.Example.com:443')).toBe('acme.example.com');
  });

  it('resolves from Host map', () => {
    expect(
      resolveTenantId({
        headers: { host: 'si.blokhr.app' },
        hostMap: map,
        fallback: 'default',
      }),
    ).toBe('si');
  });

  it('prefers X-Forwarded-Host over Host', () => {
    expect(
      resolveTenantId({
        headers: {
          host: 'gateway.railway.app',
          'x-forwarded-host': 'blokhr.vercel.app',
        },
        hostMap: map,
        fallback: 'default',
      }),
    ).toBe('default');
  });

  it('ignores client X-Blok-Tenant unless trusted', () => {
    expect(
      resolveTenantId({
        headers: { host: 'unknown.local', 'x-blok-tenant': 'spoofed' },
        hostMap: map,
        trustBlokTenantHeader: false,
        fallback: 'default',
      }),
    ).toBe('default');

    expect(
      resolveTenantId({
        headers: { host: 'unknown.local', 'x-blok-tenant': 'trusted-t' },
        hostMap: map,
        trustBlokTenantHeader: true,
        fallback: 'default',
      }),
    ).toBe('trusted-t');
  });

  it('falls back to DEFAULT_TENANT_ID', () => {
    expect(
      resolveTenantId({
        headers: { host: 'localhost:3000' },
        hostMap: map,
        fallback: 'default',
      }),
    ).toBe('default');
  });
});
