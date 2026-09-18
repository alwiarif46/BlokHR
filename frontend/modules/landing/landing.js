/**
 * modules/landing/landing.js
 *
 * Apex signup portal: Design option 3 (Assembly) hero + create/login flows.
 * Called from shell.html when GET /api/setup/status returns signupPortal: true.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';

/** @typedef {'idle'|'checking'|'available'|'taken'|'incomplete'|'invalid'|'error'} SlugUiState */
/** @typedef {'create'|'login'} LandingMode */

const DEBOUNCE_MS = 350;

/** Markup mirrored from landing.html (for tests / empty #landingRoot). */
export const LANDING_MARKUP = `
<div class="landing" id="landingApp">
  <header class="landing-nav">
    <div class="landing-brand df" aria-label="Blok">Blok</div>
    <button type="button" class="landing-nav-login" data-landing-open="login">Log in</button>
  </header>
  <section class="landing-hero" aria-labelledby="landingHeadline">
    <div class="landing-mosaic breathe" aria-hidden="true">
      <span class="landing-tile landing-tile-w2 landing-tile-a"></span>
      <span class="landing-tile landing-tile-b"></span>
      <span class="landing-tile landing-tile-c"></span>
      <span class="landing-tile landing-tile-d"></span>
      <span class="landing-tile landing-tile-feature landing-tile-w2 landing-tile-h2">
        <span class="landing-tile-kicker mf">On today</span>
        <span class="landing-tile-num mf">12</span>
        <span class="landing-tile-sub">of 46 blocks</span>
      </span>
      <span class="landing-tile landing-tile-e"></span>
      <span class="landing-tile landing-tile-f"></span>
      <span class="landing-tile landing-tile-g"></span>
    </div>
    <h1 class="landing-headline df" id="landingHeadline">The HRMS that<br />clicks together.</h1>
    <p class="landing-lede">
      Motorola drew a phone made of blocks. Google shelved it. We built the software version: 46
      modules, one spine, and a switch on every one.
    </p>
    <div class="landing-cta">
      <button type="button" class="landing-btn-primary" data-landing-open="create">Create workspace</button>
      <button type="button" class="landing-btn-ghost" data-landing-open="login">Log in</button>
      <div class="landing-meta mf">4 setup steps · no card</div>
    </div>
  </section>
  <div class="landing-panel" id="landingPanel" hidden>
    <div class="landing-panel-card" role="dialog" aria-modal="true" aria-labelledby="landingPanelTitle">
      <button type="button" class="landing-panel-close" id="landingPanelClose" aria-label="Close">&times;</button>
      <h2 class="landing-panel-title df" id="landingPanelTitle">Create workspace</h2>
      <p class="landing-panel-sub" id="landingPanelSub">
        Pick a unique subdomain. Your team will use it for setup and sign-in.
      </p>
      <label class="landing-field">
        <span class="landing-field-label">Workspace name</span>
        <div class="landing-slug-row">
          <input class="landing-input" id="landingSlug" type="text" autocomplete="off" spellcheck="false" placeholder="acme" />
          <span class="landing-suffix mf" id="landingSuffix"></span>
        </div>
      </label>
      <div class="landing-err" id="landingErr" hidden></div>
      <div class="landing-hint mf" id="landingHint"></div>
      <button type="button" class="landing-btn-primary landing-btn-submit" id="landingSubmit" disabled>Continue</button>
    </div>
  </div>
</div>
`.trim();

/**
 * Boot gate for apex vs tenant hosts.
 * @param {{ signupPortal?: boolean, setupComplete?: boolean }|null|undefined} status
 * @returns {'landing'|'setup'|'login'}
 */
export function pickBootScreen(status) {
  if (status && status.signupPortal === true) return 'landing';
  if (status && status.setupComplete === false) return 'setup';
  return 'login';
}

/**
 * @param {{ get: (path: string) => Promise<any> }} apiClient
 * @param {string} slug
 * @returns {Promise<{ state: SlugUiState, slug: string, message?: string }>}
 */
