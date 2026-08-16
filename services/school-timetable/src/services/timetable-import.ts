/**
 * Parse Excel/CSV workbook sheets for day-scheme periods and class sections.
 * Sheets: "Periods" and/or "Classes" (case-insensitive). If Periods is missing,
 * a default Standard Day scheme is created when Classes need a day_scheme.
 */
import * as XLSX from 'xlsx';
import type { TimetableService } from './timetable-service';
import type { PeriodDef } from '../types';

export interface TimetableImportError {
  row: number;
  sheet: string;
  message: string;
}

export interface TimetableImportResult {
  daySchemesCreated: number;
  sectionsCreated: number;
  sectionsSkipped: number;
  errors: TimetableImportError[];
}

const MAX_BASE64_BYTES = 4 * 1024 * 1024;

function headerKey(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase();
}

function findColumn(headers: string[], candidates: string[]): number {
  const set = new Set(candidates);
  return headers.findIndex((h) => set.has(h));
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  if (v == null) return '';
  return String(v).trim();
}

function findSheet(workbook: XLSX.WorkBook, name: string): string | null {
  const target = name.toLowerCase();
  return workbook.SheetNames.find((n) => n.trim().toLowerCase() === target) ?? null;
}

function sheetMatrix(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

export function decodeTimetableImportBase64(
  contentBase64: string,
): Buffer | { error: string } {
  const cleaned = contentBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleaned) return { error: 'contentBase64 is required' };
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, 'base64');
  } catch {
    return { error: 'Invalid base64 content' };
  }
  if (!buf.length) return { error: 'Empty file' };
  if (buf.length > MAX_BASE64_BYTES) return { error: 'File too large (max 4MB)' };
  return buf;
}

interface PeriodRow {
  dayScheme: string;
  index: number;
  label: string;
  startTime: string;
  endTime: string;
  isTeaching: boolean;
}

interface ClassRow {
  classLabel: string;
  section: string;
  dayScheme: string;
}

function parsePeriodsSheet(
  matrix: unknown[][],
): { rows: PeriodRow[]; errors: TimetableImportError[] } {
  if (!matrix.length) {
    return { rows: [], errors: [{ row: 0, sheet: 'Periods', message: 'Sheet is empty' }] };
  }
  const headers = (matrix[0] ?? []).map(headerKey);
  const schemeIdx = findColumn(headers, [
    'day_scheme',
    'day scheme',
    'scheme',
    'day_scheme_label',
  ]);
  const indexIdx = findColumn(headers, ['index', 'period_index', 'period index', 'no', 'number']);
  const labelIdx = findColumn(headers, ['label', 'period', 'period_label', 'period label', 'name']);
  const startIdx = findColumn(headers, ['start_time', 'start time', 'start', 'from']);
  const endIdx = findColumn(headers, ['end_time', 'end time', 'end', 'to']);
  const teachIdx = findColumn(headers, [
    'is_teaching',
    'is teaching',
    'teaching',
    'is_teaching_period',
  ]);

  if (labelIdx < 0 || startIdx < 0 || endIdx < 0) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          sheet: 'Periods',
          message: 'Header row must include Label, Start Time, and End Time',
        },
      ],
    };
  }

  const rows: PeriodRow[] = [];
  const errors: TimetableImportError[] = [];
  let autoIndex = 1;

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const blank = raw.every((c) => c == null || String(c).trim() === '');
    if (blank) continue;

    const label = cell(raw, labelIdx);
    const startTime = cell(raw, startIdx);
    const endTime = cell(raw, endIdx);
    if (!label && !startTime && !endTime) continue;

    const indexRaw = indexIdx >= 0 ? cell(raw, indexIdx) : '';
    const index = indexRaw ? Number(indexRaw) : autoIndex;
    autoIndex += 1;

    if (!label || !startTime || !endTime || !Number.isFinite(index)) {
      errors.push({
        row: i + 1,
        sheet: 'Periods',
        message: 'label, start_time, end_time, and index are required',
      });
      continue;
    }

    const teachRaw = teachIdx >= 0 ? cell(raw, teachIdx).toLowerCase() : 'yes';
    const isTeaching =
      teachRaw === '' ||
      teachRaw === '1' ||
      teachRaw === 'true' ||
      teachRaw === 'yes' ||
      teachRaw === 'y';

    rows.push({
      dayScheme: schemeIdx >= 0 ? cell(raw, schemeIdx) || 'Standard Day' : 'Standard Day',
      index,
      label,
      startTime,
      endTime,
      isTeaching,
    });
  }

  return { rows, errors };
}

