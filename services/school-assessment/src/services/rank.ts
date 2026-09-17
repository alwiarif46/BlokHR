/**
 * Pure rank helpers for report-card cohort ranking (Phase 2).
 * Tie = same rank, next skips (1, 1, 3). Exempt / no score → rank null.
 */

export interface RankCandidate {
  studentId: string;
  percentage: number | null;
  /** true → excluded from ranked pool */
  exempt: boolean;
}

export interface RankResult {
  studentId: string;
  rank: number | null;
  outOf: number;
  percentage: number | null;
}

/**
 * Compute dense-skip ranks for a cohort.
 * Only non-exempt candidates with a finite percentage enter the pool.
 */
export function computeCohortRanks(candidates: RankCandidate[]): RankResult[] {
  const pool = candidates.filter(
    (c) => !c.exempt && c.percentage != null && Number.isFinite(c.percentage),
  );
  const outOf = pool.length;
  const sorted = [...pool].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0));

  const rankByStudent = new Map<string, number>();
  let i = 0;
  while (i < sorted.length) {
    const pct = sorted[i]!.percentage!;
    let j = i;
    while (j < sorted.length && sorted[j]!.percentage === pct) j += 1;
    const rank = i + 1;
    for (let k = i; k < j; k++) {
      rankByStudent.set(sorted[k]!.studentId, rank);
    }
    i = j;
  }

  return candidates.map((c) => ({
    studentId: c.studentId,
    percentage: c.exempt ? null : c.percentage,
    outOf,
    rank: c.exempt || c.percentage == null ? null : (rankByStudent.get(c.studentId) ?? null),
  }));
}
