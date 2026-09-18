'use client'

import { SqueezeCarousel, type SqueezeSlide } from '@/components/ui/carousel-squeeze'
import { MOSAIC } from '@/app/apex/mosaic-theme'

const mark = (text: string) => (
  <span className="text-sm font-medium tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
    {text}
  </span>
)

/** Six module panels with mosaic colour fills until real images ship. */
const SLIDES: SqueezeSlide[] = [
  {
    id: 'roll-call',
    title: 'Roll call',
    description: 'Section presence, live for teachers.',
    background: MOSAIC.gold,
    overlay: mark('Roll call'),
  },
  {
    id: 'clock-in',
    title: 'Clock-in',
    description: 'Clock-in and regularizations on the core rack.',
    background: MOSAIC.blueSoft,
    overlay: mark('Clock-in'),
  },
  {
    id: 'leaves',
    title: 'Leaves',
    description: 'Policies and balances when you switch them on.',
    background: MOSAIC.mint,
    overlay: mark('Leaves'),
  },
  {
    id: 'timetable',
    title: 'Timetable',
    description: 'Slots, cover, and instances on the campus rack.',
    background: MOSAIC.coral,
    overlay: mark('Timetable'),
  },
  {
    id: 'report-cards',
    title: 'Report cards',
    description: 'Publish when marks lock; parents see only what you release.',
    background: MOSAIC.charcoal,
    overlay: mark('Report cards'),
  },
  {
    id: 'face-capture',
    title: 'Face capture',
    description: 'Biometrics when you are ready, as an add-on.',
    background: MOSAIC.midGray,
    overlay: mark('Face capture'),
  },
]

/** Landing module squeeze carousel. */
export function ModuleCarousel() {
  return (
    <section aria-label="Modules" className="mt-16 overflow-x-clip md:mt-20">
      <SqueezeCarousel
        slides={SLIDES}
        label="Modules"
        radius={MOSAIC.radiusPx}
        accent={MOSAIC.darkFace}
        accentForeground="#ffffff"
        height="clamp(180px, 32cqi, 320px)"
      />
    </section>
  )
}
