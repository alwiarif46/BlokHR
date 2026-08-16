/**
 * Parse Excel/CSV school roster workbooks into student + enrolment rows.
 * Sheet name "Students" preferred; otherwise the first sheet is used.
 */
import * as XLSX from 'xlsx';
import type { IdentityService } from './identity-service';
import type {
  CreateStudentInput,
  StudentCategory,
  StudentGender,
  StudentStatus,
} from '../types';

export interface StudentImportRow {
  student: CreateStudentInput;
  classLabel?: string;
  section?: string;
  rollNumber?: string;
  house?: string;
  sessionLabel?: string;
}

export interface StudentImportError {
  row: number;
  message: string;
}

export interface StudentImportResult {
  created: number;
  skipped: number;
  enrolled: number;
  errors: StudentImportError[];
  sessionId: string | null;
  classes: Array<{ classLabel: string; section: string }>;
}

const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const ADMISSION_HEADERS = new Set([
  'admission_number',
  'admission number',
  'admission_no',
  'admission no',
  'adm_no',
  'adm no',
]);
const FIRST_HEADERS = new Set(['first_name', 'first name', 'firstname', 'given_name', 'given name']);
const LAST_HEADERS = new Set(['last_name', 'last name', 'lastname', 'surname', 'family_name']);
const DOB_HEADERS = new Set(['dob', 'date_of_birth', 'date of birth', 'birth_date', 'birth date']);
const GENDER_HEADERS = new Set(['gender', 'sex']);
const ADMISSION_DATE_HEADERS = new Set([
  'admission_date',
  'admission date',
  'date_of_admission',
  'date of admission',
]);
const STATUS_HEADERS = new Set(['status']);
const CATEGORY_HEADERS = new Set(['category', 'caste_category', 'caste category']);
const MOTHER_HEADERS = new Set(['mother_name', 'mother name', 'mother']);
const FATHER_HEADERS = new Set(['father_name', 'father name', 'father']);
const GUARDIAN_HEADERS = new Set([
  'guardian_contact',
  'guardian contact',
  'phone',
  'mobile',
  'contact',
  'guardian_phone',
  'guardian phone',
]);
const CLASS_HEADERS = new Set(['class', 'class_label', 'class label', 'grade', 'standard']);
const SECTION_HEADERS = new Set(['section', 'sec', 'division']);
const ROLL_HEADERS = new Set(['roll', 'roll_number', 'roll number', 'roll_no', 'roll no']);
const HOUSE_HEADERS = new Set(['house']);
const SESSION_HEADERS = new Set([
  'session',
  'academic_session',
  'academic session',
  'session_label',
  'session label',
]);
const AADHAAR_HEADERS = new Set(['aadhaar_last4', 'aadhaar last4', 'aadhaar', 'uid_last4']);

function headerKey(h: unknown): string {
  return String(h ?? '')
    .trim()
    .toLowerCase();
}

function findColumn(headers: string[], candidates: Set<string>): number {
  return headers.findIndex((h) => candidates.has(h));
}

function cell(row: unknown[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  const v = row[idx];
  if (v == null) return '';
  return String(v).trim();
}

/** Normalize spreadsheet dates to YYYY-MM-DD. */
export function normalizeImportDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (parsed && parsed.y >= 1900 && parsed.y <= 2100) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return null;
  }
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const parsed = Date.parse(s);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return null;
}

function normalizeGender(raw: string): StudentGender | null {
  const g = raw.trim().toLowerCase();
  if (g === 'm' || g === 'male' || g === 'boy') return 'male';
  if (g === 'f' || g === 'female' || g === 'girl') return 'female';
  if (g === 'other' || g === 'o') return 'other';
  return null;
}

function normalizeStatus(raw: string): StudentStatus {
  const s = raw.trim().toLowerCase();
  if (
    s === 'enquiry' ||
    s === 'admitted' ||
    s === 'active' ||
    s === 'transferred' ||
    s === 'alumni' ||
    s === 'withdrawn'
  ) {
    return s;
  }
  return 'active';
}

