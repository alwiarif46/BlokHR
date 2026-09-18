'use client'

import { PRICING_WIDGETS } from '@/app/apex/demo-widgets'
import { PAGE_COPY } from '@/app/apex/marketing-copy'
import { MarketingPage } from '@/app/apex/marketing-page'

export function PricingPage() {
  const copy = PAGE_COPY.pricing
  return (
    <MarketingPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      bullets={copy.bullets}
      stripLabel={copy.stripLabel}
      meta={copy.meta}
      aside={copy.aside}
      widgets={PRICING_WIDGETS}
      boardTitle="Pricing board"
    />
  )
}
