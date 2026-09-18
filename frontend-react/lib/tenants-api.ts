/** Tenant signup/login helpers — mirrors frontend/modules/landing/landing.js */

export type SlugUiState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'taken'
  | 'incomplete'
  | 'invalid'
  | 'error'

export type LandingMode = 'create' | 'login'

export interface SetupStatus {
  signupPortal?: boolean
  setupComplete?: boolean
  subdomainBase?: string | null
  tenantId?: string
  tenant_id?: string
}

export interface ApiClient {
  get: (path: string) => Promise<Record<string, unknown>>
  post: (path: string, body: unknown) => Promise<Record<string, unknown>>
}

export async function checkSlugAvailability(
  apiClient: ApiClient,
  slug: string,
): Promise<{ state: SlugUiState; slug: string; message?: string }> {
  const raw = String(slug || '')
    .trim()
    .toLowerCase()
  if (!raw) return { state: 'idle', slug: '' }
  if (raw.length < 3) {
    return { state: 'invalid', slug: raw, message: 'Use at least 3 characters' }
  }
  const check = await apiClient.get('/api/tenants/check/' + encodeURIComponent(raw))
  if (!check || check._error) {
    if (
      check &&
      (check.status === 400 ||
        check.error === 'invalid_slug' ||
        check.message === 'invalid_slug')
    ) {
      return { state: 'invalid', slug: raw, message: 'Invalid workspace name' }
    }
    return {
      state: 'error',
      slug: raw,
      message:
        (typeof check?.message === 'string' && check.message) ||
        (typeof check?.error === 'string' && check.error) ||
        'Could not check availability',
    }
  }
  if (check.status === 'available') return { state: 'available', slug: String(check.slug || raw) }
  if (check.status === 'incomplete') return { state: 'incomplete', slug: String(check.slug || raw) }
  if (check.status === 'taken') return { state: 'taken', slug: String(check.slug || raw) }
  return { state: 'invalid', slug: raw, message: 'Invalid workspace name' }
}

export function loginRedirectTarget(
  slug: string,
  subdomainBase: string | null | undefined,
  checkStatus: SlugUiState | string,
): { url: string | null; message: string | null } {
  const base = String(subdomainBase || '').trim()
  if (!base) {
    return { url: null, message: 'Workspace routing is not configured' }
  }
  const s = String(slug || '')
    .trim()
    .toLowerCase()
  if (!s) return { url: null, message: 'Enter your workspace name' }
  if (checkStatus === 'available') {
    return { url: null, message: 'No workspace with that name' }
  }
  if (checkStatus === 'taken' || checkStatus === 'incomplete') {
    return { url: 'https://' + s + '.' + base + '/', message: null }
  }
  if (checkStatus === 'invalid') {
    return { url: null, message: 'Invalid workspace name' }
  }
  return { url: null, message: 'Could not find that workspace' }
}

export async function claimWorkspace(
  apiClient: ApiClient,
  slug: string,
): Promise<{ ok: boolean; workspaceUrl?: string; error?: string; message?: string }> {
  const raw = String(slug || '')
    .trim()
    .toLowerCase()
  if (!raw) {
    return { ok: false, error: 'invalid_slug', message: 'Enter a workspace name' }
  }
  const claimed = await apiClient.post('/api/tenants', { slug: raw })
  if (claimed && !claimed._error && claimed.workspaceUrl) {
    return { ok: true, workspaceUrl: String(claimed.workspaceUrl) }
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
    }
  }
  return {
    ok: false,
    error: (typeof claimed?.error === 'string' && claimed.error) || 'claim_failed',
    message:
      (typeof claimed?.message === 'string' && claimed.message) ||
      (typeof claimed?.error === 'string' && claimed.error) ||
      'Could not create workspace',
  }
}

/** Browser fetch client for apex (same-origin via gateway). */
export function createBrowserApi(): ApiClient {
  return {
    async get(path) {
      try {
        const res = await fetch(path, { credentials: 'include' })
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (!res.ok) {
          return { ...data, _error: true, status: res.status }
        }
        return data
      } catch (err) {
        return {
          _error: true,
          message: err instanceof Error ? err.message : 'Network error',
        }
      }
    },
    async post(path, body) {
      try {
        const res = await fetch(path, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
        if (!res.ok) {
          return { ...data, _error: true, status: res.status }
        }
        return data
      } catch (err) {
        return {
          _error: true,
          message: err instanceof Error ? err.message : 'Network error',
        }
      }
    },
  }
}
