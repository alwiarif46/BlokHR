'use client'

import { useEffect, useState } from 'react'
import { DrawnSwitch } from '@/app/apex/drawn-switch'
import { MODULE_COUNT } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const TARGET = 13

const dim = 'opacity-45'

/** Decorative mosaic flush with the headline column. 4-col grid, no mid-grid gaps. */
export function HeroMosaic({ compact = false }: { compact?: boolean }) {
  const rows = compact
    ? 'grid-rows-[36px_36px_36px]'
    : 'grid-rows-[clamp(36px,5vw,48px)_clamp(36px,5vw,48px)_clamp(36px,5vw,48px)]'
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(TARGET)
      return
    }
    const start = performance.now()
    const duration = 700
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      setCount(Math.round(TARGET * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className={`mb-4 grid w-full grid-cols-4 gap-1.5 ${rows}`} aria-hidden="true">
      <span className={`col-span-2 rounded-[10px] ${dim}`} style={{ background: MOSAIC.mint }} />
      {/* Top-row grey spans columns 3-4 so the row is flush */}
      <span
        className={`col-span-2 rounded-[10px] ${dim}`}
        style={{ background: MOSAIC.charcoal }}
      />
      <span className={`rounded-[10px] ${dim}`} style={{ background: MOSAIC.coral }} />
      <span
        className="col-span-2 row-span-2 flex items-center justify-between gap-2 rounded-[10px] border border-white/20 p-2.5 text-white"
        style={{ background: MOSAIC.darkFace }}
      >
        <span className="flex min-w-0 flex-col justify-center gap-0.5">
          <span
            className="font-mono text-[9px] tracking-[1.2px] uppercase"
            style={{ color: MOSAIC.mint }}
          >
            On today
          </span>
          <span className="font-mono text-[34px] font-extrabold leading-none tracking-tight md:text-[40px]">
            {count}
          </span>
          <span className="text-[10px] text-white/55">of {MODULE_COUNT} modules</span>
        </span>
        <DrawnSwitch on size={compact ? 36 : 44} />
      </span>
      <span className={`rounded-[10px] ${dim}`} style={{ background: MOSAIC.blue }} />
      <span className={`rounded-[10px] ${dim}`} style={{ background: MOSAIC.gold }} />
      {/* Fills the cell under blue so nothing ends mid-grid */}
      <span className={`rounded-[10px] ${dim}`} style={{ background: MOSAIC.midGray }} />
    </div>
  )
}
