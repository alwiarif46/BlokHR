import type { SchoolLibraryDb } from '../db';
import { currentLibraryDb } from '../db-context';
import type {
  CopyCondition,
  CopyCounts,
  CopyStatus,
  Fine,
  FineStatus,
  Hold,
  HoldStatus,
  LibraryCopy,
  LibrarySettings,
  LibraryTitle,
  Loan,
  LoanStatus,
} from '../types';

interface TitleRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  isbn13: string | null;
  title: string;
  authors_json: string;
  publisher: string | null;
  published_year: number | null;
  subjects_json: string;
  language: string;
  active: number;
  created_at: string;
  updated_at: string;
}

interface CopyRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  title_id: string;
  barcode: string;
  accession_no: string | null;
  condition: string;
  status: string;
  location_label: string | null;
  acquired_on: string | null;
  created_at: string;
  updated_at: string;
}

interface CountRow extends Record<string, unknown> {
  status: string;
  n: number;
}

interface SettingsRow extends Record<string, unknown> {
  tenant_id: string;
  loan_days: number;
  renew_limit: number;
  max_open_loans: number;
  hold_days: number;
  fine_paise_per_day: number;
  fine_cap_paise: number;
  grace_days: number;
  updated_at: string;
}

interface LoanRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  copy_id: string;
  student_ref: string;
  issued_on: string;
  due_on: string;
  returned_on: string | null;
  renewals: number;
  status: string;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
}

interface HoldRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  title_id: string;
  student_ref: string;
  position: number;
  status: string;
  ready_copy_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FineRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  loan_id: string;
  student_ref: string;
  days_overdue: number;
  amount_paise: number;
  status: string;
  waived_reason: string | null;
  paid_on: string | null;
  created_at: string;
  updated_at: string;
}

