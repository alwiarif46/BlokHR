'use client'

import { RACKS } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

/** Campus-only story strip (not the home two-rack section). */
export function CampusStory() {
  const campus = RACKS.campus

  return (
    <section
      aria-labelledby="campus-story-title"
      className="mt-16 md:mt-20"
    >
      <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
        {RACKS.subtitle}
      </p>
      <h2
        id="campus-story-title"
        className="mb-4 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        {campus.name}
      </h2>
      <div
        className="border border-[#121314]/12 p-5 text-[#121314] md:p-6"
        style={{ background: MOSAIC.gold, borderRadius: MOSAIC.radiusPx }}
      >
        <p className="max-w-[46em] text-[14px] leading-[1.65] text-[#121314]/85">
          {campus.body}
        </p>
      </div>
    </section>
  )
}
