import { v4 as uuidv4 } from 'uuid';
import type { FeesRepository } from '../repositories/fees-repository';
import type {
  Concession,
  ConcessionKind,
  FeeHead,
  FeeHeadKind,
  FeeSchedule,
  FeeStructure,
  FeeStructureLine,
} from '../types';

type ServiceError = { error: string; status: number };

const HEAD_KINDS = new Set<FeeHeadKind>([
  'tuition',
  'transport',
  'lab',
  'library',
  'exam',
  'admission',
  'other',
]);

const SCHEDULES = new Set<FeeSchedule>(['annual', 'term', 'monthly']);
const CONCESSION_KINDS = new Set<ConcessionKind>(['pct', 'flat']);

function parseLines(raw: unknown): FeeStructureLine[] | ServiceError {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'lines must be a non-empty array', status: 400 };
  }
  const lines: FeeStructureLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Record<string, unknown>;
    const feeHeadId = String(row.fee_head_id ?? row.feeHeadId ?? '').trim();
    if (!feeHeadId) {
      return { error: `lines[${i}]: fee_head_id is required`, status: 400 };
    }
    const amountPaise = Number(row.amount_paise ?? row.amountPaise);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      return { error: `lines[${i}]: amount_paise must be an integer > 0`, status: 400 };
    }
    const schedule = String(row.schedule ?? '') as FeeSchedule;
    if (!SCHEDULES.has(schedule)) {
      return { error: `lines[${i}]: schedule must be annual|term|monthly`, status: 400 };
    }
    lines.push({ feeHeadId, amountPaise, schedule });
  }
  return lines;
}

export class FeesService {
  constructor(private readonly repo: FeesRepository) {}

  async createHead(
    tenantId: string,
    input: {
      code: string;
      label: string;
      kind: FeeHeadKind;
      taxable?: boolean;
    },
  ): Promise<{ head?: FeeHead; error?: ServiceError }> {
    const code = (input.code || '').trim();
    const label = (input.label || '').trim();
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!HEAD_KINDS.has(input.kind)) {
      return { error: { error: 'invalid fee head kind', status: 400 } };
    }
    const dup = await this.repo.getHeadByCode(tenantId, code);
    if (dup) return { error: { error: 'fee head code already exists', status: 409 } };

