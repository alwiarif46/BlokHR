import type {
  BlueprintBucket,
  BlueprintRule,
  ItemAnalysisItem,
  ItemAnalysisResultRow,
  PaperConformanceReport,
  Question,
  QuestionKind,
} from '../types-questions';

export function questionBucket(q: {
  kind: QuestionKind;
  competencyStyle: boolean;
}): BlueprintBucket {
  if (q.kind === 'case_based' || q.kind === 'source_based' || q.competencyStyle) {
    return 'competency';
  }
  if (q.kind === 'mcq') return 'objective';
  return 'short_long';
}

export function checkPaperConformance(
  blueprint: { totalMarks: number; rules: BlueprintRule[] },
  questions: Question[],
  questionIds: string[],
): PaperConformanceReport {
  const duplicates = [
    ...new Set(
      questionIds.filter((id, i) => questionIds.indexOf(id) !== i),
    ),
  ];

  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);
  const expectedTotalMarks = blueprint.totalMarks;
  const totalMarksPass = totalMarks === expectedTotalMarks;

  const byBucket: Record<BlueprintBucket, number> = {
    competency: 0,
    objective: 0,
    short_long: 0,
  };
  for (const q of questions) {
    byBucket[questionBucket(q)] += q.marks;
  }

  const buckets = blueprint.rules.map((rule) => {
    const actualPct =
      totalMarks === 0 ? 0 : Math.round((byBucket[rule.bucket] / totalMarks) * 1000) / 10;
    const pass = Math.abs(actualPct - rule.pct) <= 2;
    return {
      bucket: rule.bucket,
      expectedPct: rule.pct,
      actualPct,
      pass,
    };
  });

  const outcomeCoverage = [
    ...new Set(
      questions
        .map((q) => q.outcomeCode)
        .filter((c): c is string => c != null && c.trim() !== ''),
    ),
  ].sort();

  const pass =
    totalMarksPass &&
    duplicates.length === 0 &&
    buckets.every((b) => b.pass);

  return {
    pass,
    totalMarks,
    expectedTotalMarks,
    totalMarksPass,
    buckets,
    duplicates,
    outcomeCoverage,
  };
}

/** Pearson correlation; null if undefined (zero variance). */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n === 0 || n !== ys.length) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  if (denX === 0 || denY === 0) return null;
  return Math.round((num / Math.sqrt(denX * denY)) * 10000) / 10000;
}

/**
 * Item analysis: p-value = mean(score/max); discrimination = point-biserial
 * (Pearson of item scores vs student totals).
 */
export function analyzeItems(results: ItemAnalysisResultRow[]): ItemAnalysisItem[] {
  if (results.length === 0) return [];
  const nStudents = results[0]!.scores.length;
  if (results.some((r) => r.scores.length !== nStudents || r.max <= 0)) {
    throw new Error('invalid analysis vectors');
  }

  const totals: number[] = Array.from({ length: nStudents }, () => 0);
  for (const r of results) {
    for (let i = 0; i < nStudents; i++) {
      totals[i]! += r.scores[i]!;
    }
  }

  return results.map((r) => {
    const proportions = r.scores.map((s) => s / r.max);
    const pValue =
      Math.round(
        (proportions.reduce((a, b) => a + b, 0) / proportions.length) * 10000,
      ) / 10000;
    const discrimination = pearsonCorrelation(r.scores, totals);
    const review =
      pValue < 0.2 ||
      pValue > 0.9 ||
      discrimination == null ||
      discrimination < 0.15;
    return {
      questionId: r.questionId,
      pValue,
      discrimination,
      review,
    };
  });
}
