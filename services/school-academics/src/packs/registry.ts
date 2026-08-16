/**
 * Load and validate syllabus pack JSON files from a directory (fail-fast at boot).
 */
import fs from 'fs';
import path from 'path';
import { validateImportUnits } from '../services/syllabus-import-validate';
import type { SyllabusPack, SyllabusPackSummary } from './types';

const PACK_ID_RE = /^(cbse|icse|state)(-[A-Z]{2})?-\d{4}(-\d{2})?$/;
const ALLOWED_BOARDS = new Set(['cbse', 'icse', 'state']);
const FORBIDDEN_BOARDS = new Set(['ib', 'cambridge']);

export class SyllabusPackRegistry {
  private readonly byId = new Map<string, SyllabusPack>();

  constructor(packs: SyllabusPack[]) {
    for (const p of packs) {
      this.byId.set(p.id, p);
    }
  }

  list(): SyllabusPackSummary[] {
    return [...this.byId.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(toSummary);
  }

  get(id: string): SyllabusPack | null {
    return this.byId.get(id) ?? null;
  }

  /** Newest pack id in same family(+state) with academic_year > installed year, else null. */
  findUpdateAvailable(installed: SyllabusPack): string | null {
    let best: SyllabusPack | null = null;
    for (const p of this.byId.values()) {
      if (p.family !== installed.family) continue;
      if ((p.state_code || '') !== (installed.state_code || '')) continue;
      if (p.academic_year <= installed.academic_year) continue;
      if (!best || p.academic_year > best.academic_year) best = p;
    }
    return best ? best.id : null;
  }
}

export function toSummary(pack: SyllabusPack): SyllabusPackSummary {
  const classes = [...new Set(pack.courses.map((c) => c.class_label))].sort();
  const subjects = [...new Set(pack.courses.map((c) => c.subject_code))].sort();
  return {
    id: pack.id,
    family: pack.family,
    state_code: pack.state_code,
    academic_year: pack.academic_year,
    label: pack.label,
    status: pack.status,
    course_count: pack.courses.length,
    classes,
    subjects,
  };
}

/**
 * Synchronously load every *.json under packsDir. Throws with filename on validation failure.
 */
export function loadSyllabusPackRegistry(packsDir: string): SyllabusPackRegistry {
  if (!fs.existsSync(packsDir)) {
    return new SyllabusPackRegistry([]);
  }
  const files = fs
    .readdirSync(packsDir)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const packs: SyllabusPack[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const full = path.join(packsDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      throw new Error(`pack ${file}: invalid JSON (${(err as Error).message})`);
    }
    const pack = validatePackObject(raw, file);
    if (seen.has(pack.id)) {
      throw new Error(`pack ${file}: duplicate pack id '${pack.id}'`);
    }
    seen.add(pack.id);
    packs.push(pack);
  }

  return new SyllabusPackRegistry(packs);
}

function validatePackObject(raw: unknown, file: string): SyllabusPack {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`pack ${file}: root must be an object`);
  }
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '').trim();
  if (!PACK_ID_RE.test(id)) {
    throw new Error(
      `pack ${file}: id '${id}' must match family(-STATE)?-year (e.g. cbse-2026-27, state-MH-2026-27)`,
    );
  }

  const family = String(o.family ?? '').trim() as SyllabusPack['family'];
  if (family !== 'cbse' && family !== 'icse' && family !== 'state') {
    throw new Error(`pack ${file}: family must be cbse, icse, or state`);
  }

  const board = String(o.board ?? '').trim();
  if (FORBIDDEN_BOARDS.has(board)) {
    throw new Error(`pack ${file}: board '${board}' is not distributable`);
  }
  if (!ALLOWED_BOARDS.has(board)) {
    throw new Error(`pack ${file}: board must be cbse, icse, or state`);
  }

  const stateCode =
    o.state_code != null && String(o.state_code).trim()
      ? String(o.state_code).trim().toUpperCase()
      : undefined;
  if (family === 'state' && !stateCode) {
    throw new Error(`pack ${file}: state_code is required when family is state`);
  }

  const academicYear = String(o.academic_year ?? '').trim();
  if (!academicYear) throw new Error(`pack ${file}: academic_year is required`);

  const label = String(o.label ?? '').trim();
  if (!label) throw new Error(`pack ${file}: label is required`);

  const status = String(o.status ?? '').trim() as SyllabusPack['status'];
  if (status !== 'sample' && status !== 'official') {
    throw new Error(`pack ${file}: status must be sample or official`);
  }

  const sourceNote = String(o.source_note ?? '').trim();
  if (!sourceNote) throw new Error(`pack ${file}: source_note is required`);

  if (!Array.isArray(o.courses) || o.courses.length === 0) {
    throw new Error(`pack ${file}: courses must be a non-empty array`);
  }

  const courses: SyllabusPack['courses'] = [];
  o.courses.forEach((cRow, ci) => {
    if (!cRow || typeof cRow !== 'object') {
      throw new Error(`pack ${file}: courses[${ci}] invalid`);
    }
    const c = cRow as Record<string, unknown>;
    const subjectCode = String(c.subject_code ?? '').trim();
    const classLabel = String(c.class_label ?? '').trim();
    const courseLabel = String(c.label ?? '').trim();
    if (!subjectCode || !classLabel || !courseLabel) {
      throw new Error(
        `pack ${file}: courses[${ci}] requires subject_code, class_label, and label`,
      );
    }
    const { errors } = validateImportUnits(Array.isArray(c.units) ? c.units : []);
    if (errors.length) {
      throw new Error(`pack ${file}: courses[${ci}] units: ${errors.join('; ')}`);
    }
    courses.push({
      subject_code: subjectCode,
      class_label: classLabel,
      label: courseLabel,
      units: c.units as SyllabusPack['courses'][0]['units'],
    });
  });

  return {
    id,
    family,
    state_code: stateCode,
    board: board as SyllabusPack['board'],
    academic_year: academicYear,
    label,
    status,
    source_note: sourceNote,
    courses,
  };
}
