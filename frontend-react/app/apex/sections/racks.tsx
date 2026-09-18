'use client'

import { RACKS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

/** Workforce and Campus rack cards from marketing copy. */
export function Racks() {
  const cards = [
    { key: 'workforce', ...RACKS.workforce, shell: MOSAIC.blueSoft },
    { key: 'campus', ...RACKS.campus, shell: MOSAIC.gold },
  ] as const

  return (
    <section aria-labelledby="racks-title" className="mt-16 md:mt-20">
      <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
        {RACKS.subtitle}
      </p>
      <h2
        id="racks-title"
        className="mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        {RACKS.title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <li
            key={card.key}
            className="flex flex-col gap-3 border border-[#121314]/12 p-5 text-[#121314] md:p-6"
            style={{ background: card.shell, borderRadius: MOSAIC.radiusPx }}
          >
            <h3 className="text-[18px] font-bold tracking-tight">{card.name}</h3>
            <p className="text-[14px] leading-[1.65] text-[#121314]/85">{card.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
