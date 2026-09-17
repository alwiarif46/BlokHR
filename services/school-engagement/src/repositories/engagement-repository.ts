import type { SchoolEngagementDb } from '../db';
import { currentEngagementDb } from '../db-context';
import type {
  ChannelKind,
  DigestFrequency,
  EngagementSettings,
  GuardianChannel,
  ListMessagesFilters,
  ListThreadsFilters,
  MessageTemplate,
  OutboundMessage,
  OutboundStatus,
  TemplateKey,
  TemplateKind,
  Thread,
  ThreadDirection,
  ThreadMessage,
  ThreadState,
} from '../types';

interface ChannelRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  guardian_ref: string;
  channel: string;
  address: string;
  verified: number;
  priority: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface SettingsRow extends Record<string, unknown> {
  tenant_id: string;
  daily_cap_per_student: number;
  digest_hour: number;
  digest_frequency: string;
  quiet_start: number;
  quiet_end: number;
  updated_at: string;
}

function mapChannel(row: ChannelRow): GuardianChannel {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    guardianRef: row.guardian_ref,
    channel: row.channel as ChannelKind,
    address: row.address,
    verified: row.verified === 1,
    priority: row.priority,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row: SettingsRow): EngagementSettings {
  return {
    tenantId: row.tenant_id,
    dailyCapPerStudent: row.daily_cap_per_student,
    digestHour: row.digest_hour,
    digestFrequency: row.digest_frequency as DigestFrequency,
    quietStart: row.quiet_start,
    quietEnd: row.quiet_end,
    updatedAt: row.updated_at,
  };
}

export class EngagementRepository {
  constructor(private readonly fallbackDb: SchoolEngagementDb) {}

  private get db(): SchoolEngagementDb {
    return currentEngagementDb(this.fallbackDb);
  }

  async listChannels(tenantId: string, guardianRef: string): Promise<GuardianChannel[]> {
    const rows = await this.db.all<ChannelRow>(
      `SELECT * FROM guardian_channels
       WHERE tenant_id = ? AND guardian_ref = ?
       ORDER BY priority ASC, created_at ASC`,
      [tenantId, guardianRef],
    );
    return rows.map(mapChannel);
  }

  async deleteChannelsForGuardian(tenantId: string, guardianRef: string): Promise<void> {
    await this.db.run(
      'DELETE FROM guardian_channels WHERE tenant_id = ? AND guardian_ref = ?',
      [tenantId, guardianRef],
    );
  }

  async insertChannel(channel: GuardianChannel): Promise<GuardianChannel> {
    await this.db.run(
      `INSERT INTO guardian_channels (
         id, tenant_id, guardian_ref, channel, address, verified, priority, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        channel.id,
        channel.tenantId,
        channel.guardianRef,
        channel.channel,
        channel.address,
        channel.verified ? 1 : 0,
        channel.priority,
        channel.isActive ? 1 : 0,
      ],
    );
    const rows = await this.listChannels(channel.tenantId, channel.guardianRef);
    const created = rows.find((c) => c.id === channel.id);
    if (!created) throw new Error('Failed to read inserted channel');
    return created;
  }

  async getSettings(tenantId: string): Promise<EngagementSettings | null> {
    const row = await this.db.get<SettingsRow>(
      'SELECT * FROM engagement_settings WHERE tenant_id = ?',
      [tenantId],
    );
    return row ? mapSettings(row) : null;
  }

  async upsertSettings(settings: EngagementSettings): Promise<EngagementSettings> {
    await this.db.run(
      `INSERT INTO engagement_settings (
         tenant_id, daily_cap_per_student, digest_hour, digest_frequency,
         quiet_start, quiet_end
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id) DO UPDATE SET
         daily_cap_per_student = excluded.daily_cap_per_student,
         digest_hour = excluded.digest_hour,
         digest_frequency = excluded.digest_frequency,
         quiet_start = excluded.quiet_start,
         quiet_end = excluded.quiet_end,
         updated_at = datetime('now')`,
      [
        settings.tenantId,
        settings.dailyCapPerStudent,
        settings.digestHour,
        settings.digestFrequency,
        settings.quietStart,
        settings.quietEnd,
      ],
    );
    const saved = await this.getSettings(settings.tenantId);
    if (!saved) throw new Error('Failed to read upserted settings');
    return saved;
  }

  async findTemplate(
    tenantId: string,
    key: TemplateKey,
    lang: string,
  ): Promise<MessageTemplate | null> {
    const tenantRow = await this.db.get<TemplateRow>(
      `SELECT * FROM message_templates
       WHERE tenant_id = ? AND key = ? AND lang = ?
       LIMIT 1`,
      [tenantId, key, lang],
    );
    if (tenantRow) return mapTemplate(tenantRow);
    const globalLang = await this.db.get<TemplateRow>(
      `SELECT * FROM message_templates
       WHERE tenant_id IS NULL AND key = ? AND lang = ?
       LIMIT 1`,
      [key, lang],
    );
    if (globalLang) return mapTemplate(globalLang);
    if (lang !== 'en') {
      const globalEn = await this.db.get<TemplateRow>(
        `SELECT * FROM message_templates
         WHERE tenant_id IS NULL AND key = ? AND lang = 'en'
         LIMIT 1`,
        [key],
      );
      if (globalEn) return mapTemplate(globalEn);
    }
    return null;
  }

  async insertTemplate(t: MessageTemplate): Promise<MessageTemplate> {
    await this.db.run(
      `INSERT INTO message_templates (id, tenant_id, key, lang, body, kind, reviewed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.tenantId,
        t.key,
        t.lang,
        t.body,
        t.kind,
        t.reviewed ? 1 : 0,
      ],
    );
    const row = await this.db.get<TemplateRow>(
      'SELECT * FROM message_templates WHERE id = ?',
      [t.id],
    );
    if (!row) throw new Error('Failed to read inserted template');
    return mapTemplate(row);
  }

