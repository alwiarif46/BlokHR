'use client'

import { PAGE_COPY } from '@/app/apex/marketing-copy'
import { PageFrame } from '@/app/apex/page-frame'
import { PageHero } from '@/app/apex/page-hero'
import { PageFaqSection } from '@/app/apex/sections/page-faq'
import { ProofBand } from '@/app/apex/sections/proof-band'
import { SetupBoard } from '@/app/apex/sections/setup-board'

export function SetupPage() {
  const copy = PAGE_COPY.setup

  return (
    <PageFrame>
      <div className="md:grid md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-stretch md:gap-10 md:pt-2">
        <PageHero
          eyebrow={copy.eyebrow}
          title={copy.title}
          lede={copy.lede}
          bullets={copy.bullets}
          meta={copy.meta}
          audience={copy.audience}
          aside={copy.aside}
          compactColumn
        />
        <SetupBoard />
      </div>
      <PageFaqSection faqs={copy.faqs} />
      <ProofBand />
    </PageFrame>
  )
}
