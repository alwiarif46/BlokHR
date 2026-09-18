import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApexPage } from '@/app/apex/page'
import '@/app/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApexPage status={{ signupPortal: true, subdomainBase: 'localhost' }} />
  </StrictMode>,
)
