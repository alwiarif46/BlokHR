/**
 * Per-request L5 teacher section scope (P12-05).
 * Only when X-Blok-Role === 'teacher'; office/school_admin/admin skip.
 */
import type { Request } from 'express';
import type { Role } from './role-guard';
import type { TimetableClient } from './clients/timetable-client';

type StaffOk = { ok: true; role: Role; memberId: string };

function staffOf(req: Request): StaffOk | undefined {
  const s = (req as Request & { staff?: StaffOk }).staff;
  return s?.ok ? s : undefined;
}

type Cache = Map<string, 'ok' | 'denied' | 'unverifiable'>;

function cacheOf(req: Request): Cache {
  const r = req as Request & { _teacherScopeCache?: Cache };
  if (!r._teacherScopeCache) r._teacherScopeCache = new Map();
  return r._teacherScopeCache;
}

export async function assertTeacherSectionScope(
  req: Request,
  timetable: TimetableClient,
  opts: {
    tenantId: string;
    periodInstanceId?: string | null;
    sectionRef?: string | null;
  },
): Promise<{ ok: true } | { status: number; error: string }> {
  const staff = staffOf(req);
  if (!staff || staff.role !== 'teacher') return { ok: true };

  const periodInstanceId = (opts.periodInstanceId ?? '').trim();
  const sectionRef = (opts.sectionRef ?? '').trim();
  if (!periodInstanceId && !sectionRef) {
    return { status: 403, error: 'scope_denied' };
  }

  const key = periodInstanceId
    ? `pi:${periodInstanceId}`
    : `sec:${sectionRef}`;
  const cache = cacheOf(req);
  const hit = cache.get(key);
  if (hit === 'ok') return { ok: true };
  if (hit === 'denied') return { status: 403, error: 'scope_denied' };
  if (hit === 'unverifiable') {
    return { status: 403, error: 'scope_unverifiable' };
  }

  const result = await timetable.verifyTeacher({
    tenantId: opts.tenantId,
    teacherMemberId: staff.memberId,
    periodInstanceId: periodInstanceId || undefined,
    sectionRef: sectionRef || undefined,
  });

  if ('unverifiable' in result) {
    cache.set(key, 'unverifiable');
    return { status: 403, error: 'scope_unverifiable' };
  }
  if (result.allowed) {
    cache.set(key, 'ok');
    return { ok: true };
  }
  cache.set(key, 'denied');
  return { status: 403, error: 'scope_denied' };
}
