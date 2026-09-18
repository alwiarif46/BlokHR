'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { NavLink, Outlet } from 'react-router-dom'
import { BRAND, MOBILE_NAV, NAV } from '@/app/apex/marketing-copy'
import { SignupPanel } from '@/app/apex/signup-panel'
import { useTheme } from '@/app/apex/theme-provider'
import type { ApiClient, LandingMode, SetupStatus } from '@/lib/tenants-api'

export interface ApexOutletContext {
  openSignup: (mode: LandingMode) => void
  status: SetupStatus
  api?: ApiClient
  navigate?: (url: string) => void
}

const ApexCtx = createContext<ApexOutletContext | null>(null)

export function useApex() {
  const ctx = useContext(ApexCtx)
  if (!ctx) throw new Error('useApex must be used within ApexShell')
  return ctx
}

interface ApexShellProps {
  status: SetupStatus
  api?: ApiClient
  navigate?: (url: string) => void
  children?: ReactNode
}

export function ApexShell({ status, api, navigate, children }: ApexShellProps) {
  const { theme, toggleTheme } = useTheme()
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState<LandingMode>('create')

  const openSignup = useCallback((next: LandingMode) => {
    setMode(next)
    setPanelOpen(true)
  }, [])

  const value = useMemo(
    () => ({ openSignup, status, api, navigate }),
    [openSignup, status, api, navigate],
  )

  return (
    <ApexCtx.Provider value={value}>
      <div className="relative min-h-screen bg-background text-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />

        <header className="relative z-10 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 pt-5 pb-3 md:gap-6 md:px-8 md:pt-8 md:pb-4">
          <NavLink
            to="/"
            end
            className="text-[28px] font-extrabold tracking-[-1.2px] leading-none md:text-[40px] md:tracking-[-1.4px]"
            aria-label={BRAND}
          >
            {BRAND}
          </NavLink>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `font-mono text-[12px] tracking-[1px] uppercase ${
                    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-muted-foreground hover:text-foreground"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              <Icon
                icon={theme === 'dark' ? 'mdi:white-balance-sunny' : 'mdi:moon-waning-crescent'}
                className="size-4"
              />
            </button>
            <button
              type="button"
              onClick={() => openSignup('login')}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border border-border px-4 py-2 font-mono text-[12px] tracking-[1px] text-muted-foreground uppercase hover:text-foreground"
            >
              <Icon icon="mdi:login" className="size-3.5" />
              Log in
            </button>
            <button
              type="button"
              onClick={() => openSignup('create')}
              className="hidden min-h-11 items-center gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-mono text-[12px] tracking-[1px] text-primary-foreground uppercase sm:inline-flex"
            >
              <Icon icon="mdi:plus-box-outline" className="size-3.5" />
              Create workspace
            </button>
          </div>
        </header>

        <div className="pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
          {children ?? <Outlet />}
        </div>

        <nav
          className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background"
          style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
          aria-label="Page menu"
        >
          <div className="mx-auto flex w-full max-w-[1180px] items-stretch justify-between gap-0.5 px-1 pt-1">
            {MOBILE_NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 font-mono text-[10px] tracking-[0.3px] uppercase transition-colors ${
                    isActive
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                <Icon icon={item.icon} className="size-5 shrink-0" aria-hidden="true" />
                <span className="max-w-full truncate leading-none">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>

        <SignupPanel
          status={status}
          mode={mode}
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          api={api}
          navigate={navigate}
        />
      </div>
    </ApexCtx.Provider>
  )
}
