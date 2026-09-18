/** Shared 13blok Apex marketing copy — single source of truth for desktop/mobile. */

export const BRAND = '13blok'
export const MODULE_COUNT = 50

export const NAV = [
  { id: 'modules', label: 'Modules', path: '/modules', icon: 'mdi:view-grid-outline' },
  { id: 'setup', label: 'Setup', path: '/setup', icon: 'mdi:cog-outline' },
  { id: 'access', label: 'Access', path: '/access', icon: 'mdi:shield-key-outline' },
  { id: 'campus', label: 'Campus', path: '/campus', icon: 'mdi:school-outline' },
  { id: 'workforce', label: 'Workforce', path: '/workforce', icon: 'mdi:account-group-outline' },
  { id: 'pricing', label: 'Pricing', path: '/pricing', icon: 'mdi:tag-outline' },
] as const

export const HERO = {
  eyebrow: 'Modular HRMS & campus ops',
  headline: 'Switch on what you actually run.',
  lede:
    'Motorola sketched a phone you built from blocks. Google called it Project Ara and shelved it. 13blok is that idea, shipped as software: 50 modules on one spine, each with its own switch. Attendance today, payroll next quarter, biometrics when you are ready.',
  primaryCta: 'Create your workspace',
  secondaryCta: 'I already have one',
  meta: 'No card to start · setup takes 4 steps',
} as const

export const FEATURE_MODULES = [
  { rack: 'core', label: 'Attendance' },
  { rack: 'core', label: 'Leaves' },
  { rack: 'campus', label: 'Roll call' },
  { rack: 'campus', label: 'Timetable' },
  { rack: 'add-on', label: 'Overtime' },
  { rack: 'add-on', label: 'Face capture' },
  { rack: 'campus', label: 'Library' },
  { rack: 'campus', label: 'Transport' },
] as const

export const FEATURES_BLURB =
  'Off means gone from the sidebar and 404 from its own API. On means back on the next load.'

/** Modest product-true proof — no invented customer counts or quotes. */
export const PROOF_BAND = [
  'Workforce or Campus — pick once per workspace',
  'Four steps to a live trial, no card to start',
  'Off modules stay 404, not only hidden in the UI',
] as const

export const STATS = [
  { value: String(MODULE_COUNT), label: 'modules in the rack' },
  { value: '6', label: 'access layers per request' },
  { value: '15', label: 'services behind one gateway' },
  { value: '4', label: 'themes, switchable per person' },
] as const

export const RACKS = {
  title: 'One spine, two racks',
  subtitle: 'Pick your workspace type once.',
  workforce: {
    name: 'Workforce, BlokHR',
    body: 'Attendance, leaves, holidays, regularizations, timesheets, overtime, expenses, org chart, training. Face, iris, geo-fence and kiosk capture bolt on when you want them.',
  },
  campus: {
    name: 'Campus, BlokSchool',
    body: 'Roll call, timetable and cover, academics and homework, exams, report cards, library, fees, transport, circulars, surveys, and a parent portal your guardians actually sign into.',
  },
} as const

export const SETUP_STEPS = [
  {
    n: '01',
    title: 'Type',
    body: 'Workforce or Campus. Permanent for this workspace.',
  },
  {
    n: '02',
    title: 'Branding',
    body: 'Your name, your logo, your login line.',
  },
  {
    n: '03',
    title: 'Auth',
    body: 'Password, magic link, Microsoft, Google or SAML.',
  },
  {
    n: '04',
    title: 'Plan',
    body: 'Start a trial, or paste the licence token you were sent.',
  },
] as const

export const ACCESS = {
  title: 'Who sees what',
  lead: 'A teacher sees her sections. Nothing else.',
  body: 'Six checks stand between a request and a record: what your tenant owns, which flags are on, who the caller is, what that role may call, which rows they own, and only then the screen. Hiding a button is never the boundary here.',
  roles: [
    'employee',
    'manager',
    'hr',
    'teacher',
    'office',
    'school_admin',
    'admin',
    'parent',
    'guardian',
  ],
  layers: [
    { n: '01', title: 'Tenant', body: 'Your workspace boundary first.' },
    { n: '02', title: 'Flags', body: 'Only modules you switched on.' },
    { n: '03', title: 'Identity', body: 'Who is calling this API.' },
    { n: '04', title: 'Role', body: 'What that role may invoke.' },
    { n: '05', title: 'Rows', body: 'Which records they own.' },
    { n: '06', title: 'Screen', body: 'UI last, never the gate.' },
  ],
} as const