function parseClassesSheet(
  matrix: unknown[][],
): { rows: ClassRow[]; errors: TimetableImportError[] } {
  if (!matrix.length) {
    return { rows: [], errors: [{ row: 0, sheet: 'Classes', message: 'Sheet is empty' }] };
  }
  const headers = (matrix[0] ?? []).map(headerKey);
  const classIdx = findColumn(headers, [
    'class',
    'class_label',
    'class label',
    'grade',
    'standard',
  ]);
  const sectionIdx = findColumn(headers, ['section', 'sec', 'division']);
  const schemeIdx = findColumn(headers, [
    'day_scheme',
    'day scheme',
    'scheme',
    'day_scheme_label',
  ]);

  if (classIdx < 0 || sectionIdx < 0) {
    return {
      rows: [],
      errors: [
        {
          row: 0,
          sheet: 'Classes',
          message: 'Header row must include Class and Section',
        },
      ],
    };
  }

  const rows: ClassRow[] = [];
  const errors: TimetableImportError[] = [];
  const seen = new Set<string>();

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const blank = raw.every((c) => c == null || String(c).trim() === '');
    if (blank) continue;
    const classLabel = cell(raw, classIdx);
    const section = cell(raw, sectionIdx);
    if (!classLabel || !section) {
      errors.push({
        row: i + 1,
        sheet: 'Classes',
        message: 'class and section are required',
      });
      continue;
    }
    const key = classLabel + '\0' + section;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      classLabel,
      section,
      dayScheme: schemeIdx >= 0 ? cell(raw, schemeIdx) || 'Standard Day' : 'Standard Day',
    });
  }

  return { rows, errors };
}

/** Derive class/section pairs from a Students sheet when Classes sheet is absent. */
function deriveClassesFromStudents(workbook: XLSX.WorkBook): ClassRow[] {
  const sheetName =
    findSheet(workbook, 'Students') ?? workbook.SheetNames[0] ?? null;
  if (!sheetName) return [];
  const matrix = sheetMatrix(workbook, sheetName);
  if (!matrix.length) return [];
  const headers = (matrix[0] ?? []).map(headerKey);
  const classIdx = findColumn(headers, [
    'class',
    'class_label',
    'class label',
    'grade',
    'standard',
  ]);
  const sectionIdx = findColumn(headers, ['section', 'sec', 'division']);
  if (classIdx < 0 || sectionIdx < 0) return [];

  const seen = new Set<string>();
  const rows: ClassRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const classLabel = cell(raw, classIdx);
    const section = cell(raw, sectionIdx);
    if (!classLabel || !section) continue;
    const key = classLabel + '\0' + section;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ classLabel, section, dayScheme: 'Standard Day' });
  }
  return rows;
}

const DEFAULT_PERIODS: PeriodDef[] = [
  { index: 1, label: 'Period 1', startTime: '08:00', endTime: '08:45', isTeaching: true },
  { index: 2, label: 'Period 2', startTime: '08:45', endTime: '09:30', isTeaching: true },
  { index: 3, label: 'Period 3', startTime: '09:45', endTime: '10:30', isTeaching: true },
  { index: 4, label: 'Period 4', startTime: '10:30', endTime: '11:15', isTeaching: true },
  { index: 5, label: 'Period 5', startTime: '11:30', endTime: '12:15', isTeaching: true },
  { index: 6, label: 'Period 6', startTime: '12:15', endTime: '13:00', isTeaching: true },
  { index: 7, label: 'Period 7', startTime: '13:45', endTime: '14:30', isTeaching: true },
  { index: 8, label: 'Period 8', startTime: '14:30', endTime: '15:15', isTeaching: true },
];