function normalizeCategory(raw: string): StudentCategory {
  const c = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (c === 'GEN' || c === 'GENERAL') return 'GEN';
  if (c === 'EWS') return 'EWS';
  if (c === 'OBC') return 'OBC';
  if (c === 'SC') return 'SC';
  if (c === 'ST') return 'ST';
  if (c === 'OTHER_STATE' || c === 'OTHERSTATE') return 'OTHER_STATE';
  return 'GEN';
}

function pickStudentsSheet(workbook: XLSX.WorkBook): string | null {
  const named = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'students');
  if (named) return named;
  return workbook.SheetNames[0] ?? null;
}

/**
 * Parse Students sheet (or first sheet) into typed import rows.
 */
export function parseStudentWorkbook(buffer: Buffer): {
  rows: StudentImportRow[];
  parseErrors: StudentImportError[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = pickStudentsSheet(workbook);
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
  const admissionIdx = findColumn(headers, ADMISSION_HEADERS);
  const firstIdx = findColumn(headers, FIRST_HEADERS);
  const lastIdx = findColumn(headers, LAST_HEADERS);
  const dobIdx = findColumn(headers, DOB_HEADERS);
  const genderIdx = findColumn(headers, GENDER_HEADERS);
  const admDateIdx = findColumn(headers, ADMISSION_DATE_HEADERS);
  const statusIdx = findColumn(headers, STATUS_HEADERS);
  const categoryIdx = findColumn(headers, CATEGORY_HEADERS);
  const motherIdx = findColumn(headers, MOTHER_HEADERS);
  const fatherIdx = findColumn(headers, FATHER_HEADERS);
  const guardianIdx = findColumn(headers, GUARDIAN_HEADERS);
  const classIdx = findColumn(headers, CLASS_HEADERS);
  const sectionIdx = findColumn(headers, SECTION_HEADERS);
  const rollIdx = findColumn(headers, ROLL_HEADERS);
  const houseIdx = findColumn(headers, HOUSE_HEADERS);
  const sessionIdx = findColumn(headers, SESSION_HEADERS);
  const aadhaarIdx = findColumn(headers, AADHAAR_HEADERS);

  if (admissionIdx < 0 || firstIdx < 0 || lastIdx < 0 || dobIdx < 0 || genderIdx < 0) {
    return {
      rows: [],
      parseErrors: [
        {
          row: 0,
          message:
            'Header row must include Admission Number, First Name, Last Name, DOB, and Gender',
        },
      ],
    };
  }
  if (motherIdx < 0 || fatherIdx < 0 || guardianIdx < 0) {
    return {
      rows: [],
      parseErrors: [
        {
          row: 0,
          message: 'Header row must include Mother Name, Father Name, and Guardian Contact',
        },
      ],
    };
  }

  const rows: StudentImportRow[] = [];
  const parseErrors: StudentImportError[] = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const blank = raw.every((c) => c == null || String(c).trim() === '');
    if (blank) continue;

    const admissionNumber = cell(raw, admissionIdx);
    const firstName = cell(raw, firstIdx);
    const lastName = cell(raw, lastIdx);
    if (!admissionNumber && !firstName && !lastName) continue;

    const dob = normalizeImportDate(raw[dobIdx]);
    const gender = normalizeGender(cell(raw, genderIdx));
    // Prefer explicit admission date; otherwise use today (not DOB — age-at-admission checks).
    const admissionDate =
      admDateIdx >= 0
        ? normalizeImportDate(raw[admDateIdx]) || new Date().toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const rowNum = i + 1;

    if (!admissionNumber || !firstName || !lastName) {
      parseErrors.push({
        row: rowNum,
        message: 'admission_number, first_name, and last_name are required',
      });
      continue;
    }
    if (!dob) {
      parseErrors.push({ row: rowNum, message: 'Invalid or missing DOB' });
      continue;
    }
    if (!gender) {
      parseErrors.push({ row: rowNum, message: 'Invalid gender (use male/female/other)' });
      continue;
    }

    const aadhaarRaw = aadhaarIdx >= 0 ? cell(raw, aadhaarIdx) : '';
    const aadhaarLast4 =
      aadhaarRaw.length >= 4 ? aadhaarRaw.replace(/\D/g, '').slice(-4) : null;

    rows.push({
      student: {
        admissionNumber,
        firstName,
        lastName,
        dob,
        gender,
        admissionDate,
        status: statusIdx >= 0 ? normalizeStatus(cell(raw, statusIdx)) : 'active',
        category: categoryIdx >= 0 ? normalizeCategory(cell(raw, categoryIdx)) : 'GEN',
        stateCategoryCode: null,
        stateStudentId: null,
        motherName: cell(raw, motherIdx),
        fatherName: cell(raw, fatherIdx),
        guardianContact: cell(raw, guardianIdx),
        aadhaarLast4: aadhaarLast4 && aadhaarLast4.length === 4 ? aadhaarLast4 : null,
        apaarId: null,
        penId: null,
        udiseExportOk: false,
        isCwsn: false,
        cwsnCategory: null,
        cwsnDisability: null,
        cwsnCertificate: false,
        isRte: false,
        photoRef: null,
      },
      classLabel: classIdx >= 0 ? cell(raw, classIdx) : undefined,
      section: sectionIdx >= 0 ? cell(raw, sectionIdx) : undefined,
      rollNumber: rollIdx >= 0 ? cell(raw, rollIdx) : undefined,
      house: houseIdx >= 0 ? cell(raw, houseIdx) || undefined : undefined,
      sessionLabel: sessionIdx >= 0 ? cell(raw, sessionIdx) || undefined : undefined,
    });
  }

  return { rows, parseErrors };
}

