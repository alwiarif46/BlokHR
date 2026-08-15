import type { DirectoryDb } from '../db';
import type { DirectoryMember } from '../types';

interface MemberRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  group_id: string | null;
  designation: string;
  phone: string;
  timezone: string;
  individual_shift_start: string | null;
  individual_shift_end: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

function mapRow(row: MemberRow): DirectoryMember {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    name: row.name,
    role: row.role,
    groupId: row.group_id,
    designation: row.designation || '',
    phone: row.phone || '',
    timezone: row.timezone || 'Asia/Kolkata',
    individualShiftStart: row.individual_shift_start,
    individualShiftEnd: row.individual_shift_end,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class DirectoryRepository {
  constructor(private readonly db: DirectoryDb) {}

  async countActive(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM members WHERE tenant_id = ? AND active = 1',
      [tenantId],
    );
    return Number(row?.c ?? 0);
  }

  async countAll(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM members WHERE tenant_id = ?',
      [tenantId],
    );
    return Number(row?.c ?? 0);
  }

  async listActive(tenantId: string): Promise<DirectoryMember[]> {
    const rows = await this.db.all<MemberRow>(
      `SELECT * FROM members
       WHERE tenant_id = ? AND active = 1
       ORDER BY name COLLATE NOCASE`,
      [tenantId],
    );
    return rows.map(mapRow);
  }

  async listAll(tenantId: string): Promise<DirectoryMember[]> {
    const rows = await this.db.all<MemberRow>(
      `SELECT * FROM members
       WHERE tenant_id = ?
       ORDER BY active DESC, name COLLATE NOCASE`,
      [tenantId],
    );
    return rows.map(mapRow);
  }

  async getByEmail(tenantId: string, email: string): Promise<DirectoryMember | null> {
    const row = await this.db.get<MemberRow>(
      'SELECT * FROM members WHERE tenant_id = ? AND email = ?',
      [tenantId, email],
    );
    return row ? mapRow(row) : null;
  }

  async getById(tenantId: string, id: string): Promise<DirectoryMember | null> {
    const row = await this.db.get<MemberRow>(
      'SELECT * FROM members WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapRow(row) : null;
  }

  async insert(member: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
    groupId: string | null;
    designation: string;
    phone: string;
    timezone: string;
    individualShiftStart: string | null;
    individualShiftEnd: string | null;
    active: boolean;
  }): Promise<DirectoryMember> {
    await this.db.run(
      `INSERT INTO members (
        id, tenant_id, email, name, role, group_id, designation, phone, timezone,
        individual_shift_start, individual_shift_end, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        member.id,
        member.tenantId,
        member.email,
        member.name,
        member.role,
        member.groupId,
        member.designation,
        member.phone,
        member.timezone,
        member.individualShiftStart,
        member.individualShiftEnd,
        member.active ? 1 : 0,
      ],
    );
    const created = await this.getById(member.tenantId, member.id);
    if (!created) throw new Error('Failed to create member');
    return created;
  }

  async update(
    tenantId: string,
    id: string,
    fields: Partial<{
      name: string;
      role: string;
      groupId: string | null;
      designation: string;
      phone: string;
      timezone: string;
      individualShiftStart: string | null;
      individualShiftEnd: string | null;
      active: boolean;
    }>,
  ): Promise<DirectoryMember | null> {
    const sets: string[] = [];
    const params: unknown[] = [];

    const map: Array<[keyof typeof fields, string, (v: unknown) => unknown]> = [
      ['name', 'name', (v) => v],
      ['role', 'role', (v) => v],
      ['groupId', 'group_id', (v) => v],
      ['designation', 'designation', (v) => v],
      ['phone', 'phone', (v) => v],
      ['timezone', 'timezone', (v) => v],
      ['individualShiftStart', 'individual_shift_start', (v) => v],
      ['individualShiftEnd', 'individual_shift_end', (v) => v],
      ['active', 'active', (v) => (v ? 1 : 0)],
    ];

    for (const [key, col, transform] of map) {
      if (fields[key] !== undefined) {
        sets.push(`${col} = ?`);
        params.push(transform(fields[key]));
      }
    }

    if (sets.length === 0) return this.getById(tenantId, id);

    sets.push("updated_at = datetime('now')");
    params.push(tenantId, id);
    await this.db.run(
      `UPDATE members SET ${sets.join(', ')} WHERE tenant_id = ? AND id = ?`,
      params,
    );
    return this.getById(tenantId, id);
  }
}
