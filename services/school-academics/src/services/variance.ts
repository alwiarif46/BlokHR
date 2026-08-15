/**
 * Pure variance / slippage computation (P3-05).
 * No I/O — BFF supplies timetable period instances.
 */

export interface VarianceUnitInput {
  id: string;
  label: string;
  plannedWeeks: number;
  /** Academic week number when the unit is planned to start; defaults to 1 if null/omitted. */
  plannedStartWeek: number | null;
  sequence: number;
}

export interface VarianceTopicInput {
  id: string;
  unitId: string;
  sequence: number;
}

export interface VarianceDeliveryInput {
  topicId: string;
  date: string;
}

export interface VarianceInstanceInput {
  id: string;
  /** Academic / calendar week index aligned with planned_start_week. */
  week: number;
  status: string;
  lostReason?: string | null;
  date?: string;
}

export interface WeekPoint {
  week: number;
  cumulativeTopics: number;
}

export interface UnitVariance {
  unitId: string;
  label: string;
  topicsTotal: number;
  topicsDelivered: number;
  plannedWindow: { startWeek: number; endWeek: number };
  actualWindow: { startWeek: number | null; endWeek: number | null };
  /** Positive = behind plan; negative = ahead. */
  slippageWeeks: number | null;
  lostPeriods: Array<{ reason: string; count: number }>;
}

export interface VarianceReport {
  plannedCurve: WeekPoint[];
  actualCurve: WeekPoint[];
  units: UnitVariance[];
  remainingTopics: number;
  trailingFourWeekRate: number;
  projectedCompletionDate: string | null;
  stalled: boolean;
  daysPastTarget: number | null;
}

