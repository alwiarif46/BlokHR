import type { ConsentState, Enrolment, Student } from '../types';

export interface UdiseIssue {
  field: string;
  code: string;
  message: string;
}

export interface UdiseValidationResult {
  ok: boolean;
  errors: UdiseIssue[];
  infos: UdiseIssue[];
  warnings: UdiseIssue[];
}

export interface UdiseValidateContext {
  apaarState?: ConsentState;
  sessionStartsOn?: string;
  hasPriorOpenEnrolment?: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GENDERS = new Set(['male', 'female', 'other']);
const CATEGORIES = new Set(['GEN', 'EWS', 'OBC', 'SC', 'ST', 'OTHER_STATE']);
const APAAR_ID = /^\d{12}$/;

/**
 * Pure UDISE field checks — no HTTP, no DB.
 */
export function validateStudentForUdise(
  student: Student,
  enrolment: Enrolment | null,
  context: UdiseValidateContext = {},
): UdiseValidationResult {
  const errors: UdiseIssue[] = [];
  const infos: UdiseIssue[] = [];
  const warnings: UdiseIssue[] = [];

  if (!student.firstName?.trim() || !student.lastName?.trim()) {
    errors.push({
      field: 'name',
      code: 'name_required',
      message: 'first_name and last_name are required',
    });
  }

  if (!student.admissionNumber?.trim()) {
    errors.push({
      field: 'admission_number',
      code: 'admission_number_required',
      message: 'admission_number is required',
    });
  }
  if (!student.admissionDate || !ISO_DATE.test(student.admissionDate)) {
    errors.push({
      field: 'admission_date',
      code: 'admission_date_invalid',
      message: 'admission_date must be a valid ISO date',
    });
  }

  if (!student.dob || !ISO_DATE.test(student.dob)) {
    errors.push({ field: 'dob', code: 'dob_invalid', message: 'dob must be a valid ISO date' });
  } else if (enrolment?.classLabel) {
    const age = ageYearsAt(student.dob, student.admissionDate || enrolment.enrolledOn);
    const range = ageRangeForClass(enrolment.classLabel);
    if (age === null || age < range.min || age > range.max) {
      errors.push({
        field: 'dob',
        code: 'age_implausible_for_class',
        message: `age ${age ?? '?'} is not plausible for class ${enrolment.classLabel}`,
      });
    }
  }

  if (!GENDERS.has(student.gender)) {
    errors.push({ field: 'gender', code: 'gender_invalid', message: 'gender must be male|female|other' });
  }

  if (!CATEGORIES.has(student.category)) {
    errors.push({
      field: 'category',
      code: 'category_invalid',
      message: 'category must be a UDISE enum value',
    });
  }

  if (!enrolment || !enrolment.classLabel?.trim() || !enrolment.section?.trim()) {
    errors.push({
      field: 'enrolment',
      code: 'class_section_required',
      message: 'active class_label and section are required',
    });
  }

  if (!student.motherName?.trim()) {
    errors.push({
      field: 'mother_name',
      code: 'mother_name_required',
      message: 'mother_name is required',
    });
  }
  if (!student.guardianContact?.trim()) {
    errors.push({
      field: 'guardian_contact',
      code: 'guardian_contact_required',
      message: 'guardian_contact is required',
    });
  }

  const apaarState = context.apaarState ?? 'not_sought';
  const apaarId = student.apaarId?.trim() || '';
  if (apaarState === 'granted') {
    if (!APAAR_ID.test(apaarId)) {
      errors.push({
        field: 'apaar_id',
        code: 'apaar_id_required',
        message: 'apaar_id must be 12 digits when APAAR consent is granted',
      });
    }
  } else if (apaarState === 'refused') {
    if (apaarId) {
      errors.push({
        field: 'apaar_id',
        code: 'apaar_id_must_be_empty',
        message: 'apaar_id must be empty when APAAR consent is refused',
      });
    } else {
      infos.push({
        field: 'apaar_id',
        code: 'apaar_refused',
        message: 'APAAR consent refused — apaar_id correctly empty',
      });
    }
  }

  if (student.isCwsn) {
    if (!student.cwsnCategory?.trim() || !student.cwsnDisability?.trim()) {
      errors.push({
        field: 'cwsn',
        code: 'cwsn_details_required',
        message: 'cwsn_category and cwsn_disability are required for CWSN students',
      });
    }
  }

  if (
    context.sessionStartsOn &&
    ISO_DATE.test(context.sessionStartsOn) &&
    student.admissionDate &&
    ISO_DATE.test(student.admissionDate) &&
    student.admissionDate > context.sessionStartsOn &&
    context.hasPriorOpenEnrolment
  ) {
    warnings.push({
      field: 'admission_date',
      code: 'progression_before_admission',
      message:
        'admission_date is after session start while a prior-session enrolment remains open',
    });
  }

  return { ok: errors.length === 0, errors, infos, warnings };
}

export function ageYearsAt(dob: string, onDate: string): number | null {
  const [dy, dm, dd] = dob.split('-').map(Number);
  const [oy, om, od] = onDate.split('-').map(Number);
  if (!dy || !dm || !dd || !oy || !om || !od) return null;
  let age = oy - dy;
  if (om < dm || (om === dm && od < dd)) age -= 1;
  return age;
}

/** Rough CBSE/state age bands for class labels like "5", "10", "XII". */
export function ageRangeForClass(classLabel: string): { min: number; max: number } {
  const n = parseClassNumber(classLabel);
  if (n === null) return { min: 2, max: 25 };
  if (n <= 2) return { min: 4, max: 9 };
  if (n <= 5) return { min: 7, max: 13 };
  if (n <= 8) return { min: 10, max: 16 };
  if (n <= 10) return { min: 13, max: 18 };
  return { min: 15, max: 22 };
}

function parseClassNumber(label: string): number | null {
  const t = label.trim().toUpperCase();
  const roman: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    IX: 9,
    X: 10,
    XI: 11,
    XII: 12,
  };
  if (roman[t] != null) return roman[t];
  const m = t.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}
