import { v4 as uuidv4 } from 'uuid';
import type { TimetableRepository } from '../repositories/timetable-repository';
import type {
  Exclusion,
  GenerateInstancesResult,
  PeriodInstance,
  PeriodLostReason,
  Section,
  Slot,
} from '../types';

const WEEKDAY_REFS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface GenerateInstancesError {
  error: string;
  status: number;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return next;
}

function findExclusionForSection(
  exclusions: Exclusion[],
  date: string,
  classLabel: string,
): Exclusion | null {
  const school = exclusions.find((e) => e.date === date && e.scope === 'school');
  if (school) return school;
  const classEx = exclusions.find(
    (e) => e.date === date && e.scope === 'class' && e.classLabel === classLabel,
  );
  return classEx ?? null;
}

function mapExclusionReason(reason: Exclusion['reason']): PeriodLostReason {
  switch (reason) {
    case 'holiday':
      return 'holiday';
    case 'exam':
      return 'exam';
    case 'event':
      return 'event';
    case 'other':
      return 'other';
    default: {
      const _exhaustive: never = reason;
      return _exhaustive;
    }
  }
}

/**
 * Generates period_instances for a section over a date range.
 * Cyclic schemes advance only on non-Sunday, non-fully-excluded days.
 */
export async function generateInstances(
  repo: TimetableRepository,
  tenantId: string,
  sectionId: string,
  from: string,
  to: string,
): Promise<{ result?: GenerateInstancesResult; error?: GenerateInstancesError }> {
  const section = await repo.getSection(tenantId, sectionId);
  if (!section) return { error: { error: 'Section not found', status: 404 } };

  const scheme = await repo.getDayScheme(tenantId, section.daySchemeId);
  if (!scheme) return { error: { error: 'day_scheme not found', status: 404 } };

  const slots = await repo.listSlotsForSection(tenantId, sectionId);
  const slotsByDay = new Map<string, Slot[]>();
  for (const slot of slots) {
    const list = slotsByDay.get(slot.dayRef) ?? [];
    list.push(slot);
    slotsByDay.set(slot.dayRef, list);
  }

  const exclusions = await repo.listExclusions(tenantId, { from, to });
  const counts: GenerateInstancesResult = { created: 0, lost: 0, skipped: 0 };

  let cyclePos = 0;
  const cycleLength = scheme.kind === 'cyclic' ? scheme.cycleLength ?? 0 : 0;

  let cursor = parseIsoDate(from);
  const end = parseIsoDate(to);

  while (cursor <= end) {
    const dateStr = formatIsoDate(cursor);
    const dow = cursor.getDay();

    if (dow === 0) {
      cursor = addDays(cursor, 1);
      continue;
    }

    const exclusion = findExclusionForSection(exclusions, dateStr, section.classLabel);
    const fullyExcluded = exclusion != null;

    let dayRef: string;
    if (scheme.kind === 'weekly') {
      dayRef = WEEKDAY_REFS[dow];
    } else {
      if (cycleLength < 1) {
        return { error: { error: 'cyclic scheme missing cycle_length', status: 400 } };
      }
      dayRef = `d${cyclePos + 1}`;
    }

    const daySlots = slotsByDay.get(dayRef) ?? [];
    for (const slot of daySlots) {
      const outcome = await upsertGeneratedInstance(repo, {
        tenantId,
        section,
        date: dateStr,
        slot,
        lost: fullyExcluded,
        lostReason: exclusion ? mapExclusionReason(exclusion.reason) : null,
      });
      counts[outcome] += 1;
    }

    if (scheme.kind === 'cyclic' && !fullyExcluded) {
      cyclePos = (cyclePos + 1) % cycleLength;
    }

    cursor = addDays(cursor, 1);
  }

  return { result: counts };
}

async function upsertGeneratedInstance(
  repo: TimetableRepository,
  args: {
    tenantId: string;
    section: Section;
    date: string;
    slot: Slot;
    lost: boolean;
    lostReason: PeriodLostReason | null;
  },
): Promise<'created' | 'lost' | 'skipped'> {
  const { tenantId, section, date, slot, lost, lostReason } = args;
  const existing = await repo.findPeriodInstance(
    tenantId,
    section.id,
    date,
    slot.periodIndex,
  );

  const desiredStatus = lost ? 'lost' : 'scheduled';
  const desiredReason = lost ? lostReason : null;

  if (existing) {
    if (existing.status === 'held') {
      return 'skipped';
    }
    const unchanged =
      existing.status === desiredStatus &&
      existing.lostReason === desiredReason &&
      existing.allocationId === slot.allocationId;
    if (unchanged) {
      return 'skipped';
    }
    const updated: PeriodInstance = {
      ...existing,
      allocationId: slot.allocationId,
      status: desiredStatus,
      lostReason: desiredReason,
      source: 'generated',
    };
    await repo.updatePeriodInstance(tenantId, existing.id, updated);
    return lost ? 'lost' : 'skipped';
  }

  await repo.insertPeriodInstance({
    id: uuidv4(),
    tenantId,
    sectionId: section.id,
    date,
    periodIndex: slot.periodIndex,
    allocationId: slot.allocationId,
    status: desiredStatus,
    lostReason: desiredReason,
    source: 'generated',
    createdAt: '',
    updatedAt: '',
  });
  return lost ? 'lost' : 'created';
}
