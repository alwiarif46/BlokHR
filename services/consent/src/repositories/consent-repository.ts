import { v4 as uuidv4 } from 'uuid';
import type { ConsentDb } from '../db';
import type { ConsentRecord, CreateConsentInput } from '../types';

interface ConsentRow {
  id: string;
  tenant_id: string;
  subject_ref: string;
  subject_type: string;
  modality: string;
  legal_basis: string;
  guardian_ref: string;
  dpia_ref: string;
  alternative_acknowledged: number;
  revoked_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

function toRecord(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectRef: row.subject_ref,
    subjectType: row.subject_type as ConsentRecord['subjectType'],
    modality: row.modality as ConsentRecord['modality'],
    legalBasis: row.legal_basis,
    guardianRef: row.guardian_ref,
    dpiaRef: row.dpia_ref,
    alternativeAcknowledged: row.alternative_acknowledged === 1,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

export class ConsentRepository {
  constructor(private readonly db: ConsentDb) {}

  async create(input: CreateConsentInput): Promise<ConsentRecord> {
    const id = `cns_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    await this.db.run(
      `INSERT INTO consents (
        id, tenant_id, subject_ref, subject_type, modality, legal_basis,
        guardian_ref, dpia_ref, alternative_acknowledged
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.tenantId,
        input.subjectRef,
        input.subjectType,
        input.modality,
        input.legalBasis ?? 'employment',
        input.guardianRef ?? '',
        input.dpiaRef ?? '',
        input.alternativeAcknowledged ? 1 : 0,
      ],
    );
    const row = await this.db.get<ConsentRow>('SELECT * FROM consents WHERE id = ?', [id]);
    return toRecord(row!);
  }

  async getById(tenantId: string, id: string): Promise<ConsentRecord | null> {
    const row = await this.db.get<ConsentRow>(
      'SELECT * FROM consents WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? toRecord(row) : null;
  }

  async isValid(tenantId: string, id: string, modality: string): Promise<boolean> {
    const row = await this.db.get<ConsentRow>(
      `SELECT * FROM consents
       WHERE tenant_id = ? AND id = ? AND modality = ? AND revoked_at IS NULL`,
      [tenantId, id, modality],
    );
    return !!row;
  }

  async revoke(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getById(tenantId, id);
    if (!existing || existing.revokedAt) return false;
    await this.db.run(
      `UPDATE consents SET revoked_at = datetime('now'), updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return true;
  }

  async listForSubject(tenantId: string, subjectRef: string): Promise<ConsentRecord[]> {
    const rows = await this.db.all<ConsentRow>(
      'SELECT * FROM consents WHERE tenant_id = ? AND subject_ref = ? ORDER BY created_at DESC',
      [tenantId, subjectRef],
    );
    return rows.map(toRecord);
  }
}