export async function checkSlugAvailability(apiClient, slug) {
  const raw = String(slug || '')
    .trim()
    .toLowerCase();
  if (!raw) return { state: 'idle', slug: '' };
  if (raw.length < 3) {
    return { state: 'invalid', slug: raw, message: 'Use at least 3 characters' };
  }
  const check = await apiClient.get('/api/tenants/check/' + encodeURIComponent(raw));
  if (!check || check._error) {
    if (
      check &&
      (check.status === 400 ||
        check.error === 'invalid_slug' ||
        check.message === 'invalid_slug')
    ) {
      return { state: 'invalid', slug: raw, message: 'Invalid workspace name' };
    }
    return {
      state: 'error',
      slug: raw,
      message: (check && (check.message || check.error)) || 'Could not check availability',
    };
  }
  if (check.status === 'available') return { state: 'available', slug: check.slug || raw };
  if (check.status === 'incomplete') return { state: 'incomplete', slug: check.slug || raw };
  if (check.status === 'taken') return { state: 'taken', slug: check.slug || raw };
  return { state: 'invalid', slug: raw, message: 'Invalid workspace name' };
}

/**
 * @param {string} slug
 * @param {string|null|undefined} subdomainBase
 * @param {SlugUiState|string} checkStatus
 * @returns {{ url: string|null, message: string|null }}
 */
export function loginRedirectTarget(slug, subdomainBase, checkStatus) {
  const base = String(subdomainBase || '').trim();
  if (!base) {
    return { url: null, message: 'Workspace routing is not configured' };
  }
  const s = String(slug || '')
    .trim()
    .toLowerCase();
  if (!s) return { url: null, message: 'Enter your workspace name' };
  if (checkStatus === 'available') {
    return { url: null, message: 'No workspace with that name' };
  }
  if (checkStatus === 'taken' || checkStatus === 'incomplete') {
    return { url: 'https://' + s + '.' + base + '/', message: null };
  }
  if (checkStatus === 'invalid') {
    return { url: null, message: 'Invalid workspace name' };
  }
  return { url: null, message: 'Could not find that workspace' };
}

/**
 * @param {{ post: (path: string, body: any) => Promise<any> }} apiClient
 * @param {string} slug
 * @returns {Promise<{ ok: boolean, workspaceUrl?: string, error?: string, message?: string }>}
 */
export async function claimWorkspace(apiClient, slug) {
  const raw = String(slug || '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return { ok: false, error: 'invalid_slug', message: 'Enter a workspace name' };
  }
  const claimed = await apiClient.post('/api/tenants', { slug: raw });
  if (claimed && !claimed._error && claimed.workspaceUrl) {
    return { ok: true, workspaceUrl: claimed.workspaceUrl };
  }
  if (
    claimed &&
    (claimed.error === 'slug_taken' ||
      claimed.status === 409 ||
      claimed.message === 'slug_taken')
  ) {
    return {
      ok: false,
      error: 'slug_taken',
      message: 'That workspace URL is already taken',
    };
  }
  return {
    ok: false,
    error: (claimed && claimed.error) || 'claim_failed',
    message:
      (claimed && (claimed.message || claimed.error)) || 'Could not create workspace',
  };
}

/**
 * Prefer the React Apex bundle (desktop/mobile + light/dark) when present.
 * Falls back to the vanilla Assembly hero markup.
 * @param {HTMLElement} root
 * @param {{ subdomainBase?: string|null, signupPortal?: boolean }} status
 * @param {{ api?: typeof api, navigate?: (url: string) => void }} [deps]
 * @returns {Promise<boolean>}
 */
