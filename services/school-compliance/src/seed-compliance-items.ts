/**
 * SAMPLE SEED — global compliance calendar items.
 * Guidance marked VERIFY DATES ANNUALLY — statutory windows shift.
 */
import { v4 as uuidv4 } from 'uuid';
import type { SchoolComplianceDb } from './db';

const SEEDS: Array<{
  key: string;
  label: string;
  authority: string;
  dueRule: Record<string, unknown>;
  guidance: string;
}> = [
  {
    key: 'udise_freeze',
    label: 'UDISE+ data freeze',
    authority: 'udise',
    dueRule: { month: 9, day: 30 },
    guidance: 'VERIFY DATES ANNUALLY — typical freeze around 30 Sep.',
  },
  {
    key: 'cbse_loc',
    label: 'CBSE LOC submission window',
    authority: 'cbse',
    dueRule: {
      window_start: { m: 7, d: 1 },
      window_end: { m: 9, d: 30 },
    },
    guidance: 'VERIFY DATES ANNUALLY — LOC window typically Jul–Sep.',
  },
  {
    key: 'cbse_oasis',
    label: 'CBSE OASIS annual return',
    authority: 'cbse',
    dueRule: { month: 12, day: 31 },
    guidance: 'VERIFY DATES ANNUALLY — treat as annual year-end until board circular.',
  },
  {
    key: 'cisce_entry',
    label: 'CISCE entry window',
    authority: 'cisce',
    dueRule: {
      window_start: { m: 8, d: 1 },
      window_end: { m: 9, d: 30 },
    },
    guidance: 'VERIFY DATES ANNUALLY — entry window typically Aug–Sep.',
  },
];

export const SAMPLE_COMPLIANCE_ITEM_COUNT = SEEDS.length;

export async function seedGlobalComplianceItems(db: SchoolComplianceDb): Promise<void> {
  const existing = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM compliance_items WHERE tenant_id IS NULL`,
  );
  if (Number(existing?.c ?? 0) >= SAMPLE_COMPLIANCE_ITEM_COUNT) return;

  for (const seed of SEEDS) {
    await db.run(
      `INSERT INTO compliance_items (id, tenant_id, key, label, authority, due_rule_json, guidance)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        seed.key,
        seed.label,
        seed.authority,
        JSON.stringify(seed.dueRule),
        seed.guidance,
      ],
    );
  }
}