function parseStringArray(json: string): string[] {
  try {
    const v = JSON.parse(json || '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.map((x) => String(x));
  } catch {
    return [];
  }
}

function mapTitle(row: TitleRow): LibraryTitle {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    isbn13: row.isbn13,
    title: row.title,
    authors: parseStringArray(row.authors_json),
    publisher: row.publisher,
    publishedYear: row.published_year,
    subjects: parseStringArray(row.subjects_json),
    language: row.language,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCopy(row: CopyRow): LibraryCopy {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    titleId: row.title_id,
    barcode: row.barcode,
    accessionNo: row.accession_no,
    condition: row.condition as CopyCondition,
    status: row.status as CopyStatus,
    locationLabel: row.location_label,
    acquiredOn: row.acquired_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettings(row: SettingsRow): LibrarySettings {
  return {
    tenantId: row.tenant_id,
    loanDays: row.loan_days,
    renewLimit: row.renew_limit,
    maxOpenLoans: row.max_open_loans,
    holdDays: row.hold_days,
    finePaisePerDay: Number(row.fine_paise_per_day ?? 500),
    fineCapPaise: Number(row.fine_cap_paise ?? 20000),
    graceDays: Number(row.grace_days ?? 0),
    updatedAt: row.updated_at,
  };
}

function mapLoan(row: LoanRow): Loan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    copyId: row.copy_id,
    studentRef: row.student_ref,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    returnedOn: row.returned_on,
    renewals: row.renewals,
    status: row.status as LoanStatus,
    issuedBy: row.issued_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHold(row: HoldRow): Hold {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    titleId: row.title_id,
    studentRef: row.student_ref,
    position: row.position,
    status: row.status as HoldStatus,
    readyCopyId: row.ready_copy_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFine(row: FineRow): Fine {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    loanId: row.loan_id,
    studentRef: row.student_ref,
    daysOverdue: row.days_overdue,
    amountPaise: row.amount_paise,
    status: row.status as FineStatus,
    waivedReason: row.waived_reason,
    paidOn: row.paid_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class LibraryRepository {
  constructor(private readonly fallbackDb: SchoolLibraryDb) {}

  private get db(): SchoolLibraryDb {
    return currentLibraryDb(this.fallbackDb);
  }

  async insertTitle(row: {
    id: string;
    tenantId: string;
    isbn13: string | null;
    title: string;
    authorsJson: string;
    publisher: string | null;
    publishedYear: number | null;
    subjectsJson: string;
    language: string;
    active: number;
  }): Promise<LibraryTitle> {
    await this.db.run(
      `INSERT INTO titles (
        id, tenant_id, isbn13, title, authors_json, publisher, published_year,
        subjects_json, language, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.isbn13,
        row.title,
        row.authorsJson,
        row.publisher,
        row.publishedYear,
        row.subjectsJson,
        row.language,
        row.active,
      ],
    );
    const created = await this.getTitle(row.tenantId, row.id);
    if (!created) throw new Error('title_insert_failed');
    return created;
  }

  async getTitle(tenantId: string, id: string): Promise<LibraryTitle | undefined> {
    const row = await this.db.get<TitleRow>(
      'SELECT * FROM titles WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapTitle(row) : undefined;
  }

  async listTitles(
    tenantId: string,
    filters: { q?: string; subject?: string },
  ): Promise<LibraryTitle[]> {
    let sql = 'SELECT * FROM titles WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];

    if (filters.q) {
      const like = `%${filters.q.toLowerCase()}%`;
      sql += ` AND (
        lower(title) LIKE ?
        OR lower(ifnull(isbn13, '')) LIKE ?
        OR lower(authors_json) LIKE ?
      )`;
      params.push(like, like, like);
    }

    if (filters.subject) {
      sql += ` AND lower(subjects_json) LIKE ?`;
      params.push(`%${filters.subject.toLowerCase()}%`);
    }

    sql += ' ORDER BY title COLLATE NOCASE ASC';
    const rows = await this.db.all<TitleRow>(sql, params);
    return rows.map(mapTitle);
  }

  async updateTitle(
    tenantId: string,
    id: string,
    patch: {
      isbn13?: string | null;
      title?: string;
      authorsJson?: string;
      publisher?: string | null;
      publishedYear?: number | null;
      subjectsJson?: string;
      language?: string;
      active?: number;
    },
  ): Promise<LibraryTitle | undefined> {
    const existing = await this.getTitle(tenantId, id);
    if (!existing) return undefined;

    const isbn13 = patch.isbn13 !== undefined ? patch.isbn13 : existing.isbn13;
    const title = patch.title !== undefined ? patch.title : existing.title;
    const authorsJson =
      patch.authorsJson !== undefined
        ? patch.authorsJson
        : JSON.stringify(existing.authors);
    const publisher =
      patch.publisher !== undefined ? patch.publisher : existing.publisher;
    const publishedYear =
      patch.publishedYear !== undefined
        ? patch.publishedYear
        : existing.publishedYear;
    const subjectsJson =
      patch.subjectsJson !== undefined
        ? patch.subjectsJson
        : JSON.stringify(existing.subjects);
    const language =
      patch.language !== undefined ? patch.language : existing.language;
    const active =
      patch.active !== undefined ? patch.active : existing.active ? 1 : 0;

    await this.db.run(
      `UPDATE titles SET
        isbn13 = ?, title = ?, authors_json = ?, publisher = ?, published_year = ?,
        subjects_json = ?, language = ?, active = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        isbn13,
        title,
        authorsJson,
        publisher,
        publishedYear,
        subjectsJson,
        language,
        active,
        tenantId,
        id,
      ],
    );
    return this.getTitle(tenantId, id);
  }

  async countCopiesForTitle(tenantId: string, titleId: string): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      'SELECT COUNT(*) AS n FROM copies WHERE tenant_id = ? AND title_id = ?',
      [tenantId, titleId],
    );
    return Number(row?.n ?? 0);
  }

  async deleteTitle(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getTitle(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM titles WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async copyCounts(tenantId: string, titleId: string): Promise<CopyCounts> {
    const rows = await this.db.all<CountRow>(
      `SELECT status, COUNT(*) AS n FROM copies
       WHERE tenant_id = ? AND title_id = ?
       GROUP BY status`,
      [tenantId, titleId],
    );
    const counts: CopyCounts = {
      available: 0,
      on_loan: 0,
      reserved: 0,
      withdrawn: 0,
      total: 0,
    };
    for (const row of rows) {
      const n = Number(row.n);
      counts.total += n;
      switch (row.status) {
        case 'available':
          counts.available += n;
          break;
        case 'on_loan':
          counts.on_loan += n;
          break;
        case 'reserved':
          counts.reserved += n;
          break;
        case 'withdrawn':
          counts.withdrawn += n;
          break;
        default:
          break;
      }
    }
    return counts;
  }

  async insertCopy(row: {
    id: string;
    tenantId: string;
    titleId: string;
    barcode: string;
    accessionNo: string | null;
    condition: CopyCondition;
    status: CopyStatus;
    locationLabel: string | null;
    acquiredOn: string | null;
  }): Promise<LibraryCopy> {
    await this.db.run(
      `INSERT INTO copies (
        id, tenant_id, title_id, barcode, accession_no, condition, status,
        location_label, acquired_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.titleId,
        row.barcode,
        row.accessionNo,
        row.condition,
        row.status,
        row.locationLabel,
        row.acquiredOn,
      ],
    );
    const created = await this.getCopy(row.tenantId, row.id);
    if (!created) throw new Error('copy_insert_failed');
    return created;
  }

  async getCopy(tenantId: string, id: string): Promise<LibraryCopy | undefined> {
    const row = await this.db.get<CopyRow>(
      'SELECT * FROM copies WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapCopy(row) : undefined;
  }

  async listCopies(
    tenantId: string,
    filters: { titleId?: string; status?: string; barcode?: string },
  ): Promise<LibraryCopy[]> {
    let sql = 'SELECT * FROM copies WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (filters.titleId) {
      sql += ' AND title_id = ?';
      params.push(filters.titleId);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.barcode) {
      sql += ' AND barcode = ?';
      params.push(filters.barcode);
    }
    sql += ' ORDER BY barcode COLLATE NOCASE ASC';
    const rows = await this.db.all<CopyRow>(sql, params);
    return rows.map(mapCopy);
  }

  async updateCopy(
    tenantId: string,
    id: string,
    patch: {
      barcode?: string;
      accessionNo?: string | null;
      condition?: CopyCondition;
      status?: CopyStatus;
      locationLabel?: string | null;
      acquiredOn?: string | null;
    },
  ): Promise<LibraryCopy | undefined> {
    const existing = await this.getCopy(tenantId, id);
    if (!existing) return undefined;

    const barcode = patch.barcode !== undefined ? patch.barcode : existing.barcode;
    const accessionNo =
      patch.accessionNo !== undefined ? patch.accessionNo : existing.accessionNo;
    const condition =
      patch.condition !== undefined ? patch.condition : existing.condition;
    const status = patch.status !== undefined ? patch.status : existing.status;
    const locationLabel =
      patch.locationLabel !== undefined
        ? patch.locationLabel
        : existing.locationLabel;
    const acquiredOn =
      patch.acquiredOn !== undefined ? patch.acquiredOn : existing.acquiredOn;

    await this.db.run(
      `UPDATE copies SET
        barcode = ?, accession_no = ?, condition = ?, status = ?,
        location_label = ?, acquired_on = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        barcode,
        accessionNo,
        condition,
        status,
        locationLabel,
        acquiredOn,
        tenantId,
        id,
      ],
    );
    return this.getCopy(tenantId, id);
  }

  async deleteCopy(tenantId: string, id: string): Promise<boolean> {
    const existing = await this.getCopy(tenantId, id);
    if (!existing) return false;
    await this.db.run('DELETE FROM copies WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
    return true;
  }

  async getCopyByBarcode(
    tenantId: string,
    barcode: string,
  ): Promise<LibraryCopy | undefined> {
    const row = await this.db.get<CopyRow>(
      'SELECT * FROM copies WHERE tenant_id = ? AND barcode = ?',
      [tenantId, barcode],
    );
    return row ? mapCopy(row) : undefined;
  }

  async ensureSettings(tenantId: string): Promise<LibrarySettings> {
    const existing = await this.getSettings(tenantId);
    if (existing) return existing;
    await this.db.run(
      `INSERT INTO library_settings (tenant_id) VALUES (?)`,
      [tenantId],
    );
    const created = await this.getSettings(tenantId);
    if (!created) throw new Error('settings_insert_failed');
    return created;
  }

  async getSettings(tenantId: string): Promise<LibrarySettings | undefined> {
    const row = await this.db.get<SettingsRow>(
      'SELECT * FROM library_settings WHERE tenant_id = ?',
      [tenantId],
    );
    return row ? mapSettings(row) : undefined;
  }

  async updateSettings(
    tenantId: string,
    patch: {
      loanDays: number;
      renewLimit: number;
      maxOpenLoans: number;
      holdDays: number;
      finePaisePerDay: number;
      fineCapPaise: number;
      graceDays: number;
    },
  ): Promise<LibrarySettings> {
    await this.ensureSettings(tenantId);
    await this.db.run(
      `UPDATE library_settings SET
        loan_days = ?, renew_limit = ?, max_open_loans = ?, hold_days = ?,
        fine_paise_per_day = ?, fine_cap_paise = ?, grace_days = ?,
        updated_at = datetime('now')
       WHERE tenant_id = ?`,
      [
        patch.loanDays,
        patch.renewLimit,
        patch.maxOpenLoans,
        patch.holdDays,
        patch.finePaisePerDay,
        patch.fineCapPaise,
        patch.graceDays,
        tenantId,
      ],
    );
    const updated = await this.getSettings(tenantId);
    if (!updated) throw new Error('settings_update_failed');
    return updated;
  }

  async insertLoan(row: {
    id: string;
    tenantId: string;
    copyId: string;
    studentRef: string;
    issuedOn: string;
    dueOn: string;
    issuedBy: string | null;
  }): Promise<Loan> {
    await this.db.run(
      `INSERT INTO loans (
        id, tenant_id, copy_id, student_ref, issued_on, due_on, status, issued_by
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        row.id,
        row.tenantId,
        row.copyId,
        row.studentRef,
        row.issuedOn,
        row.dueOn,
        row.issuedBy,
      ],
    );
    const created = await this.getLoan(row.tenantId, row.id);
    if (!created) throw new Error('loan_insert_failed');
    return created;
  }

  async getLoan(tenantId: string, id: string): Promise<Loan | undefined> {
    const row = await this.db.get<LoanRow>(
      'SELECT * FROM loans WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapLoan(row) : undefined;
  }

  async countOpenLoansForStudent(
    tenantId: string,
    studentRef: string,
  ): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM loans
       WHERE tenant_id = ? AND student_ref = ? AND status = 'open'`,
      [tenantId, studentRef],
    );
    return Number(row?.n ?? 0);
  }

  async listLoans(
    tenantId: string,
    filters: {
      studentRef?: string;
      status?: string;
      overdueAsOf?: string;
    },
  ): Promise<Loan[]> {
    let sql = 'SELECT * FROM loans WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (filters.studentRef) {
      sql += ' AND student_ref = ?';
      params.push(filters.studentRef);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.overdueAsOf) {
      sql += ` AND status = 'open' AND due_on < ?`;
      params.push(filters.overdueAsOf);
    }
    sql += ' ORDER BY due_on ASC, created_at ASC';
    const rows = await this.db.all<LoanRow>(sql, params);
    return rows.map(mapLoan);
  }

  async returnLoan(
    tenantId: string,
    id: string,
    returnedOn: string,
  ): Promise<Loan | undefined> {
    await this.db.run(
      `UPDATE loans SET
        status = 'returned', returned_on = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ? AND status = 'open'`,
      [returnedOn, tenantId, id],
    );
    return this.getLoan(tenantId, id);
  }

  async renewLoan(
    tenantId: string,
    id: string,
    dueOn: string,
    renewals: number,
  ): Promise<Loan | undefined> {
    await this.db.run(
      `UPDATE loans SET
        due_on = ?, renewals = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ? AND status = 'open'`,
      [dueOn, renewals, tenantId, id],
    );
    return this.getLoan(tenantId, id);
  }

  async countOverdueOpen(
    tenantId: string,
    asOf: string,
  ): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM loans
       WHERE tenant_id = ? AND status = 'open' AND due_on < ?`,
      [tenantId, asOf],
    );
    return Number(row?.n ?? 0);
  }

  async insertHold(row: {
    id: string;
    tenantId: string;
    titleId: string;
    studentRef: string;
    position: number;
  }): Promise<Hold> {
    await this.db.run(
      `INSERT INTO holds (
        id, tenant_id, title_id, student_ref, position, status
      ) VALUES (?, ?, ?, ?, ?, 'queued')`,
      [row.id, row.tenantId, row.titleId, row.studentRef, row.position],
    );
    const created = await this.getHold(row.tenantId, row.id);
    if (!created) throw new Error('hold_insert_failed');
    return created;
  }

  async getHold(tenantId: string, id: string): Promise<Hold | undefined> {
    const row = await this.db.get<HoldRow>(
      'SELECT * FROM holds WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapHold(row) : undefined;
  }

  async listHolds(
    tenantId: string,
    filters: { titleId?: string; studentRef?: string; status?: string },
  ): Promise<Hold[]> {
    let sql = 'SELECT * FROM holds WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (filters.titleId) {
      sql += ' AND title_id = ?';
      params.push(filters.titleId);
    }
    if (filters.studentRef) {
      sql += ' AND student_ref = ?';
      params.push(filters.studentRef);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY position ASC, created_at ASC';
    const rows = await this.db.all<HoldRow>(sql, params);
    return rows.map(mapHold);
  }

  async nextHoldPosition(tenantId: string, titleId: string): Promise<number> {
    const row = await this.db.get<{ m: number | null }>(
      `SELECT MAX(position) AS m FROM holds
       WHERE tenant_id = ? AND title_id = ? AND status IN ('queued', 'ready')`,
      [tenantId, titleId],
    );
    return Number(row?.m ?? 0) + 1;
  }

  async findReadyHoldForStudentTitle(
    tenantId: string,
    titleId: string,
    studentRef: string,
  ): Promise<Hold | undefined> {
    const row = await this.db.get<HoldRow>(
      `SELECT * FROM holds
       WHERE tenant_id = ? AND title_id = ? AND student_ref = ?
         AND status = 'ready'`,
      [tenantId, titleId, studentRef],
    );
    return row ? mapHold(row) : undefined;
  }

  async hasActiveHoldOnTitle(
    tenantId: string,
    titleId: string,
    excludeStudentRef?: string,
  ): Promise<boolean> {
    let sql = `SELECT id FROM holds
      WHERE tenant_id = ? AND title_id = ? AND status IN ('queued', 'ready')`;
    const params: unknown[] = [tenantId, titleId];
    if (excludeStudentRef) {
      sql += ' AND student_ref != ?';
      params.push(excludeStudentRef);
    }
    sql += ' LIMIT 1';
    const row = await this.db.get<{ id: string }>(sql, params);
    return !!row;
  }

  async nextQueuedHold(
    tenantId: string,
    titleId: string,
  ): Promise<Hold | undefined> {
    const row = await this.db.get<HoldRow>(
      `SELECT * FROM holds
       WHERE tenant_id = ? AND title_id = ? AND status = 'queued'
       ORDER BY position ASC, created_at ASC
       LIMIT 1`,
      [tenantId, titleId],
    );
    return row ? mapHold(row) : undefined;
  }

  async markHoldReady(
    tenantId: string,
    id: string,
    readyCopyId: string,
    expiresAt: string,
  ): Promise<Hold | undefined> {
    await this.db.run(
      `UPDATE holds SET
        status = 'ready', ready_copy_id = ?, expires_at = ?,
        updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [readyCopyId, expiresAt, tenantId, id],
    );
    return this.getHold(tenantId, id);
  }

  async markHoldFulfilled(tenantId: string, id: string): Promise<Hold | undefined> {
    await this.db.run(
      `UPDATE holds SET status = 'fulfilled', updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return this.getHold(tenantId, id);
  }

  async markHoldCancelled(tenantId: string, id: string): Promise<Hold | undefined> {
    await this.db.run(
      `UPDATE holds SET status = 'cancelled', updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return this.getHold(tenantId, id);
  }

  async reorderQueuedHolds(tenantId: string, titleId: string): Promise<void> {
    const rows = await this.db.all<HoldRow>(
      `SELECT * FROM holds
       WHERE tenant_id = ? AND title_id = ? AND status = 'queued'
       ORDER BY position ASC, created_at ASC`,
      [tenantId, titleId],
    );
    let pos = 1;
    for (const row of rows) {
      await this.db.run(
        `UPDATE holds SET position = ?, updated_at = datetime('now')
         WHERE tenant_id = ? AND id = ?`,
        [pos, tenantId, row.id],
      );
      pos += 1;
    }
  }

  async getFineByLoan(
    tenantId: string,
    loanId: string,
  ): Promise<Fine | undefined> {
    const row = await this.db.get<FineRow>(
      'SELECT * FROM fines WHERE tenant_id = ? AND loan_id = ?',
      [tenantId, loanId],
    );
    return row ? mapFine(row) : undefined;
  }

  async getFine(tenantId: string, id: string): Promise<Fine | undefined> {
    const row = await this.db.get<FineRow>(
      'SELECT * FROM fines WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapFine(row) : undefined;
  }

  async upsertOpenFine(row: {
    id: string;
    tenantId: string;
    loanId: string;
    studentRef: string;
    daysOverdue: number;
    amountPaise: number;
  }): Promise<Fine> {
    const existing = await this.getFineByLoan(row.tenantId, row.loanId);
    if (existing) {
      if (existing.status !== 'open') return existing;
      await this.db.run(
        `UPDATE fines SET
          days_overdue = ?, amount_paise = ?, updated_at = datetime('now')
         WHERE tenant_id = ? AND id = ? AND status = 'open'`,
        [row.daysOverdue, row.amountPaise, row.tenantId, existing.id],
      );
      const updated = await this.getFine(row.tenantId, existing.id);
      if (!updated) throw new Error('fine_update_failed');
      return updated;
    }
    await this.db.run(
      `INSERT INTO fines (
        id, tenant_id, loan_id, student_ref, days_overdue, amount_paise, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'open')`,
      [
        row.id,
        row.tenantId,
        row.loanId,
        row.studentRef,
        row.daysOverdue,
        row.amountPaise,
      ],
    );
    const created = await this.getFine(row.tenantId, row.id);
    if (!created) throw new Error('fine_insert_failed');
    return created;
  }

  async listFines(
    tenantId: string,
    filters: { studentRef?: string; status?: string },
  ): Promise<Fine[]> {
    let sql = 'SELECT * FROM fines WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (filters.studentRef) {
      sql += ' AND student_ref = ?';
      params.push(filters.studentRef);
    }
    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await this.db.all<FineRow>(sql, params);
    return rows.map(mapFine);
  }

  async sumOpenFinesPaise(
    tenantId: string,
    studentRef: string,
  ): Promise<number> {
    const row = await this.db.get<{ s: number | null }>(
      `SELECT COALESCE(SUM(amount_paise), 0) AS s FROM fines
       WHERE tenant_id = ? AND student_ref = ? AND status = 'open'`,
      [tenantId, studentRef],
    );
    return Number(row?.s ?? 0);
  }

  async payFine(
    tenantId: string,
    id: string,
    paidOn: string,
  ): Promise<Fine | undefined> {
    await this.db.run(
      `UPDATE fines SET
        status = 'paid', paid_on = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ? AND status = 'open'`,
      [paidOn, tenantId, id],
    );
    return this.getFine(tenantId, id);
  }

  async waiveFine(
    tenantId: string,
    id: string,
    reason: string,
  ): Promise<Fine | undefined> {
    await this.db.run(
      `UPDATE fines SET
        status = 'waived', waived_reason = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ? AND status = 'open'`,
      [reason, tenantId, id],
    );
    return this.getFine(tenantId, id);
  }

  async countActiveHoldsForStudent(
    tenantId: string,
    studentRef: string,
  ): Promise<number> {
    const row = await this.db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM holds
       WHERE tenant_id = ? AND student_ref = ?
         AND status IN ('queued', 'ready')`,
      [tenantId, studentRef],
    );
    return Number(row?.n ?? 0);
  }

  isUniqueConstraintError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /UNIQUE constraint failed/i.test(msg);
  }
}
