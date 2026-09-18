'use client'

import { LEGAL_DOCS } from '@/app/apex/legal-copy'
import { LegalDocument } from '@/app/apex/pages/legal-page'

export function PrivacyPage() {
  return <LegalDocument doc={LEGAL_DOCS.privacy} />
}

export function TermsPage() {
  return <LegalDocument doc={LEGAL_DOCS.terms} />
}

export function CookiesPage() {
  return <LegalDocument doc={LEGAL_DOCS.cookies} />
}

export function ContactPage() {
  return <LegalDocument doc={LEGAL_DOCS.contact} />
}
