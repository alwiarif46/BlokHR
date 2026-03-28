import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import {
  AssetRepository,
  type AssetRow,
  type AssetAssignmentRow,
  type MaintenanceRecordRow,
} from '../repositories/asset-repository';

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}
interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

const VALID_ASSET_TYPES = [
  'laptop',
  'phone',
  'id_card',
  'parking',
  'furniture',
  'monitor',
  'other',
];

export class AssetService {
  private readonly repo: AssetRepository;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
  ) {
    this.repo = new AssetRepository(db);
  }

  async createAsset(
    data: {
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
    },
    actorEmail: string,
  ): Promise<ServiceResult<AssetRow>> {
    if (!data.name?.trim()) return { success: false, error: 'Asset name is required' };
    if (!data.assetTag?.trim()) return { success: false, error: 'Asset tag is required' };
    if (data.assetType && !VALID_ASSET_TYPES.includes(data.assetType)) {
      return {
        success: false,
        error: `Invalid asset type. Must be one of: ${VALID_ASSET_TYPES.join(', ')}`,
      };
    }
    const asset = await this.repo.createAsset({
      ...data,
      name: data.name.trim(),
      assetTag: data.assetTag.trim(),
      createdBy: actorEmail,
    });
    this.logger.info({ assetId: asset.id, name: asset.name, actor: actorEmail }, 'Asset created');
    this.logAudit('asset', asset.id, 'created', actorEmail, {
      name: asset.name,
      assetTag: asset.asset_tag,
    });
    return { success: true, data: asset };
  }

  async updateAsset(
    id: string,
    fields: Record<string, unknown>,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getAssetById(id);
    if (!existing) return { success: false, error: 'Asset not found' };
    await this.repo.updateAsset(id, fields as Parameters<typeof this.repo.updateAsset>[1]);
    this.logAudit('asset', id, 'updated', actorEmail, fields);
    return { success: true };
  }

  async deleteAsset(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getAssetById(id);
    if (!existing) return { success: false, error: 'Asset not found' };
    await this.repo.deleteAsset(id);
    this.logAudit('asset', id, 'deleted', actorEmail, { name: existing.name });
    return { success: true };
  }

  async getAssetById(id: string): Promise<AssetRow | null> {
    return this.repo.getAssetById(id);
  }
  async listAssets(filters?: { assetType?: string; status?: string }): Promise<AssetRow[]> {
    return this.repo.listAssets(filters);
  }

  async assignAsset(
    assetId: string,
    email: string,
    actorEmail: string,
    conditionOnAssign?: string,
    notes?: string,
  ): Promise<ServiceResult<AssetAssignmentRow>> {
    const asset = await this.repo.getAssetById(assetId);
    if (!asset) return { success: false, error: 'Asset not found' };
    if (asset.status !== 'available')
      return { success: false, error: `Asset is not available (current status: ${asset.status})` };
    const member = await this.db.get<MemberRow>(
      'SELECT email FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) return { success: false, error: 'Employee not found or inactive' };

    const assignment = await this.repo.assignAsset({
      assetId,
      email,
      conditionOnAssign,
      assignedBy: actorEmail,
      notes,
    });
    this.logger.info({ assetId, email, actor: actorEmail }, 'Asset assigned');
    this.logAudit('asset_assignment', assignment.id, 'assigned', actorEmail, { assetId, email });
    return { success: true, data: assignment };
  }

  async returnAsset(
    assignmentId: string,
    conditionOnReturn: string,
    actorEmail: string,
  ): Promise<ServiceResult> {
    const assignment = await this.db.get<AssetAssignmentRow>(
      'SELECT * FROM asset_assignments WHERE id = ?',
      [assignmentId],
    );
    if (!assignment) return { success: false, error: 'Assignment not found' };
    if (assignment.returned_date) return { success: false, error: 'Already returned' };

    await this.repo.returnAsset(assignmentId, conditionOnReturn);
    this.logger.info({ assignmentId, actor: actorEmail }, 'Asset returned');
    this.logAudit('asset_assignment', assignmentId, 'returned', actorEmail, { conditionOnReturn });
    return { success: true };
  }

  async getMyAssets(
    email: string,
  ): Promise<(AssetAssignmentRow & { asset_name: string; asset_type: string })[]> {
    return this.repo.getAssignmentsByEmail(email);
  }

  async getAssetHistory(assetId: string): Promise<AssetAssignmentRow[]> {
    return this.repo.getAssignmentsByAsset(assetId);
  }

  /** Compute current book value using straight-line or declining balance. */
  computeBookValue(asset: AssetRow): number {
    if (asset.depreciation_method === 'none' || !asset.purchase_date || asset.purchase_cost <= 0) {
      return asset.purchase_cost;
    }
    const purchaseDate = new Date(asset.purchase_date);
    const now = new Date();
    const yearsElapsed = (now.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (yearsElapsed <= 0) return asset.purchase_cost;

    if (asset.depreciation_method === 'straight_line') {
      const annualDep = asset.purchase_cost / asset.useful_life_years;
      const totalDep = annualDep * Math.min(yearsElapsed, asset.useful_life_years);
      return Math.max(0, Math.round((asset.purchase_cost - totalDep) * 100) / 100);
    }
    // declining_balance: 200% rate
    const rate = 2 / asset.useful_life_years;
    let value = asset.purchase_cost;
    for (let y = 0; y < Math.min(Math.floor(yearsElapsed), asset.useful_life_years); y++) {
      value -= value * rate;
    }
    return Math.max(0, Math.round(value * 100) / 100);
  }

  // ── Maintenance ──
  async scheduleMaintenance(
    data: { assetId: string; scheduledDate: string; cost?: number; notes?: string },
    actorEmail: string,
  ): Promise<ServiceResult<MaintenanceRecordRow>> {
    const asset = await this.repo.getAssetById(data.assetId);
    if (!asset) return { success: false, error: 'Asset not found' };
    const record = await this.repo.createMaintenance({ ...data, createdBy: actorEmail });
    this.logAudit('maintenance', record.id, 'scheduled', actorEmail, { assetId: data.assetId });
    return { success: true, data: record };
  }

  async completeMaintenance(id: string, actorEmail: string): Promise<ServiceResult> {
    await this.repo.completeMaintenance(id);
    this.logAudit('maintenance', id, 'completed', actorEmail, {});
    return { success: true };
  }

  async getMaintenanceHistory(assetId: string): Promise<MaintenanceRecordRow[]> {
    return this.repo.getMaintenanceByAsset(assetId);
  }

  private logAudit(
    entityType: string,
    entityId: string,
    action: string,
    actorEmail: string,
    detail: Record<string, unknown>,
  ): void {
    if (!this.auditService) return;
    this.auditService
      .log({ entityType, entityId, action, actorEmail, detail })
      .catch((err) => this.logger.error({ err }, 'Audit log failed'));
  }
}
