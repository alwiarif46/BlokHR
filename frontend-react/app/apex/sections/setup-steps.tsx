'use client'

import { PAGE_COPY, SETUP_STEPS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const STEP_SHELLS = [MOSAIC.gold, MOSAIC.blueSoft, MOSAIC.coral, MOSAIC.charcoal] as const

/** Setup steps: heading column beside a 2x2 tile grid. */
export function SetupSteps() {
  const copy = PAGE_COPY.setup

  return (
    <section
      aria-labelledby="setup-steps-title"
      className="mt-16 grid gap-8 md:mt-20 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] md:items-start md:gap-10"
    >
      <div>
        <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
          {copy.eyebrow}
        </p>
        <h2
          id="setup-steps-title"
          className="mb-3 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
        >
          {copy.title}
        </h2>
        <p className="max-w-[28em] text-[14px] leading-[1.65] text-muted-foreground">{copy.lede}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3">
        {SETUP_STEPS.map((step, i) => {
          const shell = STEP_SHELLS[i] ?? MOSAIC.gold
          const dark = shell === MOSAIC.charcoal
          return (
            <li
              key={step.n}
              className={`flex min-h-[120px] flex-col gap-2 p-4 ${dark ? 'text-white' : 'text-[#121314]'}`}
              style={{ background: shell, borderRadius: MOSAIC.radiusPx }}
            >
              <span
                className={`font-mono text-[11px] tracking-[0.12em] uppercase ${dark ? 'text-white/70' : 'text-[#121314]/70'}`}
              >
                {step.n}
              </span>
              <h3 className="text-[16px] font-bold">{step.title}</h3>
              <p className={`text-[13px] leading-snug ${dark ? 'text-white/85' : 'text-[#121314]/85'}`}>
                {step.body}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
