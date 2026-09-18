'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  checkSlugAvailability,
  claimWorkspace,
  createBrowserApi,
  loginRedirectTarget,
  type ApiClient,
  type LandingMode,
  type SetupStatus,
  type SlugUiState,
} from '@/lib/tenants-api'

const DEBOUNCE_MS = 350

interface SignupPanelProps {
  status: SetupStatus
  mode: LandingMode
  open: boolean
  onClose: () => void
  api?: ApiClient
  navigate?: (url: string) => void
}

export function SignupPanel({
  status,
  mode,
  open,
  onClose,
  api,
  navigate,
}: SignupPanelProps) {
  const apiClient = useMemo(() => api ?? createBrowserApi(), [api])
  const go =
    navigate ??
    ((url: string) => {
      window.location.href = url
    })

  const subdomainBase = status.subdomainBase ? String(status.subdomainBase).trim() : ''
  const [slug, setSlug] = useState('')
  const [lastState, setLastState] = useState<SlugUiState>('idle')
  const [err, setErr] = useState('')
  const [hint, setHint] = useState('')
  const [hintOk, setHintOk] = useState(false)
  const [disabled, setDisabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const refresh = useCallback(async () => {
    const raw = slug.trim().toLowerCase()
    if (!raw) {
      setLastState('idle')
      setErr('')
      setHint('')
      setHintOk(false)
      setDisabled(true)
      return
    }
    setLastState('checking')
    setHint('Checking…')
    setHintOk(false)
    setErr('')
    setDisabled(true)
    const result = await checkSlugAvailability(apiClient, raw)
    setLastState(result.state)

    if (mode === 'create') {
      if (result.state === 'available') {
        setHint(
          subdomainBase
            ? `Available — ${result.slug}.${subdomainBase}`
            : 'Available',
        )
        setHintOk(true)
        setDisabled(false)
        return
      }
      if (result.state === 'incomplete') {
        setHint('Workspace exists but setup is unfinished — continue there')
        setHintOk(false)
        setDisabled(false)
        return
      }
      if (result.state === 'taken') {
        setErr('That workspace URL is already taken')
        setHint('')
        return
      }
      if (result.state === 'invalid' || result.state === 'error') {
        setErr(result.message || 'Invalid workspace name')
        setHint('')
        return
      }
      return
    }

    if (result.state === 'available') {
      setErr('No workspace with that name')
      setHint('')
      return
    }
    if (result.state === 'taken' || result.state === 'incomplete') {
      setHint(result.state === 'incomplete' ? 'Workspace found — continue setup' : 'Workspace found')
      setHintOk(true)
      setDisabled(false)
      return
    }
    if (result.state === 'invalid' || result.state === 'error') {
      setErr(result.message || 'Invalid workspace name')
      setHint('')
    }
  }, [apiClient, mode, slug, subdomainBase])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(refresh, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [open, slug, mode, refresh])

  useEffect(() => {
    if (open) {
      setErr('')
      setHint('')
      setDisabled(true)
    }
  }, [open, mode])

  async function onSubmit() {
    const raw = slug.trim().toLowerCase()
    if (!raw || disabled || submitting) return

    if (mode === 'login') {
      const target = loginRedirectTarget(raw, subdomainBase, lastState)
      if (target.url) {
        go(target.url)
        return
      }
      setErr(target.message || 'Could not find that workspace')
      return
    }

    setSubmitting(true)
    setDisabled(true)
    const claimed = await claimWorkspace(apiClient, raw)
    if (claimed.ok && claimed.workspaceUrl) {
      go(claimed.workspaceUrl)
      return
    }
    if (claimed.error === 'slug_taken') {
      setErr(claimed.message || 'That workspace URL is already taken')
      setHint('')
      setLastState('taken')
      setSubmitting(false)
      setDisabled(false)
      return
    }
    setErr(claimed.message || 'Could not create workspace')
    setSubmitting(false)
    setDisabled(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-background/70 p-5 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="apex-panel-title"
        className="relative w-full max-w-[420px] rounded-xl border border-border bg-card p-7 text-card-foreground shadow-2xl"
      >
        <button
          type="button"
          className="absolute top-3 right-3 rounded-md px-2 text-2xl leading-none text-muted-foreground hover:text-foreground"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 id="apex-panel-title" className="mb-2 text-[22px] font-extrabold tracking-tight">
          {mode === 'login' ? 'Log in to your workspace' : 'Create workspace'}
        </h2>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          {mode === 'login'
            ? 'Enter your workspace name. We will send you to its sign-in page.'
            : 'Pick a unique subdomain. Your team will use it for setup and sign-in.'}
        </p>
        <label className="mb-2 block">
          <span className="mb-2 block text-xs font-semibold text-muted-foreground">
            Workspace name
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="min-w-[140px] flex-1 rounded-md border border-input bg-background px-3.5 py-3 text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onSubmit()
              }}
              autoComplete="off"
              spellCheck={false}
              placeholder="acme"
              autoFocus
            />
            <span className="font-mono text-[13px] text-muted-foreground">
              {subdomainBase ? `.${subdomainBase}` : ''}
            </span>
          </div>
        </label>
        {err ? <div className="mt-2 text-[13px] text-rose-600 dark:text-rose-400">{err}</div> : null}
        {hint ? (
          <div
            className={`mt-2 min-h-[1.2em] font-mono text-xs ${
              hintOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
            }`}
          >
            {hint}
          </div>
        ) : null}
        <button
          type="button"
          disabled={disabled || submitting}
          onClick={() => void onSubmit()}
          className="mt-5 block w-full rounded-xl bg-primary px-5 py-4 text-center text-[15px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45"
        >
          {mode === 'login' ? 'Continue to sign-in' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
