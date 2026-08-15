import { describe, it, expect } from 'vitest';
import {
  analyzeItems,
  checkPaperConformance,
  pearsonCorrelation,
  questionBucket,
} from '../src/services/item-analysis';
import type { Question } from '../src/types';

function q(
  partial: Partial<Question> & Pick<Question, 'id' | 'kind' | 'marks'>,
): Question {
  return {
    tenantId: 't1',
    subjectCode: 'Sc',
    classLabel: '10',
    outcomeCode: null,
    competencyStyle: false,
    body: {},
    answer: null,
    provenance: 'human',
    timesUsed: 0,
    createdAt: '',
    updatedAt: '',
    ...partial,
  };
}

describe('item-analysis pure functions (P4-03)', () => {
  it('maps question kinds to blueprint buckets', () => {
    expect(questionBucket({ kind: 'mcq', competencyStyle: false })).toBe('objective');
    expect(questionBucket({ kind: 'case_based', competencyStyle: false })).toBe('competency');
    expect(questionBucket({ kind: 'source_based', competencyStyle: false })).toBe('competency');
    expect(questionBucket({ kind: 'sa', competencyStyle: true })).toBe('competency');
    expect(questionBucket({ kind: 'vsa', competencyStyle: false })).toBe('short_long');
    expect(questionBucket({ kind: 'la', competencyStyle: false })).toBe('short_long');
  });

  it.each([
    {
      name: 'hand-computed p and discrimination',
      results: [
        { questionId: 'q1', scores: [1, 1, 1, 0, 0], max: 1 },
        { questionId: 'q2', scores: [1, 1, 0, 0, 0], max: 1 },
      ],
      expected: [
        { questionId: 'q1', pValue: 0.6, discrimination: 0.9129, review: false },
        { questionId: 'q2', pValue: 0.4, discrimination: 0.9129, review: false },
      ],
    },
    {
      name: 'flags extreme p-values',
      results: [
        { questionId: 'easy', scores: [1, 1, 1, 1, 1], max: 1 },
        { questionId: 'hard', scores: [0, 0, 0, 0, 1], max: 1 },
      ],
      expected: [
        { questionId: 'easy', pValue: 1, review: true },
        { questionId: 'hard', pValue: 0.2, review: true },
      ],
    },
    {
      name: 'flags low discrimination',
      results: [
        { questionId: 'flat', scores: [1, 1, 1, 1], max: 1 },
        { questionId: 'var', scores: [0, 1, 0, 1], max: 1 },
      ],
      expected: [{ questionId: 'flat', review: true }],
    },
  ])('$name', ({ results, expected }) => {
    const items = analyzeItems(results);
    for (const exp of expected) {
      const row = items.find((i) => i.questionId === exp.questionId)!;
      expect(row.pValue).toBe(exp.pValue ?? row.pValue);
      if (exp.discrimination !== undefined) {
        expect(row.discrimination).toBe(exp.discrimination);
      }
      expect(row.review).toBe(exp.review);
    }
  });

  it('pearson is null when variance is zero', () => {
    expect(pearsonCorrelation([1, 1, 1], [2, 3, 4])).toBeNull();
  });

  it('conformance pass within ±2pct; fail outside; duplicates', () => {
    const blueprint = {
      totalMarks: 100,
      rules: [
        { bucket: 'competency' as const, pct: 40 },
        { bucket: 'objective' as const, pct: 20 },
        { bucket: 'short_long' as const, pct: 40 },
      ],
    };
    const questions = [
      q({ id: 'a', kind: 'case_based', marks: 40, outcomeCode: '10.Sc.LO1' }),
      q({ id: 'b', kind: 'mcq', marks: 20 }),
      q({ id: 'c', kind: 'sa', marks: 40, outcomeCode: '10.Sc.LO2' }),
    ];
    const pass = checkPaperConformance(blueprint, questions, ['a', 'b', 'c']);
    expect(pass.pass).toBe(true);
    expect(pass.outcomeCoverage).toEqual(['10.Sc.LO1', '10.Sc.LO2']);

    const near = checkPaperConformance(
      blueprint,
      [
        q({ id: 'a', kind: 'case_based', marks: 38 }),
        q({ id: 'b', kind: 'mcq', marks: 22 }),
        q({ id: 'c', kind: 'sa', marks: 40 }),
      ],
      ['a', 'b', 'c'],
    );
    // 38% and 22% within ±2 of 40/20
    expect(near.buckets.every((b) => b.pass)).toBe(true);
    expect(near.totalMarksPass).toBe(true);

    const fail = checkPaperConformance(
      blueprint,
      [
        q({ id: 'a', kind: 'case_based', marks: 50 }),
        q({ id: 'b', kind: 'mcq', marks: 20 }),
        q({ id: 'c', kind: 'sa', marks: 30 }),
      ],
      ['a', 'b', 'c'],
    );
    expect(fail.pass).toBe(false);
    expect(fail.buckets.find((b) => b.bucket === 'competency')!.pass).toBe(false);

    const dup = checkPaperConformance(blueprint, questions, ['a', 'b', 'c', 'a']);
    expect(dup.duplicates).toEqual(['a']);
    expect(dup.pass).toBe(false);
  });
});
