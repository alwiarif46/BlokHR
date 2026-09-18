'use client'

import { HeroMosaic } from '@/app/apex/hero-mosaic'
import { HERO } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { useApex } from '@/app/apex/shell'
import { useIsDesktop } from '@/app/apex/use-viewport'

export type PageHeroProps = {
  eyebrow: string
  title: string
  lede: string
  meta?: string
  /** One-line audience cue under the CTA row. */
  audience?: string
  bullets?: readonly string[]
  aside?: string
  /** When true, hero sits in a narrow column beside a board. */
  compactColumn?: boolean
}

/**
 * Secondary-page hero: mosaic, copy, shared CTAs.
 * Same white / jet-black panel language as the home headline column.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  meta,
  audience,
  bullets,
  aside,
  compactColumn = false,
}: PageHeroProps) {
  const isDesktop = useIsDesktop()
  const { openSignup } = useApex()

  return (
    <section
      className={`flex h-full flex-col justify-start bg-white p-5 dark:bg-black md:p-6 ${
        compactColumn ? 'mb-6 md:mb-0' : 'mb-10 md:mb-12'
      }`}
      style={{ borderRadius: MOSAIC.radiusPx }}
      aria-labelledby="page-headline"
    >
      <HeroMosaic compact={!isDesktop || compactColumn} />
      <p className="mb-2 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase md:text-[12px]">
        {eyebrow}
      </p>
      <h1
        id="page-headline"
        className="mb-3 text-[32px] font-extrabold leading-[1.05] tracking-[-1.4px] md:text-[40px] md:tracking-[-1.6px]"
      >
        {title}
      </h1>
      <p className="mb-5 max-w-[34em] text-[15px] leading-[1.65] text-muted-foreground">{lede}</p>

      {bullets && bullets.length > 0 ? (
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
      ) : null}

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
        {meta ? (
          <div className="w-full text-center font-mono text-[11px] text-muted-foreground md:text-left">
            {meta}
          </div>
        ) : null}
      </div>

      {audience ? (
        <p className="mt-4 font-mono text-[11px] text-muted-foreground">{audience}</p>
      ) : null}

      {aside ? (
        <p className="mt-8 max-w-[34em] border-t border-border pt-6 text-[14px] leading-[1.65] text-muted-foreground">
          {aside}
        </p>
      ) : null}
    </section>
  )
}
