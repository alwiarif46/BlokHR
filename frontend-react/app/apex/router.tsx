'use client'

import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AccessPage } from '@/app/apex/pages/access-page'
import { CampusPage } from '@/app/apex/pages/campus-page'
import { HomePage } from '@/app/apex/pages/home-page'
import { ModulesPage } from '@/app/apex/pages/modules-page'
import { PricingPage } from '@/app/apex/pages/pricing-page'
import { SetupPage } from '@/app/apex/pages/setup-page'
import { WorkforcePage } from '@/app/apex/pages/workforce-page'
import { ApexShell } from '@/app/apex/shell'
import type { ApiClient, SetupStatus } from '@/lib/tenants-api'

export interface ApexRouterProps {
  status: SetupStatus
  api?: ApiClient
  navigate?: (url: string) => void
}

export function ApexRouter({ status, api, navigate }: ApexRouterProps) {
  return (
    <HashRouter>
      <Routes>
        <Route element={<ApexShell status={status} api={api} navigate={navigate} />}>
          <Route index element={<HomePage />} />
          <Route path="modules" element={<ModulesPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="campus" element={<CampusPage />} />
          <Route path="workforce" element={<WorkforcePage />} />
          <Route path="pricing" element={<PricingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
