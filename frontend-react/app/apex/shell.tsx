'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { NavLink, Outlet } from 'react-router-dom'
import { BRAND, NAV } from '@/app/apex/marketing-copy'
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
      <div className="apex-shell relative min-h-screen bg-background text-foreground">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        />

        <header className="apex-shell-header relative z-10 w-full shrink-0 bg-white dark:bg-black">
          <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-5 pt-5 pb-3 md:gap-6 md:px-8 md:pt-8 md:pb-4">
          <NavLink
            to="/"
            className="text-[28px] font-extrabold tracking-[-1.2px] leading-none md:text-[40px] md:tracking-[-1.4px]"
            aria-label={BRAND}
          >
            {BRAND}
          </NavLink>

          <nav className="apex-nav-desktop font-mono text-[12px] font-bold tracking-[1px]" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `font-bold uppercase ${
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
              className="apex-header-create min-h-11 gap-1.5 rounded-[10px] bg-primary px-4 py-2 font-mono text-[12px] tracking-[1px] text-primary-foreground uppercase"
            >
              <Icon icon="mdi:plus-box-outline" className="size-3.5" />
              Create workspace
            </button>
          </div>
          </div>
        </header>

        <div className="apex-shell-body">
          {children ?? <Outlet />}
        </div>

        <nav
          className="apex-nav-mobile font-mono text-[11px] font-bold tracking-[1px]"
          aria-label="Primary mobile"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex min-h-11 flex-1 items-center justify-center px-1 text-center font-mono text-[11px] font-bold tracking-[1px] uppercase ${
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
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
