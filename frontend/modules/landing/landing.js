/**
 * modules/landing/landing.js
 *
 * Apex signup portal boot: mount React Apex only (no vanilla fallback).
 * Called from shell.html when GET /api/setup/status returns signupPortal: true.
 */

import { api } from '../../shared/api.js';

/** @typedef {'idle'|'checking'|'available'|'taken'|'incomplete'|'invalid'|'error'} SlugUiState */
/** @typedef {'create'|'login'} LandingMode */

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
 * Mount the React Apex bundle. Failures throw after logging — never paint a vanilla fallback.
 * @param {HTMLElement} root
 * @param {{ subdomainBase?: string|null, signupPortal?: boolean }} status
 * @param {{ api?: typeof api, navigate?: (url: string) => void, loadApex?: () => Promise<any> }} [deps]
 * @returns {Promise<boolean>}
 */
export async function tryMountReactApex(root, status, deps) {
  if (!root || typeof document === 'undefined') return false;

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

  const loadApex =
    (deps && typeof deps.loadApex === 'function' && deps.loadApex) ||
    (() => import('/apex/apex.js'));

  let mod;
  try {
    mod = await loadApex();
  } catch (err) {
    console.error('[landing] Apex bundle failed to load', err);
    throw err;
  }

  if (!mod || typeof mod.mountApexLanding !== 'function') {
    const err = new Error('Apex mountApexLanding export missing');
    console.error('[landing]', err);
    throw err;
  }

  root.innerHTML = '';
  mod.mountApexLanding(root, status || {}, {
    api: (deps && deps.api) || api,
    navigate:
      (deps && deps.navigate) ||
      function (url) {
        window.location.href = url;
      },
  });
  return true;
}

/**
 * @param {HTMLElement} root
 * @param {{ subdomainBase?: string|null, signupPortal?: boolean }} status
 * @param {{ api?: typeof api, navigate?: (url: string) => void, loadApex?: () => Promise<any> }} [deps]
 */
export async function initLanding(root, status, deps) {
  if (!root) return;
  await tryMountReactApex(root, status, deps);
}
