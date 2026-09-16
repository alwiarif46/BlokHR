import { Router, Request, Response, NextFunction } from 'express';
import type { EngagementService } from '../services/engagement-service';
import type { MessageService } from '../services/message-service';
import type { ThreadService } from '../services/thread-service';
import type { DiaryService } from '../services/diary-service';
import type { DiaryEntry } from '../types';
import type {
  ChannelInput,
  ChannelKind,
  DigestFrequency,
  MessageUrgency,
  OutboundStatus,
  TemplateKey,
  TemplateKind,
  ThreadDirection,
  ThreadState,
} from '../types';
import {
  enforceGuardianPrincipal,
  parseStudentsHeader,
} from '../internal-auth';
import { guardRoutes, assertTeacherMemberMatch } from '../role-guard';
import { ENGAGEMENT_ROUTE_POLICIES } from '../route-policies';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function staffOf(req: Request) {
  return (req as Request & { staff?: { ok: true; role: import('../role-guard').Role; memberId: string } })
    .staff;
}

/** Ack summary: guardians_total is null — engagement doesn't know counts; BFF/frontend composes. */
function diaryEntryJson(e: DiaryEntry) {
  return {
    id: e.id,
    tenantId: e.tenantId,
    sectionRef: e.sectionRef,
    studentRef: e.studentRef,
    entryDate: e.entryDate,
    kind: e.kind,
    body: e.body,
    attachmentRefs: e.attachmentRefs,
    authorMemberId: e.authorMemberId,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    acks: e.acks ?? 0,
    guardians_total: null as null,
  };
}