/** ISO calendar week number (1–53) for an ISO date string. */
export function isoWeekNumber(isoDate: string): number {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  // Thursday in current week decides the year
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function plannedWindow(unit: VarianceUnitInput): { startWeek: number; endWeek: number } {
  const start = unit.plannedStartWeek != null && unit.plannedStartWeek > 0 ? unit.plannedStartWeek : 1;
  const weeks = unit.plannedWeeks > 0 ? unit.plannedWeeks : 1;
  const end = start + Math.ceil(weeks) - 1;
  return { startWeek: start, endWeek: end };
}

/** Topics expected completed by the end of `week` for one unit (even spread). */
function expectedTopicsByWeek(
  unit: VarianceUnitInput,
  topicCount: number,
  week: number,
): number {
  const { startWeek, endWeek } = plannedWindow(unit);
  if (topicCount === 0) return 0;
  if (week < startWeek) return 0;
  if (week >= endWeek) return topicCount;
  const span = endWeek - startWeek + 1;
  const progressed = week - startWeek + 1;
  return Math.min(topicCount, Math.floor((topicCount * progressed) / span));
}

/**
 * First-delivery week per topic (earliest delivery date → ISO week).
 */
function firstDeliveryWeekByTopic(
  deliveries: VarianceDeliveryInput[],
): Map<string, { week: number; date: string }> {
  const map = new Map<string, { week: number; date: string }>();
  for (const d of deliveries) {
    const week = isoWeekNumber(d.date);
    const prev = map.get(d.topicId);
    if (!prev || d.date < prev.date) {
      map.set(d.topicId, { week, date: d.date });
    }
  }
  return map;
}

export function computeVariance(
  units: VarianceUnitInput[],
  topics: VarianceTopicInput[],
  deliveries: VarianceDeliveryInput[],
  instances: VarianceInstanceInput[],
  opts: { targetDate?: string | null; asOfDate?: string | null } = {},
): VarianceReport {
  const sortedUnits = [...units].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const topicsByUnit = new Map<string, VarianceTopicInput[]>();
  for (const t of topics) {
    const list = topicsByUnit.get(t.unitId) ?? [];
    list.push(t);
    topicsByUnit.set(t.unitId, list);
  }
  for (const list of topicsByUnit.values()) {
    list.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  }

  const firstByTopic = firstDeliveryWeekByTopic(deliveries);
  const deliveredTopicIds = new Set(firstByTopic.keys());

  let minWeek = Infinity;
  let maxWeek = -Infinity;
  for (const u of sortedUnits) {
    const w = plannedWindow(u);
    minWeek = Math.min(minWeek, w.startWeek);
    maxWeek = Math.max(maxWeek, w.endWeek);
  }
  for (const v of firstByTopic.values()) {
    minWeek = Math.min(minWeek, v.week);
    maxWeek = Math.max(maxWeek, v.week);
  }
  for (const inst of instances) {
    minWeek = Math.min(minWeek, inst.week);
    maxWeek = Math.max(maxWeek, inst.week);
  }
  if (!Number.isFinite(minWeek)) {
    minWeek = 1;
    maxWeek = 1;
  }

  const plannedCurve: WeekPoint[] = [];
  const actualCurve: WeekPoint[] = [];
  for (let week = minWeek; week <= maxWeek; week++) {
    let planned = 0;
    for (const u of sortedUnits) {
      const count = (topicsByUnit.get(u.id) ?? []).length;
      planned += expectedTopicsByWeek(u, count, week);
    }
    plannedCurve.push({ week, cumulativeTopics: planned });

    let actual = 0;
    for (const [, info] of firstByTopic) {
      if (info.week <= week) actual++;
    }
    actualCurve.push({ week, cumulativeTopics: actual });
  }

  const unitReports: UnitVariance[] = [];
  for (const u of sortedUnits) {
    const unitTopics = topicsByUnit.get(u.id) ?? [];
    const delivered = unitTopics.filter((t) => deliveredTopicIds.has(t.id));
    const window = plannedWindow(u);

    let actualStart: number | null = null;
    let actualEnd: number | null = null;
    for (const t of delivered) {
      const info = firstByTopic.get(t.id)!;
      actualStart = actualStart == null ? info.week : Math.min(actualStart, info.week);
      actualEnd = actualEnd == null ? info.week : Math.max(actualEnd, info.week);
    }

    const slippageWeeks =
      actualEnd == null ? null : actualEnd - window.endWeek;

    const lostCounts = new Map<string, number>();
    if (actualStart != null && actualEnd != null) {
      for (const inst of instances) {
        if (inst.status !== 'lost') continue;
        if (inst.week < actualStart || inst.week > actualEnd) continue;
        const reason = (inst.lostReason || 'unspecified').trim() || 'unspecified';
        lostCounts.set(reason, (lostCounts.get(reason) ?? 0) + 1);
      }
    }
    const lostPeriods = [...lostCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => a.reason.localeCompare(b.reason));

    unitReports.push({
      unitId: u.id,
      label: u.label,
      topicsTotal: unitTopics.length,
      topicsDelivered: delivered.length,
      plannedWindow: window,
      actualWindow: { startWeek: actualStart, endWeek: actualEnd },
      slippageWeeks,
      lostPeriods,
    });
  }

  const totalTopics = topics.length;
  const remainingTopics = Math.max(0, totalTopics - deliveredTopicIds.size);

  // Trailing delivery rate: distinct topics first-delivered in the last up-to-4 weeks.
  const asOf =
    opts.asOfDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.asOfDate)
      ? opts.asOfDate
      : [...deliveries].map((d) => d.date).sort().at(-1) ??
        new Date().toISOString().slice(0, 10);
  const asOfWeek = isoWeekNumber(asOf);
  const rateWindowWeeks = Math.min(4, Math.max(1, asOfWeek - minWeek + 1));
  const windowStart = asOfWeek - rateWindowWeeks + 1;
  let topicsInWindow = 0;
  for (const info of firstByTopic.values()) {
    if (info.week >= windowStart && info.week <= asOfWeek) topicsInWindow++;
  }
  const trailingFourWeekRate = topicsInWindow / rateWindowWeeks;

  let projectedCompletionDate: string | null = null;
  let stalled = false;
  if (remainingTopics === 0) {
    projectedCompletionDate = asOf;
    stalled = false;
  } else if (trailingFourWeekRate <= 0) {
    projectedCompletionDate = null;
    stalled = true;
  } else {
    const weeksNeeded = Math.ceil(remainingTopics / trailingFourWeekRate);
    projectedCompletionDate = addDaysIso(asOf, weeksNeeded * 7);
    stalled = false;
  }

  let daysPastTarget: number | null = null;
  if (opts.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.targetDate)) {
    if (projectedCompletionDate) {
      const proj = Date.parse(`${projectedCompletionDate}T00:00:00.000Z`);
      const tgt = Date.parse(`${opts.targetDate}T00:00:00.000Z`);
      daysPastTarget = Math.round((proj - tgt) / 86_400_000);
    } else {
      daysPastTarget = null;
    }
  }

  return {
    plannedCurve,
    actualCurve,
    units: unitReports,
    remainingTopics,
    trailingFourWeekRate,
    projectedCompletionDate,
    stalled,
    daysPastTarget,
  };
}