    const now = new Date().toISOString();
    const head = await this.repo.insertHead({
      id: uuidv4(),
      tenantId,
      code,
      label,
      kind: input.kind,
      taxable: Boolean(input.taxable),
      createdAt: now,
      updatedAt: now,
    });
    return { head };
  }

  async listHeads(tenantId: string): Promise<{ heads: FeeHead[] }> {
    return { heads: await this.repo.listHeads(tenantId) };
  }

  async getHead(
    tenantId: string,
    id: string,
  ): Promise<{ head?: FeeHead; error?: ServiceError }> {
    const head = await this.repo.getHead(tenantId, id);
    if (!head) return { error: { error: 'fee head not found', status: 404 } };
    return { head };
  }

  async updateHead(
    tenantId: string,
    id: string,
    input: {
      code?: string;
      label?: string;
      kind?: FeeHeadKind;
      taxable?: boolean;
    },
  ): Promise<{ head?: FeeHead; error?: ServiceError }> {
    const existing = await this.repo.getHead(tenantId, id);
    if (!existing) return { error: { error: 'fee head not found', status: 404 } };

    const code = input.code !== undefined ? input.code.trim() : existing.code;
    const label = input.label !== undefined ? input.label.trim() : existing.label;
    const kind = input.kind !== undefined ? input.kind : existing.kind;
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!HEAD_KINDS.has(kind)) {
      return { error: { error: 'invalid fee head kind', status: 400 } };
    }
    if (code !== existing.code) {
      const dup = await this.repo.getHeadByCode(tenantId, code);
      if (dup) return { error: { error: 'fee head code already exists', status: 409 } };
    }

    const head = await this.repo.updateHead({
      ...existing,
      code,
      label,
      kind,
      taxable: input.taxable !== undefined ? Boolean(input.taxable) : existing.taxable,
      updatedAt: new Date().toISOString(),
    });
    if (!head) return { error: { error: 'fee head not found', status: 404 } };
    return { head };
  }

  async deleteHead(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteHead(tenantId, id);
    if (!ok) return { error: { error: 'fee head not found', status: 404 } };
    return { ok: true };
  }

  async createStructure(
    tenantId: string,
    input: {
      academicSessionRef: string;
      classLabel: string;
      label: string;
      lines: unknown;
      active?: boolean;
    },
  ): Promise<{ structure?: FeeStructure; error?: ServiceError }> {
    const academicSessionRef = (input.academicSessionRef || '').trim();
    const classLabel = (input.classLabel || '').trim();
    const label = (input.label || '').trim();
    if (!academicSessionRef) {
      return { error: { error: 'academic_session_ref is required', status: 400 } };
    }
    if (!classLabel) return { error: { error: 'class_label is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };

    const lines = parseLines(input.lines);
    if ('error' in lines) return { error: lines };

    for (const line of lines) {
      const head = await this.repo.getHead(tenantId, line.feeHeadId);
      if (!head) {
        return {
          error: { error: `fee_head_id not found: ${line.feeHeadId}`, status: 400 },
        };
      }
    }

    const now = new Date().toISOString();
    const structure = await this.repo.insertStructure({
      id: uuidv4(),
      tenantId,
      academicSessionRef,
      classLabel,
      label,
      lines,
      active: input.active === undefined ? true : Boolean(input.active),
      createdAt: now,
      updatedAt: now,
    });
    return { structure };
  }

  async listStructures(tenantId: string): Promise<{ structures: FeeStructure[] }> {
    return { structures: await this.repo.listStructures(tenantId) };
  }

  async getStructure(
    tenantId: string,
    id: string,
  ): Promise<{ structure?: FeeStructure; error?: ServiceError }> {
    const structure = await this.repo.getStructure(tenantId, id);
    if (!structure) return { error: { error: 'fee structure not found', status: 404 } };
    return { structure };
  }

  async updateStructure(
    tenantId: string,
    id: string,
    input: {
      academicSessionRef?: string;
      classLabel?: string;
      label?: string;
      lines?: unknown;
      active?: boolean;
    },
  ): Promise<{ structure?: FeeStructure; error?: ServiceError }> {
    const existing = await this.repo.getStructure(tenantId, id);
    if (!existing) return { error: { error: 'fee structure not found', status: 404 } };

    let lines = existing.lines;
    if (input.lines !== undefined) {
      const parsed = parseLines(input.lines);
      if ('error' in parsed) return { error: parsed };
      for (const line of parsed) {
        const head = await this.repo.getHead(tenantId, line.feeHeadId);
        if (!head) {
          return {
            error: { error: `fee_head_id not found: ${line.feeHeadId}`, status: 400 },
          };
        }
      }
      lines = parsed;
    }

    const structure = await this.repo.updateStructure({
      ...existing,
      academicSessionRef:
        input.academicSessionRef !== undefined
          ? input.academicSessionRef.trim()
          : existing.academicSessionRef,
      classLabel:
        input.classLabel !== undefined ? input.classLabel.trim() : existing.classLabel,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      lines,
      active: input.active !== undefined ? Boolean(input.active) : existing.active,
      updatedAt: new Date().toISOString(),
    });
    if (!structure) return { error: { error: 'fee structure not found', status: 404 } };
    return { structure };
  }

  async deleteStructure(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteStructure(tenantId, id);
    if (!ok) return { error: { error: 'fee structure not found', status: 404 } };
    return { ok: true };
  }

  async createConcession(
    tenantId: string,
    input: {
      code: string;
      label: string;
      kind: ConcessionKind;
      value: number;
      appliesToHeads?: string[] | null;
    },
  ): Promise<{ concession?: Concession; error?: ServiceError }> {
    const code = (input.code || '').trim();
    const label = (input.label || '').trim();
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!CONCESSION_KINDS.has(input.kind)) {
      return { error: { error: 'kind must be pct or flat', status: 400 } };
    }
    const value = Number(input.value);
    if (!Number.isInteger(value)) {
      return { error: { error: 'value must be an integer', status: 400 } };
    }
    if (input.kind === 'pct') {
      if (value < 1 || value > 100) {
        return { error: { error: 'pct value must be 1–100', status: 400 } };
      }
    } else if (value <= 0) {
      return { error: { error: 'flat value must be paise > 0', status: 400 } };
    }

    let appliesToHeads: string[] | null = null;
    if (input.appliesToHeads !== undefined && input.appliesToHeads !== null) {
      if (!Array.isArray(input.appliesToHeads)) {
        return { error: { error: 'applies_to_heads must be an array or null', status: 400 } };
      }
      appliesToHeads = input.appliesToHeads.map((h) => String(h).trim()).filter(Boolean);
      for (const headId of appliesToHeads) {
        const head = await this.repo.getHead(tenantId, headId);
        if (!head) {
          return { error: { error: `fee_head_id not found: ${headId}`, status: 400 } };
        }
      }
    }

    const dup = await this.repo.getConcessionByCode(tenantId, code);
    if (dup) return { error: { error: 'concession code already exists', status: 409 } };

    const now = new Date().toISOString();
    const concession = await this.repo.insertConcession({
      id: uuidv4(),
      tenantId,
      code,
      label,
      kind: input.kind,
      value,
      appliesToHeads,
      createdAt: now,
      updatedAt: now,
    });
    return { concession };
  }

  async listConcessions(tenantId: string): Promise<{ concessions: Concession[] }> {
    return { concessions: await this.repo.listConcessions(tenantId) };
  }

  async getConcession(
    tenantId: string,
    id: string,
  ): Promise<{ concession?: Concession; error?: ServiceError }> {
    const concession = await this.repo.getConcession(tenantId, id);
    if (!concession) return { error: { error: 'concession not found', status: 404 } };
    return { concession };
  }

  async updateConcession(
    tenantId: string,
    id: string,
    input: {
      code?: string;
      label?: string;
      kind?: ConcessionKind;
      value?: number;
      appliesToHeads?: string[] | null;
    },
  ): Promise<{ concession?: Concession; error?: ServiceError }> {
    const existing = await this.repo.getConcession(tenantId, id);
    if (!existing) return { error: { error: 'concession not found', status: 404 } };

    const code = input.code !== undefined ? input.code.trim() : existing.code;
    const label = input.label !== undefined ? input.label.trim() : existing.label;
    const kind = input.kind !== undefined ? input.kind : existing.kind;
    const value = input.value !== undefined ? Number(input.value) : existing.value;
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!CONCESSION_KINDS.has(kind)) {
      return { error: { error: 'kind must be pct or flat', status: 400 } };
    }
    if (!Number.isInteger(value)) {
      return { error: { error: 'value must be an integer', status: 400 } };
    }
    if (kind === 'pct') {
      if (value < 1 || value > 100) {
        return { error: { error: 'pct value must be 1–100', status: 400 } };
      }
    } else if (value <= 0) {
      return { error: { error: 'flat value must be paise > 0', status: 400 } };
    }

    let appliesToHeads = existing.appliesToHeads;
    if (input.appliesToHeads !== undefined) {
      if (input.appliesToHeads === null) {
        appliesToHeads = null;
      } else if (!Array.isArray(input.appliesToHeads)) {
        return { error: { error: 'applies_to_heads must be an array or null', status: 400 } };
      } else {
        appliesToHeads = input.appliesToHeads.map((h) => String(h).trim()).filter(Boolean);
        for (const headId of appliesToHeads) {
          const head = await this.repo.getHead(tenantId, headId);
          if (!head) {
            return { error: { error: `fee_head_id not found: ${headId}`, status: 400 } };
          }
        }
      }
    }

    if (code !== existing.code) {
      const dup = await this.repo.getConcessionByCode(tenantId, code);
      if (dup) return { error: { error: 'concession code already exists', status: 409 } };
    }

    const concession = await this.repo.updateConcession({
      ...existing,
      code,
      label,
      kind,
      value,
      appliesToHeads,
      updatedAt: new Date().toISOString(),
    });
    if (!concession) return { error: { error: 'concession not found', status: 404 } };
    return { concession };
  }

  async deleteConcession(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteConcession(tenantId, id);
    if (!ok) return { error: { error: 'concession not found', status: 404 } };
    return { ok: true };
  }
}