  async insertOutboundMessage(m: OutboundMessage): Promise<OutboundMessage> {
    await this.db.run(
      `INSERT INTO outbound_messages (
         id, tenant_id, student_ref, guardian_ref, template_key, lang,
         channel, rendered_body, status, suppress_reason, created_at, sent_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.tenantId,
        m.studentRef,
        m.guardianRef,
        m.templateKey,
        m.lang,
        m.channel,
        m.renderedBody,
        m.status,
        m.suppressReason,
        m.createdAt || new Date().toISOString(),
        m.sentAt,
      ],
    );
    const created = await this.getOutboundMessage(m.tenantId, m.id);
    if (!created) throw new Error('Failed to read inserted outbound message');
    return created;
  }

  async getOutboundMessage(tenantId: string, id: string): Promise<OutboundMessage | null> {
    const row = await this.db.get<OutboundRow>(
      'SELECT * FROM outbound_messages WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapOutbound(row) : null;
  }

  async listOutboundMessages(
    tenantId: string,
    filters: ListMessagesFilters,
  ): Promise<OutboundMessage[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.studentRef) {
      clauses.push('student_ref = ?');
      params.push(filters.studentRef);
    }
    if (filters.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }
    if (filters.date) {
      clauses.push(`substr(created_at, 1, 10) = ?`);
      params.push(filters.date);
    }
    const rows = await this.db.all<OutboundRow>(
      `SELECT * FROM outbound_messages
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC`,
      params,
    );
    return rows.map(mapOutbound);
  }

  async countSentInterruptToday(
    tenantId: string,
    studentRef: string,
    day: string,
  ): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM outbound_messages
       WHERE tenant_id = ?
         AND student_ref = ?
         AND status = 'sent'
         AND template_key != 'digest'
         AND substr(created_at, 1, 10) = ?`,
      [tenantId, studentRef, day],
    );
    return Number(row?.c ?? 0);
  }

  async listQueuedDigestMessages(
    tenantId: string,
    day: string,
  ): Promise<OutboundMessage[]> {
    const rows = await this.db.all<OutboundRow>(
      `SELECT * FROM outbound_messages
       WHERE tenant_id = ?
         AND status = 'queued'
         AND template_key != 'digest'
         AND substr(created_at, 1, 10) = ?
       ORDER BY guardian_ref ASC, created_at ASC`,
      [tenantId, day],
    );
    return rows.map(mapOutbound);
  }

