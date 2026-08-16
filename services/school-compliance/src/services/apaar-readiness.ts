export type ApaarIssue = {
  code: string;
  field: string;
  hint: string;
};

export type ApaarConsentState = 'granted' | 'refused' | 'withdrawn' | 'not_sought';

export type ApaarClassification =
  | { status: 'ready' }
  | { status: 'blocked_refused' }
  | { status: 'needs_consent' }
  | { status: 'needs_fix'; issues: ApaarIssue[] };

export interface ApaarStudentInput {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  classLabel: string;
  section: string;
  guardianContact: string;
  apaarConsent: ApaarConsentState;
}

function ageYears(dob: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split('-').map(Number);
  let age = today.getUTCFullYear() - y!;
  const md = today.getUTCMonth() + 1;
  const dd = today.getUTCDate();
  if (md < m! || (md === m && dd < d!)) age -= 1;
  return age;
}

/**
 * Name/DOB anomaly checks that dominate ABC portal rejections.
 * Pure — table-driven tests cover each rule both directions.
 */
export function detectNameDobAnomalies(
  input: {
    firstName: string;
    lastName: string;
    dob: string;
  },
  today: Date = new Date(),
): ApaarIssue[] {
  const issues: ApaarIssue[] = [];
  const { firstName, lastName, dob } = input;

  if (firstName !== firstName.trim() || lastName !== lastName.trim()) {
    issues.push({
      code: 'name_whitespace',
      field: 'name',
      hint: 'Trim leading/trailing whitespace from first and last name',
    });
  }

  if (/\d/.test(firstName) || /\d/.test(lastName)) {
    issues.push({
      code: 'name_digits',
      field: 'name',
      hint: 'Names must not contain digits',
    });
  }

  if (/  +/.test(firstName) || /  +/.test(lastName)) {
    issues.push({
      code: 'name_double_space',
      field: 'name',
      hint: 'Collapse multiple consecutive spaces in the name',
    });
  }

  const firstAllCaps =
    firstName.trim().length > 1 &&
    firstName === firstName.toUpperCase() &&
    /[A-Z]/.test(firstName);
  const lastAllCaps =
    lastName.trim().length > 1 &&
    lastName === lastName.toUpperCase() &&
    /[A-Z]/.test(lastName);
  const firstMixed = /[a-z]/.test(firstName) && /[A-Z]/.test(firstName);
  const lastMixed = /[a-z]/.test(lastName) && /[A-Z]/.test(lastName);
  if ((firstAllCaps && lastMixed) || (lastAllCaps && firstMixed)) {
    issues.push({
      code: 'name_case_mismatch',
      field: 'name',
      hint: 'Normalise casing — first/last should not mix ALL-CAPS with mixed case',
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    issues.push({
      code: 'dob_invalid',
      field: 'dob',
      hint: 'DOB must be YYYY-MM-DD',
    });
  } else {
    const dobDate = new Date(`${dob}T00:00:00.000Z`);
    const todayUtc = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    if (dobDate.getTime() > todayUtc.getTime()) {
      issues.push({
        code: 'dob_future',
        field: 'dob',
        hint: 'DOB cannot be in the future',
      });
    }
    const age = ageYears(dob, today);
    if (age != null && age > 25) {
      issues.push({
        code: 'dob_age_over_25',
        field: 'dob',
        hint: 'Age over 25 is implausible for school ABC enrolment',
      });
    }
  }

  return issues;
}

function missingAbcFields(input: ApaarStudentInput): ApaarIssue[] {
  const issues: ApaarIssue[] = [];
  if (!input.firstName?.trim()) {
    issues.push({
      code: 'field_required',
      field: 'first_name',
      hint: 'First name is required for ABC',
    });
  }
  if (!input.lastName?.trim()) {
    issues.push({
      code: 'field_required',
      field: 'last_name',
      hint: 'Last name is required for ABC',
    });
  }
  if (!input.dob?.trim()) {
    issues.push({
      code: 'field_required',
      field: 'dob',
      hint: 'DOB is required for ABC',
    });
  }
  if (!input.gender?.trim()) {
    issues.push({
      code: 'field_required',
      field: 'gender',
      hint: 'Gender is required for ABC',
    });
  }
  if (!input.guardianContact?.trim()) {
    issues.push({
      code: 'field_required',
      field: 'guardian_contact',
      hint: 'Guardian contact is required for ABC',
    });
  }
  return issues;
}

export function classifyApaarStudent(
  input: ApaarStudentInput,
  today: Date = new Date(),
): ApaarClassification {
  if (input.apaarConsent === 'refused') {
    return { status: 'blocked_refused' };
  }
  if (input.apaarConsent !== 'granted') {
    return { status: 'needs_consent' };
  }

  const issues = [
    ...missingAbcFields(input),
    ...detectNameDobAnomalies(
      {
        firstName: input.firstName,
        lastName: input.lastName,
        dob: input.dob,
      },
      today,
    ),
  ];
  if (issues.length > 0) {
    return { status: 'needs_fix', issues };
  }
  return { status: 'ready' };
}
