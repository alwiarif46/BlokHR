'use client'

import { BRAND } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  /** When true, mark is decorative inside a parent with aria-label. */
  decorative?: boolean
}

/** Extrabold 13lok lockup with the blue square over the k. */
export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <span
      className={cn('relative inline-block leading-none', className)}
      {...(decorative ? { 'aria-hidden': true as const } : { 'aria-label': BRAND })}
    >
      {BRAND}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 size-[0.22em] translate-x-[18%] -translate-y-[8%] rounded-[1.5px]"
        style={{ background: MOSAIC.blue }}
      />
    </span>
  )
}
