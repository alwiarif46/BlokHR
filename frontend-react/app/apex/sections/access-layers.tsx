'use client'

import { ACCESS, PAGE_COPY } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const LAYER_SHELLS = [
  MOSAIC.gold,
  MOSAIC.blueSoft,
  MOSAIC.coral,
  MOSAIC.charcoal,
  MOSAIC.midGray,
  MOSAIC.darkFace,
] as const

/** Access layers on a dark band, plus role chips (guardian highlighted). */
export function AccessLayers() {
  const copy = PAGE_COPY.access

  return (
    <section
      aria-labelledby="access-layers-title"
      className="mt-16 -mx-5 px-5 py-12 md:mt-20 md:-mx-8 md:rounded-[14px] md:px-8 md:py-14"
      style={{ background: MOSAIC.darkFace }}
    >
      <p className="mb-2 font-mono text-[12px] tracking-[0.14em] text-white/55 uppercase">
        {copy.eyebrow}
      </p>
      <h2
        id="access-layers-title"
        className="mb-3 text-[28px] font-extrabold tracking-[-1px] text-white md:text-[32px]"
      >
        {ACCESS.title}
      </h2>
      <p className="mb-2 max-w-[40em] text-[15px] font-semibold text-white">{ACCESS.lead}</p>
      <p className="mb-8 max-w-[46em] text-[14px] leading-[1.65] text-white/75">{ACCESS.body}</p>

      <ul className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {ACCESS.layers.map((layer, i) => {
          const shell = LAYER_SHELLS[i] ?? MOSAIC.midGray
          const dark =
            shell === MOSAIC.charcoal || shell === MOSAIC.midGray || shell === MOSAIC.darkFace
          return (
            <li
              key={layer.n}
              className={`flex min-h-[110px] flex-col gap-2 border border-white/10 p-4 ${dark ? 'text-white' : 'text-[#121314]'}`}
              style={{ background: shell, borderRadius: MOSAIC.radiusPx }}
            >
              <span
                className={`font-mono text-[11px] tracking-[0.12em] uppercase ${dark ? 'text-white/65' : 'text-[#121314]/70'}`}
              >
                {layer.n}
              </span>
              <h3 className="text-[15px] font-bold">{layer.title}</h3>
              <p className={`text-[13px] leading-snug ${dark ? 'text-white/80' : 'text-[#121314]/85'}`}>
                {layer.body}
              </p>
            </li>
          )
        })}
      </ul>

      <ul className="flex flex-wrap gap-2" aria-label="Named roles">
        {ACCESS.roles.map((role) => {
          const guardian = role === 'guardian'
          return (
            <li key={role}>
              <span
                className={`inline-flex min-h-11 items-center rounded-full px-4 font-mono text-[12px] tracking-wide ${
                  guardian ? 'font-bold text-[#121314]' : 'border border-white/25 bg-white/10 text-white'
                }`}
                style={guardian ? { background: MOSAIC.mint } : undefined}
              >
                {role}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
