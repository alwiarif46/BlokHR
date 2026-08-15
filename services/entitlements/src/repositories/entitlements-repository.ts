import type { EntitlementsDb } from '../db';
import type {
  Entitlement,
  EntitlementChannel,
  EntitlementPlan,
  EntitlementSource,
  EntitlementStatus,
} from '../types';

interface EntitlementRow extends Record<string, unknown> {
  tenant_id: string;
  channel: string;
  plan: string;
  status: string;
  seat_limit: number;
  modules_json: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  currency: string;
  source: string;
  vertical?: string | null;
}

function mapRow(row: EntitlementRow): Entitlement {
  let modules: string[] = [];
  try {
    modules = JSON.parse(row.modules_json || '[]') as string[];
  } catch {
    modules = [];
  }
  const verticalRaw = row.vertical;
  const vertical =
    verticalRaw === 'school' || verticalRaw === 'hr' ? verticalRaw : 'hr';
  return {
    tenantId: row.tenant_id,
    channel: row.channel as EntitlementChannel,
    plan: row.plan as EntitlementPlan,
    status: row.status as EntitlementStatus,
    seatLimit: row.seat_limit,
    modules,
    trialEndsAt: row.trial_ends_at,
    renewsAt: row.renews_at,
    currency: 'INR',
    source: row.source as EntitlementSource,
    vertical,
  };
}

export class EntitlementsRepository {
  constructor(private readonly db: EntitlementsDb) {}

  async get(tenantId: string): Promise<Entitlement | null> {
    const row = await this.db.get<EntitlementRow>(
      'SELECT * FROM entitlements WHERE tenant_id = ?',
      [tenantId],
    );
    return row ? mapRow(row) : null;
  }

  async upsert(entitlement: Entitlement, licensePayloadJson = ''): Promise<void> {
    const vertical = entitlement.vertical ?? 'hr';
    await this.db.run(
      `INSERT INTO entitlements (
         tenant_id, channel, plan, status, seat_limit, modules_json,
         trial_ends_at, renews_at, currency, source, license_payload_json, vertical, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET
         channel = excluded.channel,
         plan = excluded.plan,
         status = excluded.status,
         seat_limit = excluded.seat_limit,
         modules_json = excluded.modules_json,
         trial_ends_at = excluded.trial_ends_at,
         renews_at = excluded.renews_at,
         currency = excluded.currency,
         source = excluded.source,
         license_payload_json = excluded.license_payload_json,
         vertical = excluded.vertical,
         updated_at = datetime('now')`,
      [
        entitlement.tenantId,
        entitlement.channel,
        entitlement.plan,
        entitlement.status,
        entitlement.seatLimit,
        JSON.stringify(entitlement.modules),
        entitlement.trialEndsAt,
        entitlement.renewsAt,
        entitlement.currency,
        entitlement.source,
        licensePayloadJson,
        vertical,
      ],
    );
  }

  async recordEvent(
    tenantId: string,
    eventType: string,
    detail: Record<string, unknown>,
    id: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO entitlement_events (id, tenant_id, event_type, detail_json)
       VALUES (?, ?, ?, ?)`,
      [id, tenantId, eventType, JSON.stringify(detail)],
    );
  }
}
