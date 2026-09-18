import { createRoot, type Root } from 'react-dom/client'
import { ApexPage } from '@/app/apex/page'
import type { ApiClient, SetupStatus } from '@/lib/tenants-api'
import '@/app/globals.css'

export type { SetupStatus, ApiClient }

let root: Root | null = null

/**
 * Mount the React Apex landing into a DOM node (used by vanilla shell landing bridge).
 */
export function mountApexLanding(
  el: HTMLElement,
  status: SetupStatus,
  deps?: { api?: ApiClient; navigate?: (url: string) => void },
) {
  if (!el) return
  if (root) {
    root.unmount()
    root = null
  }
  root = createRoot(el)
  root.render(
    <ApexPage status={status || {}} api={deps?.api} navigate={deps?.navigate} />,
  )
}

export function unmountApexLanding() {
  if (root) {
    root.unmount()
    root = null
  }
}

export { ApexPage }
