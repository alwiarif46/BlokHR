'use client'

import type { ReactNode } from 'react'
import { Footer } from '@/app/apex/sections/footer'

/** Shared main width + footer for secondary marketing pages. */
export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-16 md:px-8 md:pb-20">
      {children}
      <Footer />
    </main>
  )
}
