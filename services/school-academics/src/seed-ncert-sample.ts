/**
 * SAMPLE SEED — replace with full NCERT import.
 * 30 global NCERT learning outcomes: classes 1,5,8 × subjects M,Sc,E.
 */
import { v4 as uuidv4 } from 'uuid';
import type { SchoolAcademicsDb } from './db';

type SeedRow = {
  code: string;
  classLabel: string;
  subjectCode: string;
  description: string;
};

const SUBJECT_NAMES: Record<string, string> = {
  M: 'Mathematics',
  Sc: 'Science',
  E: 'English',
};

const THEMES = [
  'observes and describes everyday patterns',
  'applies concepts to simple problems',
  'communicates ideas with evidence',
  'connects classroom learning to daily life',
];

/** Fixed plan → exactly 30 sample rows. */
const SEED_PLAN: Array<{ cls: string; sub: string; n: number }> = [
  { cls: '1', sub: 'M', n: 4 },
  { cls: '1', sub: 'Sc', n: 3 },
  { cls: '1', sub: 'E', n: 3 },
  { cls: '5', sub: 'M', n: 4 },
  { cls: '5', sub: 'Sc', n: 3 },
  { cls: '5', sub: 'E', n: 3 },
  { cls: '8', sub: 'M', n: 4 },
  { cls: '8', sub: 'Sc', n: 3 },
  { cls: '8', sub: 'E', n: 3 },
];

function buildSampleSeeds(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const p of SEED_PLAN) {
    const subName = SUBJECT_NAMES[p.sub] ?? p.sub;
    for (let i = 1; i <= p.n; i++) {
      rows.push({
        code: `${p.cls}.${p.sub}.LO${i}`,
        classLabel: p.cls,
        subjectCode: p.sub,
        description: `${subName} Class ${p.cls}: ${THEMES[(i - 1) % THEMES.length]}`,
      });
    }
  }
  return rows;
}

export const SAMPLE_NCERT_SEED_COUNT = 30;

export async function seedSampleNcertOutcomes(db: SchoolAcademicsDb): Promise<void> {
  const existing = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM learning_outcomes WHERE tenant_id IS NULL`,
  );
  if (Number(existing?.c ?? 0) > 0) return;

  const seeds = buildSampleSeeds();
  if (seeds.length !== SAMPLE_NCERT_SEED_COUNT) {
    throw new Error(
      `SAMPLE SEED expected ${SAMPLE_NCERT_SEED_COUNT} rows, got ${seeds.length}`,
    );
  }

  for (const seed of seeds) {
    await db.run(
      `INSERT INTO learning_outcomes (
         id, tenant_id, code, class_label, subject_code, description, framework
       ) VALUES (?, NULL, ?, ?, ?, ?, 'ncert')`,
      [uuidv4(), seed.code, seed.classLabel, seed.subjectCode, seed.description],
    );
  }
}
