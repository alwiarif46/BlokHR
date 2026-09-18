'use client'

import { DemoBoard, DESKTOP_BOARD_COLUMNS, HOME_WIDGETS, LOCK_DESKTOP_BOARD_COLUMNS } from '@/app/apex/demo-widgets'
import { HeroMosaic } from '@/app/apex/hero-mosaic'
import { HERO, HOME_STRIP_LABEL, MODULE_COUNT, PROOF_BAND } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { useApex } from '@/app/apex/shell'
import { useIsDesktop } from '@/app/apex/use-viewport'

function ProofBand() {
  return (
    <section
      aria-label="Customer proof"
      className="mt-16 border-t border-border pt-10 md:mt-20"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {PROOF_BAND.map((slot) => (
          <li
            key={slot}
            className="rounded-[14px] border border-[#121314]/12 px-4 py-5 font-mono text-[13px] leading-relaxed text-muted-foreground"
          >
            {slot}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomePage() {
  const isDesktop = useIsDesktop()
  const { openSignup } = useApex()

  if (isDesktop) {
    return (
      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-8 pb-20">
        <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] items-start gap-10 pt-2">
          <section className="flex flex-col justify-start pt-0" aria-labelledby="landingHeadlineDesktop">
            <HeroMosaic />
            <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
              {HERO.eyebrow}
            </p>
            <h1
              id="landingHeadlineDesktop"
              className="mb-3 text-[44px] font-extrabold leading-[1.02] tracking-[-1.8px] xl:text-[52px]"
            >
              {HERO.headline}
            </h1>
            <p className="mb-6 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground">
              {HERO.lede}
            </p>
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
              <div className="w-full font-mono text-[11px] text-muted-foreground">{HERO.meta}</div>
            </div>
            <p className="mt-5 font-mono text-[11px] text-muted-foreground">
              Admin › Features · {MODULE_COUNT} modules in the rack
            </p>
          </section>

          <DemoBoard
            items={HOME_WIDGETS}
            stripLabel={HOME_STRIP_LABEL}
            maxColumns={DESKTOP_BOARD_COLUMNS}
            fixedColumns={LOCK_DESKTOP_BOARD_COLUMNS ? DESKTOP_BOARD_COLUMNS : undefined}
            cellSize={180}
            gap={12}
            radius={MOSAIC.radiusPx}
          />
        </div>
        <ProofBand />
      </main>
    )
  }

  return (
    <main className="relative z-10 px-5 pb-16">
      <section className="mb-6" aria-labelledby="landingHeadlineMobile">
        <HeroMosaic compact />
        <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {HERO.eyebrow}
        </p>
        <h1
          id="landingHeadlineMobile"
          className="mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px]"
        >
          {HERO.headline}
        </h1>
        <p className="mb-5 text-[15px] leading-[1.65] text-muted-foreground">{HERO.lede}</p>
        <div className="flex max-w-[360px] flex-col gap-3">
          <button
            type="button"
            onClick={() => openSignup('create')}
            className="min-h-11 w-full rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground"
          >
            {HERO.primaryCta}
          </button>
          <button
            type="button"
            onClick={() => openSignup('login')}
            className="min-h-11 w-full rounded-xl border border-border px-5 py-4 text-[15px] font-semibold"
          >
            {HERO.secondaryCta}
          </button>
          <div className="text-center font-mono text-[11px] text-muted-foreground">{HERO.meta}</div>
        </div>
        <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
          Admin › Features · {MODULE_COUNT} modules
        </p>
      </section>

      <DemoBoard
        items={HOME_WIDGETS}
        stripLabel={HOME_STRIP_LABEL}
        maxColumns={2}
        cellSize={150}
        gap={10}
        radius={MOSAIC.radiusPx}
      />
      <ProofBand />
    </main>
  )
}