export function createEngagementRouter(
  service: EngagementService,
  messages: MessageService,
  threads: ThreadService,
  diary: DiaryService,
  opts: { internalSecret?: string } = {},
): Router {
  const internalSecret = opts.internalSecret ?? '';
  const router = Router({ mergeParams: true });

  guardRoutes(router, ENGAGEMENT_ROUTE_POLICIES, { internalSecret });

  router.get(
    '/:tenantId/guardians/:guardianRef/channels',
    asyncHandler(async (req, res) => {
      const result = await service.listChannels(
        req.params.tenantId,
        req.params.guardianRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ channels: result.channels });
    }),
  );

  router.put(
    '/:tenantId/guardians/:guardianRef/channels',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const raw = Array.isArray(body.channels) ? body.channels : [];
      const channels: ChannelInput[] = raw.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          channel: String(r.channel ?? '') as ChannelKind,
          address: String(r.address ?? ''),
          verified: r.verified !== undefined ? Boolean(r.verified) : false,
          priority: Number(r.priority),
          isActive:
            r.is_active !== undefined || r.isActive !== undefined
              ? Boolean(r.is_active ?? r.isActive)
              : true,
        };
      });
      const result = await service.putChannels(
        req.params.tenantId,
        req.params.guardianRef,
        channels,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ channels: result.channels });
    }),
  );

  router.get(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const result = await service.getSettings(req.params.tenantId);
      res.json(result.settings);
    }),
  );

  router.put(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.putSettings(req.params.tenantId, {
        dailyCapPerStudent:
          body.daily_cap_per_student !== undefined || body.dailyCapPerStudent !== undefined
            ? Number(body.daily_cap_per_student ?? body.dailyCapPerStudent)
            : undefined,
        digestHour:
          body.digest_hour !== undefined || body.digestHour !== undefined
            ? Number(body.digest_hour ?? body.digestHour)
            : undefined,
        digestFrequency:
          body.digest_frequency !== undefined || body.digestFrequency !== undefined
            ? (String(body.digest_frequency ?? body.digestFrequency) as DigestFrequency)
            : undefined,
        quietStart:
          body.quiet_start !== undefined || body.quietStart !== undefined
            ? Number(body.quiet_start ?? body.quietStart)
            : undefined,
        quietEnd:
          body.quiet_end !== undefined || body.quietEnd !== undefined
            ? Number(body.quiet_end ?? body.quietEnd)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.settings);
    }),
  );

  router.post(
    '/:tenantId/templates',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await messages.createTenantTemplate(req.params.tenantId, {
        key: String(body.key ?? '') as TemplateKey,
        lang: String(body.lang ?? ''),
        body: String(body.body ?? ''),
        kind: body.kind != null ? (String(body.kind) as TemplateKind) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.template);
    }),
  );

  router.post(
    '/:tenantId/messages',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const varsRaw = (body.vars ?? {}) as Record<string, unknown>;
      const vars: Record<string, string> = {};
      for (const [k, v] of Object.entries(varsRaw)) {
        vars[k] = v == null ? '' : String(v);
      }
      const result = await messages.queueMessage({
        tenantId: req.params.tenantId,
        studentRef:
          body.student_ref !== undefined || body.studentRef !== undefined
            ? body.student_ref === null || body.studentRef === null
              ? null
              : String(body.student_ref ?? body.studentRef)
            : null,
        guardianRef: String(body.guardian_ref ?? body.guardianRef ?? ''),
        templateKey: String(body.template_key ?? body.templateKey ?? '') as TemplateKey,
        lang: body.lang != null ? String(body.lang) : undefined,
        vars,
        urgency: String(body.urgency ?? '') as MessageUrgency,
        capExempt: Boolean(body.cap_exempt ?? body.capExempt ?? false),
      });
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.missing ? { missing: result.error.missing } : {}),
        });
        return;
      }
      res.status(201).json(result.message);
    }),
  );

  router.post(
    '/:tenantId/circulars',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await messages.sendCircular(req.params.tenantId, {
        sectionRef: String(body.section_ref ?? body.sectionRef ?? ''),
        body: String(body.body ?? ''),
        title:
          body.title !== undefined && body.title !== null
            ? String(body.title)
            : null,
        lang: body.lang != null ? String(body.lang) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({
        count: result.count ?? result.messages?.length ?? 0,
        messages: result.messages,
      });
    }),
  );

  router.get(
    '/:tenantId/messages',
    asyncHandler(async (req, res) => {
      const result = await messages.listMessages(req.params.tenantId, {
        studentRef:
          typeof req.query.student_ref === 'string'
            ? req.query.student_ref
            : typeof req.query.studentRef === 'string'
              ? req.query.studentRef
              : undefined,
        status:
          typeof req.query.status === 'string'
            ? (req.query.status as OutboundStatus)
            : undefined,
        date: typeof req.query.date === 'string' ? req.query.date : undefined,
      });
      res.json({ messages: result.messages });
    }),
  );

  router.post(
    '/:tenantId/ingest',
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await messages.ingestEvent(req.params.tenantId, body);
      if (result.error) {
        res.status(result.error.status).json({
          error: result.error.error,
          ...(result.error.missing ? { missing: result.error.missing } : {}),
        });
        return;
      }
      if (result.dropped) {
        res.status(200).json({ dropped: true });
        return;
      }
      if (result.messages && result.messages.length > 1) {
        res.status(201).json({
          messages: result.messages,
          count: result.messages.length,
        });
        return;
      }
      res.status(201).json(result.message);
    }),
  );

  router.post(
    '/:tenantId/digest/run',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const date = String(body.date ?? '');
      const result = await messages.runDigest(req.params.tenantId, date);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        guardians: result.guardians,
        skipped: result.skipped,
        messages: result.messages,
      });
    }),
  );

  router.get(
    '/:tenantId/pending-escalation',
    asyncHandler(async (req, res) => {
      const raw = req.query.minutes;
      const minutes = typeof raw === 'string' ? Number(raw) : Number(raw ?? 90);
      const result = await messages.listPendingEscalation(req.params.tenantId, minutes);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ messages: result.messages });
    }),
  );

  router.post(
    '/:tenantId/messages/:id/ack',
    asyncHandler(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const ackedBy =
        body.acked_by !== undefined || body.ackedBy !== undefined
          ? String(body.acked_by ?? body.ackedBy)
          : null;
      const result = await messages.ackMessage(req.params.tenantId, req.params.id, ackedBy);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/threads',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const result = await threads.createThread(req.params.tenantId, {
        guardianRef: gate.guardianId
          ? gate.guardianId
          : String(body.guardian_ref ?? body.guardianRef ?? ''),
        studentRef: String(body.student_ref ?? body.studentRef ?? ''),
        subject: String(body.subject ?? ''),
        body: String(body.body ?? ''),
        author: String(body.author ?? ''),
        langOriginal:
          body.lang_original !== undefined || body.langOriginal !== undefined
            ? body.lang_original == null && body.langOriginal == null
              ? null
              : String(body.lang_original ?? body.langOriginal)
            : undefined,
        bodyTranslated:
          body.body_translated !== undefined || body.bodyTranslated !== undefined
            ? body.body_translated == null && body.bodyTranslated == null
              ? null
              : String(body.body_translated ?? body.bodyTranslated)
            : undefined,
        translatedFlag: Boolean(body.translated_flag ?? body.translatedFlag ?? false),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ thread: result.thread, message: result.message });
    }),
  );

  router.get(
    '/:tenantId/threads/overdue',
    asyncHandler(async (req, res) => {
      const raw = req.query.hours;
      const hours = typeof raw === 'string' ? Number(raw) : Number(raw ?? 24);
      const result = await threads.listOverdue(req.params.tenantId, hours);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ threads: result.threads });
    }),
  );

  router.get(
    '/:tenantId/threads',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const result = await threads.list(req.params.tenantId, {
        state:
          typeof req.query.state === 'string'
            ? (req.query.state as ThreadState)
            : undefined,
        guardianRef: gate.guardianId
          ? gate.guardianId
          : typeof req.query.guardian_ref === 'string'
            ? req.query.guardian_ref
            : typeof req.query.guardianRef === 'string'
              ? req.query.guardianRef
              : undefined,
        studentRef:
          typeof req.query.student_ref === 'string'
            ? req.query.student_ref
            : typeof req.query.studentRef === 'string'
              ? req.query.studentRef
              : undefined,
        assignedTo:
          typeof req.query.assigned_to === 'string'
            ? req.query.assigned_to
            : typeof req.query.assignedTo === 'string'
              ? req.query.assignedTo
              : undefined,
      });
      res.json({ threads: result.threads });
    }),
  );

  router.get(
    '/:tenantId/threads/:id',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const result = await threads.get(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      if (
        gate.guardianId &&
        result.thread &&
        result.thread.guardianRef !== gate.guardianId
      ) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      res.json({ thread: result.thread, messages: result.messages });
    }),
  );

  router.post(
    '/:tenantId/threads/:id/reply',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (gate.guardianId) {
        const existing = await threads.get(req.params.tenantId, req.params.id);
        if (existing.error) {
          res.status(existing.error.status).json({ error: existing.error.error });
          return;
        }
        if (existing.thread!.guardianRef !== gate.guardianId) {
          res.status(403).json({ error: 'forbidden' });
          return;
        }
      } else {
        // Teacher school-side reply only on threads assigned to them (P12-04).
        const staff = staffOf(req);
        if (staff?.ok && staff.role === 'teacher') {
          const existing = await threads.get(req.params.tenantId, req.params.id);
          if (existing.error) {
            res.status(existing.error.status).json({ error: existing.error.error });
            return;
          }
          const assigned = existing.thread!.assignedTo ?? '';
          const match = assertTeacherMemberMatch(req, assigned);
          if (!('ok' in match)) {
            res.status(match.status).json({ error: match.error });
            return;
          }
        }
      }
      const body = req.body as Record<string, unknown>;
      const result = await threads.reply(req.params.tenantId, req.params.id, {
        direction: gate.guardianId
          ? 'guardian'
          : (String(body.direction ?? '') as ThreadDirection),
        body: String(body.body ?? ''),
        author: gate.guardianId
          ? String(body.author ?? `guardian:${gate.guardianId}`)
          : String(body.author ?? ''),
        langOriginal:
          body.lang_original !== undefined || body.langOriginal !== undefined
            ? body.lang_original == null && body.langOriginal == null
              ? null
              : String(body.lang_original ?? body.langOriginal)
            : undefined,
        bodyTranslated:
          body.body_translated !== undefined || body.bodyTranslated !== undefined
            ? body.body_translated == null && body.bodyTranslated == null
              ? null
              : String(body.body_translated ?? body.bodyTranslated)
            : undefined,
        translatedFlag: Boolean(body.translated_flag ?? body.translatedFlag ?? false),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ thread: result.thread, message: result.message });
    }),
  );

  router.post(
    '/:tenantId/threads/:id/assign',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await threads.assign(
        req.params.tenantId,
        req.params.id,
        String(body.assigned_to ?? body.assignedTo ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.thread);
    }),
  );

  router.post(
    '/:tenantId/threads/:id/close',
    asyncHandler(async (req, res) => {
      const result = await threads.close(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.thread);
    }),
  );

  router.post(
    '/:tenantId/diary',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff?.ok) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await diary.createEntry(
        req.params.tenantId,
        {
          sectionRef: String(body.section_ref ?? body.sectionRef ?? ''),
          studentRef:
            body.student_ref !== undefined || body.studentRef !== undefined
              ? body.student_ref == null && body.studentRef == null
                ? null
                : String(body.student_ref ?? body.studentRef)
              : null,
          entryDate: String(body.entry_date ?? body.entryDate ?? ''),
          kind: String(body.kind ?? ''),
          body: String(body.body ?? ''),
          attachmentRefs: Array.isArray(body.attachment_refs)
            ? (body.attachment_refs as unknown[]).map(String)
            : Array.isArray(body.attachmentRefs)
              ? (body.attachmentRefs as unknown[]).map(String)
              : null,
        },
        { role: staff.role, memberId: staff.memberId },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(diaryEntryJson(result.entry!));
    }),
  );

  router.get(
    '/:tenantId/diary',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff?.ok) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const result = await diary.listStaff(
        req.params.tenantId,
        {
          sectionRef:
            typeof req.query.section_ref === 'string'
              ? req.query.section_ref
              : typeof req.query.sectionRef === 'string'
                ? req.query.sectionRef
                : undefined,
          date: typeof req.query.date === 'string' ? req.query.date : undefined,
          studentRef:
            typeof req.query.student_ref === 'string'
              ? req.query.student_ref
              : typeof req.query.studentRef === 'string'
                ? req.query.studentRef
                : undefined,
        },
        { role: staff.role, memberId: staff.memberId },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ entries: (result.entries ?? []).map(diaryEntryJson) });
    }),
  );

  router.patch(
    '/:tenantId/diary/:id',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff?.ok) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (
        'section_ref' in body ||
        'sectionRef' in body ||
        'student_ref' in body ||
        'studentRef' in body ||
        'entry_date' in body ||
        'entryDate' in body
      ) {
        res.status(400).json({
          error: 'section_ref, student_ref, and entry_date are immutable',
        });
        return;
      }
      const result = await diary.patchEntry(
        req.params.tenantId,
        req.params.id,
        {
          kind: body.kind !== undefined ? String(body.kind) : undefined,
          body: body.body !== undefined ? String(body.body) : undefined,
          attachmentRefs: Array.isArray(body.attachment_refs)
            ? (body.attachment_refs as unknown[]).map(String)
            : Array.isArray(body.attachmentRefs)
              ? (body.attachmentRefs as unknown[]).map(String)
              : body.attachment_refs === null || body.attachmentRefs === null
                ? null
                : undefined,
        },
        { role: staff.role, memberId: staff.memberId },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(diaryEntryJson(result.entry!));
    }),
  );

  router.delete(
    '/:tenantId/diary/:id',
    asyncHandler(async (req, res) => {
      const staff = staffOf(req);
      if (!staff?.ok) {
        res.status(403).json({ error: 'role_denied' });
        return;
      }
      const result = await diary.deleteEntry(
        req.params.tenantId,
        req.params.id,
        { role: staff.role, memberId: staff.memberId },
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/guardian/diary',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (!gate.guardianId) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const studentRef =
        typeof req.query.student_ref === 'string'
          ? req.query.student_ref
          : typeof req.query.studentRef === 'string'
            ? req.query.studentRef
            : '';
      const result = await diary.listGuardian(req.params.tenantId, {
        studentRef,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
        allowedStudents: parseStudentsHeader(req),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ entries: (result.entries ?? []).map(diaryEntryJson) });
    }),
  );

  router.post(
    '/:tenantId/guardian/diary/:id/ack',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (!gate.guardianId) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await diary.ack(
        req.params.tenantId,
        req.params.id,
        String(body.student_ref ?? body.studentRef ?? ''),
        gate.guardianId,
        parseStudentsHeader(req),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ack: result.ack });
    }),
  );

  return router;
}

export { ENGAGEMENT_ROUTE_POLICIES };
