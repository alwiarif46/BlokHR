import { Router, Request, Response, NextFunction } from 'express';
import type { EngagementService } from '../services/engagement-service';
import type { MessageService } from '../services/message-service';
import type { ThreadService } from '../services/thread-service';
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

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createEngagementRouter(
  service: EngagementService,
  messages: MessageService,
  threads: ThreadService,
): Router {
  const router = Router({ mergeParams: true });

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
      const body = req.body as Record<string, unknown>;
      const result = await threads.createThread(req.params.tenantId, {
        guardianRef: String(body.guardian_ref ?? body.guardianRef ?? ''),
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
      const result = await threads.list(req.params.tenantId, {
        state:
          typeof req.query.state === 'string'
            ? (req.query.state as ThreadState)
            : undefined,
        guardianRef:
          typeof req.query.guardian_ref === 'string'
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
      const result = await threads.get(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ thread: result.thread, messages: result.messages });
    }),
  );

  router.post(
    '/:tenantId/threads/:id/reply',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await threads.reply(req.params.tenantId, req.params.id, {
        direction: String(body.direction ?? '') as ThreadDirection,
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

  return router;
}
