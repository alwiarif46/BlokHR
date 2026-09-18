'use client'

import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import { ACCESS, FEATURES_BLURB, MODULE_COUNT, SETUP_STEPS } from '@/app/apex/marketing-copy'
import {
  DARK_FACE,
  MOSAIC,
  mosaicShellForId,
  type MosaicShell,
} from '@/app/apex/mosaic-theme'
import DraggableWidgetGrid, {
  type WidgetItem,
  type WidgetSize,
} from '@/components/ui/draggable-widget-grid'

type Rack = 'core' | 'campus' | 'add-on'

type Kind =
  | 'features-header'
  | 'module-switch'
  | 'setup-step'
  | 'access-layer'
  | 'access-role'
  | 'pricing-card'
  | 'overview-stat'
  | 'marketing-cta'

export interface Widget extends WidgetItem {
  kind: Kind
  rack?: Rack
  enabled?: boolean
  icon?: string
  detail?: string
  stepN?: string
  /** Force a mosaic shell instead of hashed cycle. */
  shell?: MosaicShell
}

function switchWidget(
  id: string,
  label: string,
  rack: Rack,
  enabled: boolean,
  icon: string,
  detail: string,
  size: WidgetSize = 'sm',
): Widget {
  return { id, kind: 'module-switch', size, label, rack, enabled, icon, detail }
}

const ATTENDANCE = switchWidget(
  'attendance',
  'Clock-in',
  'core',
  true,
  'mdi:clock-check-outline',
  'Clock-in and regularizations.',
)
const LEAVES = switchWidget(
  'leaves',
  'Leaves',
  'core',
  true,
  'mdi:calendar-remove-outline',
  'Policies and balances.',
)
const ROLLCALL = switchWidget(
  'rollcall',
  'Roll call',
  'campus',
  true,
  'mdi:account-check-outline',
  'Section presence, live.',
)
const TIMETABLE = switchWidget(
  'timetable',
  'Timetable',
  'campus',
  true,
  'mdi:calendar-clock',
  'Slots, cover, instances.',
)
const OVERTIME = switchWidget(
  'overtime',
  'Overtime',
  'add-on',
  false,
  'mdi:timer-plus-outline',
  'Bolt on when needed.',
)
const FACE = switchWidget(
  'face',
  'Face capture',
  'add-on',
  false,
  'mdi:face-recognition',
  'Biometrics when ready.',
)
const LIBRARY = switchWidget(
  'library',
  'Library',
  'campus',
  false,
  'mdi:bookshelf',
  'Catalog and loans.',
)
const TRANSPORT = switchWidget(
  'transport',
  'Transport',
  'campus',
  false,
  'mdi:bus-school',
  'Routes for guardians.',
)
const IRIS = switchWidget(
  'iris',
  'Iris scan',
  'add-on',
  true,
  'mdi:eye-outline',
  'High-assurance capture.',
)
const EXAMS = switchWidget(
  'exams',
  'Examinations',
  'campus',
  true,
  'mdi:file-document-edit-outline',
  'Papers, marks, cards.',
)
const PAYROLL = switchWidget(
  'payroll',
  'Payroll',
  'core',
  false,
  'mdi:cash-multiple',
  'Pay runs when you switch on.',
)
const PARENT = switchWidget(
  'parent',
  'Parent portal',
  'campus',
  true,
  'mdi:account-child-outline',
  'Guardians actually sign in.',
)
const REPORTS = switchWidget(
  'reports',
  'Report cards',
  'campus',
  true,
  'mdi:card-account-details-outline',
  'Publish when marks lock; parents see only what you release.',
  'wide',
)

const FEATURES_HEADER: Widget = {
  id: 'features-header',
  kind: 'features-header',
  size: 'wide',
  label: 'Admin Features',
  shell: DARK_FACE,
}

/** Closing CTA — spans two sm cells. Neutral face; green reserved for on-state. */
const MARKETING_CTA: Widget = {
  id: 'marketing-cta',
  kind: 'marketing-cta',
  size: 'wide',
  label: 'Need it later?',
  detail: 'Just turn it on.',
  icon: 'mdi:toggle-switch',
  shell: DARK_FACE,
}

const OFF_SHELL: MosaicShell = { bg: '#D8D8DC', tone: 'light' }

