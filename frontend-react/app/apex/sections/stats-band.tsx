'use client'

import { STATS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const STAT_SHELLS = [MOSAIC.mint, MOSAIC.gold, MOSAIC.blueSoft, MOSAIC.coral] as const

/** Four mosaic colour blocks for landing stats. */
export function StatsBand() {
  return (
    <section aria-label="Product stats" className="mt-16 md:mt-20">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {STATS.map((stat, i) => (
          <li
            key={stat.label}
            className="flex min-h-11 flex-col justify-between p-4 text-[#121314]"
            style={{
              background: STAT_SHELLS[i] ?? MOSAIC.mint,
              borderRadius: MOSAIC.radiusPx,
            }}
          >
            <span className="font-mono text-[28px] font-extrabold leading-none tracking-tight md:text-[32px]">
              {stat.value}
            </span>
            <span className="mt-3 text-[13px] leading-snug font-medium">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
