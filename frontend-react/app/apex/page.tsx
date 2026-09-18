'use client'

import { ApexRouter } from '@/app/apex/router'
import { ThemeProvider } from '@/app/apex/theme-provider'
import type { ApiClient, SetupStatus } from '@/lib/tenants-api'

export interface ApexPageProps {
  status: SetupStatus
  api?: ApiClient
  navigate?: (url: string) => void
}

/** Apex entry: theme provider + hash-routed marketing pages. */
export function ApexPage(props: ApexPageProps) {
  return (
    <ThemeProvider>
      <div className="landing-root min-h-screen">
        <ApexRouter {...props} />
      </div>
    </ThemeProvider>
  )
}

export default ApexPage
