import type { KioskDb } from '../db';

export interface KioskPinRow {
  tenant_id: string;
  member_email: string;
  pin_hash: string;
  updated_at: string;
  [key: string]: unknown;
}

export class KioskRepository {
  constructor(private readonly db: KioskDb) {}

  async getPin(tenantId: string, email: string): Promise<KioskPinRow | undefined> {
    return this.db.get<KioskPinRow>(
      'SELECT * FROM kiosk_pins WHERE tenant_id = ? AND member_email = ?',
      [tenantId, email.toLowerCase().trim()],
    );
  }

  async upsertPin(tenantId: string, email: string, pinHash: string): Promise<void> {
    const memberEmail = email.toLowerCase().trim();
    const existing = await this.getPin(tenantId, memberEmail);
    if (existing) {
      await this.db.run(
        `UPDATE kiosk_pins SET pin_hash = ?, updated_at = datetime('now')
         WHERE tenant_id = ? AND member_email = ?`,
        [pinHash, tenantId, memberEmail],
      );
      return;
    }
    await this.db.run(
      `INSERT INTO kiosk_pins (tenant_id, member_email, pin_hash, updated_at)
       VALUES (?, ?, ?, datetime('now'))`,
      [tenantId, memberEmail, pinHash],
    );
  }

  async deletePin(tenantId: string, email: string): Promise<boolean> {
    const existing = await this.getPin(tenantId, email);
    if (!existing) return false;
    await this.db.run('DELETE FROM kiosk_pins WHERE tenant_id = ? AND member_email = ?', [
      tenantId,
      email.toLowerCase().trim(),
    ]);
    return true;
  }

  async hasPin(tenantId: string, email: string): Promise<boolean> {
    const row = await this.getPin(tenantId, email);
    return !!row;
  }
}
