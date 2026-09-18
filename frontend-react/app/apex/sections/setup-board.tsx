'use client'

import { Icon } from '@iconify/react'
import { BRAND, HERO, SETUP_STEPS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { useApex } from '@/app/apex/shell'

const STEP_VISUAL = [
  {
    shell: '#E8F8EE',
    border: '#C5EBD4',
    badge: MOSAIC.mint,
    bar: MOSAIC.mint,
    icon: 'mdi:shape-outline',
    heading: 'Choose your space',
  },
  {
    shell: '#FBF3DC',
    border: '#F0E0A8',
    badge: MOSAIC.gold,
    bar: MOSAIC.gold,
    icon: 'mdi:palette-outline',
    heading: 'Brand the login',
  },
  {
    shell: '#EAF0FC',
    border: '#C9D7F5',
    badge: MOSAIC.blueSoft,
    bar: MOSAIC.blue,
    icon: 'mdi:shield-key-outline',
    heading: 'Connect sign-in',
  },
  {
    shell: '#F8EDEA',
    border: '#E8CFC8',
    badge: MOSAIC.coral,
    bar: MOSAIC.coral,
    icon: 'mdi:ticket-confirmation-outline',
    heading: 'Start your trial',
  },
] as const

const AFTER_SETUP = [
  {
    label: 'Locked',
    detail: 'Workspace type stays permanent',
    shell: MOSAIC.charcoal,
    tone: 'dark' as const,
    icon: 'mdi:lock-outline',
  },
  {
    label: 'Editable',
    detail: 'Branding and auth stay flexible',
    shell: MOSAIC.mint,
    tone: 'light' as const,
    icon: 'mdi:pencil-outline',
  },
  {
    label: 'Scoped',
    detail: 'Plan limits stay on this tenant',
    shell: MOSAIC.blueSoft,
    tone: 'light' as const,
    icon: 'mdi:office-building-outline',
  },
] as const

/**
 * 2x2 setup board for the Setup page right column.
 * Stretches with the hero column; lower band fills leftover height.
 */
export function SetupBoard() {
  const { openSignup } = useApex()

  return (
    <aside
      aria-label="Setup steps"
      className="flex h-full min-h-0 flex-col rounded-[14px] border border-border bg-card p-4 md:p-5"
    >
      <p className="font-mono text-[12px] font-bold tracking-[0.12em] text-foreground uppercase">
        {BRAND} / Get started
      </p>
      <p className="mt-1 mb-4 text-[13px] leading-snug text-muted-foreground">
        Four clear steps, then your workspace is ready.
      </p>

      <ul className="grid grid-cols-2 gap-3">
        {SETUP_STEPS.map((step, i) => {
          const visual = STEP_VISUAL[i]!
          return (
            <li
              key={step.n}
              className="flex min-h-[140px] flex-col border p-3.5 text-[#121314] md:min-h-[160px] md:p-4"
              style={{
                background: visual.shell,
                borderColor: visual.border,
                borderRadius: MOSAIC.radiusPx,
              }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                  style={{ background: visual.badge }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span
                  className="inline-flex size-9 items-center justify-center rounded-lg border border-[#121314]/12 bg-white/70"
                  aria-hidden
                >
                  <Icon icon={visual.icon} className="size-4 text-[#14213d]" />
                </span>
              </div>
              <h3 className="text-[15px] font-bold leading-snug tracking-tight">{visual.heading}</h3>
              <p className="mt-1 flex-1 text-[12px] leading-snug text-[#121314]/75">{step.body}</p>
              <div className="mt-3 flex gap-1.5" aria-hidden>
                <span className="h-1 flex-1 rounded-full" style={{ background: visual.bar }} />
                <span className="h-1 flex-1 rounded-full bg-[#121314]/12" />
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 border-t border-border pt-4">
        <p className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
          After step four
        </p>
        <ul className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
          {AFTER_SETUP.map((item) => (
            <li
              key={item.label}
              className={`flex flex-col items-center justify-between gap-3 p-4 text-center ${
                item.tone === 'dark' ? 'text-white' : 'text-[#121314]'
              }`}
              style={{ background: item.shell, borderRadius: MOSAIC.radiusPx }}
            >
              <span className="font-mono text-[11px] tracking-[0.1em] uppercase opacity-80">
                {item.label}
              </span>
              <Icon
                icon={item.icon}
                className="size-14 shrink-0 opacity-90 md:size-16"
                aria-hidden
              />
              <span className="text-[13px] font-semibold leading-snug">{item.detail}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => openSignup('create')}
          className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground"
        >
          {HERO.primaryCta}
        </button>
      </div>
    </aside>
  )
}
