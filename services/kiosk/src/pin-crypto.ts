import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PIN_MIN_LEN = 4;
const PIN_MAX_LEN = 12;

export function normalizePin(pin: string): string {
  return String(pin ?? '').trim();
}

export function validatePinFormat(pin: string): string | null {
  const p = normalizePin(pin);
  if (p.length < PIN_MIN_LEN || p.length > PIN_MAX_LEN) {
    return `PIN must be ${PIN_MIN_LEN}–${PIN_MAX_LEN} digits`;
  }
  if (!/^\d+$/.test(p)) {
    return 'PIN must be numeric';
  }
  return null;
}

/** Store as salt:hash (scrypt). Never return plaintext. */
export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(normalizePin(pin), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPinHash(pin: string, stored: string): boolean {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  try {
    const computed = scryptSync(normalizePin(pin), salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, expected);
  } catch {
    return false;
  }
}

export function createActionToken(): string {
  return randomBytes(24).toString('hex');
}
