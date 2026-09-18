'use client'

import { WORKFORCE_SPLIT } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

/** Core-on vs add-on-off split for the workforce page. */
export function WorkforceSplit() {
  return (
    <section aria-labelledby="workforce-split-title" className="mt-16 md:mt-20">
      <h2
        id="workforce-split-title"
        className="mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        {WORKFORCE_SPLIT.title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        <li
          className="flex flex-col gap-3 border border-[#121314]/12 p-5 text-[#121314] md:p-6"
          style={{ background: MOSAIC.blueSoft, borderRadius: MOSAIC.radiusPx }}
        >
          <h3 className="text-[18px] font-bold">{WORKFORCE_SPLIT.core.title}</h3>
          <ul className="flex flex-wrap gap-2">
            {WORKFORCE_SPLIT.core.items.map((item) => (
              <li key={item}>
                <span className="inline-flex min-h-11 items-center rounded-full bg-white/70 px-4 font-mono text-[12px] tracking-wide">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </li>
        <li
          className="flex flex-col gap-3 border border-white/10 p-5 text-white md:p-6"
          style={{ background: MOSAIC.charcoal, borderRadius: MOSAIC.radiusPx }}
        >
          <h3 className="text-[18px] font-bold">{WORKFORCE_SPLIT.addOns.title}</h3>
          <ul className="flex flex-wrap gap-2">
            {WORKFORCE_SPLIT.addOns.items.map((item) => (
              <li key={item}>
                <span className="inline-flex min-h-11 items-center rounded-full border border-white/25 bg-white/10 px-4 font-mono text-[12px] tracking-wide">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </li>
      </ul>
    </section>
  )
}
