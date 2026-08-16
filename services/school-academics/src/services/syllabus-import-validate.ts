/**
 * Shared P3-07 syllabus unit validation (used by importSyllabus + pack registry).
 */
import type { ImportUnit, SyllabusUnitImport } from '../types';

export function validateImportUnits(unitsRaw: unknown[]): {
  units: SyllabusUnitImport[];
  errors: string[];
} {
  const unitsIn: SyllabusUnitImport[] = [];
  const errors: string[] = [];

  if (!Array.isArray(unitsRaw)) {
    return { units: [], errors: ['units array required'] };
  }

  unitsRaw.forEach((row, ui) => {
    if (!row || typeof row !== 'object') {
      errors.push(`units[${ui}]: invalid`);
      return;
    }
    const u = row as Record<string, unknown>;
    const label = String(u.label ?? '').trim();
    if (!label) errors.push(`units[${ui}].label required`);
    const weeks = Number(u.planned_weeks ?? u.plannedWeeks);
    if (!Number.isFinite(weeks) || weeks <= 0) {
      errors.push(`units[${ui}].planned_weeks must be positive`);
    }
    const topicsRaw = Array.isArray(u.topics) ? u.topics : null;
    if (!topicsRaw || topicsRaw.length === 0) {
      errors.push(`units[${ui}].topics required`);
    }
    const topics: SyllabusUnitImport['topics'] = [];
    if (topicsRaw) {
      topicsRaw.forEach((tRow, ti) => {
        const t = (tRow ?? {}) as Record<string, unknown>;
        const tLabel = String(t.label ?? '').trim();
        if (!tLabel) errors.push(`units[${ui}].topics[${ti}].label required`);
        let estimatedPeriods: number | undefined;
        if (t.estimated_periods !== undefined || t.estimatedPeriods !== undefined) {
          const p = Number(t.estimated_periods ?? t.estimatedPeriods);
          if (!Number.isInteger(p) || p < 1) {
            errors.push(`units[${ui}].topics[${ti}].estimated_periods invalid`);
          } else {
            estimatedPeriods = p;
          }
        }
        topics.push({ label: tLabel, estimatedPeriods });
      });
    }
    let plannedStartWeek: number | null | undefined;
    if (u.planned_start_week !== undefined || u.plannedStartWeek !== undefined) {
      const rawStart = u.planned_start_week ?? u.plannedStartWeek;
      plannedStartWeek = rawStart === null ? null : Number(rawStart);
    }
    const codesRaw = (u.outcome_codes ?? u.outcomeCodes) as unknown;
    const outcomeCodes = Array.isArray(codesRaw)
      ? codesRaw.map((c) => String(c).trim()).filter(Boolean)
      : undefined;
    unitsIn.push({
      label,
      plannedWeeks: weeks,
      plannedStartWeek,
      summary: u.summary != null ? String(u.summary) : null,
      topics,
      outcomeCodes,
    });
  });

  return { units: unitsIn, errors };
}

/** Re-export wire type for pack authors. */
export type { ImportUnit };
