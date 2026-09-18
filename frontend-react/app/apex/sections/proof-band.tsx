'use client'

import { PROOF_BAND } from '@/app/apex/marketing-copy'

/** Modest product proof shared by home and secondary pages. */
export function ProofBand() {
  return (
    <section
      aria-label="Product proof"
      className="mt-16 border-t border-border pt-10 md:mt-20"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {PROOF_BAND.map((slot) => (
          <li
            key={slot}
            className="rounded-[14px] border border-[#121314]/12 px-4 py-5 font-mono text-[13px] leading-relaxed text-muted-foreground"
          >
            {slot}
          </li>
        ))}
      </ul>
    </section>
  )
}
