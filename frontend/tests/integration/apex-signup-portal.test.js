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

  it('initLanding renders hero and never activates the login screen', () => {
    landing.initLanding(document.getElementById('landingRoot'), {
      signupPortal: true,
      setupComplete: true,
      subdomainBase: 'test.example',
    });
    const app = document.getElementById('landingApp');
    expect(app).toBeTruthy();
    expect(document.getElementById('landingHeadline').textContent).toMatch(/clicks together/i);
    expect(document.getElementById('screenLogin').classList.contains('active')).toBe(false);
    expect(document.querySelector('[data-landing-open="create"]')).toBeTruthy();
    expect(document.querySelector('[data-landing-open="login"]')).toBeTruthy();
  });

  it('slug check states render available / taken / invalid inline', async () => {
    vi.useFakeTimers();
    const get = vi.fn(async (path) => {
      if (path.endsWith('/acme')) return { slug: 'acme', status: 'available' };
      if (path.endsWith('/taken-co')) return { slug: 'taken-co', status: 'taken' };
      if (path.endsWith('/bad')) {
        return { _error: true, status: 400, error: 'invalid_slug', message: 'invalid_slug' };
      }
      return { slug: 'x', status: 'available' };
    });
    const apiMock = { get, post: vi.fn() };

    landing.initLanding(
      document.getElementById('landingRoot'),
      { signupPortal: true, subdomainBase: 'test.example' },
      { api: apiMock, navigate: (u) => navigated.push(u) },
    );

    document.querySelector('[data-landing-open="create"]').click();
    const input = document.getElementById('landingSlug');
    const err = document.getElementById('landingErr');
    const hint = document.getElementById('landingHint');
    const btn = document.getElementById('landingSubmit');

    input.value = 'acme';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();
    expect(hint.textContent).toMatch(/Available/i);
    expect(hint.classList.contains('is-ok')).toBe(true);
    expect(btn.disabled).toBe(false);
    expect(err.hidden).toBe(true);

    input.value = 'taken-co';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/already taken/i);
    expect(btn.disabled).toBe(true);

    input.value = 'bad';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();
    expect(err.textContent).toMatch(/Invalid workspace name/i);
    expect(btn.disabled).toBe(true);
  });

  it('409 on claim keeps the typed slug and shows taken inline', async () => {
    const get = vi.fn(async () => ({ slug: 'race-co', status: 'available' }));
    const post = vi.fn(async () => ({
      _error: true,
      status: 409,
      error: 'slug_taken',
      message: 'slug_taken',
    }));
    const apiMock = { get, post };

    landing.initLanding(
      document.getElementById('landingRoot'),
      { signupPortal: true, subdomainBase: 'test.example' },
      { api: apiMock, navigate: (u) => navigated.push(u) },
    );

    document.querySelector('[data-landing-open="create"]').click();
    const input = document.getElementById('landingSlug');
    const btn = document.getElementById('landingSubmit');
    const err = document.getElementById('landingErr');

    input.value = 'race-co';
    /* Force submit enabled as if check passed */
    btn.disabled = false;
    await btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(navigated).toEqual([]);
    expect(input.value).toBe('race-co');
    expect(err.hidden).toBe(false);
    expect(err.textContent).toMatch(/already taken/i);
    expect(btn.disabled).toBe(false);
  });

  it('login path redirects to subdomain rather than posting credentials', async () => {
    vi.useFakeTimers();
    const get = vi.fn(async () => ({ slug: 'acme', status: 'taken' }));
    const post = vi.fn();
    const apiMock = { get, post };

    landing.initLanding(
      document.getElementById('landingRoot'),
      { signupPortal: true, subdomainBase: 'test.example' },
      { api: apiMock, navigate: (u) => navigated.push(u) },
    );

    document.querySelector('[data-landing-open="login"]').click();
    const input = document.getElementById('landingSlug');
    const btn = document.getElementById('landingSubmit');

    input.value = 'acme';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    await Promise.resolve();
    expect(btn.disabled).toBe(false);

    await btn.click();
    await Promise.resolve();

    expect(post).not.toHaveBeenCalled();
    expect(navigated).toEqual(['https://acme.test.example/']);
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
