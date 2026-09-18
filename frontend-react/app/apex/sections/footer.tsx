'use client'

import { BRAND } from '@/app/apex/marketing-copy'

const FOOTER_LINKS = [
  { label: 'Modules', href: '#/modules' },
  { label: 'Security', href: '#/access' },
  { label: 'Status', href: '#status' },
  { label: 'Terms', href: '#terms' },
  { label: 'Privacy', href: '#privacy' },
  { label: 'Contact', href: '#contact' },
] as const

/** Landing footer with placeholder company name. */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-16 border-t border-border pt-10 pb-6 md:mt-20">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <a
          href="#/"
          className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-[-0.8px] text-foreground"
          aria-label={BRAND}
        >
          {BRAND}
        </a>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="inline-flex min-h-11 items-center font-mono text-[12px] tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
      <p className="mt-8 font-mono text-[11px] text-muted-foreground">
        © {year} [YOUR COMPANY]
      </p>
    </footer>
  )
}
