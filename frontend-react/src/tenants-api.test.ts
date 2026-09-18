import { describe, expect, it, vi } from 'vitest'
import {
  checkSlugAvailability,
  claimWorkspace,
  loginRedirectTarget,
} from '../lib/tenants-api'

describe('tenants-api', () => {
  it('rejects short slugs', async () => {
    const api = { get: vi.fn(), post: vi.fn() }
    const result = await checkSlugAvailability(api, 'ab')
    expect(result.state).toBe('invalid')
  })

  it('maps available check', async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ status: 'available', slug: 'acme' }),
      post: vi.fn(),
    }
    const result = await checkSlugAvailability(api, 'acme')
    expect(result).toEqual({ state: 'available', slug: 'acme' })
  })

  it('builds login redirect for taken workspaces', () => {
    expect(loginRedirectTarget('acme', 'blok.hr', 'taken').url).toBe('https://acme.blok.hr/')
    expect(loginRedirectTarget('acme', 'blok.hr', 'available').url).toBeNull()
  })

  it('claims workspace urls', async () => {
    const api = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({ workspaceUrl: 'https://acme.blok.hr/' }),
    }
    const result = await claimWorkspace(api, 'acme')
    expect(result.ok).toBe(true)
    expect(result.workspaceUrl).toBe('https://acme.blok.hr/')
  })
})