function rackCategoryShell(rack: Rack): MosaicShell {
  switch (rack) {
    case 'core':
      return { bg: MOSAIC.blueSoft, tone: 'light' }
    case 'campus':
      return { bg: MOSAIC.gold, tone: 'light' }
    case 'add-on':
      return { bg: MOSAIC.coral, tone: 'light' }
    default: {
      const _e: never = rack
      return _e
    }
  }
}

/** Slim home overview: 3 on + 2 off + header + CTA = 9 cells. */
export const HOME_WIDGETS: Widget[] = [
  FEATURES_HEADER,
  { ...ATTENDANCE, shell: rackCategoryShell('core') },
  { ...ROLLCALL, shell: rackCategoryShell('campus') },
  { ...LEAVES, shell: rackCategoryShell('core') },
  { ...OVERTIME, shell: OFF_SHELL },
  { ...FACE, shell: OFF_SHELL },
  MARKETING_CTA,
]

/** Starting "modules on" for the live chip (product story of 50). */
export const BOARD_BASE_ON = 13

/** Full Admin › Features switch rack: 12 cells (4×3). */
export const MODULES_WIDGETS: Widget[] = [
  FEATURES_HEADER,
  { ...ATTENDANCE, shell: rackCategoryShell('core') },
  { ...LEAVES, shell: rackCategoryShell('core') },
  { ...ROLLCALL, shell: rackCategoryShell('campus') },
  { ...TIMETABLE, shell: rackCategoryShell('campus') },
  { ...OVERTIME, shell: OFF_SHELL },
  { ...FACE, shell: OFF_SHELL },
  { ...LIBRARY, shell: OFF_SHELL },
  { ...TRANSPORT, shell: OFF_SHELL },
  MARKETING_CTA,
]

export const CAMPUS_WIDGETS: Widget[] = [
  {
    id: 'campus-header',
    kind: 'features-header',
    size: 'wide',
    label: 'Campus rack',
    detail: 'BlokSchool modules on the same spine.',
    shell: DARK_FACE,
  },
  { ...ROLLCALL, shell: rackCategoryShell('campus') },
  { ...TIMETABLE, shell: rackCategoryShell('campus') },
  { ...EXAMS, shell: rackCategoryShell('campus') },
  { ...PARENT, shell: rackCategoryShell('campus') },
  { ...IRIS, shell: rackCategoryShell('add-on') },
  { ...LIBRARY, shell: OFF_SHELL },
  { ...TRANSPORT, shell: OFF_SHELL },
  {
    ...REPORTS,
    size: 'sm',
    detail: 'Publish when marks lock.',
    shell: rackCategoryShell('campus'),
  },
  MARKETING_CTA,
]

export const WORKFORCE_WIDGETS: Widget[] = [
  {
    id: 'workforce-header',
    kind: 'features-header',
    size: 'wide',
    label: 'Workforce rack',
    detail: 'BlokHR modules you grow into.',
    shell: DARK_FACE,
  },
  { ...ATTENDANCE, shell: rackCategoryShell('core') },
  { ...LEAVES, shell: rackCategoryShell('core') },
  { ...IRIS, shell: rackCategoryShell('add-on') },
  { ...OVERTIME, shell: OFF_SHELL },
  { ...FACE, shell: OFF_SHELL },
  { ...PAYROLL, shell: OFF_SHELL },
  MARKETING_CTA,
]

export const SETUP_WIDGETS: Widget[] = [
  {
    id: 'setup-header',
    kind: 'features-header',
    size: 'wide',
    label: 'Setup',
    detail: 'Four steps, then you are inside.',
    shell: DARK_FACE,
  },
  ...SETUP_STEPS.map((step, i) => ({
    id: `setup-${step.n}`,
    kind: 'setup-step' as const,
    size: 'sm' as WidgetSize,
    label: step.title,
    stepN: step.n,
    detail: step.body,
    icon:
      i === 0
        ? 'mdi:shape-outline'
        : i === 1
          ? 'mdi:palette-outline'
          : i === 2
            ? 'mdi:shield-key-outline'
            : 'mdi:ticket-confirmation-outline',
    shell: [
      { bg: MOSAIC.gold, tone: 'light' as const },
      { bg: MOSAIC.blueSoft, tone: 'light' as const },
      { bg: MOSAIC.coral, tone: 'light' as const },
      { bg: MOSAIC.charcoal, tone: 'dark' as const },
    ][i],
  })),
  {
    id: 'setup-meta',
    kind: 'overview-stat',
    size: 'sm',
    label: 'Locked',
    detail: 'Permanent where it must be',
    icon: 'mdi:lock-outline',
    shell: { bg: MOSAIC.midGray, tone: 'dark' },
  },
  MARKETING_CTA,
]