export function decodeImportBase64(contentBase64: string): Buffer | { error: string } {
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

/**
 * Import students (and enrolments when class/section/roll present).
 * Ensures a current academic session exists.
 */
export async function importStudentsFromWorkbook(
  service: IdentityService,
  tenantId: string,
  buffer: Buffer,
): Promise<StudentImportResult> {
  const { rows, parseErrors } = parseStudentWorkbook(buffer);
  const result: StudentImportResult = {
    created: 0,
    skipped: 0,
    enrolled: 0,
    errors: [...parseErrors],
    sessionId: null,
    classes: [],
  };

  if (!rows.length && result.errors.length) return result;

  const sessions = await service.listSessions(tenantId);
  let session = sessions.find((s) => s.isCurrent) ?? sessions[0] ?? null;
  if (!session) {
    const year = new Date().getFullYear();
    const created = await service.createSession(tenantId, {
      label: `${year}-${String(year + 1).slice(-2)}`,
      startsOn: `${year}-04-01`,
      endsOn: `${year + 1}-03-31`,
      isCurrent: true,
    });
    if (created.error || !created.session) {
      result.errors.push({
        row: 0,
        message: created.error || 'Could not create academic session',
      });
      return result;
    }
    session = created.session;
  }
  result.sessionId = session.id;

  const classKey = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const sheetRow = i + 2;
    const created = await service.createStudent(tenantId, row.student);
    if (created.error || !created.student) {
      const msg = created.error?.error || 'Create failed';
      if (/already exists/i.test(msg)) {
        result.skipped += 1;
      } else {
        result.errors.push({ row: sheetRow, message: msg });
      }
      continue;
    }
    result.created += 1;

    const classLabel = (row.classLabel || '').trim();
    const section = (row.section || '').trim();
    const rollNumber = (row.rollNumber || '').trim();
    if (classLabel && section && rollNumber) {
      const enrolled = await service.enrolStudent(tenantId, created.student.id, {
        academicSessionId: session.id,
        classLabel,
        section,
        rollNumber,
        house: row.house || null,
        enrolledOn: row.student.admissionDate,
      });
      if (enrolled.error) {
        result.errors.push({
          row: sheetRow,
          message: 'Created student but enrol failed: ' + enrolled.error.error,
        });
      } else {
        result.enrolled += 1;
        const key = classLabel + '\0' + section;
        if (!classKey.has(key)) {
          classKey.add(key);
          result.classes.push({ classLabel, section });
        }
      }
    }
  }

  return result;
}
