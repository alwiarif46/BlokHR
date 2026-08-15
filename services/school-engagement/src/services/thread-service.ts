import { v4 as uuidv4 } from 'uuid';
import type { EngagementRepository } from '../repositories/engagement-repository';
import type {
  ListThreadsFilters,
  Thread,
  ThreadDirection,
  ThreadMessage,
  ThreadState,
} from '../types';

type ServiceError = { error: string; status: number };

const STATES = new Set<ThreadState>([
  'open',
  'waiting_school',
  'waiting_guardian',
  'closed',
]);

const DIRECTIONS = new Set<ThreadDirection>(['guardian', 'school']);

function normalizeTranslation(input: {
  bodyTranslated?: string | null;
  translatedFlag?: boolean;
}): { bodyTranslated: string | null; translatedFlag: boolean } | ServiceError {
  const raw =
    input.bodyTranslated === undefined || input.bodyTranslated === null
      ? null
      : String(input.bodyTranslated).trim() || null;
  const flag = Boolean(input.translatedFlag);
  if (raw != null && !flag) {
    return {
      error: 'translated_flag must be 1 when body_translated is set',
      status: 400,
    };
  }
  return { bodyTranslated: raw, translatedFlag: flag };
}

export class ThreadService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createThread(
    tenantId: string,
    input: {
      guardianRef: string;
      studentRef: string;
      subject: string;
      body: string;
      author: string;
      langOriginal?: string | null;
      bodyTranslated?: string | null;
      translatedFlag?: boolean;
    },
  ): Promise<{
    thread?: Thread;
    message?: ThreadMessage;
    error?: ServiceError;
  }> {
    const guardianRef = (input.guardianRef || '').trim();
    const studentRef = (input.studentRef || '').trim();
    const subject = (input.subject || '').trim();
    const body = String(input.body ?? '').trim();
    const author = (input.author || '').trim();
    if (!guardianRef) return { error: { error: 'guardian_ref is required', status: 400 } };
    if (!studentRef) return { error: { error: 'student_ref is required', status: 400 } };
    if (!subject) return { error: { error: 'subject is required', status: 400 } };
    if (!body) return { error: { error: 'body is required', status: 400 } };
    if (!author) return { error: { error: 'author is required', status: 400 } };

    const translation = normalizeTranslation(input);
    if ('error' in translation) return { error: translation };

    const now = this.clock().toISOString();
    const thread = await this.repo.insertThread({
      id: uuidv4(),
      tenantId,
      guardianRef,
      studentRef,
      subject,
      state: 'waiting_school',
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
    });

    const message = await this.repo.insertThreadMessage({
      id: uuidv4(),
      tenantId,
      threadId: thread.id,
      direction: 'guardian',
      body,
      langOriginal: input.langOriginal != null ? String(input.langOriginal).trim() || null : null,
      bodyTranslated: translation.bodyTranslated,
      translatedFlag: translation.translatedFlag,
      author,
      at: now,
    });

    return { thread, message };
  }

  async reply(
    tenantId: string,
    threadId: string,
    input: {
      direction: ThreadDirection;
      body: string;
      author: string;
      langOriginal?: string | null;
      bodyTranslated?: string | null;
      translatedFlag?: boolean;
    },
  ): Promise<{
    thread?: Thread;
    message?: ThreadMessage;
    error?: ServiceError;
  }> {
    if (!DIRECTIONS.has(input.direction)) {
      return { error: { error: 'direction must be guardian or school', status: 400 } };
    }
    const body = String(input.body ?? '').trim();
    const author = (input.author || '').trim();
    if (!body) return { error: { error: 'body is required', status: 400 } };
    if (!author) return { error: { error: 'author is required', status: 400 } };

    const translation = normalizeTranslation(input);
    if ('error' in translation) return { error: translation };

    const existing = await this.repo.getThread(tenantId, threadId);
    if (!existing) return { error: { error: 'thread not found', status: 404 } };

    const now = this.clock().toISOString();
    let nextState: ThreadState;
    if (existing.state === 'closed') {
      nextState = 'open';
    } else if (input.direction === 'guardian') {
      nextState = 'waiting_school';
    } else {
      nextState = 'waiting_guardian';
    }

    const message = await this.repo.insertThreadMessage({
      id: uuidv4(),
      tenantId,
      threadId,
      direction: input.direction,
      body,
      langOriginal: input.langOriginal != null ? String(input.langOriginal).trim() || null : null,
      bodyTranslated: translation.bodyTranslated,
      translatedFlag: translation.translatedFlag,
      author,
      at: now,
    });

    const thread = await this.repo.updateThread(tenantId, threadId, {
      state: nextState,
      updatedAt: now,
    });
    if (!thread) return { error: { error: 'thread not found', status: 404 } };
    return { thread, message };
  }

  async assign(
    tenantId: string,
    threadId: string,
    assignedTo: string,
  ): Promise<{ thread?: Thread; error?: ServiceError }> {
    const to = (assignedTo || '').trim();
    if (!to) return { error: { error: 'assigned_to is required', status: 400 } };
    const existing = await this.repo.getThread(tenantId, threadId);
    if (!existing) return { error: { error: 'thread not found', status: 404 } };
    const thread = await this.repo.updateThread(tenantId, threadId, {
      assignedTo: to,
      updatedAt: this.clock().toISOString(),
    });
    if (!thread) return { error: { error: 'thread not found', status: 404 } };
    return { thread };
  }

  async close(
    tenantId: string,
    threadId: string,
  ): Promise<{ thread?: Thread; error?: ServiceError }> {
    const existing = await this.repo.getThread(tenantId, threadId);
    if (!existing) return { error: { error: 'thread not found', status: 404 } };
    const thread = await this.repo.updateThread(tenantId, threadId, {
      state: 'closed',
      updatedAt: this.clock().toISOString(),
    });
    if (!thread) return { error: { error: 'thread not found', status: 404 } };
    return { thread };
  }

  async list(
    tenantId: string,
    filters: ListThreadsFilters,
  ): Promise<{ threads: Thread[] }> {
    if (filters.state && !STATES.has(filters.state)) {
      return { threads: [] };
    }
    return {
      threads: await this.repo.listThreads(tenantId, {
        ...filters,
        sortUnansweredAge: filters.sortUnansweredAge !== false,
      }),
    };
  }

  async get(
    tenantId: string,
    threadId: string,
  ): Promise<{
    thread?: Thread;
    messages?: ThreadMessage[];
    error?: ServiceError;
  }> {
    const thread = await this.repo.getThread(tenantId, threadId);
    if (!thread) return { error: { error: 'thread not found', status: 404 } };
    const messages = await this.repo.listThreadMessages(tenantId, threadId);
    return { thread, messages };
  }

  async listOverdue(
    tenantId: string,
    hours: number,
  ): Promise<{ threads?: Thread[]; error?: ServiceError }> {
    if (!Number.isFinite(hours) || hours < 0) {
      return { error: { error: 'hours must be a non-negative number', status: 400 } };
    }
    const cutoff = new Date(this.clock().getTime() - hours * 3_600_000).toISOString();
    return { threads: await this.repo.listOverdueThreads(tenantId, cutoff) };
  }
}
