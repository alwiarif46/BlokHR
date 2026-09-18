'use client'

import { DemoBoard, DESKTOP_BOARD_COLUMNS, HOME_WIDGETS, LOCK_DESKTOP_BOARD_COLUMNS } from '@/app/apex/demo-widgets'
import { HeroMosaic } from '@/app/apex/hero-mosaic'
import { HERO, HOME_STRIP_LABEL, MODULE_COUNT, PROOF_BAND } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { AccessLayers } from '@/app/apex/sections/access-layers'
import { Footer } from '@/app/apex/sections/footer'
import { ModuleCarousel } from '@/app/apex/sections/module-carousel'
import { Racks } from '@/app/apex/sections/racks'
import { SetupSteps } from '@/app/apex/sections/setup-steps'
import { StatsBand } from '@/app/apex/sections/stats-band'
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

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-8 md:pb-20">
      <div className="md:grid md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-start md:gap-10 md:pt-2">
        <section
          className="mb-6 flex flex-col justify-start pt-0 md:mb-0"
          aria-labelledby="landingHeadline"
        >
          <HeroMosaic compact={!isDesktop} />
          <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase md:text-[12px]">
            {HERO.eyebrow}
          </p>
          <h1
            id="landingHeadline"
            className="mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[44px] md:leading-[1.02] md:tracking-[-1.8px] xl:text-[52px]"
          >
            {HERO.headline}
          </h1>
          <p className="mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground md:mb-6">
            {HERO.lede}
          </p>
          <div className="flex max-w-[360px] flex-col gap-3 md:max-w-none md:flex-row md:flex-wrap md:items-center">
            <button
              type="button"
              onClick={() => openSignup('create')}
              className="min-h-11 w-full rounded-xl bg-primary px-5 py-4 text-[15px] font-bold text-primary-foreground md:min-w-[200px] md:w-auto"
            >
              {HERO.primaryCta}
            </button>
            <button
              type="button"
              onClick={() => openSignup('login')}
              className="min-h-11 w-full rounded-xl border border-border px-5 py-4 text-[15px] font-semibold md:min-w-[180px] md:w-auto"
            >
              {HERO.secondaryCta}
            </button>
            <div className="w-full text-center font-mono text-[11px] text-muted-foreground md:text-left">
              {HERO.meta}
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground md:mt-5 md:text-left">
            Admin › Features · {MODULE_COUNT} modules
            <span className="hidden md:inline"> in the rack</span>
          </p>
        </section>

        <DemoBoard
          items={HOME_WIDGETS}
          stripLabel={HOME_STRIP_LABEL}
          maxColumns={isDesktop ? DESKTOP_BOARD_COLUMNS : 2}
          fixedColumns={
            isDesktop && LOCK_DESKTOP_BOARD_COLUMNS ? DESKTOP_BOARD_COLUMNS : undefined
          }
          cellSize={isDesktop ? 180 : 150}
          gap={isDesktop ? 12 : 10}
          radius={MOSAIC.radiusPx}
        />
      </div>

      <StatsBand />
      <ModuleCarousel />
      <Racks />
      <SetupSteps />
      <AccessLayers />
      <ProofBand />
      <Footer />
    </main>
  )
}
