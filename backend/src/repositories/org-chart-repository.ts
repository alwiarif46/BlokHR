import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface OrgPositionRow {
  [key: string]: unknown;
  id: string;
  title: string;
  parent_position_id: string | null;
  group_id: string | null;
  level: number;
  max_headcount: number;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface SuccessionPlanRow {
  [key: string]: unknown;
  id: number;
  position_id: string;
  nominee_email: string;
  readiness: string;
  notes: string;
  nominated_by: string;
  created_at: string;
  updated_at: string;
}

/** Flat node returned by recursive CTE — frontend builds the tree from this. */
export interface OrgTreeNode {
  [key: string]: unknown;
  id: string;
  title: string;
  parent_position_id: string | null;
  group_id: string | null;
  group_name: string | null;
  level: number;
  max_headcount: number;
  description: string;
  /** Comma-separated emails filling this position (empty string if vacant). */
  holder_emails: string;
  /** Comma-separated names filling this position (empty string if vacant). */
  holder_names: string;
  /** Count of members currently filling this position. */
  holder_count: number;
}

export interface SpanOfControlRow {
  [key: string]: unknown;
  email: string;
  name: string;
  position_id: string;
  position_title: string;
  direct_report_count: number;
}

export interface DirectReportRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string | null;
  designation: string;
  position_id: string | null;
  position_title: string | null;
  active: number;
}

/**
 * Org Chart repository — all position hierarchy, reporting line, and succession DB operations.
 * Hierarchy traversal uses recursive CTEs (SQLite 3.8.3+ and all Postgres versions support this).
 */
