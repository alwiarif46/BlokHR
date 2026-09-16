import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { NotifySink } from '../events';
import type { EngagementRepository } from '../repositories/engagement-repository';
import type { EngagementService } from './engagement-service';
import type { IdentityClient } from '../clients/identity-client';
import type {
  ListMessagesFilters,
  MessageTemplate,
  OutboundMessage,
  QueueMessageInput,
  TemplateKey,
  TemplateKind,
} from '../types';

type ServiceError = { error: string; status: number; missing?: string[] };

const TEMPLATE_KEYS = new Set<TemplateKey>([
  'absence_alert',
  'attendance_nudge',
  'fee_reminder',
  'digest',
  'general',
]);

const TEMPLATE_KINDS = new Set<TemplateKind>(['transactional', 'informational']);

export function extractPlaceholders(body: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    found.add(m[1]!);
  }
  return [...found];
}

export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_all, key: string) => {
    return vars[key] ?? '';
  });
}

/** Hour-of-day quiet window; overnight when start > end. */
export function isInQuietHours(hour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false;
  if (quietStart < quietEnd) return hour >= quietStart && hour < quietEnd;
  return hour >= quietStart || hour < quietEnd;
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1 || v === '1') return true;
  if (v === 'false' || v === 0 || v === '0') return false;
  return Boolean(v);
}

