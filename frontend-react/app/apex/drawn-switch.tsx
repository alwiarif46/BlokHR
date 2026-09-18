'use client'

import { MOSAIC } from '@/app/apex/mosaic-theme'

/** Flat drawn toggle in page palette (green = on). No emoji / photo assets. */
export function DrawnSwitch({
  on,
  className = '',
  size = 48,
}: {
  on: boolean
  className?: string
  size?: number
}) {
  const h = Math.round(size * 0.58)
  const r = h / 2
  const knob = h - 6
  const cx = on ? size - r : r
  return (
    <svg
      width={size}
      height={h}
      viewBox={`0 0 ${size} ${h}`}
      className={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={size}
        height={h}
        rx={r}
        fill={on ? MOSAIC.mint : MOSAIC.charcoal}
      />
      <circle
        cx={cx}
        cy={r}
        r={knob / 2}
        fill={on ? '#121314' : '#F4F4F5'}
      />
    </svg>
  )
}
