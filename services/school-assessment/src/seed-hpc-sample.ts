/**
 * SAMPLE SEED — replace with full PARAKH competency import.
 * 27 global competencies: foundational, middle, secondary × 3 abilities × 3.
 */
import { v4 as uuidv4 } from 'uuid';
import type { SchoolAssessmentDb } from './db';

const STAGES = ['foundational', 'middle', 'secondary'] as const;
const ABILITIES = ['awareness', 'sensitivity', 'creativity'] as const;

export const SAMPLE_HPC_COMPETENCY_COUNT = 27;

export async function seedSampleHpcCompetencies(db: SchoolAssessmentDb): Promise<void> {
  const existing = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM competencies WHERE tenant_id IS NULL`,
  );
  if (Number(existing?.c ?? 0) >= SAMPLE_HPC_COMPETENCY_COUNT) return;

  let n = 0;
  for (const stage of STAGES) {
    for (const ability of ABILITIES) {
      for (let i = 1; i <= 3; i++) {
        n += 1;
        await db.run(
          `INSERT INTO competencies (id, tenant_id, stage, ability, subject_area, label)
           VALUES (?, NULL, ?, ?, NULL, ?)`,
          [
            uuidv4(),
            stage,
            ability,
            `SAMPLE SEED: ${stage}/${ability} competency ${i}`,
          ],
        );
      }
    }
  }
  if (n !== SAMPLE_HPC_COMPETENCY_COUNT) {
    throw new Error(`HPC sample seed expected ${SAMPLE_HPC_COMPETENCY_COUNT}, got ${n}`);
  }
}