export class MessageService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly engagement: EngagementService,
    private readonly notify: NotifySink,
    private readonly clock: () => Date = () => new Date(),
    private readonly logger: Logger | null = null,
    private readonly identity: IdentityClient | null = null,
  ) {}

  async createTenantTemplate(
    tenantId: string,
    input: { key: TemplateKey; lang: string; body: string; kind?: TemplateKind },
  ): Promise<{ template?: MessageTemplate; error?: ServiceError }> {
    if (!TEMPLATE_KEYS.has(input.key)) {
      return { error: { error: 'invalid template key', status: 400 } };
    }
    const lang = (input.lang || '').trim().slice(0, 16);
    if (!lang) return { error: { error: 'lang is required', status: 400 } };
    const body = String(input.body ?? '');
    if (!body.trim()) return { error: { error: 'body is required', status: 400 } };
    const kind = input.kind ?? 'informational';
    if (!TEMPLATE_KINDS.has(kind)) {
      return { error: { error: 'invalid template kind', status: 400 } };
    }
    const template = await this.repo.insertTemplate({
      id: uuidv4(),
      tenantId,
      key: input.key,
      lang,
      body,
      kind,
      reviewed: false,
      createdAt: '',
    });
    return { template };
  }

  async queueMessage(
    input: QueueMessageInput,
  ): Promise<{ message?: OutboundMessage; error?: ServiceError }> {
    const guardianRef = (input.guardianRef || '').trim();
    if (!guardianRef) {
      return { error: { error: 'guardian_ref is required', status: 400 } };
    }
    if (!TEMPLATE_KEYS.has(input.templateKey)) {
      return { error: { error: 'invalid template_key', status: 400 } };
    }
    if (input.urgency !== 'interrupt' && input.urgency !== 'digest') {
      return { error: { error: 'urgency must be interrupt or digest', status: 400 } };
    }

    const preferredLang = (input.lang || 'en').trim() || 'en';
    const tpl = await this.repo.findTemplate(input.tenantId, input.templateKey, preferredLang);
    if (!tpl) {
      return { error: { error: 'template not found', status: 404 } };
    }

    const vars = input.vars ?? {};
    const required = extractPlaceholders(tpl.body);
    const missing = required.filter((k) => vars[k] === undefined || vars[k] === null);
    if (missing.length > 0) {
      return {
        error: { error: 'missing template vars', status: 400, missing },
      };
    }
    const stringVars: Record<string, string> = {};
    for (const k of required) {
      stringVars[k] = String(vars[k] ?? '');
    }
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in stringVars)) stringVars[k] = String(v ?? '');
    }
    const renderedBody = renderTemplate(tpl.body, stringVars);
    const now = this.clock();
    const studentRef =
      input.studentRef === undefined || input.studentRef === null
        ? null
        : String(input.studentRef).trim() || null;

    const base = {
      id: uuidv4(),
      tenantId: input.tenantId,
      studentRef,
      guardianRef,
      templateKey: input.templateKey,
      lang: tpl.lang,
      renderedBody,
      createdAt: now.toISOString(),
    };

    if (input.urgency === 'digest') {
      const message = await this.repo.insertOutboundMessage({
        ...base,
        channel: '',
        status: 'queued',
        suppressReason: null,
        sentAt: null,
      });
      return { message };
    }

    const { settings } = await this.engagement.getSettings(input.tenantId);
    const hour = now.getUTCHours();
    if (
      isInQuietHours(hour, settings.quietStart, settings.quietEnd) &&
      input.templateKey !== 'absence_alert'
    ) {
      const message = await this.repo.insertOutboundMessage({
        ...base,
        channel: '',
        status: 'suppressed_quiet',
        suppressReason: 'quiet_hours',
        sentAt: null,
      });
      return { message };
    }

    if (!input.capExempt && studentRef) {
      const sentToday = await this.repo.countSentInterruptToday(
        input.tenantId,
        studentRef,
        dayKey(now),
      );
      if (sentToday >= settings.dailyCapPerStudent) {
        const message = await this.repo.insertOutboundMessage({
          ...base,
          channel: '',
          status: 'suppressed_cap',
          suppressReason: 'daily_cap',
          sentAt: null,
        });
        return { message };
      }
    }

    const channelsResult = await this.engagement.listChannels(input.tenantId, guardianRef);
    const channels = (channelsResult.channels ?? [])
      .filter((c) => c.verified && c.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (channels.length === 0) {
      const message = await this.repo.insertOutboundMessage({
        ...base,
        channel: '',
        status: 'failed',
        suppressReason: 'no_channel',
        sentAt: null,
      });
      return { message };
    }

    let lastErr: string | null = null;
    for (const ch of channels) {
      try {
        await this.notify.send({
          channel: ch.channel,
          address: ch.address,
          body: renderedBody,
        });
        const message = await this.repo.insertOutboundMessage({
          ...base,
          channel: ch.channel,
          status: 'sent',
          suppressReason: null,
          sentAt: now.toISOString(),
        });
        return { message };
      } catch (err) {
        lastErr = err instanceof Error ? err.message : 'notify_failed';
      }
    }

    const message = await this.repo.insertOutboundMessage({
      ...base,
      channel: channels[channels.length - 1]!.channel,
      status: 'failed',
      suppressReason: lastErr ?? 'notify_failed',
      sentAt: null,
    });
    return { message };
  }

  /**
   * Staff circular: fan-out `general` messages to all guardians in a section.
   */
  async sendCircular(
    tenantId: string,
    input: {
      sectionRef: string;
      body: string;
      title?: string | null;
      lang?: string;
    },
  ): Promise<{
    messages?: OutboundMessage[];
    count?: number;
    error?: ServiceError;
  }> {
    const sectionRef = (input.sectionRef || '').trim();
    const body = String(input.body ?? '').trim();
    if (!sectionRef) {
      return { error: { error: 'section_ref is required', status: 400 } };
    }
    if (!body) {
      return { error: { error: 'body is required', status: 400 } };
    }
    if (!this.identity) {
      return { error: { error: 'identity_unavailable', status: 503 } };
    }
    const listed = await this.identity.listGuardiansForSection(tenantId, sectionRef);
    if ('error' in listed) {
      this.logger?.warn(
        { tenantId, sectionRef, err: listed.error },
        'engagement.circular.identity_fail',
      );
      return { error: { error: 'identity_unavailable', status: 503 } };
    }
    if (listed.guardians.length === 0) {
      return { error: { error: 'no_guardians_for_section', status: 404 } };
    }
    const title = (input.title || '').trim();
    const messageText = title ? `${title}\n\n${body}` : body;
    const lang = (input.lang || 'en').trim() || 'en';
    const messages: OutboundMessage[] = [];
    for (const g of listed.guardians) {
      const result = await this.queueMessage({
        tenantId,
        guardianRef: g.guardianId,
        studentRef: g.studentId || null,
        templateKey: 'general',
        lang,
        vars: { message: messageText },
        urgency: 'digest',
      });
      if (result.message) messages.push(result.message);
    }
    if (messages.length === 0) {
      return { error: { error: 'circular_queue_failed', status: 502 } };
    }
    return { messages, count: messages.length };
  }

  async listMessages(
    tenantId: string,
    filters: ListMessagesFilters,
  ): Promise<{ messages: OutboundMessage[] }> {
    return { messages: await this.repo.listOutboundMessages(tenantId, filters) };
  }

  async ingestEvent(
    tenantId: string,
    body: Record<string, unknown>,
  ): Promise<{
    dropped?: boolean;
    message?: OutboundMessage;
    messages?: OutboundMessage[];
    error?: ServiceError;
  }> {
    const type = String(body.type ?? '').trim();
    const data =
      body.data && typeof body.data === 'object' && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : body;

    if (type === 'school.attendance.marked_absent') {
      if (bool(data.explained) === true) {
        return { dropped: true };
      }
      const guardianRef = str(data.guardian_ref ?? data.guardianRef);
      const studentRef = str(data.student_ref ?? data.studentRef) ?? null;
      if (!guardianRef) {
        return { error: { error: 'guardian_ref is required', status: 400 } };
      }
      const lang = str(data.lang ?? data.locale) ?? 'en';
      const vars: Record<string, string> = {
        student_name: String(data.student_name ?? data.studentName ?? ''),
        date: String(data.date ?? dayKey(this.clock())),
        period_label: String(data.period_label ?? data.periodLabel ?? ''),
      };
      const result = await this.queueMessage({
        tenantId,
        guardianRef,
        studentRef,
        templateKey: 'absence_alert',
        lang,
        vars,
        urgency: 'interrupt',
      });
      if (result.error) return { error: result.error };
      return { message: result.message };
    }

    if (type === 'school.nudge.send') {
      const guardianRef = str(data.guardian_ref ?? data.guardianRef);
      const studentRef = str(data.student_ref ?? data.studentRef) ?? null;
      if (!guardianRef) {
        return { error: { error: 'guardian_ref is required', status: 400 } };
      }
      const lang = str(data.lang ?? data.locale) ?? 'en';
      const vars: Record<string, string> = {
        student_name: String(data.student_name ?? data.studentName ?? ''),
        date: String(data.date ?? dayKey(this.clock())),
      };
      const result = await this.queueMessage({
        tenantId,
        guardianRef,
        studentRef,
        templateKey: 'attendance_nudge',
        lang,
        vars,
        urgency: 'interrupt',
        capExempt: true,
      });
      if (result.error) return { error: result.error };
      return { message: result.message };
    }

    if (type === 'school.fee.invoice_issued') {
      return this.ingestGuardianTemplateEvent(tenantId, data, {
        templateKey: 'fee_reminder',
        urgency: 'interrupt',
        vars: {
          student_name: String(
            data.student_name ??
              data.studentName ??
              data.student_ref ??
              data.studentRef ??
              '',
          ),
          period_label: String(data.period_label ?? data.periodLabel ?? ''),
          total_paise: String(data.total_paise ?? data.totalPaise ?? ''),
        },
      });
    }

    if (
      type === 'school.transport.boarded' ||
      type === 'school.transport.alighted' ||
      type === 'school.transport.missed_boarding' ||
      type === 'school.transport.delayed'
    ) {
      const label = type.replace('school.transport.', '');
      const useNudge = type === 'school.transport.missed_boarding';
      return this.ingestGuardianTemplateEvent(tenantId, data, {
        templateKey: useNudge ? 'attendance_nudge' : 'general',
        urgency: 'interrupt',
        vars: useNudge
          ? {
              student_name: String(
                data.student_name ??
                  data.studentName ??
                  data.student_ref ??
                  data.studentRef ??
                  '',
              ),
              date: String(data.date ?? dayKey(this.clock())),
            }
          : {
              message: String(
                data.message ??
                  `Transport ${label}: ${data.student_ref ?? data.studentRef ?? data.route_id ?? data.routeId ?? ''}`.trim(),
              ),
            },
      });
    }

    if (type === 'school.survey.published') {
      return this.ingestGuardianTemplateEvent(tenantId, data, {
        templateKey: 'general',
        urgency: 'digest',
        vars: {
          message: String(
            data.message ??
              `New survey published: ${data.title ?? data.surveyId ?? data.survey_id ?? ''}`.trim(),
          ),
        },
      });
    }

    if (type === 'school.diary.created') {
      const studentRef = str(data.student_ref ?? data.studentRef) ?? null;
      const sectionRef = str(data.section_ref ?? data.sectionRef);
      const lang = str(data.lang ?? data.locale) ?? 'en';
      const kind = String(data.kind ?? 'note');
      const entryDate = String(
        data.entry_date ?? data.entryDate ?? dayKey(this.clock()),
      );
      const bodyText = String(data.body ?? '').trim();
      const diaryMessage =
        bodyText ||
        `Diary update (${kind}) for ${entryDate}` +
          (studentRef ? ` — student ${studentRef}` : sectionRef ? ` — section ${sectionRef}` : '');
      const vars: Record<string, string> = {
        student_name: String(
          data.student_name ?? data.studentName ?? studentRef ?? '',
        ),
        date: entryDate,
        message: diaryMessage,
      };

      // Class-wide: enumerate guardians via identity when IDENTITY_URL is set.
      if (!studentRef) {
        if (!sectionRef) {
          this.logger?.info(
            { tenantId, type, kind: data.kind },
            'engagement.ingest.diary_classwide_noop',
          );
          return { dropped: true };
        }
        if (!this.identity) {
          this.logger?.info(
            { tenantId, type, sectionRef },
            'engagement.ingest.diary_classwide_no_identity',
          );
          return { dropped: true };
        }
        const listed = await this.identity.listGuardiansForSection(
          tenantId,
          sectionRef,
        );
        if ('error' in listed) {
          this.logger?.warn(
            { tenantId, type, sectionRef, err: listed.error },
            'engagement.ingest.diary_classwide_identity_fail',
          );
          return { dropped: true };
        }
        if (listed.guardians.length === 0) {
          this.logger?.info(
            { tenantId, type, sectionRef },
            'engagement.ingest.diary_classwide_empty',
          );
          return { dropped: true };
        }
        const messages: OutboundMessage[] = [];
        for (const g of listed.guardians) {
          const result = await this.queueMessage({
            tenantId,
            guardianRef: g.guardianId,
            studentRef: g.studentId || null,
            templateKey: 'general',
            lang,
            vars: {
              ...vars,
              student_name: vars.student_name || g.studentId,
            },
            urgency: 'digest',
          });
          if (result.message) messages.push(result.message);
        }
        if (messages.length === 0) return { dropped: true };
        return { messages, message: messages[0] };
      }

      // Student-specific: resolve guardians via identity (fail-closed if down).
      if (!this.identity) {
        this.logger?.info(
          { tenantId, type, studentRef, sectionRef },
          'engagement.ingest.diary_no_identity',
        );
        return { dropped: true };
      }
      const listed = await this.identity.listGuardiansForStudent(
        tenantId,
        studentRef,
      );
      if ('error' in listed) {
        this.logger?.warn(
          { tenantId, type, studentRef, err: listed.error },
          'engagement.ingest.diary_student_identity_fail',
        );
        return { dropped: true };
      }
      if (listed.guardians.length === 0) {
        this.logger?.info(
          { tenantId, type, studentRef, sectionRef },
          'engagement.ingest.diary_no_guardian_noop',
        );
        return { dropped: true };
      }
      const messages: OutboundMessage[] = [];
      for (const g of listed.guardians) {
        const result = await this.queueMessage({
          tenantId,
          guardianRef: g.guardianId,
          studentRef,
          templateKey: 'general',
          lang,
          vars,
          urgency: 'digest',
        });
        if (result.message) messages.push(result.message);
      }
      if (messages.length === 0) return { dropped: true };
      return { messages, message: messages[0] };
    }

    this.logger?.info({ tenantId, type }, 'engagement.ingest.unknown_event');
    return { dropped: true };
  }

  private async ingestGuardianTemplateEvent(
    tenantId: string,
    data: Record<string, unknown>,
    opts: {
      templateKey: TemplateKey;
      urgency: 'interrupt' | 'digest';
      vars: Record<string, string>;
    },
  ): Promise<{
    dropped?: boolean;
    message?: OutboundMessage;
    error?: ServiceError;
  }> {
    const guardianRef = str(data.guardian_ref ?? data.guardianRef);
    const studentRef = str(data.student_ref ?? data.studentRef) ?? null;
    if (!guardianRef) {
      this.logger?.info(
        { tenantId, templateKey: opts.templateKey, studentRef },
        'engagement.ingest.no_guardian_noop',
      );
      return { dropped: true };
    }
    const lang = str(data.lang ?? data.locale) ?? 'en';
    const result = await this.queueMessage({
      tenantId,
      guardianRef,
      studentRef,
      templateKey: opts.templateKey,
      lang,
      vars: opts.vars,
      urgency: opts.urgency,
    });
    if (result.error) return { error: result.error };
    return { message: result.message };
  }

  async runDigest(
    tenantId: string,
    date: string,
  ): Promise<{
    guardians?: number;
    messages?: OutboundMessage[];
    skipped?: number;
    error?: ServiceError;
  }> {
    const day = (date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { error: { error: 'date must be YYYY-MM-DD', status: 400 } };
    }

    const queued = await this.repo.listQueuedDigestMessages(tenantId, day);
    const byGuardian = new Map<string, OutboundMessage[]>();
    for (const row of queued) {
      const list = byGuardian.get(row.guardianRef) ?? [];
      list.push(row);
      byGuardian.set(row.guardianRef, list);
    }

    const messages: OutboundMessage[] = [];
    let skipped = 0;

    for (const [guardianRef, items] of byGuardian) {
      const existing = await this.repo.getDigestRun(tenantId, guardianRef, day);
      if (existing) {
        skipped += 1;
        continue;
      }

      const lines = items.map((m) => m.renderedBody).join('\n');
      const result = await this.queueMessage({
        tenantId,
        guardianRef,
        studentRef: null,
        templateKey: 'digest',
        lang: 'en',
        vars: { items: lines },
        urgency: 'interrupt',
        capExempt: true,
      });
      if (result.error || !result.message) {
        return { error: result.error ?? { error: 'digest dispatch failed', status: 500 } };
      }
      messages.push(result.message);

      const sentAt = this.clock().toISOString();
      for (const item of items) {
        await this.repo.markOutboundSent(
          tenantId,
          item.id,
          result.message.channel || 'digest',
          sentAt,
        );
      }
      await this.repo.insertDigestRun(tenantId, guardianRef, day, result.message.id);
    }

    return { guardians: messages.length, messages, skipped };
  }

  async ackMessage(
    tenantId: string,
    messageId: string,
    ackedBy?: string | null,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.ackMessage(tenantId, messageId, ackedBy);
    if (!ok) return { error: { error: 'message not found', status: 404 } };
    return { ok: true };
  }

  async listPendingEscalation(
    tenantId: string,
    minutes: number,
  ): Promise<{ messages?: OutboundMessage[]; error?: ServiceError }> {
    if (!Number.isFinite(minutes) || minutes < 0) {
      return { error: { error: 'minutes must be a non-negative number', status: 400 } };
    }
    const cutoff = new Date(this.clock().getTime() - minutes * 60_000).toISOString();
    return { messages: await this.repo.listPendingEscalation(tenantId, cutoff) };
  }
}
