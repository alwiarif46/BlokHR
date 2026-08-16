import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { DsrRepository } from '../repositories/dsr-repository';
import type {
  DataRequest,
  DataRequestAudit,
  DataRequestKind,
  DataRequestState,
} from '../types';
import { ERASURE_REQUIRED_SERVICES } from '../types';

type ServiceError = { error: string; status: number };

const KINDS = new Set<DataRequestKind>(['access', 'correction', 'erasure']);

const ALLOWED: Record<DataRequestState, DataRequestState[]> = {
  received: ['verifying'],
  verifying: ['in_progress'],
  in_progress: ['completed', 'rejected'],
  completed: [],
  rejected: [],
};

const DEFAULT_SLA_DAYS = 30;

function isDataRequestState(v: string): v is DataRequestState {
  return v in ALLOWED;
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(clock: () => Date, raw?: string): string | ServiceError {
  if (raw != null && raw.trim() !== '') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
      return { error: 'today must be YYYY-MM-DD', status: 400 };
    }
    return raw.trim();
  }
  return clock().toISOString().slice(0, 10);
}

function missingErasureServices(
  details: Record<string, unknown>,
): string[] {
  const confirmed = details.services_confirmed;
  const list = Array.isArray(confirmed)
    ? confirmed.map((s) => String(s))
    : [];
  return ERASURE_REQUIRED_SERVICES.filter((s) => !list.includes(s));
}

