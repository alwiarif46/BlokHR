'use client'

import { PAGE_COPY } from '@/app/apex/marketing-copy'
import { PageFrame } from '@/app/apex/page-frame'
import { PageHero } from '@/app/apex/page-hero'
import { AccessLayers } from '@/app/apex/sections/access-layers'
import { PageFaqSection } from '@/app/apex/sections/page-faq'
import { ProofBand } from '@/app/apex/sections/proof-band'

export function AccessPage() {
  const copy = PAGE_COPY.access

  return (
    <PageFrame>
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        lede={copy.lede}
        bullets={copy.bullets}
        meta={copy.meta}
        audience={copy.audience}
        aside={copy.aside}
      />
      <AccessLayers showIntro={false} />
      <PageFaqSection faqs={copy.faqs} />
      <ProofBand />
    </PageFrame>
  )
}