export const ACCESS_WIDGETS: Widget[] = [
  {
    id: 'access-header',
    kind: 'features-header',
    size: 'wide',
    label: ACCESS.title,
    detail: ACCESS.lead,
    shell: DARK_FACE,
  },
  ...ACCESS.layers.map((layer, i) => ({
    id: `layer-${layer.n}`,
    kind: 'access-layer' as const,
    size: 'sm' as WidgetSize,
    label: layer.title,
    stepN: layer.n,
    detail: layer.body,
    icon: 'mdi:shield-check-outline',
    shell: [
      { bg: MOSAIC.gold, tone: 'light' as const },
      { bg: MOSAIC.blueSoft, tone: 'light' as const },
      { bg: MOSAIC.coral, tone: 'light' as const },
      { bg: MOSAIC.charcoal, tone: 'dark' as const },
      { bg: MOSAIC.midGray, tone: 'dark' as const },
      { bg: MOSAIC.darkFace, tone: 'dark' as const },
    ][i],
  })),
  {
    id: 'role-teacher',
    kind: 'access-role' as const,
    size: 'sm' as WidgetSize,
    label: 'teacher',
    detail: 'Sees her sections only',
    icon: 'mdi:account-badge-outline',
    shell: { bg: MOSAIC.gold, tone: 'light' },
  },
  {
    id: 'role-admin',
    kind: 'access-role' as const,
    size: 'sm' as WidgetSize,
    label: 'admin',
    detail: 'Tenant-wide with audit',
    icon: 'mdi:account-badge-outline',
    shell: { bg: MOSAIC.blueSoft, tone: 'light' },
  },
  MARKETING_CTA,
]

export const PRICING_WIDGETS: Widget[] = [
  {
    id: 'pricing-header',
    kind: 'features-header',
    size: 'wide',
    label: 'Commercial',
    detail: 'Trial first. Licence when your team is ready.',
    shell: DARK_FACE,
  },
  {
    id: 'pricing-trial',
    kind: 'pricing-card',
    size: 'sm',
    label: 'Start a trial',
    detail: 'No card required from setup step four.',
    icon: 'mdi:rocket-launch-outline',
    shell: DARK_FACE,
  },
  {
    id: 'pricing-licence',
    kind: 'pricing-card',
    size: 'sm',
    label: 'Paste a licence',
    detail: 'Token issued per tenant by your commercial team.',
    icon: 'mdi:key-variant',
    shell: { bg: MOSAIC.blueSoft, tone: 'light' },
  },
  {
    id: 'pricing-plan-step',
    kind: 'setup-step',
    size: 'sm',
    label: 'Plan',
    stepN: '04',
    detail: 'Trial or licence, your choice in setup.',
    icon: 'mdi:ticket-confirmation-outline',
    shell: { bg: MOSAIC.gold, tone: 'light' },
  },
  {
    id: 'pricing-tenant',
    kind: 'overview-stat',
    size: 'sm',
    label: '1',
    detail: 'tenant boundary per workspace',
    icon: 'mdi:office-building-outline',
    shell: { bg: MOSAIC.coral, tone: 'light' },
  },
  {
    id: 'pricing-entitlements',
    kind: 'overview-stat',
    size: 'sm',
    label: 'Scoped',
    detail: 'Entitlements stay per tenant',
    icon: 'mdi:shield-check-outline',
    shell: { bg: MOSAIC.charcoal, tone: 'dark' },
  },
  MARKETING_CTA,
]

/** @deprecated Prefer page-specific sets. */
export const WIDGETS = MODULES_WIDGETS

function shellOf(widget: Widget, enabled?: boolean): MosaicShell {
  if (widget.kind === 'module-switch') {
    const on = enabled ?? !!widget.enabled
    if (!on) return OFF_SHELL
    if (widget.rack) return rackCategoryShell(widget.rack)
  }
  return widget.shell ?? mosaicShellForId(widget.id)
}

