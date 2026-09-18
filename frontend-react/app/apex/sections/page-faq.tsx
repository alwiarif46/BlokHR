'use client'

import type { PageFaq } from '@/app/apex/marketing-copy'

/** Short FAQ list for secondary marketing pages. */
export function PageFaqSection({
  title = 'Questions',
  faqs,
}: {
  title?: string
  faqs: readonly PageFaq[]
}) {
  if (!faqs.length) return null

  return (
    <section aria-labelledby="page-faq-title" className="mt-16 md:mt-20">
      <h2
        id="page-faq-title"
        className="mb-6 text-[28px] font-extrabold tracking-[-1px] md:text-[32px]"
      >
        {title}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        {faqs.map((item) => (
          <li
            key={item.q}
            className="rounded-[14px] border border-border bg-card px-4 py-5"
          >
            <h3 className="mb-2 text-[15px] font-bold text-foreground">{item.q}</h3>
            <p className="text-[14px] leading-[1.65] text-muted-foreground">{item.a}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