export class DsrService {
  constructor(
    private readonly repo: DsrRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(
    tenantId: string,
    input: {
      studentRef: string;
      guardianRef: string;
      kind: string;
      details?: Record<string, unknown>;
      createdBy?: string;
    },
  ): Promise<{ request?: DataRequest; error?: ServiceError }> {
    const studentRef = (input.studentRef || '').trim();
    const guardianRef = (input.guardianRef || '').trim();
    const kind = (input.kind || '').trim() as DataRequestKind;
    if (!studentRef) {
      return { error: { error: 'student_ref is required', status: 400 } };
    }
    if (!guardianRef) {
      return { error: { error: 'guardian_ref is required', status: 400 } };
    }
    if (!KINDS.has(kind)) {
      return {
        error: {
          error: 'kind must be access|correction|erasure',
          status: 400,
        },
      };
    }

    const slaRaw = await this.repo.getConfig(tenantId, 'dsr_sla_days');
    let slaDays = DEFAULT_SLA_DAYS;
    if (slaRaw != null && slaRaw.trim() !== '') {
      const n = Number(slaRaw);
      if (!Number.isFinite(n) || n < 1) {
        return {
          error: { error: 'invalid dsr_sla_days config', status: 400 },
        };
      }
      slaDays = Math.floor(n);
    }

    const now = this.clock();
    const createdAt = now.toISOString();
    const createdDay = createdAt.slice(0, 10);
    const request: DataRequest = {
      id: uuidv4(),
      tenantId,
      studentRef,
      guardianRef,
      kind,
      state: 'received',
      details: input.details ?? {},
      slaDueOn: addDaysIso(createdDay, slaDays),
      resolutionNote: null,
      handledBy: null,
      overdueEmittedAt: null,
      createdAt,
      updatedAt: createdAt,
    };

    const saved = await this.repo.insertRequest(request);

    await this.events.publish({
      type: 'school.dsr.received',
      tenantId,
      occurredAt: createdAt,
      data: {
        requestId: saved.id,
        kind: saved.kind,
        studentRef: saved.studentRef,
        slaDueOn: saved.slaDueOn,
      },
    });

    return { request: saved };
  }

  async transition(
    tenantId: string,
    id: string,
    input: {
      state: string;
      resolutionNote?: string | null;
      handledBy?: string;
      details?: Record<string, unknown>;
      actor?: string;
    },
  ): Promise<{ request?: DataRequest; error?: ServiceError }> {
    const existing = await this.repo.getRequest(tenantId, id);
    if (!existing) {
      return { error: { error: 'data request not found', status: 404 } };
    }

    const toState = (input.state || '').trim();
    if (!isDataRequestState(toState)) {
      return { error: { error: 'invalid state', status: 400 } };
    }

    const allowed = ALLOWED[existing.state];
    if (!allowed.includes(toState)) {
      return {
        error: {
          error: `cannot transition from ${existing.state} to ${toState}`,
          status: 400,
        },
      };
    }

    if (toState === 'rejected') {
      const note = (input.resolutionNote ?? '').trim();
      if (!note) {
        return {
          error: { error: 'resolution_note is required for rejected', status: 400 },
        };
      }
    }

    const details = input.details
      ? { ...existing.details, ...input.details }
      : existing.details;

    if (toState === 'completed' && existing.kind === 'erasure') {
      const missing = missingErasureServices(details);
      if (missing.length > 0) {
        return {
          error: {
            error: `erasure requires services_confirmed: missing ${missing.join(',')}`,
            status: 400,
          },
        };
      }
    }

    const now = this.clock().toISOString();
    const actor = (input.actor || input.handledBy || '').trim() || 'system';
    const updated = await this.repo.updateRequest({
      ...existing,
      state: toState,
      details,
      resolutionNote:
        toState === 'rejected'
          ? String(input.resolutionNote).trim()
          : existing.resolutionNote,
      handledBy: input.handledBy?.trim()
        ? input.handledBy.trim()
        : existing.handledBy,
      updatedAt: now,
    });

    await this.repo.insertAudit({
      id: uuidv4(),
      tenantId,
      requestId: id,
      fromState: existing.state,
      toState,
      actor,
      at: now,
    });

    return { request: updated };
  }

  async list(
    tenantId: string,
    opts: { state?: string; overdue?: boolean; today?: string },
  ): Promise<{ requests?: DataRequest[]; error?: ServiceError }> {
    let state: string | undefined;
    if (opts.state != null && opts.state.trim() !== '') {
      if (!isDataRequestState(opts.state.trim())) {
        return { error: { error: 'invalid state filter', status: 400 } };
      }
      state = opts.state.trim();
    }
    const today = todayIso(this.clock, opts.today);
    if (typeof today !== 'string') return { error: today };

    const requests = await this.repo.listRequests(tenantId, {
      state,
      overdueOnly: opts.overdue === true,
      todayIso: today,
    });
    return { requests };
  }

  async get(
    tenantId: string,
    id: string,
  ): Promise<{
    request?: DataRequest;
    audit?: DataRequestAudit[];
    error?: ServiceError;
  }> {
    const request = await this.repo.getRequest(tenantId, id);
    if (!request) {
      return { error: { error: 'data request not found', status: 404 } };
    }
    const audit = await this.repo.listAudit(tenantId, id);
    return { request, audit };
  }

  async sweepOverdue(
    tenantId: string,
    todayRaw?: string,
  ): Promise<{
    emitted?: Array<{ requestId: string }>;
    error?: ServiceError;
  }> {
    const today = todayIso(this.clock, todayRaw);
    if (typeof today !== 'string') return { error: today };

    const due = await this.repo.listOverdueUnnotified(tenantId, today);
    const emitted: Array<{ requestId: string }> = [];
    const now = this.clock().toISOString();

    for (const req of due) {
      await this.events.publish({
        type: 'school.dsr.overdue',
        tenantId,
        occurredAt: now,
        data: {
          requestId: req.id,
          kind: req.kind,
          slaDueOn: req.slaDueOn,
          state: req.state,
        },
      });
      await this.repo.updateRequest({
        ...req,
        overdueEmittedAt: now,
        updatedAt: now,
      });
      emitted.push({ requestId: req.id });
    }

    return { emitted };
  }

  async setSlaDays(
    tenantId: string,
    days: number,
  ): Promise<{ error?: ServiceError }> {
    if (!Number.isFinite(days) || days < 1) {
      return { error: { error: 'dsr_sla_days must be >= 1', status: 400 } };
    }
    await this.repo.setConfig(tenantId, 'dsr_sla_days', String(Math.floor(days)));
    return {};
  }
}

export { addDaysIso, missingErasureServices, DEFAULT_SLA_DAYS };
