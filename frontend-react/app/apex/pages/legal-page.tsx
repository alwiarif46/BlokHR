'use client'

import { COMPANY, type LegalDoc } from '@/app/apex/legal-copy'
import { PageFrame } from '@/app/apex/page-frame'

/** Long-form legal document layout for Privacy, Terms, Cookies, Contact. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  return (
    <PageFrame>
      <article className="mx-auto max-w-[720px] pt-10 md:pt-14">
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
          {doc.eyebrow}
        </p>
        <h1 className="mt-3 text-[32px] font-extrabold tracking-[-1px] text-foreground md:text-[40px] md:tracking-[-1.2px]">
          {doc.title}
        </h1>
        <p className="mt-3 font-mono text-[12px] text-muted-foreground">
          Last updated {COMPANY.lastUpdated} · {COMPANY.legalName}
        </p>
        <p className="mt-8 text-[16px] leading-relaxed text-foreground/90">{doc.intro}</p>

        <div className="mt-10 space-y-10">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-[18px] font-bold tracking-[-0.3px] text-foreground md:text-[20px]">
                {section.heading}
              </h2>
              <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-muted-foreground">
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {section.bullets && section.bullets.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5">
                    {section.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 border-t border-border pt-6 font-mono text-[11px] leading-relaxed text-muted-foreground">
          These pages are provided for transparency for a commercial multi-tenant SaaS
          operated by {COMPANY.legalName}. Have your counsel review them before relying on
          them as final legal advice.
        </p>
      </article>
    </PageFrame>
  )
}
