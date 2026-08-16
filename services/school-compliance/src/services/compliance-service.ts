import { v4 as uuidv4 } from 'uuid';
import type { ComplianceRepository } from '../repositories/compliance-repository';
import type {
  CalendarEntry,
  ComplianceStatusState,
  TenantComplianceStatus,
} from '../types';
import { daysUntilDue, dueDateIso } from './due-math';

type ServiceError = { error: string; status: number };

const STATE_ORDER: ComplianceStatusState[] = [
  'not_started',
  'in_progress',
  'ready',
  'submitted',
  'closed',
];

const STATE_SET = new Set<ComplianceStatusState>(STATE_ORDER);

function rank(state: ComplianceStatusState): number {
  return STATE_ORDER.indexOf(state);
}

function parseToday(raw: string | undefined, fallback: Date): Date | ServiceError {
  if (!raw || !raw.trim()) return fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return { error: 'today must be YYYY-MM-DD', status: 400 };
  }
  const d = new Date(`${raw.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    return { error: 'today must be YYYY-MM-DD', status: 400 };
  }
  return d;
}

export class ComplianceService {
  constructor(
    private readonly repo: ComplianceRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async getCalendar(
    tenantId: string,
    session: string,
    todayRaw?: string,
  ): Promise<{ entries?: CalendarEntry[]; error?: ServiceError }> {
    const sessionRef = (session || '').trim();
    if (!sessionRef) {
      return { error: { error: 'session is required', status: 400 } };
    }
    const today = parseToday(todayRaw, this.clock());
    if ('error' in today) return { error: today };

    const items = await this.repo.listItemsForTenant(tenantId);
    const statuses = await this.repo.listStatuses(tenantId, sessionRef);
    const byKey = new Map(statuses.map((s) => [s.itemKey, s]));

    const entries: CalendarEntry[] = items.map((item) => {
      const days = daysUntilDue(item.dueRule, today);
      const status = byKey.get(item.key) ?? null;
      const terminal =
        status?.state === 'submitted' || status?.state === 'closed';
      return {
        item,
        status,
        daysUntilDue: days,
        dueDate: dueDateIso(item.dueRule, today),
        overdue: days < 0 && !terminal,
      };
    });

    entries.sort(
      (a, b) =>
        (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0) ||
        a.item.key.localeCompare(b.item.key),
    );
    return { entries };
  }

  async listOverdue(
    tenantId: string,
    session: string,
    todayRaw?: string,
  ): Promise<{ entries?: CalendarEntry[]; error?: ServiceError }> {
    const cal = await this.getCalendar(tenantId, session, todayRaw);
    if (cal.error) return { error: cal.error };
    return { entries: (cal.entries ?? []).filter((e) => e.overdue) };
  }

  async transitionStatus(
    tenantId: string,
    input: {
      itemKey: string;
      academicSessionRef: string;
      state: ComplianceStatusState;
      note?: string | null;
      updatedBy: string;
    },
  ): Promise<{ status?: TenantComplianceStatus; error?: ServiceError }> {
    const itemKey = (input.itemKey || '').trim();
    const session = (input.academicSessionRef || '').trim();
    const updatedBy = (input.updatedBy || '').trim();
    if (!itemKey) return { error: { error: 'item_key is required', status: 400 } };
    if (!session) {
      return { error: { error: 'academic_session_ref is required', status: 400 } };
    }
    if (!updatedBy) return { error: { error: 'updated_by is required', status: 400 } };
    if (!STATE_SET.has(input.state)) {
      return { error: { error: 'invalid state', status: 400 } };
    }

    const item = await this.repo.getItemByKey(tenantId, itemKey);
    if (!item) return { error: { error: 'compliance item not found', status: 404 } };

    const existing = await this.repo.getStatus(tenantId, itemKey, session);
    const currentState: ComplianceStatusState = existing?.state ?? 'not_started';
    const from = rank(currentState);
    const to = rank(input.state);

    if (to === from) {
      return { error: { error: 'state unchanged', status: 400 } };
    }
    if (to < from) {
      const note = (input.note || '').trim();
      if (!note) {
        return {
          error: { error: 'note is required for backward transitions', status: 400 },
        };
      }
    }

    const status = await this.repo.upsertStatus({
      id: existing?.id ?? uuidv4(),
      tenantId,
      itemKey: item.key,
      academicSessionRef: session,
      state: input.state,
      note:
        input.note !== undefined && input.note !== null
          ? String(input.note).trim() || null
          : existing?.note ?? null,
      updatedBy,
      updatedAt: this.clock().toISOString(),
    });
    return { status };
  }
}