function toneClasses(tone: MosaicShell['tone']) {
  if (tone === 'dark') {
    return {
      muted: 'text-white/90',
      label: 'text-white',
      title: 'text-white',
      titleOff: 'text-white/70',
      accent: MOSAIC.mint,
      chipOn: 'bg-white/15 text-white',
      chipOff: 'bg-white/10 text-white/75',
      border: 'border border-white/25',
    }
  }
  return {
    muted: 'text-[#121314]/90',
    label: 'text-[#121314]',
    title: 'text-[#121314]',
    titleOff: 'text-[#121314]/75',
    accent: '#121314',
    chipOn: 'bg-[#121314]/18 text-[#121314]',
    chipOff: 'bg-[#121314]/10 text-[#121314]/80',
    border: 'border border-[#121314]/12',
  }
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? MOSAIC.mint : MOSAIC.charcoal }}
    >
      <span
        className={`absolute size-3.5 rounded-full bg-[#121314] shadow transition-transform ${
          on ? 'translate-x-[18px]' : 'translate-x-[3px]'
        }`}
      />
    </span>
  )
}

function FeaturesHeader({
  title,
  detail,
  shell,
  onCount,
}: {
  title: string
  detail?: string
  shell: MosaicShell
  onCount?: number
}) {
  const t = toneClasses(shell.tone)
  return (
    <section
      className={`flex h-full flex-col gap-3 p-4 sm:p-5 ${t.border}`}
      style={{ background: shell.bg }}
    >
      <header className="flex items-center justify-between gap-3">
        <h3
          className={`flex items-center gap-2 text-[12px] font-bold tracking-[0.1em] uppercase ${t.label}`}
        >
          <Icon icon="mdi:toggle-switch" className="size-3.5" style={{ color: MOSAIC.mint }} />
          {title}
        </h3>
        {typeof onCount === 'number' ? (
          <span
            className="flex items-center gap-1.5 text-[13px] font-bold tabular-nums"
            style={{ color: MOSAIC.mint }}
          >
            <span className="relative inline-flex size-2">
              <span
                className="absolute inset-0 animate-ping rounded-full motion-reduce:hidden"
                style={{ background: `${MOSAIC.mint}80` }}
              />
              <span className="relative size-2 rounded-full" style={{ background: MOSAIC.mint }} />
            </span>
            {onCount} on
          </span>
        ) : null}
      </header>
      <p className={`text-[13px] leading-relaxed ${t.muted}`}>{detail ?? FEATURES_BLURB}</p>
      <p className={`mt-auto text-[12px] ${t.muted}`}>
        {MODULE_COUNT} modules in the rack · drag any tile
      </p>
    </section>
  )
}

function ModuleSwitch({
  rack,
  label,
  detail,
  icon,
  enabled,
  shell,
  onToggle,
}: {
  rack: Rack
  label: string
  detail: string
  icon: string
  enabled: boolean
  shell: MosaicShell
  onToggle?: () => void
}) {
  const t = toneClasses(shell.tone)
  return (
    <section
      className={`flex h-full flex-col gap-2 p-3.5 sm:p-4 ${t.border} ${
        enabled ? '' : 'grayscale-[0.35]'
      }`}
      style={{ background: shell.bg }}
    >
      <header className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold tracking-[0.1em] uppercase ${t.label}`}>
          {rack}
        </span>
        {onToggle ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg"
            aria-pressed={enabled}
            aria-label={`${label} ${enabled ? 'on' : 'off'}`}
          >
            <Toggle on={enabled} />
          </button>
        ) : (
          <Toggle on={enabled} />
        )}
      </header>
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`truncate text-[18px] font-bold tracking-tight ${
              enabled ? t.title : t.titleOff
            }`}
          >
            {label}
          </p>
          {enabled ? (
            <p className={`mt-1 line-clamp-2 text-[12px] leading-snug ${t.muted}`}>{detail}</p>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              <p className={`text-[12px] font-bold uppercase tracking-wide ${t.muted}`}>off</p>
              {onToggle ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggle()
                  }}
                  className="inline-flex min-h-11 w-fit items-center rounded-lg text-[12px] font-bold"
                  style={{ color: '#0A7A3E' }}
                >
                  Turn on
                </button>
              ) : null}
            </div>
          )}
        </div>
        <span
          className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${
            enabled ? t.chipOn : t.chipOff
          }`}
        >
          <Icon icon={icon} className="size-4" />
        </span>
      </div>
    </section>
  )
}

