'use client'

import {
  CAMPUS_WIDGETS,
  DemoBoard,
  DESKTOP_BOARD_COLUMNS,
  LOCK_DESKTOP_BOARD_COLUMNS,
} from '@/app/apex/demo-widgets'
import { PAGE_COPY } from '@/app/apex/marketing-copy'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import { PageFrame } from '@/app/apex/page-frame'
import { PageHero } from '@/app/apex/page-hero'
import { CampusStory } from '@/app/apex/sections/campus-story'
import { PageFaqSection } from '@/app/apex/sections/page-faq'
import { ProofBand } from '@/app/apex/sections/proof-band'
import { useIsDesktop } from '@/app/apex/use-viewport'

export function CampusPage() {
  const copy = PAGE_COPY.campus
  const isDesktop = useIsDesktop()

  return (
    <PageFrame>
      <div className="md:grid md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-start md:gap-10 md:pt-2">
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
        <DemoBoard
          items={CAMPUS_WIDGETS}
          title="Campus rack"
          stripLabel={copy.stripLabel}
          maxColumns={isDesktop ? DESKTOP_BOARD_COLUMNS : 2}
          fixedColumns={
            isDesktop && LOCK_DESKTOP_BOARD_COLUMNS ? DESKTOP_BOARD_COLUMNS : undefined
          }
          cellSize={isDesktop ? 180 : 150}
          gap={isDesktop ? 12 : 10}
          radius={MOSAIC.radiusPx}
        />
      </div>
      <CampusStory />
      <PageFaqSection faqs={copy.faqs} />
      <ProofBand />
    </PageFrame>
  )
}
