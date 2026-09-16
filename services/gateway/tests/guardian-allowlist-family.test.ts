import { describe, it, expect } from 'vitest';
import {
  resolveGuardianAllowlist,
  type GuardianIdentity,
} from '../src/guards/guardian-allowlist';

const id: GuardianIdentity = {
  tenantId: 'tenant-a',
  guardianId: 'g-1',
};

describe('guardian allowlist family hub mappings', () => {
  it('maps profile, domain reads, consents, and family-ops', () => {
    const cases: Array<{ method: string; path: string; service: string; includes: string }> = [
      {
        method: 'GET',
        path: '/guardian/me/profile',
        service: 'school-identity',
        includes: '/guardians/g-1/profile',
      },
      {
        method: 'PATCH',
        path: '/guardian/me/profile',
        service: 'school-identity',
        includes: '/guardians/g-1/profile',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/fees',
        service: 'school-fees',
        includes: '/guardian/students/stu-1/ledger',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/library',
        service: 'school-library',
        includes: '/library-summary',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/report-cards',
        service: 'school-assessment',
        includes: '/report-cards',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/assignments',
        service: 'school-academics',
        includes: '/assignments',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/timetable',
        service: 'school-timetable',
        includes: '/schedule',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/transport',
        service: 'school-transport',
        includes: '/status',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/consents',
        service: 'school-identity',
        includes: '/guardian/students/stu-1/consents',
      },
      {
        method: 'POST',
        path: '/guardian/students/stu-1/dsr',
        service: 'school-compliance',
        includes: '/guardian/students/stu-1/dsr',
      },
      {
        method: 'GET',
        path: '/guardian/students/stu-1/family/health',
        service: 'school-family-ops',
        includes: '/family-ops/',
      },
    ];

    for (const c of cases) {
      const match = resolveGuardianAllowlist(c.method, c.path, id);
      expect(match, `${c.method} ${c.path}`).not.toBeNull();
      expect(match!.service).toBe(c.service);
      expect(match!.upstreamPath).toContain(c.includes);
      expect(match!.upstreamPath).toContain('tenant-a');
    }
  });

  it('denies unknown guardian paths', () => {
    expect(
      resolveGuardianAllowlist('GET', '/guardian/students/stu-1/secret-staff', id),
    ).toBeNull();
  });
});