export async function tryMountReactApex(root, status, deps) {
  if (!root || typeof document === 'undefined') return false;
  try {
    if (!document.querySelector('link[data-apex-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/apex/apex.css';
      link.setAttribute('data-apex-css', '1');
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-apex-font]')) {
      const font = document.createElement('link');
      font.rel = 'stylesheet';
      font.href =
        'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@500;600;700&display=swap';
      font.setAttribute('data-apex-font', '1');
      document.head.appendChild(font);
    }
    const mod = await import('/apex/apex.js');
    if (!mod || typeof mod.mountApexLanding !== 'function') return false;
    root.innerHTML = '';
    mod.mountApexLanding(root, status || {}, {
      api: (deps && deps.api) || api,
      navigate:
        (deps && deps.navigate) ||
        function (url) {
          window.location.href = url;
        },
    });
    const themeBar = document.getElementById('themeBar');
    if (themeBar) themeBar.style.display = 'none';
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * @param {HTMLElement} root
 * @param {{ subdomainBase?: string|null, signupPortal?: boolean }} status
 * @param {{ api?: typeof api, navigate?: (url: string) => void }} [deps]
 */
export function initLanding(root, status, deps) {
  if (!root) return;

  /* Sync vanilla first so tests and first paint stay interactive. */
  if (!root.querySelector('.landing')) {
    root.innerHTML = LANDING_MARKUP;
  }
  bindVanillaLanding(root, status, deps);

  /* Upgrade to React Apex (desktop/mobile + themes) when the bundle is present. */
  void tryMountReactApex(root, status, deps);
}

/**
 * @param {HTMLElement} root
 * @param {{ subdomainBase?: string|null, signupPortal?: boolean }} status
 * @param {{ api?: typeof api, navigate?: (url: string) => void }} [deps]
 */
function bindVanillaLanding(root, status, deps) {
  const apiClient = (deps && deps.api) || api;
  const navigate =
    (deps && deps.navigate) ||
    function (url) {
      window.location.href = url;
    };

  const subdomainBase =
    status && status.subdomainBase ? String(status.subdomainBase).trim() : '';

  /** @type {LandingMode} */
  let mode = 'create';
  /** @type {SlugUiState} */
  let lastState = 'idle';
  let debounceTimer = null;
  let checkSeq = 0;

  const panel = root.querySelector('#landingPanel');
  const titleEl = root.querySelector('#landingPanelTitle');
  const subEl = root.querySelector('#landingPanelSub');
  const input = root.querySelector('#landingSlug');
  const suffixEl = root.querySelector('#landingSuffix');
  const errEl = root.querySelector('#landingErr');
  const hintEl = root.querySelector('#landingHint');
  const submitBtn = root.querySelector('#landingSubmit');
  const closeBtn = root.querySelector('#landingPanelClose');

  if (suffixEl) {
    suffixEl.textContent = subdomainBase ? '.' + subdomainBase : '';
  }

  function setErr(msg) {
    if (!errEl) return;
    if (msg) {
      errEl.textContent = msg;
      errEl.hidden = false;
    } else {
      errEl.textContent = '';
      errEl.hidden = true;
    }
  }

  function setHint(msg, ok) {
    if (!hintEl) return;
    hintEl.textContent = msg || '';
    hintEl.classList.toggle('is-ok', !!ok);
  }

  function applyCreateUi(result) {
    lastState = result.state;
    setErr('');
    setHint('');
    if (submitBtn) submitBtn.disabled = true;

    if (result.state === 'idle') return;
    if (result.state === 'checking') {
      setHint('Checking…');
      return;
    }
    if (result.state === 'available') {
      setHint(
        subdomainBase
          ? 'Available — ' + result.slug + '.' + subdomainBase
          : 'Available',
        true,
      );
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (result.state === 'incomplete') {
      setHint('Workspace exists but setup is unfinished — continue there');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (result.state === 'taken') {
      setErr('That workspace URL is already taken');
      return;
    }
    if (result.state === 'invalid') {
      setErr(result.message || 'Invalid workspace name');
      return;
    }
    if (result.state === 'error') {
      toast(result.message || 'Could not check availability', 'error');
      setErr(result.message || 'Could not check availability');
    }
  }

  function applyLoginUi(result) {
    lastState = result.state;
    setErr('');
    setHint('');
    if (submitBtn) submitBtn.disabled = true;

    if (result.state === 'idle') return;
    if (result.state === 'checking') {
      setHint('Checking…');
      return;
    }
    if (result.state === 'available') {
      setErr('No workspace with that name');
      return;
    }
    if (result.state === 'taken' || result.state === 'incomplete') {
      setHint(
        result.state === 'incomplete'
          ? 'Workspace found — continue setup'
          : 'Workspace found',
        true,
      );
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    if (result.state === 'invalid') {
      setErr(result.message || 'Invalid workspace name');
      return;
    }
    if (result.state === 'error') {
      toast(result.message || 'Could not check availability', 'error');
      setErr(result.message || 'Could not check availability');
    }
  }

  async function refreshAvailability() {
    if (!input) return;
    const raw = (input.value || '').trim().toLowerCase();
    const seq = ++checkSeq;
    if (!raw) {
      lastState = 'idle';
      setErr('');
      setHint('');
      if (submitBtn) submitBtn.disabled = true;
      return;
    }
    lastState = 'checking';
    if (mode === 'create') applyCreateUi({ state: 'checking', slug: raw });
    else applyLoginUi({ state: 'checking', slug: raw });

    const result = await checkSlugAvailability(apiClient, raw);
    if (seq !== checkSeq) return;
    if (mode === 'create') applyCreateUi(result);
    else applyLoginUi(result);
  }

  function openPanel(nextMode) {
    mode = nextMode === 'login' ? 'login' : 'create';
    if (titleEl) {
      titleEl.textContent = mode === 'login' ? 'Log in to your workspace' : 'Create workspace';
    }
    if (subEl) {
      subEl.textContent =
        mode === 'login'
          ? 'Enter your workspace name. We will send you to its sign-in page.'
          : 'Pick a unique subdomain. Your team will use it for setup and sign-in.';
    }
    if (submitBtn) {
      submitBtn.textContent = mode === 'login' ? 'Continue to sign-in' : 'Continue';
      submitBtn.disabled = true;
    }
    setErr('');
    setHint('');
    if (panel) panel.hidden = false;
    if (input) {
      input.focus();
      refreshAvailability();
    }
  }

  function closePanel() {
    if (panel) panel.hidden = true;
  }

  async function onSubmit() {
    if (!input || !submitBtn) return;
    const raw = (input.value || '').trim().toLowerCase();
    if (!raw) return;

    if (mode === 'login') {
      const target = loginRedirectTarget(raw, subdomainBase, lastState);
      if (target.url) {
        navigate(target.url);
        return;
      }
      setErr(target.message || 'Could not find that workspace');
      return;
    }

    submitBtn.disabled = true;
    const claimed = await claimWorkspace(apiClient, raw);
    if (claimed.ok && claimed.workspaceUrl) {
      navigate(claimed.workspaceUrl);
      return;
    }
    if (claimed.error === 'slug_taken') {
      setErr(claimed.message || 'That workspace URL is already taken');
      setHint('');
      lastState = 'taken';
      submitBtn.disabled = false;
      return;
    }
    toast(claimed.message || 'Could not create workspace', 'error');
    setErr(claimed.message || 'Could not create workspace');
    submitBtn.disabled = false;
  }

  root.querySelectorAll('[data-landing-open]').forEach((el) => {
    el.addEventListener('click', () => {
      const m = el.getAttribute('data-landing-open');
      openPanel(m === 'login' ? 'login' : 'create');
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closePanel);
  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closePanel();
    });
  }

  if (input) {
    input.addEventListener('input', () => {
      if (submitBtn) submitBtn.disabled = true;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(refreshAvailability, DEBOUNCE_MS);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onSubmit();
    });
  }

  if (submitBtn) submitBtn.addEventListener('click', onSubmit);
}
