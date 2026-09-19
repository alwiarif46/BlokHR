'use client'

import { NavLink } from 'react-router-dom'
import { BrandMark } from '@/app/apex/brand-mark'
import { BRAND } from '@/app/apex/marketing-copy'
import { COMPANY, LEGAL_NAV } from '@/app/apex/legal-copy'

const PRODUCT_LINKS = [
  { label: 'Modules', path: '/modules' },
  { label: 'Security', path: '/access' },
] as const

/** Landing footer with legal entity and policy links. */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-border pt-10 pb-6 md:mt-20">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <NavLink
          to="/"
          className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-[-0.8px] text-foreground"
          aria-label={BRAND}
        >
          <BrandMark decorative />
        </NavLink>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          {PRODUCT_LINKS.map((link) => (
            <NavLink
              key={link.label}
              to={link.path}
              className="inline-flex min-h-11 items-center font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"
            >
              {link.label}
            </NavLink>
          ))}
          {LEGAL_NAV.map((link) => (
            <NavLink
              key={link.label}
              to={link.path}
              className="inline-flex min-h-11 items-center font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <p className="mt-8 font-mono text-[11px] leading-relaxed text-muted-foreground">
        © {year} {COMPANY.legalName}
        <br />
        {COMPANY.addressLines.join(', ')}
      </p>
    </footer>
  )
}
