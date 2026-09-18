'use client'

import { MODULES_WIDGETS } from '@/app/apex/demo-widgets'
import { PAGE_COPY } from '@/app/apex/marketing-copy'
import { MarketingPage } from '@/app/apex/marketing-page'

export function ModulesPage() {
  const copy = PAGE_COPY.modules
  return (
    <MarketingPage
      eyebrow={copy.eyebrow}
      title={copy.title}
      lede={copy.lede}
      bullets={copy.bullets}
      stripLabel={copy.stripLabel}
      meta={copy.meta}
      aside={copy.aside}
      widgets={MODULES_WIDGETS}
      boardTitle="Modules rack"
    />
  )
}
