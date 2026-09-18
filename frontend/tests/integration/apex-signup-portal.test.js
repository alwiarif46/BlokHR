import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Apex signup portal (landing)', () => {
  /** @type {typeof import('../../modules/landing/landing.js')} */
  let landing;
  let navigated;

  beforeEach(async () => {
    vi.resetModules();
    navigated = [];
    document.body.innerHTML = `
      <div id="toasts"></div>
      <div id="screenLogin" class="screen"></div>
      <div id="screenLanding" class="screen">
        <div id="landingRoot"></div>
      </div>
    `;
    landing = await import('../../modules/landing/landing.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pickBootScreen returns landing when signupPortal is true even if setupComplete', () => {
    expect(
      landing.pickBootScreen({ signupPortal: true, setupComplete: true, tenantId: 'default' }),
    ).toBe('landing');
  });

  it('pickBootScreen leaves non-apex hosts on setup or login', () => {
    expect(landing.pickBootScreen({ signupPortal: false, setupComplete: false })).toBe('setup');
    expect(landing.pickBootScreen({ setupComplete: true })).toBe('login');
    expect(landing.pickBootScreen(null)).toBe('login');
  });

  it('initLanding mounts React Apex and never activates the login screen', async () => {
    const mountApexLanding = vi.fn((root) => {
      root.innerHTML = '<div data-apex-mounted="1">Apex</div>';
    });
    await landing.initLanding(
      document.getElementById('landingRoot'),
      {
        signupPortal: true,
        setupComplete: true,
        subdomainBase: 'test.example',
      },
      {
        loadApex: async () => ({ mountApexLanding }),
        navigate: (u) => navigated.push(u),
      },
    );
    expect(mountApexLanding).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-apex-mounted]')).toBeTruthy();
    expect(document.getElementById('screenLogin').classList.contains('active')).toBe(false);
    expect(document.getElementById('landingApp')).toBeNull();
  });

  it('initLanding throws when the Apex bundle cannot mount', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      landing.initLanding(document.getElementById('landingRoot'), { signupPortal: true }, {
        loadApex: async () => {
          throw new Error('bundle missing');
        },
      }),
    ).rejects.toThrow(/bundle missing/);
    expect(errSpy).toHaveBeenCalled();
    expect(document.getElementById('landingApp')).toBeNull();
  });

  it('slug check states resolve available / taken / invalid', async () => {
    const get = vi.fn(async (path) => {
      if (path.endsWith('/acme')) return { slug: 'acme', status: 'available' };
      if (path.endsWith('/taken-co')) return { slug: 'taken-co', status: 'taken' };
      if (path.endsWith('/bad')) {
        return { _error: true, status: 400, error: 'invalid_slug', message: 'invalid_slug' };
      }
      return { slug: 'x', status: 'available' };
    });
    const apiMock = { get, post: vi.fn() };

    await expect(landing.checkSlugAvailability(apiMock, 'acme')).resolves.toMatchObject({
      state: 'available',
      slug: 'acme',
    });
    await expect(landing.checkSlugAvailability(apiMock, 'taken-co')).resolves.toMatchObject({
      state: 'taken',
    });
    await expect(landing.checkSlugAvailability(apiMock, 'bad')).resolves.toMatchObject({
      state: 'invalid',
    });
  });

  it('claimWorkspace keeps slug_taken on 409', async () => {
    const claimed = await landing.claimWorkspace(
      {
        post: async () => ({
          _error: true,
          status: 409,
          error: 'slug_taken',
          message: 'slug_taken',
        }),
      },
      'race-co',
    );
    expect(claimed.ok).toBe(false);
    expect(claimed.error).toBe('slug_taken');
    expect(claimed.message).toMatch(/already taken/i);
  });

  it('login path redirects to subdomain rather than posting credentials', async () => {
    const target = landing.loginRedirectTarget('acme', 'test.example', 'taken');
    expect(target.url).toBe('https://acme.test.example/');
    expect(target.message).toBeNull();
  });

  it('login treats available as no such workspace', async () => {
    const result = await landing.checkSlugAvailability(
      { get: async () => ({ slug: 'fresh', status: 'available' }) },
      'fresh',
    );
    const target = landing.loginRedirectTarget('fresh', 'test.example', result.state);
    expect(target.url).toBeNull();
    expect(target.message).toMatch(/No workspace/i);
  });

  it('claimWorkspace uses API workspaceUrl on success', async () => {
    const claimed = await landing.claimWorkspace(
      {
        post: async () => ({
          tenantId: 't1',
          workspaceUrl: 'https://acme.test.example/',
        }),
      },
      'acme',
    );
    expect(claimed.ok).toBe(true);
    expect(claimed.workspaceUrl).toBe('https://acme.test.example/');
  });
});
