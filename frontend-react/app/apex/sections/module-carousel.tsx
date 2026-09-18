'use client'

import { SqueezeCarousel, type SqueezeSlide } from '@/components/ui/carousel-squeeze'
import { MOSAIC } from '@/app/apex/mosaic-theme'
import campusAssets from '@/app/apex/assets/carousel/campus-assets.jpg'
import clockIn from '@/app/apex/assets/carousel/clock-in.jpg'
import expenses from '@/app/apex/assets/carousel/expenses.jpg'
import faceCapture from '@/app/apex/assets/carousel/face-capture.jpg'
import identityLocation from '@/app/apex/assets/carousel/identity-location.jpg'
import leaves from '@/app/apex/assets/carousel/leaves.jpg'
import modules from '@/app/apex/assets/carousel/modules.jpg'
import visitors from '@/app/apex/assets/carousel/visitors.jpg'

const mark = (text: string) => (
  <span className="text-sm font-medium tracking-tight text-white" style={{ fontFamily: 'var(--font-display)' }}>
    {text}
  </span>
)

/** Module mockup slides for the landing squeeze carousel. */
const SLIDES: SqueezeSlide[] = [
  {
    id: 'clock-in',
    title: 'Clock-in',
    description: 'Your team day at a glance, on desk and phone.',
    image: clockIn,
    imageAlt: 'Attendance board and My day clock-in screens on laptop and phone',
    overlay: mark('Clock-in'),
  },
  {
    id: 'leaves',
    title: 'Leaves',
    description: 'Leave requests and balances, clearly managed.',
    image: leaves,
    imageAlt: 'Staff leave approvals on tablet and leave balance on phone',
    overlay: mark('Leaves'),
  },
  {
    id: 'face-capture',
    title: 'Face capture',
    description: 'Identity and location when you switch biometrics on.',
    image: faceCapture,
    imageAlt: 'Iris scan, face recognition, and geofencing concept preview',
    overlay: mark('Face capture'),
  },
  {
    id: 'identity-location',
    title: 'Verify identity',
    description: 'Confirm who is present and that they are on campus.',
    image: identityLocation,
    imageAlt: 'Iris scanner, face recognition phone, and campus geofence card',
    overlay: mark('Identity'),
  },
  {
    id: 'modules',
    title: 'Modules',
    description: 'Switch on what you run. Leave the rest off.',
    image: modules,
    imageAlt: 'HR workspace module toggles with face, geofence, iris, and workflows',
    overlay: mark('Modules'),
  },
  {
    id: 'campus-assets',
    title: 'Campus assets',
    description: 'Know your campus equipment and who has it.',
    image: campusAssets,
    imageAlt: 'Campus assets list on a tablet with projector and laptop on a desk',
    overlay: mark('Assets'),
  },
  {
    id: 'visitors',
    title: 'Visitors',
    description: 'Welcome visitors and keep a clear record.',
    image: visitors,
    imageAlt: 'Campus visitors check-in screen on a tablet in a lobby',
    overlay: mark('Visitors'),
  },
  {
    id: 'expenses',
    title: 'Expenses',
    description: 'School expenses tracked from receipt to approval.',
    image: expenses,
    imageAlt: 'New expense on phone and expense review on desktop',
    overlay: mark('Expenses'),
  },
]

/** Landing module squeeze carousel with autoplay. */
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
        autoplay
        interval={5000}
      />
    </section>
  )
}
