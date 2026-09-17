/**
 * Parse Excel/CSV workbook Teachers sheet into directory members.
 * Sheet name "Teachers" preferred; otherwise first sheet when headers match.
 */
import * as XLSX from 'xlsx';
import type { DirectoryService } from '../directory-service';
import { DIRECTORY_MEMBER_ROLES, type DirectoryMemberRole } from '../directory-service';

export interface MemberImportError {
  row: number;
  field?: string;
  message: string;
}

export interface MemberImportResult {
  success: boolean;
  created: number;
  skipped: number;
  errors: MemberImportError[];
}

const MAX_BASE64_BYTES = 4 * 1024 * 1024;

const NAME_HEADERS = new Set(['name', 'full_name', 'full name', 'teacher_name', 'teacher name']);
const EMAIL_HEADERS = new Set(['email', 'work_email', 'work email', 'login', 'username']);
const PASS_HEADERS = new Set([
  'temporary_password',
  'temporary password',
  'temp_password',
  'temp password',
  'password',
]);
const ROLE_HEADERS = new Set(['role']);

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

function findTeachersSheet(workbook: XLSX.WorkBook): string | null {
  const named = workbook.SheetNames.find((n) => n.trim().toLowerCase() === 'teachers');
  if (named) return named;
  return workbook.SheetNames[0] ?? null;
}

export function decodeMemberImportBase64(contentBase64: string): Buffer | { error: string } {
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

interface TeacherRow {
  row: number;
  name: string;
  email: string;
  temporaryPassword: string;
  role: DirectoryMemberRole;
}

export function parseTeachersWorkbook(buffer: Buffer): {
  rows: TeacherRow[];
  parseErrors: MemberImportError[];
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = findTeachersSheet(workbook);
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
  const nameIdx = findColumn(headers, NAME_HEADERS);
  const emailIdx = findColumn(headers, EMAIL_HEADERS);
  const passIdx = findColumn(headers, PASS_HEADERS);
  const roleIdx = findColumn(headers, ROLE_HEADERS);

  if (nameIdx < 0 || emailIdx < 0 || passIdx < 0) {
    return {
      rows: [],
      parseErrors: [
        {
          row: 0,
          field: 'Teachers',
          message: 'Header row must include Name, Email, and Temporary Password',
        },
      ],
    };
  }

  // If sheet is not named Teachers, require headers so we don't import Students as teachers.
  if (sheetName.trim().toLowerCase() !== 'teachers') {
    const looksLikeStudents =
      headers.includes('admission number') ||
      headers.includes('admission_number') ||
      headers.includes('first name') ||
      headers.includes('first_name');
    if (looksLikeStudents) {
      return {
        rows: [],
        parseErrors: [
          {
            row: 0,
            field: 'Teachers',
            message: 'No Teachers sheet found (workbook looks like a Students roster)',
          },
        ],
      };
    }
  }

  const rows: TeacherRow[] = [];
  const parseErrors: MemberImportError[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const rowNum = i + 1;
    const name = cell(row, nameIdx);
    const email = cell(row, emailIdx).toLowerCase();
    const temporaryPassword = cell(row, passIdx);
    const roleRaw = roleIdx >= 0 ? cell(row, roleIdx).toLowerCase() : 'teacher';

    if (!name && !email && !temporaryPassword) continue;

    if (!name) {
      parseErrors.push({ row: rowNum, field: 'Name', message: 'Name is required' });
      continue;
    }
    if (!email || email.indexOf('@') < 0) {
      parseErrors.push({ row: rowNum, field: 'Email', message: 'Valid email is required' });
      continue;
    }
    if (temporaryPassword.length < 8) {
      parseErrors.push({
        row: rowNum,
        field: 'Temporary Password',
        message: 'Temporary password must be at least 8 characters',
      });
      continue;
    }

    let role: DirectoryMemberRole = 'teacher';
    if (roleRaw) {
      if ((DIRECTORY_MEMBER_ROLES as readonly string[]).includes(roleRaw)) {
        role = roleRaw as DirectoryMemberRole;
      } else {
        parseErrors.push({
          row: rowNum,
          field: 'Role',
          message: `Invalid role "${roleRaw}"`,
        });
        continue;
      }
    }

    rows.push({ row: rowNum, name, email, temporaryPassword, role });
  }

  return { rows, parseErrors };
}

export async function importMembersFromWorkbook(
  service: DirectoryService,
  tenantId: string,
  contentBase64: string,
  opts: { defaultRole?: DirectoryMemberRole } = {},
): Promise<MemberImportResult | { error: string; status: number }> {
  const decoded = decodeMemberImportBase64(contentBase64);
  if ('error' in decoded) {
    return { error: decoded.error, status: 400 };
  }

  const { rows, parseErrors } = parseTeachersWorkbook(decoded);
  const result: MemberImportResult = {
    success: true,
    created: 0,
    skipped: 0,
    errors: [...parseErrors],
  };

  const defaultRole = opts.defaultRole ?? 'teacher';

  for (const row of rows) {
    const created = await service.createMember({
      tenantId,
      name: row.name,
      email: row.email,
      temporaryPassword: row.temporaryPassword,
      role: row.role || defaultRole,
    });

    if (!created.success) {
      if (created.status === 409) {
        result.skipped += 1;
        result.errors.push({
          row: row.row,
          field: 'Email',
          message: created.error || 'Member already exists',
        });
      } else {
        result.errors.push({
          row: row.row,
          field: 'Teachers',
          message: created.error || 'Create failed',
        });
      }
      continue;
    }
    result.created += 1;
  }

  return result;
}

/** Build a multi-sheet roster template workbook (Students / Teachers / Periods / Classes). */
export function buildRosterTemplateWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const students = [
    [
      'Admission Number',
      'First Name',
      'Last Name',
      'DOB',
      'Gender',
      'Admission Date',
      'Status',
      'Category',
      'Mother Name',
      'Father Name',
      'Guardian Contact',
      'Class',
      'Section',
      'Roll Number',
      'House',
    ],
    [
      'ADM-001',
      'Asha',
      'Rao',
      '2015-06-15',
      'female',
      '2025-04-01',
      'active',
      'GEN',
      'Meera',
      'Ravi',
      '9876543210',
      '5',
      'A',
      '12',
      'Blue',
    ],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(students), 'Students');

  const teachers = [
    ['Name', 'Email', 'Temporary Password', 'Role'],
    ['Priya Sharma', 'priya@school.test', 'TempPass1', 'teacher'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(teachers), 'Teachers');

  const periods = [
    ['Day Scheme', 'Index', 'Label', 'Start Time', 'End Time', 'Is Teaching'],
    ['Standard Day', '0', 'P1', '08:00', '08:45', 'true'],
    ['Standard Day', '1', 'P2', '08:45', '09:30', 'true'],
    ['Standard Day', '2', 'Break', '09:30', '09:45', 'false'],
    ['Standard Day', '3', 'P3', '09:45', '10:30', 'true'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(periods), 'Periods');

  const classes = [
    ['Class', 'Section', 'Day Scheme'],
    ['5', 'A', 'Standard Day'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(classes), 'Classes');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
