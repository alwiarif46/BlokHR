import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 10;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const LOCKOUT_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function generateOpaqueToken(): string {
  return randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