function ContentTile({
  shell,
  eyebrow,
  title,
  detail,
  icon,
}: {
  shell: MosaicShell
  eyebrow?: string
  title: string
  detail?: string
  icon?: string
}) {
  const t = toneClasses(shell.tone)
  return (
    <section
      className={`flex h-full flex-col gap-2 p-3.5 sm:p-4 ${t.border}`}
      style={{ background: shell.bg }}
    >
      {eyebrow ? (
        <p className={`text-[11px] font-bold tracking-[0.1em] uppercase ${t.label}`}>{eyebrow}</p>
      ) : null}
      <div className="mt-auto flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate text-[18px] font-bold tracking-tight ${t.title}`}>{title}</p>
          {detail ? (
            <p className={`mt-1 line-clamp-3 text-[12px] leading-snug ${t.muted}`}>{detail}</p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${t.chipOn}`}
          >
            <Icon icon={icon} className="size-4" />
          </span>
        ) : null}
      </div>
    </section>
  )
}

function MarketingCta({
  title,
  detail,
  icon,
  shell,
}: {
  title: string
  detail?: string
  icon?: string
  shell: MosaicShell
}) {
  const t = toneClasses(shell.tone)
  return (
    <section
      className={`flex h-full flex-col gap-2 p-3.5 sm:p-4 ${t.border}`}
      style={{ background: shell.bg }}
    >
      <div className="mt-auto flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[20px] font-extrabold leading-tight tracking-tight sm:text-[22px] ${t.title}`}
          >
            {title}
          </p>
          {detail ? (
            <p className={`mt-1 text-[17px] font-bold leading-snug sm:text-[18px] ${t.title}`}>
              {detail}
            </p>
          ) : null}
        </div>
        {icon ? (
          <span
            className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg ${t.chipOn}`}
          >
            <Icon icon={icon} className="size-5" />
          </span>
        ) : null}
      </div>
    </section>
  )
}

function renderWidgetContent(
  widget: Widget,
  onCount: number,
  enabledMap: Record<string, boolean>,
  onToggle: (id: string) => void,
) {
  const enabled =
    widget.kind === 'module-switch' ? (enabledMap[widget.id] ?? !!widget.enabled) : !!widget.enabled
  const shell = shellOf(widget, enabled)
  switch (widget.kind) {
    case 'features-header':
      return (
        <FeaturesHeader
          title={widget.label ?? 'Admin › Features'}
          detail={widget.detail}
          shell={shell}
          onCount={widget.id === 'features-header' ? onCount : undefined}
        />
      )
    case 'module-switch':
      return (
        <ModuleSwitch
          rack={widget.rack ?? 'core'}
          label={widget.label ?? widget.id}
          detail={widget.detail ?? ''}
          icon={widget.icon ?? 'mdi:puzzle-outline'}
          enabled={enabled}
          shell={shell}
          onToggle={() => onToggle(widget.id)}
        />
      )
    case 'setup-step':
      return (
        <ContentTile
          shell={shell}
          eyebrow={widget.stepN}
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
        />
      )
    case 'access-layer':
  return (
        <ContentTile
          shell={shell}
          eyebrow={`Layer ${widget.stepN}`}
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
        />
      )
    case 'access-role':
          return (
        <ContentTile
          shell={shell}
          eyebrow="Role"
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
        />
      )
    case 'pricing-card':
      return (
        <ContentTile
          shell={shell}
          eyebrow="Commercial"
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
        />
      )
    case 'overview-stat':
  return (
        <ContentTile
          shell={shell}
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
        />
      )
    case 'marketing-cta':
  return (
        <MarketingCta
          title={widget.label ?? ''}
          detail={widget.detail}
          icon={widget.icon}
          shell={shell}
        />
      )
    default: {
      const _exhaustive: never = widget.kind
      return _exhaustive
    }
  }
}

export interface DemoBoardProps {
  items: Widget[]
  maxColumns?: number
  /** When set, column count never reflows with width (tiles shrink instead). */
  fixedColumns?: number
  cellSize?: number
  gap?: number
  radius?: number
  className?: string
  title?: string
  /** Board strip label left of Arrange. */
  stripLabel?: string
}

/**
 * Desktop boards lock to 3 columns so a 9-cell set stays a 3×3
 * (wide tiles span 2). Set to `false` to restore width-based column reflow.
 */
export const LOCK_DESKTOP_BOARD_COLUMNS = true

/** Column count when `LOCK_DESKTOP_BOARD_COLUMNS` is on (3×3 cell topology). */
export const DESKTOP_BOARD_COLUMNS = 3

const NUDGE_SESSION_KEY = 'blokhr_apex_board_nudge_v1'
const DEMO_FLIP_SESSION_KEY = 'blokhr_apex_board_demo_flip_v1'

export function DemoBoard({
  items,
  maxColumns = 4,
  fixedColumns,
  cellSize = 180,
  gap = 12,
  radius = MOSAIC.radiusPx,
  className = '',
  title = '13blok module board',
  stripLabel = 'Adding a feature takes one click, not a project',
}: DemoBoardProps) {
  const [live, setLive] = useState(true)
  const [arranging, setArranging] = useState(false)
  const [nudgeItemId, setNudgeItemId] = useState<string | null>(null)
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const w of items) {
      if (w.kind === 'module-switch') init[w.id] = !!w.enabled
    }
    return init
  })

  const switches = useMemo(() => items.filter((w) => w.kind === 'module-switch'), [items])
  const initialOn = useMemo(
    () => switches.filter((w) => w.enabled).length,
    [switches],
  )
  const boardOn = useMemo(
    () => switches.filter((w) => enabledMap[w.id]).length,
    [switches, enabledMap],
  )
  const liveOn = BOARD_BASE_ON + (boardOn - initialOn)
  const byId = useMemo(() => new Map(items.map((w) => [w.id, w])), [items])

  const toggle = (id: string) => {
    setEnabledMap((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setLive(false)
  }, [])

  useEffect(() => {
    if (!live || arranging) return
    try {
      if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return
    } catch {
      return
    }
    const target =
      items.find((w) => w.size === 'sm')?.id ?? items[1]?.id ?? items[0]?.id ?? null
    if (!target) return
    const start = window.setTimeout(() => {
      setNudgeItemId(target)
      try {
        sessionStorage.setItem(NUDGE_SESSION_KEY, '1')
      } catch {
        /* private mode */
      }
    }, 700)
    const end = window.setTimeout(() => setNudgeItemId(null), 700 + 1100)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(end)
    }
  }, [items, live, arranging])

  useEffect(() => {
    if (arranging) setNudgeItemId(null)
  }, [arranging])

  useEffect(() => {
    if (!live) return
    try {
      if (sessionStorage.getItem(DEMO_FLIP_SESSION_KEY)) return
    } catch {
      return
    }
    const offId = switches.find((w) => !(enabledMap[w.id] ?? w.enabled))?.id
    if (!offId) return
    const timer = window.setTimeout(() => {
      setEnabledMap((prev) => {
        if (prev[offId]) return prev
        return { ...prev, [offId]: true }
      })
      try {
        sessionStorage.setItem(DEMO_FLIP_SESSION_KEY, '1')
      } catch {
        /* private mode */
      }
    }, 2200)
    return () => window.clearTimeout(timer)
    // Run once after settle using initial off tile; do not re-run on enabledMap changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot demo beat
  }, [live, switches])

  return (
    <section aria-labelledby="blok-module-board-title" className={className}>
      <div
        className="mb-3 flex min-h-11 items-center gap-2 rounded-[14px] border border-[#121314]/12 px-3 py-1.5"
        style={{ borderRadius: MOSAIC.radiusPx }}
      >
        <h2 id="blok-module-board-title" className="sr-only">
          {title}
        </h2>
        <p
          className="min-w-0 flex-1 text-[13px] font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-[14px]"
          style={{ fontFamily: 'var(--font-display), "Space Grotesk", system-ui, sans-serif' }}
        >
          {stripLabel}
        </p>
        <button
          type="button"
          onClick={() => setArranging((v) => !v)}
          aria-pressed={arranging}
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[14px] border px-3 text-[12px] font-bold tracking-wide transition-colors ${
            arranging
              ? 'border-[#121314] bg-[#121314] text-white dark:border-white dark:bg-white dark:text-[#121314]'
              : 'border-[#121314]/12 text-[#121314] hover:bg-[#121314]/5 dark:border-white/25 dark:text-white'
          }`}
        >
          <Icon
            icon={arranging ? 'mdi:check' : 'mdi:cursor-move'}
            className="size-3.5"
            aria-hidden
          />
          {arranging ? 'Done' : 'Arrange'}
        </button>
          </div>
      <div data-live={live ? '1' : '0'}>
        <DraggableWidgetGrid
          key={items.map((w) => w.id).join('|')}
          items={items}
          plainShell
          editable
          jiggle={arranging && live}
          nudgeItemId={nudgeItemId}
          renderItem={(item) => {
            const widget = byId.get(item.id)
            if (!widget) return null
            return renderWidgetContent(widget, liveOn, enabledMap, toggle)
          }}
          maxColumns={maxColumns}
          fixedColumns={fixedColumns}
          cellSize={cellSize}
          gap={gap}
          radius={radius}
        />
      </div>
      </section>
  )
}
