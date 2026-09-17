import { describe, it, expect } from 'vitest';
import {
  extractSubdomainTenant,
  normalizeTenantSlug,
  parseHostList,
  parseReservedSlugs,
  parseTenantHostMap,
  resolvePublicHost,
  resolveTenantId,
} from '../src/resolve-tenant';

describe('gateway resolveTenantId subdomain', () => {
  const reserved = parseReservedSlugs('');
  const apexHosts = parseHostList('www.13blok.com,13blok.com');

  it('maps acme.13blok.com → acme', () => {
    expect(
      resolveTenantId({
        headers: { host: 'acme.13blok.com' },
        hostMap: {},
        subdomainBase: '13blok.com',
        reservedSlugs: reserved,
        apexHosts,
        fallback: 'default',
      }),
    ).toBe('acme');
  });

  it('does not treat www.13blok.com as a slug', () => {
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

  it('rejects reserved api slug', () => {
    expect(
      extractSubdomainTenant('api.13blok.com', '13blok.com', reserved, apexHosts),
    ).toBeNull();
  });

  it('still honors exact TENANT_HOST_MAP', () => {
    const map = parseTenantHostMap(JSON.stringify({ 'blokhr.vercel.app': 'default' }));
    expect(
      resolveTenantId({
        headers: { host: 'blokhr.vercel.app' },
        hostMap: map,
        subdomainBase: '13blok.com',
        reservedSlugs: reserved,
        apexHosts,
        fallback: 'default',
      }),
    ).toBe('default');
  });

  it('rejects short slugs', () => {
    expect(normalizeTenantSlug('ab', reserved)).toBeNull();
  });

  it('resolvePublicHost prefers Origin when XFHost echoes gateway Host', () => {
    expect(
      resolvePublicHost({
        host: 'gateway-production-5a5f.up.railway.app',
        'x-forwarded-host': 'gateway-production-5a5f.up.railway.app',
        origin: 'https://www.13blok.com',
      }),
    ).toBe('www.13blok.com');
  });

  it('resolvePublicHost prefers distinct X-Forwarded-Host', () => {
    expect(
      resolvePublicHost({
        host: 'gateway-production-5a5f.up.railway.app',
        'x-forwarded-host': 'www.13blok.com',
      }),
    ).toBe('www.13blok.com');
  });
});
