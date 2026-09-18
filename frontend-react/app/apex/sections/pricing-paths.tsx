'use client'

import { PRICING_PATHS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { useApex } from '@/app/apex/shell'

/** Trial vs licence paths. No dollar amounts. */
export function PricingPaths() {
  const { openSignup } = useApex()

  return (
    <section aria-labelledby="pricing-paths-title" className="mt-10 md:mt-12">
      <h2
        id="pricing-paths-title"
        className="mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        Two ways in
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {PRICING_PATHS.map((path) => {
          const dark = path.shell === 'dark'
          const bg = dark ? MOSAIC.darkFace : MOSAIC.blueSoft
          return (
            <li
              key={path.id}
              className={`flex flex-col gap-4 border border-[#121314]/12 p-6 ${
                dark ? 'text-white' : 'text-[#121314]'
              }`}
              style={{ background: bg, borderRadius: MOSAIC.radiusPx }}
            >
              <h3 className="text-[20px] font-bold tracking-tight">{path.title}</h3>
              <p
                className={`flex-1 text-[14px] leading-[1.65] ${
                  dark ? 'text-white/80' : 'text-[#121314]/85'
                }`}
              >
                {path.body}
              </p>
              <button
                type="button"
                onClick={() => openSignup(path.mode)}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-[15px] font-bold md:w-auto ${
                  dark
                    ? 'bg-white text-[#121314]'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {path.cta}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
