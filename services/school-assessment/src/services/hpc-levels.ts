import type { HpcLevel } from '../types-hpc';

export const HPC_LEVEL_RANK: Record<HpcLevel, number> = {
  beginner: 0,
  proficient: 1,
  advanced: 2,
};

export function deriveLevelFromCircled(circled: number): HpcLevel | null {
  if (!Number.isInteger(circled) || circled < 0 || circled > 6) return null;
  if (circled <= 2) return 'beginner';
  if (circled <= 4) return 'proficient';
  return 'advanced';
}

/** Majority of teacher levels; tie ⇒ higher level. */
export function majorityLevel(levels: HpcLevel[]): HpcLevel | null {
  if (levels.length === 0) return null;
  const counts: Record<HpcLevel, number> = {
    beginner: 0,
    proficient: 0,
    advanced: 0,
  };
  for (const l of levels) counts[l] += 1;
  let best: HpcLevel | null = null;
  let bestCount = -1;
  for (const level of ['beginner', 'proficient', 'advanced'] as HpcLevel[]) {
    const c = counts[level];
    if (c > bestCount) {
      bestCount = c;
      best = level;
    } else if (c === bestCount && best != null && HPC_LEVEL_RANK[level] > HPC_LEVEL_RANK[best]) {
      best = level;
    }
  }
  return best;
}
