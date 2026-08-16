import { asRole, type Role } from '../../src/role-guard';

export const SECRET = 'test-internal-secret';

export function staff(role: Role = 'school_admin', memberId?: string) {
  return asRole(role, { secret: SECRET, memberId });
}

export function internalOnly() {
  return { 'X-Blok-Internal': SECRET };
}

export function guardian(guardianId: string, studentRefs: string[] = []) {
  const h: Record<string, string> = {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
  };
  if (studentRefs.length) {
    h['X-Blok-Students'] = studentRefs.join(',');
  }
  return h;
}
