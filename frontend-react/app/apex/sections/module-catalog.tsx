'use client'

import { FEATURE_MODULES } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const RACK_SHELL: Record<(typeof FEATURE_MODULES)[number]['rack'], string> = {
  core: MOSAIC.blueSoft,
  campus: MOSAIC.gold,
  'add-on': MOSAIC.coral,
}

/** Compact catalog of featured modules from marketing copy. */
export function ModuleCatalog() {
  return (
    <section aria-labelledby="module-catalog-title" className="mt-16 md:mt-20">
      <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-muted-foreground uppercase">
        Sample of the rack
      </p>
      <h2
        id="module-catalog-title"
        className="mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        Core, campus, and add-ons
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FEATURE_MODULES.map((mod) => (
          <li
            key={`${mod.rack}-${mod.label}`}
            className="flex min-h-11 flex-col justify-between p-4 text-[#121314]"
            style={{
              background: RACK_SHELL[mod.rack],
              borderRadius: MOSAIC.radiusPx,
            }}
          >
            <span className="font-mono text-[11px] tracking-[0.12em] text-[#121314]/70 uppercase">
              {mod.rack}
            </span>
            <span className="mt-3 text-[15px] font-bold">{mod.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
