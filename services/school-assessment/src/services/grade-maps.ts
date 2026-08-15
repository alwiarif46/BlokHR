/**
 * CBSE 9-point grades (A1…E). E is fail (<33).
 * Boundaries inclusive on the lower side except E.
 */
export type Cbse9Grade = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'D' | 'E';

export function mapCbse9Point(pct: number): { grade: Cbse9Grade; pass: boolean } {
  if (!Number.isFinite(pct)) return { grade: 'E', pass: false };
  if (pct >= 91) return { grade: 'A1', pass: true };
  if (pct >= 81) return { grade: 'A2', pass: true };
  if (pct >= 71) return { grade: 'B1', pass: true };
  if (pct >= 61) return { grade: 'B2', pass: true };
  if (pct >= 51) return { grade: 'C1', pass: true };
  if (pct >= 41) return { grade: 'C2', pass: true };
  if (pct >= 33) return { grade: 'D', pass: true };
  return { grade: 'E', pass: false };
}

/**
 * MSBSHSE SSC 6-grade scale (A–F). F is fail (<20).
 */
export type MsbshseSscGrade = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export function mapMsbshseSsc(pct: number): { grade: MsbshseSscGrade; pass: boolean } {
  if (!Number.isFinite(pct)) return { grade: 'F', pass: false };
  if (pct >= 75) return { grade: 'A', pass: true };
  if (pct >= 60) return { grade: 'B', pass: true };
  if (pct >= 45) return { grade: 'C', pass: true };
  if (pct >= 35) return { grade: 'D', pass: true };
  if (pct >= 20) return { grade: 'E', pass: true };
  return { grade: 'F', pass: false };
}
