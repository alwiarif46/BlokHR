/**
 * Profile field validators for Indian HR compliance.
 *
 * Standards:
 *   - PAN: Income Tax Act format [A-Z]{5}[0-9]{4}[A-Z]
 *   - Aadhaar: UIDAI 12-digit with Verhoeff checksum
 *   - UAN: EPFO 12-digit
 *   - IFSC: RBI format [A-Z]{4}0[A-Z0-9]{6} + live Razorpay lookup
 *   - Phone: TRAI Indian mobile (10 digits, starts 6-9)
 *   - Bank A/C: 9-18 digits (Indian banking standard)
 *   - Name: min 2 chars, letters/spaces/dots/hyphens only, no digits
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Extra data returned by the validator (e.g. IFSC lookup result). */
  data?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
//  NAME
// ═══════════════════════════════════════════════════════════════

/** Validate a person's name — letters, spaces, dots, hyphens, min 2 chars. */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  const trimmed = name.trim();
  if (/\d/.test(trimmed)) {
    return { valid: false, error: 'Name cannot contain digits' };
  }
  if (!/^[a-zA-Z\s.\-']+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Name can only contain letters, spaces, dots, hyphens, and apostrophes',
    };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  PHONE (Indian mobile)
// ═══════════════════════════════════════════════════════════════

/** Validate Indian mobile number — 10 digits starting with 6-9, optional +91 prefix. */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true }; // Optional field
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const match = cleaned.match(/^(?:\+91)?([6-9]\d{9})$/);
  if (!match) {
    return {
      valid: false,
      error: 'Phone must be a 10-digit Indian mobile number starting with 6-9',
    };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  PAN
// ═══════════════════════════════════════════════════════════════

/**
 * Validate PAN number — Income Tax Act format.
 * Format: [A-Z]{5}[0-9]{4}[A-Z]
 * 4th character encodes holder type: P=Person, C=Company, H=HUF, F=Firm, etc.
 */
export function validatePan(pan: string): ValidationResult {
  if (!pan) return { valid: true }; // Optional until certification
  const upper = pan.toUpperCase().trim();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(upper)) {
    return {
      valid: false,
      error: 'PAN must be in format ABCDE1234F (5 letters, 4 digits, 1 letter)',
    };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  AADHAAR (with Verhoeff checksum)
// ═══════════════════════════════════════════════════════════════

/**
 * Verhoeff multiplication table.
 * Used for Aadhaar checksum validation — catches single-digit errors
 * and adjacent transposition errors (the two most common human mistakes).
 */
const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/** Verhoeff permutation table. */
const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Validate a number string using the Verhoeff algorithm. Returns true if valid. */
function verhoeffCheck(num: string): boolean {
  let c = 0;
  const digits = num.split('').map(Number).reverse();
  for (let i = 0; i < digits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digits[i]]];
  }
  return c === 0;
}

/**
 * Validate Aadhaar number — UIDAI standard.
 * 12 digits, no leading 0 or 1, Verhoeff checksum on last digit.
 */
