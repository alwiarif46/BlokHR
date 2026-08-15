import { createHash } from 'crypto';
import type { NudgeCohort, NudgeTier } from '../types';

/**
 * Stable 0–99 bucket from student_id. Same id always maps to the same bucket.
 */
export function studentHoldoutBucket(studentId: string): number {
  const digest = createHash('sha256').update(studentId, 'utf8').digest();
  return digest.readUInt32BE(0) % 100;
}

export function assignCohort(studentId: string, holdoutPct: number): NudgeCohort {
  const pct = Math.max(0, Math.min(100, Math.floor(holdoutPct)));
  return studentHoldoutBucket(studentId) < pct ? 'holdout' : 'treatment';
}

/**
 * Percentile of `value` within `values` (higher value → higher percentile).
 * Uses average rank so ties share the same percentile.
 */
export function percentileOf(value: number, values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let less = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) less += 1;
    else if (v === value) equal += 1;
  }
  return ((less + equal * 0.5) / sorted.length) * 100;
}

export function classifyNudgeTier(args: {
  ytdAbsentDays: number;
  ytdWorkingDays: number;
  atRiskPct: number;
  chronicDays: number;
}): NudgeTier | null {
  if (args.ytdAbsentDays >= args.chronicDays) return 'chronic';
  const absencePct =
    args.ytdWorkingDays <= 0 ? 0 : (args.ytdAbsentDays / args.ytdWorkingDays) * 100;
  if (absencePct >= args.atRiskPct) return 'at_risk';
  return null;
}

export function isImproving(last30Pct: number, ytdPct: number): boolean {
  return last30Pct > ytdPct;
}