export async function importTimetableFromWorkbook(
  service: TimetableService,
  tenantId: string,
  buffer: Buffer,
  academicSessionId: string,
): Promise<TimetableImportResult> {
  const result: TimetableImportResult = {
    daySchemesCreated: 0,
    sectionsCreated: 0,
    sectionsSkipped: 0,
    errors: [],
  };

  if (!academicSessionId.trim()) {
    result.errors.push({
      row: 0,
      sheet: 'Classes',
      message: 'academic_session_id is required',
    });
    return result;
  }

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const periodsName = findSheet(workbook, 'Periods');
  const classesName = findSheet(workbook, 'Classes');

  let periodRows: PeriodRow[] = [];
  if (periodsName) {
    const parsed = parsePeriodsSheet(sheetMatrix(workbook, periodsName));
    periodRows = parsed.rows;
    result.errors.push(...parsed.errors);
  }

  let classRows: ClassRow[] = [];
  if (classesName) {
    const parsed = parseClassesSheet(sheetMatrix(workbook, classesName));
    classRows = parsed.rows;
    result.errors.push(...parsed.errors);
  } else {
    classRows = deriveClassesFromStudents(workbook);
  }

  if (!periodRows.length && !classRows.length) {
    result.errors.push({
      row: 0,
      sheet: 'Workbook',
      message: 'No Periods or Classes data found (and no class/section on Students)',
    });
    return result;
  }

  const schemeIds = new Map<string, string>();
  const existing = await service.listDaySchemes(tenantId);
  for (const s of existing) {
    schemeIds.set(s.label.trim().toLowerCase(), s.id);
  }

  const schemeGroups = new Map<string, PeriodDef[]>();
  for (const p of periodRows) {
    const key = p.dayScheme;
    const list = schemeGroups.get(key) ?? [];
    list.push({
      index: p.index,
      label: p.label,
      startTime: p.startTime,
      endTime: p.endTime,
      isTeaching: p.isTeaching,
    });
    schemeGroups.set(key, list);
  }

  if (!schemeGroups.size && classRows.length) {
    schemeGroups.set('Standard Day', DEFAULT_PERIODS);
  }

  for (const [label, periods] of schemeGroups) {
    const existingId = schemeIds.get(label.trim().toLowerCase());
    if (existingId) continue;
    const created = await service.createDayScheme(tenantId, {
      label,
      kind: 'weekly',
      cycleLength: null,
      periods: periods.sort((a, b) => a.index - b.index),
    });
    if (created.error || !created.dayScheme) {
      result.errors.push({
        row: 0,
        sheet: 'Periods',
        message: `Day scheme "${label}": ${created.error?.error || 'create failed'}`,
      });
      continue;
    }
    schemeIds.set(label.trim().toLowerCase(), created.dayScheme.id);
    result.daySchemesCreated += 1;
  }

  for (const cls of classRows) {
    const schemeId = schemeIds.get(cls.dayScheme.trim().toLowerCase());
    if (!schemeId) {
      result.errors.push({
        row: 0,
        sheet: 'Classes',
        message: `No day scheme for "${cls.classLabel}/${cls.section}" (${cls.dayScheme})`,
      });
      continue;
    }
    const created = await service.createSection(tenantId, {
      academicSessionId,
      classLabel: cls.classLabel,
      section: cls.section,
      daySchemeId: schemeId,
      classTeacherMemberId: null,
    });
    if (created.error) {
      if (/already exists/i.test(created.error.error)) {
        result.sectionsSkipped += 1;
      } else {
        result.errors.push({
          row: 0,
          sheet: 'Classes',
          message: `${cls.classLabel}/${cls.section}: ${created.error.error}`,
        });
      }
      continue;
    }
    result.sectionsCreated += 1;
  }

  return result;
}