export function validateAadhaar(aadhaar: string): ValidationResult {
  if (!aadhaar) return { valid: true }; // Optional until certification
  const cleaned = aadhaar.replace(/\s/g, '');
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: 'Aadhaar must be exactly 12 digits' };
  }
  if (cleaned[0] === '0' || cleaned[0] === '1') {
    return { valid: false, error: 'Aadhaar cannot start with 0 or 1' };
  }
  if (!verhoeffCheck(cleaned)) {
    return { valid: false, error: 'Aadhaar checksum is invalid — please check for typos' };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  UAN
// ═══════════════════════════════════════════════════════════════

/** Validate UAN — EPFO standard, 12 digits. */
export function validateUan(uan: string): ValidationResult {
  if (!uan) return { valid: true }; // Optional
  const cleaned = uan.trim();
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: 'UAN must be exactly 12 digits' };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  IFSC (with Razorpay live lookup)
// ═══════════════════════════════════════════════════════════════

/**
 * Validate IFSC code — RBI format + live lookup via Razorpay's free API.
 * Format: [A-Z]{4}0[A-Z0-9]{6}
 * Live lookup: https://ifsc.razorpay.com/{code} — returns bank name, branch, city.
 * No API key needed. Free and open-source.
 */
export async function validateIfsc(ifsc: string): Promise<ValidationResult> {
  if (!ifsc) return { valid: true }; // Optional until certification
  const upper = ifsc.toUpperCase().trim();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(upper)) {
    return {
      valid: false,
      error: 'IFSC must be in format SBIN0001234 (4 letters, 0, 6 alphanumeric)',
    };
  }

  try {
    const resp = await fetch(`https://ifsc.razorpay.com/${upper}`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        return { valid: false, error: `IFSC code ${upper} not found in RBI database` };
      }
      // API error — fall back to regex-only validation
      return { valid: true, data: { lookupFailed: true } };
    }

    const data = (await resp.json()) as {
      BANK: string;
      BRANCH: string;
      CITY: string;
      STATE: string;
      ADDRESS: string;
      IFSC: string;
    };

    return {
      valid: true,
      data: {
        bankName: data.BANK ?? '',
        branch: data.BRANCH ?? '',
        city: data.CITY ?? '',
        state: data.STATE ?? '',
        address: data.ADDRESS ?? '',
        autoFilledBankName: `${data.BANK ?? ''}, ${data.BRANCH ?? ''}`,
      },
    };
  } catch {
    // Network error — fall back to regex-only validation
    return { valid: true, data: { lookupFailed: true } };
  }
}

// ═══════════════════════════════════════════════════════════════
//  BANK ACCOUNT
// ═══════════════════════════════════════════════════════════════

/** Validate bank account number — 9 to 18 digits (Indian standard). */
export function validateBankAccount(account: string): ValidationResult {
  if (!account) return { valid: true }; // Optional until certification
  const cleaned = account.trim();
  if (!/^\d{9,18}$/.test(cleaned)) {
    return { valid: false, error: 'Bank account number must be 9 to 18 digits' };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  EMAIL
// ═══════════════════════════════════════════════════════════════

/** Basic email format validation. */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
//  BULK VALIDATION
// ═══════════════════════════════════════════════════════════════

/** Validation errors keyed by field name. Empty object = all valid. */
export interface ProfileValidationErrors {
  [field: string]: string;
}

/**
 * Validate all profile fields at once.
 * Returns an object mapping field names to error messages.
 * Empty object means all fields are valid.
 * `ifscData` is populated if the IFSC live lookup succeeded.
 */
export async function validateProfileFields(fields: {
  name?: string;
  phone?: string;
  pan?: string;
  aadhaar?: string;
  uan?: string;
  ifsc?: string;
  bankAccount?: string;
  email?: string;
}): Promise<{
  errors: ProfileValidationErrors;
  ifscData?: Record<string, unknown>;
}> {
  const errors: ProfileValidationErrors = {};
  let ifscData: Record<string, unknown> | undefined;

  if (fields.name !== undefined) {
    const r = validateName(fields.name);
    if (!r.valid) errors.name = r.error!;
  }
  if (fields.phone !== undefined) {
    const r = validatePhone(fields.phone);
    if (!r.valid) errors.phone = r.error!;
  }
  if (fields.pan !== undefined) {
    const r = validatePan(fields.pan);
    if (!r.valid) errors.pan = r.error!;
  }
  if (fields.aadhaar !== undefined) {
    const r = validateAadhaar(fields.aadhaar);
    if (!r.valid) errors.aadhaar = r.error!;
  }
  if (fields.uan !== undefined) {
    const r = validateUan(fields.uan);
    if (!r.valid) errors.uan = r.error!;
  }
  if (fields.ifsc !== undefined) {
    const r = await validateIfsc(fields.ifsc);
    if (!r.valid) errors.ifsc = r.error!;
    if (r.data) ifscData = r.data;
  }
  if (fields.bankAccount !== undefined) {
    const r = validateBankAccount(fields.bankAccount);
    if (!r.valid) errors.bankAccount = r.error!;
  }
  if (fields.email !== undefined) {
    const r = validateEmail(fields.email);
    if (!r.valid) errors.email = r.error!;
  }

  return { errors, ifscData };
}
