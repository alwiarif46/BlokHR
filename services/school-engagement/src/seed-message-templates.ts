/**
 * SAMPLE SEED — global absence_alert + attendance_nudge in en + hi (reviewed=1).
 */
import { v4 as uuidv4 } from 'uuid';
import type { SchoolEngagementDb } from './db';

const SEEDS: Array<{ key: string; lang: string; body: string; kind: string }> = [
  {
    key: 'absence_alert',
    lang: 'en',
    kind: 'transactional',
    body: 'Absence alert: {{student_name}} was marked absent on {{date}} ({{period_label}}).',
  },
  {
    key: 'absence_alert',
    lang: 'hi',
    kind: 'transactional',
    body: 'अनुपस्थिति: {{student_name}} को {{date}} ({{period_label}}) को अनुपस्थित चिह्नित किया गया।',
  },
  {
    key: 'attendance_nudge',
    lang: 'en',
    kind: 'informational',
    body: 'Reminder: please ensure {{student_name}} attends school. Ref {{date}}.',
  },
  {
    key: 'attendance_nudge',
    lang: 'hi',
    kind: 'informational',
    body: 'अनुस्मारक: कृपया सुनिश्चित करें कि {{student_name}} विद्यालय आएँ। संदर्भ {{date}}।',
  },
  {
    key: 'digest',
    lang: 'en',
    kind: 'informational',
    body: 'Daily digest:\n{{items}}',
  },
  {
    key: 'digest',
    lang: 'hi',
    kind: 'informational',
    body: 'दैनिक सारांश:\n{{items}}',
  },
];

export const SAMPLE_MESSAGE_TEMPLATE_COUNT = SEEDS.length;

export async function seedGlobalMessageTemplates(db: SchoolEngagementDb): Promise<void> {
  const existing = await db.get<{ c: number }>(
    `SELECT COUNT(*) as c FROM message_templates WHERE tenant_id IS NULL`,
  );
  if (Number(existing?.c ?? 0) >= SAMPLE_MESSAGE_TEMPLATE_COUNT) return;

  for (const seed of SEEDS) {
    await db.run(
      `INSERT INTO message_templates (id, tenant_id, key, lang, body, kind, reviewed)
       VALUES (?, NULL, ?, ?, ?, ?, 1)`,
      [uuidv4(), seed.key, seed.lang, seed.body, seed.kind],
    );
  }
}
