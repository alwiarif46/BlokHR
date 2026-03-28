import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

export interface AssetRow {
  [key: string]: unknown;
  id: string;
  asset_tag: string;
  asset_type: string;
  name: string;
  description: string;
  serial_number: string;
  purchase_date: string;
  purchase_cost: number;
  warranty_expiry: string;
  status: string;
  depreciation_method: string;
  useful_life_years: number;
  location: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}
export interface AssetAssignmentRow {
  [key: string]: unknown;
  id: string;
  asset_id: string;
  email: string;
  assigned_date: string;
  returned_date: string | null;
  condition_on_assign: string;
  condition_on_return: string;
  assigned_by: string;
  notes: string;
  created_at: string;
}
export interface MaintenanceRecordRow {
  [key: string]: unknown;
  id: string;
  asset_id: string;
  scheduled_date: string;
  completed_date: string | null;
  cost: number;
  notes: string;
  created_by: string;
  created_at: string;
}

export class AssetRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async createAsset(data: {
    assetTag: string;
    assetType?: string;
    name: string;
    description?: string;
    serialNumber?: string;
    purchaseDate?: string;
    purchaseCost?: number;
    warrantyExpiry?: string;
    depreciationMethod?: string;
    usefulLifeYears?: number;
    location?: string;
    notes?: string;
    createdBy: string;
  }): Promise<AssetRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO assets (id, asset_tag, asset_type, name, description, serial_number, purchase_date,
        purchase_cost, warranty_expiry, depreciation_method, useful_life_years, location, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.assetTag,
        data.assetType ?? 'other',
        data.name,
        data.description ?? '',
        data.serialNumber ?? '',
        data.purchaseDate ?? '',
        data.purchaseCost ?? 0,
        data.warrantyExpiry ?? '',
        data.depreciationMethod ?? 'straight_line',
        data.usefulLifeYears ?? 3,
        data.location ?? '',
        data.notes ?? '',
        data.createdBy,
      ],
    );
    const row = await this.db.get<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to create asset');
    return row;
  }

  async getAssetById(id: string): Promise<AssetRow | null> {
    return this.db.get<AssetRow>('SELECT * FROM assets WHERE id = ?', [id]);
  }

  async listAssets(filters?: { assetType?: string; status?: string }): Promise<AssetRow[]> {
    const conds: string[] = [];
    const params: unknown[] = [];
    if (filters?.assetType) {
      conds.push('asset_type = ?');
      params.push(filters.assetType);
    }
    if (filters?.status) {
      conds.push('status = ?');
      params.push(filters.status);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    return this.db.all<AssetRow>(`SELECT * FROM assets ${where} ORDER BY name ASC`, params);
  }

  async updateAsset(
    id: string,
    fields: Partial<
      Pick<
        AssetRow,
        | 'name'
        | 'description'
        | 'serial_number'
        | 'asset_type'
        | 'status'
        | 'purchase_date'
        | 'purchase_cost'
        | 'warranty_expiry'
        | 'depreciation_method'
        | 'useful_life_years'
        | 'location'
        | 'notes'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined) continue;
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE assets SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteAsset(id: string): Promise<void> {
    await this.db.run('DELETE FROM assets WHERE id = ?', [id]);
  }

  // ── Assignments ──
  async assignAsset(data: {
    assetId: string;
    email: string;
    conditionOnAssign?: string;
    assignedBy: string;
    notes?: string;
  }): Promise<AssetAssignmentRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO asset_assignments (id, asset_id, email, condition_on_assign, assigned_by, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [
        id,
        data.assetId,
        data.email,
        data.conditionOnAssign ?? 'good',
        data.assignedBy,
        data.notes ?? '',
      ],
    );
    await this.db.run(
      "UPDATE assets SET status = 'assigned', updated_at = datetime('now') WHERE id = ?",
      [data.assetId],
    );
    const row = await this.db.get<AssetAssignmentRow>(
      'SELECT * FROM asset_assignments WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to assign asset');
    return row;
  }

  async returnAsset(assignmentId: string, conditionOnReturn: string): Promise<void> {
    const assignment = await this.db.get<AssetAssignmentRow>(
      'SELECT * FROM asset_assignments WHERE id = ?',
      [assignmentId],
    );
    if (!assignment) throw new Error('Assignment not found');
    await this.db.run(
      "UPDATE asset_assignments SET returned_date = datetime('now'), condition_on_return = ? WHERE id = ?",
      [conditionOnReturn, assignmentId],
    );
    await this.db.run(
      "UPDATE assets SET status = 'available', updated_at = datetime('now') WHERE id = ?",
      [assignment.asset_id],
    );
  }

  async getAssignmentsByAsset(assetId: string): Promise<AssetAssignmentRow[]> {
    return this.db.all<AssetAssignmentRow>(
      'SELECT * FROM asset_assignments WHERE asset_id = ? ORDER BY assigned_date DESC',
      [assetId],
    );
  }

  async getAssignmentsByEmail(
    email: string,
  ): Promise<(AssetAssignmentRow & { asset_name: string; asset_type: string })[]> {
    return this.db.all<AssetAssignmentRow & { asset_name: string; asset_type: string }>(
      `SELECT aa.*, a.name AS asset_name, a.asset_type
       FROM asset_assignments aa INNER JOIN assets a ON a.id = aa.asset_id
       WHERE aa.email = ? AND aa.returned_date IS NULL ORDER BY aa.assigned_date DESC`,
      [email],
    );
  }

  async getCurrentAssignment(assetId: string): Promise<AssetAssignmentRow | null> {
    return this.db.get<AssetAssignmentRow>(
      'SELECT * FROM asset_assignments WHERE asset_id = ? AND returned_date IS NULL ORDER BY assigned_date DESC LIMIT 1',
      [assetId],
    );
  }

  // ── Maintenance ──
  async createMaintenance(data: {
    assetId: string;
    scheduledDate: string;
    cost?: number;
    notes?: string;
    createdBy: string;
  }): Promise<MaintenanceRecordRow> {
    const id = uuidv4();
    await this.db.run(
      'INSERT INTO maintenance_records (id, asset_id, scheduled_date, cost, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [id, data.assetId, data.scheduledDate, data.cost ?? 0, data.notes ?? '', data.createdBy],
    );
    const row = await this.db.get<MaintenanceRecordRow>(
      'SELECT * FROM maintenance_records WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to create maintenance record');
    return row;
  }

  async completeMaintenance(id: string): Promise<void> {
    await this.db.run(
      "UPDATE maintenance_records SET completed_date = datetime('now') WHERE id = ?",
      [id],
    );
  }

  async getMaintenanceByAsset(assetId: string): Promise<MaintenanceRecordRow[]> {
    return this.db.all<MaintenanceRecordRow>(
      'SELECT * FROM maintenance_records WHERE asset_id = ? ORDER BY scheduled_date DESC',
      [assetId],
    );
  }
}
