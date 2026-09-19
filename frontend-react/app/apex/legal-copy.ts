/** Legal entity and policy copy for Apex marketing. Template for counsel review. */

export const COMPANY = {
  legalName: '13 Blok Private Limited',
  brand: '13lok',
  addressLines: ['Netaji Subhash Marg', 'Delhi', 'India'] as const,
  /** Primary contact for privacy / legal notices */
  emailLegal: 'legal@13blok.in',
  emailSupport: 'support@13blok.in',
  governingLaw: 'the laws of India',
  jurisdiction: 'the courts at Delhi, India',
  lastUpdated: '18 September 2026',
} as const

export type LegalSection = {
  heading: string
  paragraphs: readonly string[]
  bullets?: readonly string[]
}

export type LegalDoc = {
  id: 'privacy' | 'terms' | 'cookies' | 'contact'
  path: string
  title: string
  eyebrow: string
  intro: string
  sections: readonly LegalSection[]
}

export const LEGAL_DOCS: Record<LegalDoc['id'], LegalDoc> = {
  privacy: {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy Policy',
    eyebrow: 'Legal',
    intro: `This Privacy Policy explains how ${COMPANY.legalName} (“${COMPANY.brand}”, “we”, “us”) collects, uses, stores, and shares personal data when you visit our websites, create a workspace, or use our multi-tenant software products.`,
    sections: [
      {
        heading: 'Who we are',
        paragraphs: [
          `${COMPANY.legalName} operates the ${COMPANY.brand} platform (including BlokHR workforce and BlokSchool campus products). We act as a data fiduciary for account and billing data we control, and as a data processor / service provider for content that tenants store in their own workspaces.`,
          `Registered address: ${COMPANY.addressLines.join(', ')}.`,
        ],
      },
      {
        heading: 'Data we collect',
        paragraphs: [
          'Depending on how you use the service, we may process:',
        ],
        bullets: [
          'Identity and contact details (name, email, phone) for workspace admins and invited users',
          'Workspace and tenancy metadata (organisation name, subdomain, plan, feature flags)',
          'Authentication data (passwords hashed, magic-link tokens, SSO identifiers when configured)',
          'Usage and device logs (IP address, browser type, approximate location, timestamps) for security and reliability',
          'Support correspondence you send to us',
          'Payment or licence references handled by our billing partners (we do not store full card numbers on our servers)',
        ],
      },
      {
        heading: 'Why we use data',
        paragraphs: [
          'We use personal data to:',
        ],
        bullets: [
          'Provide, secure, and improve the product',
          'Create and administer tenant workspaces',
          'Authenticate users and enforce role-based access',
          'Send transactional messages (invites, password resets, security alerts)',
          'Meet legal, tax, and accounting obligations',
          'Investigate abuse, fraud, or security incidents',
        ],
      },
      {
        heading: 'Legal bases (India — DPDP)',
        paragraphs: [
          'Where the Digital Personal Data Protection Act, 2023 applies, we process personal data for lawful purposes such as providing the service you request, complying with law, and employment or other permitted uses. Where consent is required, we will ask for it and you may withdraw it as described below, without affecting processing already completed lawfully.',
        ],
      },
      {
        heading: 'Tenant content',
        paragraphs: [
          'Content that a customer stores in their workspace (for example attendance records, student rolls, or HR files) is controlled by that customer. We process it only to provide the service, under their instructions and our agreements with them. Requests about that content should usually go to the customer’s administrator first.',
        ],
      },
      {
        heading: 'Sharing',
        paragraphs: [
          'We do not sell personal data. We may share data with:',
        ],
        bullets: [
          'Infrastructure and email providers who process data on our instructions',
          'Payment or licensing partners when you purchase a plan',
          'Professional advisers under confidentiality',
          'Authorities when required by applicable law',
        ],
      },
      {
        heading: 'Retention',
        paragraphs: [
          'We keep account and billing records for as long as the workspace is active and for a reasonable period afterward as required for disputes, audits, and law. Security logs are retained for a limited period. Tenant content is retained according to the customer’s settings and our deletion workflows after account closure.',
        ],
      },
      {
        heading: 'Security',
        paragraphs: [
          'We use administrative, technical, and organisational measures appropriate to a multi-tenant SaaS product, including access controls, encryption in transit, and tenant isolation. No method of transmission or storage is perfectly secure; please use strong credentials and report suspected incidents promptly.',
        ],
      },
      {
        heading: 'Your rights',
        paragraphs: [
          'Subject to applicable law, you may request access, correction, updating, or erasure of personal data we hold about you, or withdraw consent where processing is consent-based. Workspace users should contact their organisation’s admin for data held inside a tenant. For data we control directly, email us using the contact details below. We may need to verify your identity before responding.',
        ],
      },
      {
        heading: 'Children',
        paragraphs: [
          'Our marketing site and self-serve signup are intended for organisations and adults. School products may process children’s data only under a customer’s instructions and applicable education / child-data rules. Do not submit a child’s personal data to us through marketing forms.',
        ],
      },
      {
        heading: 'International transfers',
        paragraphs: [
          'We may use cloud infrastructure or vendors outside India. Where we do, we take steps intended to protect personal data in line with applicable law and our contracts with those vendors.',
        ],
      },
      {
        heading: 'Changes',
        paragraphs: [
          `We may update this policy from time to time. The “Last updated” date at the top of the page will change when we do. Continued use of the service after an update constitutes notice of the revised policy where permitted by law.`,
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          `Privacy and grievance contact: ${COMPANY.emailLegal}`,
          `${COMPANY.legalName}, ${COMPANY.addressLines.join(', ')}.`,
        ],
      },
    ],
  },

  terms: {
    id: 'terms',
    path: '/terms',
    title: 'Terms of Service',
    eyebrow: 'Legal',
    intro: `These Terms of Service (“Terms”) govern access to and use of websites and software operated by ${COMPANY.legalName} (“${COMPANY.brand}”, “we”, “us”). By creating a workspace or using the service, you agree to these Terms.`,
    sections: [
      {
        heading: 'The service',
        paragraphs: [
          `${COMPANY.brand} provides modular, multi-tenant workforce and campus operations software. Features available to you depend on your workspace type, plan, and the modules you enable. We may change, improve, or discontinue features with reasonable notice where practicable.`,
        ],
      },
      {
        heading: 'Accounts and workspaces',
        paragraphs: [
          'You must provide accurate information when you register. You are responsible for safeguarding credentials and for activity under your workspace. Each workspace is isolated for a tenant; you must not attempt to access another tenant’s data.',
          'If you invite users, you confirm you are authorised to do so and that they will comply with these Terms and your organisation’s policies.',
        ],
      },
      {
        heading: 'Acceptable use',
        paragraphs: [
          'You agree not to:',
        ],
        bullets: [
          'Break the law or infringe others’ rights',
          'Probe, scan, or attack the service, or bypass access controls',
          'Upload malware or abusive content',
          'Resell the service except under a written partner agreement',
          'Misrepresent your identity or affiliation',
        ],
      },
      {
        heading: 'Customer content',
        paragraphs: [
          'You retain rights to content you upload. You grant us a limited licence to host, process, and display that content solely to operate the service. You represent that you have the rights and consents needed to use the content in the product, including personal data of employees, students, or guardians.',
        ],
      },
      {
        heading: 'Plans, trials, and fees',
        paragraphs: [
          'Trials, licences, and paid plans are described at signup or in a separate order form. Fees are non-refundable except where required by law or expressly stated in writing. We may suspend service for non-payment after notice.',
        ],
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          `The ${COMPANY.brand} software, branding, and documentation are owned by ${COMPANY.legalName} or its licensors. These Terms do not transfer ownership to you. Feedback you give may be used to improve the product without obligation to you.`,
        ],
      },
      {
        heading: 'Confidentiality',
        paragraphs: [
          'Each party may receive confidential information from the other. The recipient will use it only for the relationship under these Terms and protect it with reasonable care, except for information that is public, independently developed, or required to be disclosed by law.',
        ],
      },
      {
        heading: 'Disclaimer',
        paragraphs: [
          'The service is provided “as is” and “as available”. To the fullest extent permitted by law, we disclaim warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant uninterrupted or error-free operation.',
        ],
      },
      {
        heading: 'Limitation of liability',
        paragraphs: [
          `To the fullest extent permitted by law, ${COMPANY.legalName} will not be liable for indirect, incidental, special, consequential, or lost-profit damages. Our aggregate liability arising out of these Terms or the service is limited to the fees you paid us for the service in the three (3) months before the claim (or INR 10,000 if you are on a free trial).`,
          'Some jurisdictions do not allow certain limitations; in those cases our liability is limited to the maximum permitted by law.',
        ],
      },
      {
        heading: 'Indemnity',
        paragraphs: [
          'You will defend and indemnify us against claims arising from your content, your misuse of the service, or your breach of these Terms, except to the extent caused by our wilful misconduct.',
        ],
      },
      {
        heading: 'Suspension and termination',
        paragraphs: [
          'You may stop using the service at any time. We may suspend or terminate access for material breach, legal risk, non-payment, or misuse. Upon termination, your right to use the service ends. We will make tenant data export or deletion available according to our then-current procedures and applicable law.',
        ],
      },
      {
        heading: 'Governing law',
        paragraphs: [
          `These Terms are governed by ${COMPANY.governingLaw}. Courts at ${COMPANY.jurisdiction.replace('the courts at ', '')} have exclusive jurisdiction, subject to any mandatory consumer protections that apply.`,
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          `Questions about these Terms: ${COMPANY.emailLegal}`,
          `${COMPANY.legalName}, ${COMPANY.addressLines.join(', ')}.`,
        ],
      },
    ],
  },

  cookies: {
    id: 'cookies',
    path: '/cookies',
    title: 'Cookie Policy',
    eyebrow: 'Legal',
    intro: `This Cookie Policy explains how ${COMPANY.legalName} uses cookies and similar technologies on ${COMPANY.brand} websites and applications.`,
    sections: [
      {
        heading: 'What cookies are',
        paragraphs: [
          'Cookies are small text files stored on your device. We also use local storage and similar technologies for session and preference data.',
        ],
      },
      {
        heading: 'How we use them',
        paragraphs: ['We use:'],
        bullets: [
          'Essential cookies — sign-in, security, load balancing, and remembering your workspace session',
          'Preference cookies — theme (light/dark) and similar UI choices',
          'Analytics cookies — aggregated traffic and product usage, when enabled, to improve the service',
        ],
      },
      {
        heading: 'Your choices',
        paragraphs: [
          'Essential cookies are required for the product to work. You can block or delete cookies in your browser; some features may then fail. Where we use non-essential analytics, we will provide a control or rely on settings appropriate to the context.',
        ],
      },
      {
        heading: 'More information',
        paragraphs: [
          `For personal-data practices, see our Privacy Policy. Contact: ${COMPANY.emailLegal}.`,
          `${COMPANY.legalName}, ${COMPANY.addressLines.join(', ')}.`,
        ],
      },
    ],
  },

  contact: {
    id: 'contact',
    path: '/contact',
    title: 'Contact',
    eyebrow: 'Legal',
    intro: `Reach ${COMPANY.legalName} for product support, privacy requests, and legal notices.`,
    sections: [
      {
        heading: 'Company',
        paragraphs: [
          COMPANY.legalName,
          COMPANY.addressLines.join(', '),
        ],
      },
      {
        heading: 'Email',
        paragraphs: [
          `Support: ${COMPANY.emailSupport}`,
          `Privacy & legal: ${COMPANY.emailLegal}`,
        ],
      },
      {
        heading: 'Workspace help',
        paragraphs: [
          'If you already have a workspace, sign in and use in-product support where available, or ask your workspace administrator. For new workspaces, use Create workspace on the home page.',
        ],
      },
    ],
  },
}

export const LEGAL_NAV = [
  { label: 'Terms', path: '/terms' },
  { label: 'Privacy', path: '/privacy' },
  { label: 'Cookies', path: '/cookies' },
  { label: 'Contact', path: '/contact' },
] as const
