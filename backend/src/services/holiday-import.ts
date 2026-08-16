import * as XLSX from 'xlsx';
import type { Logger } from 'pino';
import type { HolidayService } from './holiday-service';

export interface HolidayImportRow {
  date: string;
  name: string;
  type?: string;
  year?: number;
}

export interface HolidayImportError {
  row: number;
  message: string;
}

export interface HolidayImportResult {
  created: number;
  skipped: number;
  errors: HolidayImportError[];
}

const DATE_HEADERS = new Set(['date', 'holiday_date', 'holiday date', 'day']);
const NAME_HEADERS = new Set(['name', 'holiday', 'title', 'holiday_name', 'holiday name']);
const TYPE_HEADERS = new Set(['type', 'holiday_type', 'holiday type', 'category']);

const MAX_BASE64_BYTES = 2 * 1024 * 1024; // ~2MB raw file

/** Map UI / spreadsheet synonyms onto backend types. */
export function normalizeHolidayType(raw: string | undefined): string {
  const t = (raw ?? 'mandatory').trim().toLowerCase();
  if (t === 'gazetted' || t === 'public' || t === 'national') return 'mandatory';
  if (t === 'mandatory' || t === 'optional' || t === 'restricted') return t;
  return t;
}

/** Normalize spreadsheet dates to YYYY-MM-DD. */
export function normalizeHolidayDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;

  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y >= 1900 && parsed.y <= 2100) {
      const m = String(parsed.m).padStart(2, '0');
      const d = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${m}-${d}`;
    }
    return null;
  }

  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }

  // MM/DD/YYYY (US) — only if first part > 12 we already caught as DMY; if ambiguous prefer ISO fail
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return null;
}

function headerKey(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase();
}

function findColumn(headers: string[], candidates: Set<string>): number {
  return headers.findIndex((h) => candidates.has(h));
}

/**
 * Parse first sheet of an Excel/CSV workbook into typed holiday rows.
 * Expects a header row with Date + Name (+ optional Type).
 */
export function parseHolidayWorkbook(buffer: Buffer): {
  rows: HolidayImportRow[];
  parseErrors: HolidayImportError[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], parseErrors: [{ row: 0, message: 'Workbook has no sheets' }] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  if (!matrix.length) {
    return { rows: [], parseErrors: [{ row: 0, message: 'Sheet is empty' }] };
  }

  const headers = (matrix[0] ?? []).map(headerKey);
  const dateIdx = findColumn(headers, DATE_HEADERS);
  const nameIdx = findColumn(headers, NAME_HEADERS);
  const typeIdx = findColumn(headers, TYPE_HEADERS);

  if (dateIdx < 0 || nameIdx < 0) {
    return {
      rows: [],
      parseErrors: [
        {
          row: 1,
          message: 'Header row must include Date and Name columns (optional: Type)',
        },
      ],
    };
  }

  const rows: HolidayImportRow[] = [];
  const parseErrors: HolidayImportError[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] ?? [];
    const sheetRow = i + 1;
    const dateRaw = line[dateIdx];
    const nameRaw = line[nameIdx];
    const typeRaw = typeIdx >= 0 ? line[typeIdx] : undefined;

    const name = String(nameRaw ?? '').trim();
    const empty =
      (dateRaw == null || dateRaw === '') && !name && (typeRaw == null || typeRaw === '');
    if (empty) continue;

    const date = normalizeHolidayDate(dateRaw);
    if (!date) {
      parseErrors.push({ row: sheetRow, message: `Invalid date: ${String(dateRaw)}` });
      continue;
    }
    if (!name) {
      parseErrors.push({ row: sheetRow, message: 'Name is required' });
      continue;
    }

    const type = normalizeHolidayType(typeRaw != null ? String(typeRaw) : undefined);
    rows.push({ date, name, type });
  }

  return { rows, parseErrors };
}

export function decodeImportBase64(contentBase64: string): Buffer {
  const cleaned = contentBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const buf = Buffer.from(cleaned, 'base64');
  if (buf.length === 0) throw new Error('Empty file content');
  if (buf.length > MAX_BASE64_BYTES) throw new Error('File too large (max 2MB)');
  return buf;
}

/**
 * Import holidays from parsed rows. Skips duplicates; collects per-row errors.
 */
export async function importHolidayRows(
  service: HolidayService,
  rows: HolidayImportRow[],
  logger: Logger,
  initialErrors: HolidayImportError[] = [],
): Promise<HolidayImportResult> {
  const errors = [...initialErrors];
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = normalizeHolidayType(row.type);
    if (!['mandatory', 'optional', 'restricted'].includes(type)) {
      errors.push({
        row: i + 2,
        message: `Invalid type "${row.type}" (use mandatory, optional, restricted, or gazetted)`,
      });
      continue;
    }

    const result = await service.create({
      date: row.date,
      name: row.name,
      type,
      year: row.year,
    });

    if (result.success) {
      created++;
    } else if (result.error?.includes('already exists')) {
      skipped++;
    } else {
      errors.push({ row: i + 2, message: result.error ?? 'Failed to create' });
    }
  }

  logger.info({ created, skipped, errorCount: errors.length }, 'Holiday import finished');
  return { created, skipped, errors };
}
