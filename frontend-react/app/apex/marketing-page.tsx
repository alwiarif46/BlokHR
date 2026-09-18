'use client'

import {
  DemoBoard,
  DESKTOP_BOARD_COLUMNS,
  LOCK_DESKTOP_BOARD_COLUMNS,
  type Widget,
} from '@/app/apex/demo-widgets'
import { HERO } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { useApex } from '@/app/apex/shell'
import { useIsDesktop } from '@/app/apex/use-viewport'

interface MarketingPageProps {
  eyebrow: string
  title: string
  lede: string
  bullets: readonly string[]
  stripLabel: string
  meta?: string
  /** Extra copy under the CTA row to fill left-column dead space. */
  aside?: string
  widgets: Widget[]
  boardTitle?: string
}

/** Shared copy + mosaic-themed board; matches home desktop geometry. */
export function MarketingPage({
  eyebrow,
  title,
  lede,
  bullets,
  stripLabel,
  meta,
  aside,
  widgets,
  boardTitle,
}: MarketingPageProps) {
  const isDesktop = useIsDesktop()
  const { openSignup } = useApex()

  const copyColumn = (
    <section className="flex flex-col justify-start" aria-labelledby="page-headline">
      <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h1
        id="page-headline"
        className="mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[40px] md:tracking-[-1.6px]"
      >
        {title}
      </h1>
      <p className="mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground">{lede}</p>
      <ul className="mb-6 flex flex-col gap-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 text-[14px] leading-snug text-foreground">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full"
              style={{ background: MOSAIC.mint }}
              aria-hidden
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => openSignup('create')}
          className="min-h-11 min-w-[200px] rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground"
        >
          {HERO.primaryCta}
        </button>
        <button
          type="button"
          onClick={() => openSignup('login')}
          className="min-h-11 min-w-[180px] rounded-xl border border-border px-5 py-4 text-[15px] font-semibold"
        >
          {HERO.secondaryCta}
        </button>
        {meta ? (
          <div className="w-full font-mono text-[11px] text-muted-foreground">{meta}</div>
        ) : null}
      </div>
      {aside ? (
        <p className="mt-8 max-w-[34em] border-t border-border pt-6 text-[14px] leading-[1.65] text-muted-foreground">
          {aside}
        </p>
      ) : null}
    </section>
  )

  const board = (
    <DemoBoard
      items={widgets}
      title={boardTitle ?? title}
      stripLabel={stripLabel}
      maxColumns={isDesktop ? DESKTOP_BOARD_COLUMNS : 2}
      fixedColumns={isDesktop && LOCK_DESKTOP_BOARD_COLUMNS ? DESKTOP_BOARD_COLUMNS : undefined}
      cellSize={isDesktop ? 180 : 150}
      gap={isDesktop ? 12 : 10}
      radius={MOSAIC.radiusPx}
    />
  )

  const footer = (
    <div className="mt-14 flex flex-col items-start gap-3 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-mono text-[12px] text-muted-foreground">
        Ready when you are. Create a workspace or sign in.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openSignup('create')}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-[14px] font-bold text-primary-foreground"
        >
          {HERO.primaryCta}
        </button>
        <button
          type="button"
          onClick={() => openSignup('login')}
          className="inline-flex min-h-11 items-center rounded-xl border border-border px-5 text-[14px] font-semibold"
        >
          {HERO.secondaryCta}
        </button>
      </div>
    </div>
  )

  if (isDesktop) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-8 pb-20">
        <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-10 pt-2">
          {copyColumn}
          {board}
        </div>
        {footer}
      </main>
    )
  }

  return (
    <main className="relative z-10 px-5 pb-16">
      <div className="flex flex-col gap-8 pt-1">
        {copyColumn}
        {board}
      </div>
      {footer}
    </main>
  )
}