  async markOutboundSent(
    tenantId: string,
    id: string,
    channel: string,
    sentAt: string,
  ): Promise<OutboundMessage | null> {
    await this.db.run(
      `UPDATE outbound_messages
       SET status = 'sent', channel = ?, sent_at = ?, suppress_reason = NULL
       WHERE tenant_id = ? AND id = ?`,
      [channel, sentAt, tenantId, id],
    );
    return this.getOutboundMessage(tenantId, id);
  }

  async getDigestRun(
    tenantId: string,
    guardianRef: string,
    runDate: string,
  ): Promise<{ digestMessageId: string } | null> {
    const row = await this.db.get<{ digest_message_id: string }>(
      `SELECT digest_message_id FROM digest_runs
       WHERE tenant_id = ? AND guardian_ref = ? AND run_date = ?`,
      [tenantId, guardianRef, runDate],
    );
    return row ? { digestMessageId: row.digest_message_id } : null;
  }

  async insertDigestRun(
    tenantId: string,
    guardianRef: string,
    runDate: string,
    digestMessageId: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO digest_runs (tenant_id, guardian_ref, run_date, digest_message_id)
       VALUES (?, ?, ?, ?)`,
      [tenantId, guardianRef, runDate, digestMessageId],
    );
  }

  async ackMessage(
    tenantId: string,
    messageId: string,
    ackedBy?: string | null,
  ): Promise<boolean> {
    const msg = await this.getOutboundMessage(tenantId, messageId);
    if (!msg) return false;
    await this.db.run(
      `INSERT OR REPLACE INTO message_acks (message_id, tenant_id, acked_by)
       VALUES (?, ?, ?)`,
      [messageId, tenantId, ackedBy ?? null],
    );
    return true;
  }

  async hasAck(tenantId: string, messageId: string): Promise<boolean> {
    const row = await this.db.get<{ message_id: string }>(
      `SELECT message_id FROM message_acks WHERE tenant_id = ? AND message_id = ?`,
      [tenantId, messageId],
    );
    return !!row;
  }

  async listPendingEscalation(
    tenantId: string,
    olderThanIso: string,
  ): Promise<OutboundMessage[]> {
    const rows = await this.db.all<OutboundRow>(
      `SELECT m.* FROM outbound_messages m
       LEFT JOIN message_acks a
         ON a.message_id = m.id AND a.tenant_id = m.tenant_id
       WHERE m.tenant_id = ?
         AND m.template_key = 'absence_alert'
         AND m.status = 'sent'
         AND m.sent_at IS NOT NULL
         AND m.sent_at <= ?
         AND a.message_id IS NULL
       ORDER BY m.sent_at ASC`,
      [tenantId, olderThanIso],
    );
    return rows.map(mapOutbound);
  }

  async insertThread(t: Thread): Promise<Thread> {
    await this.db.run(
      `INSERT INTO threads (
         id, tenant_id, guardian_ref, student_ref, subject, state, assigned_to, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.tenantId,
        t.guardianRef,
        t.studentRef,
        t.subject,
        t.state,
        t.assignedTo,
        t.createdAt,
        t.updatedAt,
      ],
    );
    const created = await this.getThread(t.tenantId, t.id);
    if (!created) throw new Error('Failed to read inserted thread');
    return created;
  }

  async getThread(tenantId: string, id: string): Promise<Thread | null> {
    const row = await this.db.get<ThreadRow>(
      'SELECT * FROM threads WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapThread(row) : null;
  }

  async updateThread(
    tenantId: string,
    id: string,
    patch: {
      state?: ThreadState;
      assignedTo?: string | null;
      updatedAt: string;
    },
  ): Promise<Thread | null> {
    const existing = await this.getThread(tenantId, id);
    if (!existing) return null;
    const state = patch.state ?? existing.state;
    const assignedTo =
      patch.assignedTo !== undefined ? patch.assignedTo : existing.assignedTo;
    await this.db.run(
      `UPDATE threads
       SET state = ?, assigned_to = ?, updated_at = ?
       WHERE tenant_id = ? AND id = ?`,
      [state, assignedTo, patch.updatedAt, tenantId, id],
    );
    return this.getThread(tenantId, id);
  }

  async listThreads(tenantId: string, filters: ListThreadsFilters): Promise<Thread[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.state) {
      clauses.push('state = ?');
      params.push(filters.state);
    }
    if (filters.guardianRef) {
      clauses.push('guardian_ref = ?');
      params.push(filters.guardianRef);
    }
    if (filters.studentRef) {
      clauses.push('student_ref = ?');
      params.push(filters.studentRef);
    }
    if (filters.assignedTo) {
      clauses.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }
    const order =
      filters.sortUnansweredAge === false
        ? 'updated_at DESC'
        : `CASE WHEN state = 'waiting_school' THEN 0 ELSE 1 END ASC, updated_at ASC`;
    const rows = await this.db.all<ThreadRow>(
      `SELECT * FROM threads
       WHERE ${clauses.join(' AND ')}
       ORDER BY ${order}`,
      params,
    );
    return rows.map(mapThread);
  }

  async listOverdueThreads(
    tenantId: string,
    olderThanIso: string,
  ): Promise<Thread[]> {
    const rows = await this.db.all<ThreadRow>(
      `SELECT * FROM threads
       WHERE tenant_id = ?
         AND state = 'waiting_school'
         AND updated_at < ?
       ORDER BY updated_at ASC`,
      [tenantId, olderThanIso],
    );
    return rows.map(mapThread);
  }

  async insertThreadMessage(m: ThreadMessage): Promise<ThreadMessage> {
    await this.db.run(
      `INSERT INTO thread_messages (
         id, tenant_id, thread_id, direction, body, lang_original,
         body_translated, translated_flag, author, at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.tenantId,
        m.threadId,
        m.direction,
        m.body,
        m.langOriginal,
        m.bodyTranslated,
        m.translatedFlag ? 1 : 0,
        m.author,
        m.at,
      ],
    );
    const row = await this.db.get<ThreadMessageRow>(
      'SELECT * FROM thread_messages WHERE tenant_id = ? AND id = ?',
      [m.tenantId, m.id],
    );
    if (!row) throw new Error('Failed to read inserted thread message');
    return mapThreadMessage(row);
  }

  async listThreadMessages(
    tenantId: string,
    threadId: string,
  ): Promise<ThreadMessage[]> {
    const rows = await this.db.all<ThreadMessageRow>(
      `SELECT * FROM thread_messages
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY at ASC`,
      [tenantId, threadId],
    );
    return rows.map(mapThreadMessage);
  }
}

interface TemplateRow extends Record<string, unknown> {
  id: string;
  tenant_id: string | null;
  key: string;
  lang: string;
  body: string;
  kind: string;
  reviewed: number;
  created_at: string;
}

function mapTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    key: row.key as TemplateKey,
    lang: row.lang,
    body: row.body,
    kind: row.kind as TemplateKind,
    reviewed: row.reviewed === 1,
    createdAt: row.created_at,
  };
}

interface OutboundRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_ref: string | null;
  guardian_ref: string;
  template_key: string;
  lang: string;
  channel: string;
  rendered_body: string;
  status: string;
  suppress_reason: string | null;
  created_at: string;
  sent_at: string | null;
}

function mapOutbound(row: OutboundRow): OutboundMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentRef: row.student_ref,
    guardianRef: row.guardian_ref,
    templateKey: row.template_key as TemplateKey,
    lang: row.lang,
    channel: row.channel,
    renderedBody: row.rendered_body,
    status: row.status as OutboundStatus,
    suppressReason: row.suppress_reason,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

interface ThreadRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  guardian_ref: string;
  student_ref: string;
  subject: string;
  state: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

function mapThread(row: ThreadRow): Thread {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    guardianRef: row.guardian_ref,
    studentRef: row.student_ref,
    subject: row.subject,
    state: row.state as ThreadState,
    assignedTo: row.assigned_to,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ThreadMessageRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  thread_id: string;
  direction: string;
  body: string;
  lang_original: string | null;
  body_translated: string | null;
  translated_flag: number;
  author: string;
  at: string;
}

function mapThreadMessage(row: ThreadMessageRow): ThreadMessage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    threadId: row.thread_id,
    direction: row.direction as ThreadDirection,
    body: row.body,
    langOriginal: row.lang_original,
    bodyTranslated: row.body_translated,
    translatedFlag: row.translated_flag === 1,
    author: row.author,
    at: row.at,
  };
}
