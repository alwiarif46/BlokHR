import { describe, it, expect } from 'vitest';
import {
  extractSubdomainTenant,
  normalizeHost,
  normalizeTenantSlug,
  parseHostList,
  parseReservedSlugs,
  parseTenantHostMap,
  resolveTenantId,
  DEFAULT_RESERVED_SLUGS,
} from '../../src/tenant/resolve-tenant';

describe('resolveTenantId', () => {
  const map = parseTenantHostMap(
    JSON.stringify({
      'blokhr.vercel.app': 'default',
      'si.blokhr.app': 'si',
      'acme.example.com': 'acme',
    }),
  );
  const reserved = parseReservedSlugs('');
  const apexHosts = parseHostList('www.13blok.com,13blok.com');

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

  it('resolves subdomain slug when TENANT_SUBDOMAIN_BASE is set', () => {
    expect(
      resolveTenantId({
        headers: { host: 'acme.13blok.com' },
        hostMap: map,
        subdomainBase: '13blok.com',
        reservedSlugs: reserved,
        apexHosts,
        fallback: 'default',
      }),
    ).toBe('acme');
  });

  it('does not treat apex www as a slug tenant', () => {
    expect(
      resolveTenantId({
        headers: { host: 'www.13blok.com' },
        hostMap: {},
        subdomainBase: '13blok.com',
        reservedSlugs: reserved,
        apexHosts,
        fallback: 'default',
      }),
    ).toBe('default');
  });

  it('rejects reserved subdomain labels', () => {
    expect(
      extractSubdomainTenant('www.13blok.com', '13blok.com', reserved, apexHosts),
    ).toBeNull();
    expect(
      extractSubdomainTenant('api.13blok.com', '13blok.com', reserved, apexHosts),
    ).toBeNull();
  });

  it('prefers exact Host map over subdomain extraction', () => {
    const overrideMap = parseTenantHostMap(
      JSON.stringify({ 'special.13blok.com': 'enterprise-x' }),
    );
    expect(
      resolveTenantId({
        headers: { host: 'special.13blok.com' },
        hostMap: overrideMap,
        subdomainBase: '13blok.com',
        reservedSlugs: reserved,
        apexHosts,
        fallback: 'default',
      }),
    ).toBe('enterprise-x');
  });
});

describe('normalizeTenantSlug', () => {
  const reserved = new Set(DEFAULT_RESERVED_SLUGS);

  it('accepts valid slugs', () => {
    expect(normalizeTenantSlug('acme', reserved)).toBe('acme');
    expect(normalizeTenantSlug('Acme-Co', reserved)).toBe('acme-co');
  });

  it('rejects reserved and invalid', () => {
    expect(normalizeTenantSlug('www', reserved)).toBeNull();
    expect(normalizeTenantSlug('ab', reserved)).toBeNull();
    expect(normalizeTenantSlug('-acme', reserved)).toBeNull();
    expect(normalizeTenantSlug('acme!', reserved)).toBeNull();
  });
});

describe('parseHostList / parseReservedSlugs', () => {
  it('parses apex hosts', () => {
    const set = parseHostList('www.13blok.com, 13blok.com');
    expect(set.has('www.13blok.com')).toBe(true);
    expect(set.has('13blok.com')).toBe(true);
  });

  it('merges reserved defaults', () => {
    const set = parseReservedSlugs('billing');
    expect(set.has('www')).toBe(true);
    expect(set.has('billing')).toBe(true);
  });
});
