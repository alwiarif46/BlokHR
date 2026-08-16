import { asRole, type Role } from '../../src/role-guard';

export const SECRET = 'test-internal-secret';

export function staff(role: Role = 'school_admin', memberId?: string | null) {
  return asRole(role, { secret: SECRET, memberId });
}

export function internalOnly() {
  return { 'X-Blok-Internal': SECRET };
}