export type PageFaq = { q: string; a: string }

export const PAGE_COPY = {
  modules: {
    eyebrow: 'Admin › Features',
    title: `${MODULE_COUNT} modules. Each with a switch.`,
    lede: FEATURES_BLURB,
    stripLabel: 'Adding a feature takes one click, not a project',
    bullets: [
      'One rack per workspace, flags per module.',
      'Off removes the route and its API surface.',
      'On restores the module on the next load.',
      'Core, campus, and add-ons share the same spine.',
    ],
    meta: 'Admin › Features · drag any tile',
    audience: 'For admins who decide what the workspace runs.',
    aside:
      'Drag tiles on the board to see how the rack feels. Off modules stay grey until you turn them on. Your real workspace keeps the same switch model: one flag per module, scoped to your tenant.',
    faqs: [
      {
        q: 'What does Off actually do?',
        a: 'Off removes the module from the sidebar and returns 404 from its own API. On restores it on the next load.',
      },
      {
        q: 'Do core and campus share one product?',
        a: 'Yes. Core, campus, and add-ons sit on the same spine. You pick Workforce or Campus once at setup, then switch modules on that tenant.',
      },
      {
        q: 'Is the board the real Admin Features screen?',
        a: 'It is the same switch model. Your live workspace keeps flags per module, scoped to your tenant only.',
      },
    ] satisfies PageFaq[],
  },
  setup: {
    eyebrow: 'Onboarding',
    title: 'Four steps, then you are inside.',
    lede: 'Type, branding, auth, plan. Permanent choices where they should be, flexible everywhere else.',
    stripLabel: 'Setup is four steps. Then you are inside.',
    bullets: [
      'Pick Workforce or Campus once.',
      'Brand the login with your name and mark.',
      'Wire password, magic link, or SSO.',
      'Start a trial or paste a licence token.',
    ],
    meta: 'No card to start · four steps to first login',
    audience: 'For the person creating the first workspace.',
    aside:
      'Workspace type is locked after create so HR and campus data never mix by accident. Branding and auth stay editable. Plan and entitlements stay on the tenant you just opened.',
    faqs: [
      {
        q: 'Can I change Workforce to Campus later?',
        a: 'No. Type is permanent for that workspace so HR and campus data never mix by accident.',
      },
      {
        q: 'What stays editable after create?',
        a: 'Branding and auth stay editable. Plan and entitlements stay on the tenant you opened.',
      },
      {
        q: 'Which sign-in options are supported?',
        a: 'Password, magic link, Microsoft, Google, or SAML, wired in setup step three.',
      },
    ] satisfies PageFaq[],
  },
  access: {
    eyebrow: 'Security model',
    title: ACCESS.title,
    lede: ACCESS.body,
    stripLabel: 'Six checks before a record. UI is never the gate.',
    bullets: [
      'Tenant boundary first, every request.',
      'Feature flags gate modules before roles.',
      'Roles and row ownership close the loop.',
      'Screens hide controls; APIs enforce them.',
    ],
    meta: 'Six layers · named roles · per-tenant isolation',
    audience: 'For security reviewers and school or HR admins.',
    aside:
      'A teacher sees her sections. An admin sees the tenant with audit. Parents and guardians only get what you release. The layers are the gate; the UI is never the boundary.',
    faqs: [
      {
        q: 'Is hiding a button enough?',
        a: 'No. Screens hide controls last. Tenant, flags, identity, role, and row ownership already ran.',
      },
      {
        q: 'What does a teacher see?',
        a: ACCESS.lead,
      },
      {
        q: 'How are parents and guardians limited?',
        a: 'Parents and guardians only get what you release. Named roles sit on the same six-layer path.',
      },
    ] satisfies PageFaq[],
  },
  campus: {
    eyebrow: 'BlokSchool',
    title: 'Campus ops on the same spine.',
    lede: RACKS.campus.body,
    stripLabel: 'Campus modules share one spine with workforce.',
    bullets: [
      'Roll call and timetable stay live for teachers.',
      'Exams and report cards publish when you lock.',
      'Library and transport wait until you switch on.',
      'Parents sign into a portal that only shows released data.',
    ],
    meta: 'BlokSchool · same spine as BlokHR',
    audience: 'For schools that need campus ops without a second product.',
    aside:
      'You pick Campus once at setup, then switch on the school modules you run this term. Staff attendance can still sit beside roll call when you need both.',
    faqs: [
      {
        q: 'Is BlokSchool a separate product?',
        a: 'No. Campus modules share one spine with workforce. You choose Campus once at setup.',
      },
      {
        q: 'When do parents see marks?',
        a: 'Report cards publish when marks lock. The parent portal only shows released data.',
      },
      {
        q: 'Must every campus module be on?',
        a: 'No. Library, transport, and other campus modules wait until you switch them on.',
      },
    ] satisfies PageFaq[],
  },
  workforce: {
    eyebrow: 'BlokHR',
    title: 'Workforce modules you can grow into.',
    lede: RACKS.workforce.body,
    stripLabel: 'Workforce modules you grow into, not rebuild.',
    bullets: [
      'Clock-in and leaves run from day one.',
      'Overtime and payroll stay off until ready.',
      'Face and iris bolt on as add-ons.',
      'Geo-fence and kiosk share the same capture path.',
    ],
    meta: 'BlokHR · same spine as BlokSchool',
    audience: 'For HR and ops teams that grow module by module.',
    aside:
      'Start with clock-in and leaves. Add overtime, capture, or payroll when operations are ready. You do not rebuild the workspace; you flip switches on the same tenant spine.',
    faqs: [
      {
        q: 'What runs from day one?',
        a: 'Clock-in and leaves. Overtime and payroll stay off until you are ready.',
      },
      {
        q: 'How do biometrics fit?',
        a: 'Face and iris bolt on as add-ons. Geo-fence and kiosk share the same capture path.',
      },
      {
        q: 'Do I rebuild when I add modules?',
        a: 'No. You flip switches on the same tenant spine. Core and add-ons stay one product.',
      },
    ] satisfies PageFaq[],
  },
  pricing: {
    eyebrow: 'Plans',
    title: 'Start a trial. Bring a licence when ready.',
    lede: 'No invented price list. Your commercial team issues a licence token, or you begin a trial from setup step four. Entitlements stay per tenant.',
    stripLabel: 'Trial first. Licence when your team is ready.',
    bullets: [
      'Trial from setup, no card required.',
      'Licence tokens are issued per tenant.',
      'Entitlements and plan limits stay scoped.',
      'Commercial terms live outside this board.',
    ],
    meta: 'Trial or licence · entitlements per tenant',
    audience: 'For buyers choosing how to open a workspace.',
    aside:
      'This page does not list dollars. Trial unlocks a workspace so you can configure modules. A licence token from your commercial team binds plan limits to that tenant only.',
    faqs: [
      {
        q: 'Where are the prices?',
        a: 'There is no public dollar list here. Commercial terms live with your commercial team.',
      },
      {
        q: 'How does a trial start?',
        a: 'From setup step four, with no card required. Trial unlocks a workspace so you can configure modules.',
      },
      {
        q: 'What does a licence token do?',
        a: 'It is issued per tenant and binds plan limits and entitlements to that workspace only.',
      },
    ] satisfies PageFaq[],
  },
} as const

/** Pricing path cards (no dollar amounts). */
export const PRICING_PATHS = [
  {
    id: 'trial',
    title: 'Start a trial',
    body: 'No card required from setup step four. Configure modules on a live tenant spine.',
    cta: 'Create your workspace',
    mode: 'create' as const,
    shell: 'dark' as const,
  },
  {
    id: 'licence',
    title: 'Paste a licence',
    body: 'Token issued per tenant by your commercial team. Entitlements stay scoped to that workspace.',
    cta: 'I already have one',
    mode: 'login' as const,
    shell: 'blue' as const,
  },
] as const

/** Workforce split: core on day one vs add-ons later. */
export const WORKFORCE_SPLIT = {
  title: 'Grow into the rack',
  core: {
    title: 'On from day one',
    items: ['Clock-in', 'Leaves'],
  },
  addOns: {
    title: 'Add when ready',
    items: ['Overtime', 'Payroll', 'Face capture', 'Iris'],
  },
} as const

export const HOME_STRIP_LABEL = 'Adding a feature takes one click, not a project'