export class OrgChartRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Position CRUD ──

  /** Create a new org position. Returns the created row. */
  async createPosition(data: {
    title: string;
    parentPositionId?: string | null;
    groupId?: string | null;
    level?: number;
    maxHeadcount?: number;
    description?: string;
  }): Promise<OrgPositionRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO org_positions (id, title, parent_position_id, group_id, level, max_headcount, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.parentPositionId ?? null,
        data.groupId ?? null,
        data.level ?? 0,
        data.maxHeadcount ?? 1,
        data.description ?? '',
      ],
    );
    const row = await this.getPositionById(id);
    if (!row) throw new Error('Failed to create org position');
    return row;
  }

  /** Get a position by ID. */
  async getPositionById(id: string): Promise<OrgPositionRow | null> {
    return this.db.get<OrgPositionRow>('SELECT * FROM org_positions WHERE id = ?', [id]);
  }

  /** Get all positions, ordered by level then title. */
  async getAllPositions(): Promise<OrgPositionRow[]> {
    return this.db.all<OrgPositionRow>('SELECT * FROM org_positions ORDER BY level ASC, title ASC');
  }

  /** Update a position's fields. Only updates fields that are explicitly provided. */
  async updatePosition(
    id: string,
    fields: Partial<
      Pick<
        OrgPositionRow,
        'title' | 'parent_position_id' | 'group_id' | 'level' | 'max_headcount' | 'description'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE org_positions SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Delete a position. CASCADE removes succession plans. Members get position_id set to NULL by app logic. */
  async deletePosition(id: string): Promise<void> {
    // Unlink members from this position before delete
    await this.db.run(
      "UPDATE members SET position_id = NULL, updated_at = datetime('now') WHERE position_id = ?",
      [id],
    );
    // Reparent child positions to this position's parent
    const pos = await this.getPositionById(id);
    const newParent = pos?.parent_position_id ?? null;
    await this.db.run(
      "UPDATE org_positions SET parent_position_id = ?, updated_at = datetime('now') WHERE parent_position_id = ?",
      [newParent, id],
    );
    await this.db.run('DELETE FROM org_positions WHERE id = ?', [id]);
  }

  // ── Hierarchy queries ──

  /**
   * Full org tree as flat list with holder information.
   * Frontend reconstructs tree using parent_position_id linkage.
   * Uses GROUP_CONCAT to aggregate multiple holders per position.
   */
  async getOrgTree(): Promise<OrgTreeNode[]> {
    return this.db.all<OrgTreeNode>(
      `SELECT
         p.id,
         p.title,
         p.parent_position_id,
         p.group_id,
         g.name AS group_name,
         p.level,
         p.max_headcount,
         p.description,
         COALESCE(GROUP_CONCAT(m.email), '') AS holder_emails,
         COALESCE(GROUP_CONCAT(m.name), '') AS holder_names,
         COUNT(m.email) AS holder_count
       FROM org_positions p
       LEFT JOIN groups g ON g.id = p.group_id
       LEFT JOIN members m ON m.position_id = p.id AND m.active = 1
       GROUP BY p.id
       ORDER BY p.level ASC, p.title ASC`,
    );
  }

  /**
   * Get the subtree rooted at a given position (inclusive).
   * Uses recursive CTE for unlimited depth traversal.
   */
  async getSubtree(positionId: string): Promise<OrgPositionRow[]> {
    return this.db.all<OrgPositionRow>(
      `WITH RECURSIVE subtree AS (
         SELECT * FROM org_positions WHERE id = ?
         UNION ALL
         SELECT p.* FROM org_positions p
         INNER JOIN subtree s ON p.parent_position_id = s.id
       )
       SELECT * FROM subtree ORDER BY level ASC, title ASC`,
      [positionId],
    );
  }

  /**
   * Get the ancestor chain from a position up to the root (inclusive).
   * Returns bottom-up: first row is the given position, last row is root.
   */
  async getAncestors(positionId: string): Promise<OrgPositionRow[]> {
    return this.db.all<OrgPositionRow>(
      `WITH RECURSIVE chain AS (
         SELECT *, 0 AS depth FROM org_positions WHERE id = ?
         UNION ALL
         SELECT p.*, c.depth + 1 AS depth FROM org_positions p
         INNER JOIN chain c ON p.id = c.parent_position_id
       )
       SELECT id, title, parent_position_id, group_id, level, max_headcount, description,
              created_at, updated_at
       FROM chain ORDER BY depth ASC`,
      [positionId],
    );
  }

  // ── Reporting line management ──

  /** Set a member's reports_to field. */
  async setReportsTo(email: string, managerEmail: string): Promise<void> {
    await this.db.run(
      "UPDATE members SET reports_to = ?, updated_at = datetime('now') WHERE email = ?",
      [managerEmail, email],
    );
  }

  /** Set a member's position_id. */
  async assignPosition(email: string, positionId: string | null): Promise<void> {
    await this.db.run(
      "UPDATE members SET position_id = ?, updated_at = datetime('now') WHERE email = ?",
      [positionId, email],
    );
  }

  /** Get the manager email for a given employee. Returns empty string if none set. */
  async getManagerEmail(email: string): Promise<string> {
    const row = await this.db.get<{ reports_to: string }>(
      'SELECT reports_to FROM members WHERE email = ?',
      [email],
    );
    return row?.reports_to ?? '';
  }

  /** Get all direct reports for a manager email. */
  async getDirectReports(managerEmail: string): Promise<DirectReportRow[]> {
    return this.db.all<DirectReportRow>(
      `SELECT
         m.email,
         m.name,
         m.group_id,
         m.designation,
         m.position_id,
         p.title AS position_title,
         m.active
       FROM members m
       LEFT JOIN org_positions p ON p.id = m.position_id
       WHERE m.reports_to = ? AND m.active = 1
       ORDER BY m.name ASC`,
      [managerEmail],
    );
  }

  /**
   * Get all subordinates recursively (full subtree under a manager).
   * Uses recursive CTE on the members.reports_to chain.
   * Returns count for span-of-control analytics.
   */
  async getSubordinateCount(managerEmail: string): Promise<number> {
    const row = await this.db.get<{ cnt: number }>(
      `WITH RECURSIVE subordinates AS (
         SELECT email FROM members WHERE reports_to = ? AND active = 1
         UNION ALL
         SELECT m.email FROM members m
         INNER JOIN subordinates s ON m.reports_to = s.email
         WHERE m.active = 1
       )
       SELECT COUNT(*) AS cnt FROM subordinates`,
      [managerEmail],
    );
    return row?.cnt ?? 0;
  }

  /**
   * Span-of-control for all managers: direct report count per manager.
   * Only includes active members who have at least 1 direct report.
   */
  async getSpanOfControl(): Promise<SpanOfControlRow[]> {
    return this.db.all<SpanOfControlRow>(
      `SELECT
         mgr.email,
         mgr.name,
         COALESCE(mgr.position_id, '') AS position_id,
         COALESCE(p.title, '') AS position_title,
         COUNT(rep.email) AS direct_report_count
       FROM members mgr
       INNER JOIN members rep ON rep.reports_to = mgr.email AND rep.active = 1
       LEFT JOIN org_positions p ON p.id = mgr.position_id
       WHERE mgr.active = 1
       GROUP BY mgr.email
       ORDER BY direct_report_count DESC, mgr.name ASC`,
    );
  }

  /**
   * Detect circular reporting chains.
   * Walks up the reports_to chain from a given email. If we encounter
   * the same email again before hitting an empty reports_to, it's circular.
   * Returns true if assigning managerEmail as the manager of email would create a cycle.
   */
  async wouldCreateCycle(email: string, managerEmail: string): Promise<boolean> {
    if (email === managerEmail) return true;
    // Walk up from managerEmail. If we ever reach email, it's a cycle.
    const rows = await this.db.all<{ email: string }>(
      `WITH RECURSIVE chain AS (
         SELECT email, reports_to FROM members WHERE email = ?
         UNION ALL
         SELECT m.email, m.reports_to FROM members m
         INNER JOIN chain c ON m.email = c.reports_to
         WHERE c.reports_to != '' AND m.email != ?
       )
       SELECT email FROM chain`,
      [managerEmail, managerEmail],
    );
    return rows.some((r) => r.email === email);
  }

  // ── Succession planning ──

  /** Create a succession plan entry. */
  async createSuccessionPlan(data: {
    positionId: string;
    nomineeEmail: string;
    readiness?: string;
    notes?: string;
    nominatedBy?: string;
  }): Promise<SuccessionPlanRow> {
    await this.db.run(
      `INSERT INTO succession_plans (position_id, nominee_email, readiness, notes, nominated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.positionId,
        data.nomineeEmail,
        data.readiness ?? 'ready_now',
        data.notes ?? '',
        data.nominatedBy ?? '',
      ],
    );
    const row = await this.db.get<SuccessionPlanRow>(
      'SELECT * FROM succession_plans WHERE position_id = ? AND nominee_email = ?',
      [data.positionId, data.nomineeEmail],
    );
    if (!row) throw new Error('Failed to create succession plan');
    return row;
  }

  /** Get succession plans for a position. */
  async getSuccessionByPosition(positionId: string): Promise<SuccessionPlanRow[]> {
    return this.db.all<SuccessionPlanRow>(
      'SELECT * FROM succession_plans WHERE position_id = ? ORDER BY readiness ASC, created_at ASC',
      [positionId],
    );
  }

  /** Get all succession plans (for admin overview). */
  async getAllSuccessionPlans(): Promise<(SuccessionPlanRow & { position_title: string })[]> {
    return this.db.all<SuccessionPlanRow & { position_title: string }>(
      `SELECT sp.*, p.title AS position_title
       FROM succession_plans sp
       INNER JOIN org_positions p ON p.id = sp.position_id
       ORDER BY p.title ASC, sp.readiness ASC`,
    );
  }

  /** Update a succession plan entry. */
  async updateSuccessionPlan(
    id: number,
    fields: Partial<Pick<SuccessionPlanRow, 'readiness' | 'notes'>>,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(fields)) {
      if (val === undefined) continue;
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await this.db.run(`UPDATE succession_plans SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Delete a succession plan entry. */
  async deleteSuccessionPlan(id: number): Promise<void> {
    await this.db.run('DELETE FROM succession_plans WHERE id = ?', [id]);
  }

  /** Get a succession plan by ID. */
  async getSuccessionPlanById(id: number): Promise<SuccessionPlanRow | null> {
    return this.db.get<SuccessionPlanRow>('SELECT * FROM succession_plans WHERE id = ?', [id]);
  }

  // ── Vacancy tracking ──

  /**
   * Positions where holder_count < max_headcount.
   * Used for vacancy reports and succession planning context.
   */
  async getVacantPositions(): Promise<
    (OrgPositionRow & { holder_count: number; vacancies: number })[]
  > {
    return this.db.all<OrgPositionRow & { holder_count: number; vacancies: number }>(
      `SELECT
         p.*,
         COUNT(m.email) AS holder_count,
         (p.max_headcount - COUNT(m.email)) AS vacancies
       FROM org_positions p
       LEFT JOIN members m ON m.position_id = p.id AND m.active = 1
       GROUP BY p.id
       HAVING vacancies > 0
       ORDER BY vacancies DESC, p.level ASC`,
    );
  }
}
