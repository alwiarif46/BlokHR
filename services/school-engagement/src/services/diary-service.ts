import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { EventPublisher } from '../events';
import type { TimetableClient } from '../clients/timetable-client';
import type { IdentityClient } from '../clients/identity-client';
import type { DiaryRepository } from '../repositories/diary-repository';
import type { DiaryEntry, DiaryKind } from '../types';
import type { Role } from '../role-guard';

const KINDS = new Set<DiaryKind>(['homework', 'note', 'remark', 'reminder']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 2000;

export interface ServiceError {
  error: string;
  status: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayKey(d: Date): string {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() - 1);
  return x.toISOString().slice(0, 10);
}

function hoursSince(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3600000;
}

export class DiaryService {
  constructor(
    private readonly repo: DiaryRepository,
    private readonly events: EventPublisher,
    private readonly timetable: TimetableClient,
    private readonly identity: IdentityClient,
    private readonly clock: () => Date = () => new Date(),
    private readonly logger?: Logger,
  ) {}

  private async ensureTeacherSection(
    tenantId: string,
    role: Role,
    memberId: string,
    sectionRef: string,
  ): Promise<ServiceError | null> {
    if (role !== 'teacher') return null;
    if (!memberId) {
      return { error: 'no_member_binding', status: 403 };
    }
    const result = await this.timetable.verifyTeacher(
      tenantId,
      memberId,
      sectionRef,
    );
    if (!result.allowed) {
      return { error: 'scope_unverifiable', status: 403 };
    }
    return null;
  }

  async createEntry(
    tenantId: string,
    input: {
      sectionRef: string;
      studentRef?: string | null;
      entryDate: string;
      kind: string;
      body: string;
      attachmentRefs?: string[] | null;
    },
    actor: { role: Role; memberId: string },
  ): Promise<{ entry?: DiaryEntry; error?: ServiceError }> {
    const sectionRef = (input.sectionRef || '').trim();
    if (!sectionRef) {
      return { error: { error: 'section_ref is required', status: 400 } };
    }
    const scopeErr = await this.ensureTeacherSection(
      tenantId,
      actor.role,
      actor.memberId,
      sectionRef,
    );
    if (scopeErr) return { error: scopeErr };

    const entryDate = (input.entryDate || '').trim();
    if (!ISO_DATE.test(entryDate)) {
      return { error: { error: 'entry_date must be YYYY-MM-DD', status: 400 } };
    }
    const now = this.clock();
    const today = dayKey(now);
    const yday = yesterdayKey(now);
    if (actor.role === 'teacher' && entryDate !== today && entryDate !== yday) {
      return {
        error: {
          error: 'teachers may only post for today or yesterday',
          status: 403,
        },
      };
    }
    if (
      entryDate !== today &&
      entryDate !== yday &&
      actor.role !== 'school_admin' &&
      actor.role !== 'admin'
    ) {
      return {
        error: {
          error: 'back-dating beyond yesterday requires school_admin',
          status: 403,
        },
      };
    }

    const kind = String(input.kind || '').trim() as DiaryKind;
    if (!KINDS.has(kind)) {
      return {
        error: {
          error: 'kind must be homework|note|remark|reminder',
          status: 400,
        },
      };
    }
    const body = String(input.body ?? '');
    if (!body.trim()) {
      return { error: { error: 'body is required', status: 400 } };
    }
    if (body.length > MAX_BODY) {
      return { error: { error: 'body must be ≤2000 characters', status: 400 } };
    }
    if (!actor.memberId) {
      return { error: { error: 'no_member_binding', status: 403 } };
    }

    const studentRef = input.studentRef ? String(input.studentRef).trim() : null;
    const attachmentRefs = Array.isArray(input.attachmentRefs)
      ? input.attachmentRefs.map(String)
      : null;

    const entry = await this.repo.insertEntry({
      id: uuidv4(),
      tenantId,
      sectionRef,
      studentRef: studentRef || null,
      entryDate,
      kind,
      body,
      attachmentRefs,
      authorMemberId: actor.memberId,
      createdAt: now.toISOString(),
    });

    await this.events.publish({
      type: 'school.diary.created',
      tenantId,
      occurredAt: now.toISOString(),
      data: {
        section_ref: sectionRef,
        student_ref: studentRef,
        entry_date: entryDate,
        kind,
        entry_id: entry.id,
      },
    });

    return { entry };
  }

  async patchEntry(
    tenantId: string,
    id: string,
    input: { kind?: string; body?: string; attachmentRefs?: string[] | null },
    actor: { role: Role; memberId: string },
  ): Promise<{ entry?: DiaryEntry; error?: ServiceError }> {
    const existing = await this.repo.getEntry(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };

    if (
      input &&
      ('section_ref' in (input as object) ||
        'sectionRef' in (input as object) ||
        'student_ref' in (input as object) ||
        'studentRef' in (input as object) ||
        'entry_date' in (input as object) ||
        'entryDate' in (input as object))
    ) {
      return {
        error: {
          error: 'section_ref, student_ref, and entry_date are immutable',
          status: 400,
        },
      };
    }

    const withinWindow = hoursSince(existing.createdAt, this.clock()) <= 24;
    const isAuthor = existing.authorMemberId === actor.memberId;
    const isElevated = actor.role === 'school_admin' || actor.role === 'admin';

    if (withinWindow && isAuthor) {
      /* author edit window */
    } else if (isElevated) {
      /* admin override after window */
    } else if (withinWindow && !isAuthor) {
      return { error: { error: 'author_only', status: 403 } };
    } else {
      return { error: { error: 'edit_window_closed', status: 403 } };
    }

    let kind: DiaryKind | undefined;
    if (input.kind !== undefined) {
      kind = String(input.kind).trim() as DiaryKind;
      if (!KINDS.has(kind)) {
        return {
          error: {
            error: 'kind must be homework|note|remark|reminder',
            status: 400,
          },
        };
      }
    }
    let body: string | undefined;
    if (input.body !== undefined) {
      body = String(input.body);
      if (!body.trim()) {
        return { error: { error: 'body is required', status: 400 } };
      }
      if (body.length > MAX_BODY) {
        return { error: { error: 'body must be ≤2000 characters', status: 400 } };
      }
    }

    const entry = await this.repo.updateEntry(tenantId, id, {
      kind,
      body,
      attachmentRefs: input.attachmentRefs,
    });
    return { entry: entry! };
  }

  async deleteEntry(
    tenantId: string,
    id: string,
    actor: { role: Role; memberId: string },
  ): Promise<{ ok?: true; error?: ServiceError }> {
    if (actor.role !== 'school_admin' && actor.role !== 'admin') {
      return { error: { error: 'role_denied', status: 403 } };
    }
    const existing = await this.repo.getEntry(tenantId, id);
    if (!existing) return { error: { error: 'not_found', status: 404 } };
    await this.repo.deleteEntry(tenantId, id);
    this.logger?.warn(
      {
        tenantId,
        entryId: id,
        authorMemberId: existing.authorMemberId,
        deletedBy: actor.memberId,
      },
      'diary.entry.deleted',
    );
    return { ok: true };
  }

  async listStaff(
    tenantId: string,
    filters: { sectionRef?: string; date?: string; studentRef?: string },
    actor: { role: Role; memberId: string },
  ): Promise<{ entries?: DiaryEntry[]; error?: ServiceError }> {
    if (actor.role === 'teacher') {
      if (!filters.sectionRef) {
        return { error: { error: 'section_required', status: 400 } };
      }
      const scopeErr = await this.ensureTeacherSection(
        tenantId,
        actor.role,
        actor.memberId,
        filters.sectionRef,
      );
      if (scopeErr) return { error: scopeErr };
    }

    const rows = await this.repo.listEntries(tenantId, {
      sectionRef: filters.sectionRef,
      entryDate: filters.date,
      studentRef: filters.studentRef,
    });

    const entries: DiaryEntry[] = [];
    for (const row of rows) {
      const acks = await this.repo.countAcks(tenantId, row.id);
      entries.push({
        ...row,
        acks,
        // guardians_total is null — engagement doesn't know guardian counts; BFF/frontend composes
        guardiansTotal: null,
      });
    }
    return { entries };
  }

  async listGuardian(
    tenantId: string,
    opts: {
      studentRef: string;
      from?: string;
      to?: string;
      limit?: number;
      offset?: number;
      allowedStudents: string[];
    },
  ): Promise<{ entries?: DiaryEntry[]; error?: ServiceError }> {
    const studentRef = (opts.studentRef || '').trim();
    if (!studentRef) {
      return { error: { error: 'student_ref is required', status: 400 } };
    }
    if (!opts.allowedStudents.includes(studentRef)) {
      return { error: { error: 'forbidden', status: 403 } };
    }

    const section = await this.identity.getStudentSection(tenantId, studentRef);
    if ('error' in section) {
      return {
        error: {
          error:
            section.error === 'not_found' ? 'not_found' : 'section_unresolvable',
          status: section.status === 404 ? 404 : 503,
        },
      };
    }

    const now = this.clock();
    const to = opts.to && ISO_DATE.test(opts.to) ? opts.to : dayKey(now);
    const fromDefault = (() => {
      const d = new Date(now.getTime());
      d.setUTCDate(d.getUTCDate() - 14);
      return dayKey(d);
    })();
    const from =
      opts.from && ISO_DATE.test(opts.from) ? opts.from : fromDefault;
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    const rows = await this.repo.listGuardianFeed(
      tenantId,
      section.sectionRef,
      studentRef,
      from,
      to,
      limit,
      offset,
    );
    const entries: DiaryEntry[] = [];
    for (const row of rows) {
      const acks = await this.repo.countAcks(tenantId, row.id);
      entries.push({ ...row, acks, guardiansTotal: null });
    }
    return { entries };
  }

  async ack(
    tenantId: string,
    entryId: string,
    studentRef: string,
    guardianRef: string,
    allowedStudents: string[],
  ): Promise<{ ack?: { id: string; at: string }; error?: ServiceError }> {
    const student = (studentRef || '').trim();
    if (!student) {
      return { error: { error: 'student_ref is required', status: 400 } };
    }
    if (!allowedStudents.includes(student)) {
      return { error: { error: 'forbidden', status: 403 } };
    }
    const entry = await this.repo.getEntry(tenantId, entryId);
    if (!entry) return { error: { error: 'not_found', status: 404 } };

    const existing = await this.repo.findAck(
      tenantId,
      entryId,
      guardianRef,
      student,
    );
    if (existing) {
      return { ack: { id: existing.id, at: existing.at } };
    }
    const ack = await this.repo.insertAck({
      id: uuidv4(),
      tenantId,
      entryId,
      guardianRef,
      studentRef: student,
    });
    return { ack: { id: ack.id, at: ack.at } };
  }
}
