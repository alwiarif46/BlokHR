/**
 * ISBN helpers — ISBN-10 inputs are normalised to ISBN-13 (978-prefix + new check digit).
 */

function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

function isbn13CheckDigit(twelve: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = twelve.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

function isbn10CheckDigit(nine: string): string {
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += (nine.charCodeAt(i) - 48) * (10 - i);
  }
  const rem = 11 - (sum % 11);
  if (rem === 10) return 'X';
  if (rem === 11) return '0';
  return String(rem);
}

function isValidIsbn13(digits: string): boolean {
  if (!/^\d{13}$/.test(digits)) return false;
  return isbn13CheckDigit(digits.slice(0, 12)) === digits[12];
}

function isValidIsbn10(digits: string): boolean {
  if (!/^\d{9}[\dX]$/.test(digits)) return false;
  return isbn10CheckDigit(digits.slice(0, 9)) === digits[9];
}

function isbn10ToIsbn13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9);
  return core + isbn13CheckDigit(core);
}

/**
 * Parse optional ISBN input into canonical ISBN-13 digits, or null if empty.
 * Returns `{ error: 'isbn_invalid' }` when the value is present but invalid.
 */
export function normalizeIsbn13(
  input: string | null | undefined,
): { isbn13: string | null } | { error: 'isbn_invalid' } {
  if (input === null || input === undefined) return { isbn13: null };
  const trimmed = String(input).trim();
  if (!trimmed) return { isbn13: null };

  const digits = digitsOnly(trimmed);
  if (digits.length === 13) {
    return isValidIsbn13(digits) ? { isbn13: digits } : { error: 'isbn_invalid' };
  }
  if (digits.length === 10) {
    if (!isValidIsbn10(digits)) return { error: 'isbn_invalid' };
    return { isbn13: isbn10ToIsbn13(digits) };
  }
  return { error: 'isbn_invalid' };
}

export function isbn13CheckDigitForTests(twelve: string): string {
  return isbn13CheckDigit(twelve);
}
