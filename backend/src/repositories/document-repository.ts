import { v4 as uuidv4 } from 'uuid';
import type { DatabaseEngine } from '../db/engine';

// ── Row types ──

export interface DocumentRow {
  [key: string]: unknown;
  id: string;
  document_group_id: string;
  title: string;
  category: string;
  version: number;
  content: string;
  file_id: string | null;
  status: string;
  ack_required: number;
  published_at: string | null;
  published_by: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AcknowledgmentRow {
  [key: string]: unknown;
  id: number;
  document_id: string;
  email: string;
  acked_at: string;
}

export interface DocumentTemplateRow {
  [key: string]: unknown;
  id: string;
  name: string;
  category: string;
  content_template: string;
  description: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GeneratedDocumentRow {
  [key: string]: unknown;
  id: string;
  template_id: string;
  target_email: string;
  generated_by: string;
  variables_json: string;
  file_id: string | null;
  created_at: string;
}

/** Acknowledgment with document title for employee-facing queries. */
export interface AckWithDocumentRow extends AcknowledgmentRow {
  title: string;
  category: string;
  version: number;
}

/** Acknowledgment status per employee for a given document. */
export interface AckStatusRow {
  [key: string]: unknown;
  email: string;
  name: string;
  acked_at: string | null;
}

/**
 * Document Management repository — all document, acknowledgment, template,
 * and generated document DB operations.
 */
export class DocumentRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── Document CRUD ──

  /** Create a new document (first version). Returns the created row. */
  async createDocument(data: {
    title: string;
    category?: string;
    content?: string;
    fileId?: string | null;
    ackRequired?: boolean;
    createdBy: string;
  }): Promise<DocumentRow> {
    const id = uuidv4();
    const groupId = uuidv4();
    await this.db.run(
      `INSERT INTO documents (id, document_group_id, title, category, version, content, file_id, ack_required, created_by)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
      [
        id,
        groupId,
        data.title,
        data.category ?? 'policy',
        data.content ?? '',
        data.fileId ?? null,
        data.ackRequired ? 1 : 0,
        data.createdBy,
      ],
    );
    const row = await this.getDocumentById(id);
    if (!row) throw new Error('Failed to create document');
    return row;
  }

  /** Create a new version of an existing document. Increments version from latest. */
  async createVersion(data: {
    documentGroupId: string;
    title?: string;
    category?: string;
    content?: string;
    fileId?: string | null;
    ackRequired?: boolean;
    createdBy: string;
  }): Promise<DocumentRow> {
    const latest = await this.getLatestVersion(data.documentGroupId);
    if (!latest) throw new Error('Document group not found');

    const id = uuidv4();
    const newVersion = latest.version + 1;
    await this.db.run(
      `INSERT INTO documents (id, document_group_id, title, category, version, content, file_id, ack_required, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.documentGroupId,
        data.title ?? latest.title,
        data.category ?? latest.category,
        newVersion,
        data.content ?? '',
        data.fileId ?? null,
        data.ackRequired !== undefined ? (data.ackRequired ? 1 : 0) : latest.ack_required,
        data.createdBy,
      ],
    );
    const row = await this.getDocumentById(id);
    if (!row) throw new Error('Failed to create document version');
    return row;
  }

  /** Get a document by ID. */
  async getDocumentById(id: string): Promise<DocumentRow | null> {
    return this.db.get<DocumentRow>('SELECT * FROM documents WHERE id = ?', [id]);
  }

  /** Get the latest version for a document group. */
  async getLatestVersion(documentGroupId: string): Promise<DocumentRow | null> {
    return this.db.get<DocumentRow>(
      'SELECT * FROM documents WHERE document_group_id = ? ORDER BY version DESC LIMIT 1',
      [documentGroupId],
    );
  }

  /** Get all versions for a document group, newest first. */
  async getVersionHistory(documentGroupId: string): Promise<DocumentRow[]> {
    return this.db.all<DocumentRow>(
      'SELECT * FROM documents WHERE document_group_id = ? ORDER BY version DESC',
      [documentGroupId],
    );
  }

  /**
   * List documents (latest version per group only).
   * Optionally filter by status and/or category.
   */
  async listDocuments(filters?: { status?: string; category?: string }): Promise<DocumentRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.status) {
      conditions.push('d.status = ?');
      params.push(filters.status);
    }
    if (filters?.category) {
      conditions.push('d.category = ?');
      params.push(filters.category);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db.all<DocumentRow>(
      `SELECT d.* FROM documents d
       INNER JOIN (
         SELECT document_group_id, MAX(version) AS max_version
         FROM documents
         GROUP BY document_group_id
       ) latest ON d.document_group_id = latest.document_group_id AND d.version = latest.max_version
       ${where}
       ORDER BY d.updated_at DESC`,
      params,
    );
  }

  /** Update a document's editable fields. Only draft documents should be edited. */
  async updateDocument(
    id: string,
    fields: Partial<
      Pick<DocumentRow, 'title' | 'category' | 'content' | 'file_id' | 'ack_required'>
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
    await this.db.run(`UPDATE documents SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Publish a draft document. Sets status, published_at, published_by. */
  async publishDocument(id: string, publishedBy: string): Promise<void> {
    await this.db.run(
      `UPDATE documents SET status = 'published', published_at = datetime('now'),
       published_by = ?, updated_at = datetime('now') WHERE id = ?`,
      [publishedBy, id],
    );
  }

  /** Archive a document. */
  async archiveDocument(id: string): Promise<void> {
    await this.db.run(
      "UPDATE documents SET status = 'archived', updated_at = datetime('now') WHERE id = ?",
      [id],
    );
  }

  /** Delete a draft document. Only drafts can be deleted. */
  async deleteDocument(id: string): Promise<void> {
    await this.db.run('DELETE FROM documents WHERE id = ?', [id]);
  }

  // ── Acknowledgments ──

  /** Record an employee acknowledgment. */
  async acknowledge(documentId: string, email: string): Promise<AcknowledgmentRow> {
    await this.db.run('INSERT INTO employee_acknowledgments (document_id, email) VALUES (?, ?)', [
      documentId,
      email,
    ]);
    const row = await this.db.get<AcknowledgmentRow>(
      'SELECT * FROM employee_acknowledgments WHERE document_id = ? AND email = ?',
      [documentId, email],
    );
    if (!row) throw new Error('Failed to record acknowledgment');
    return row;
  }

  /** Check if an employee has acknowledged a document. */
  async hasAcknowledged(documentId: string, email: string): Promise<boolean> {
    const row = await this.db.get<{ id: number; [key: string]: unknown }>(
      'SELECT id FROM employee_acknowledgments WHERE document_id = ? AND email = ?',
      [documentId, email],
    );
    return !!row;
  }

  /** Get all acknowledgments for a document. */
  async getAcknowledgments(documentId: string): Promise<AcknowledgmentRow[]> {
    return this.db.all<AcknowledgmentRow>(
      'SELECT * FROM employee_acknowledgments WHERE document_id = ? ORDER BY acked_at DESC',
      [documentId],
    );
  }

  /**
   * Acknowledgment report for a document: all active members with ack status.
   * Returns who has acked and who hasn't.
   */
  async getAckReport(documentId: string): Promise<AckStatusRow[]> {
    return this.db.all<AckStatusRow>(
      `SELECT m.email, m.name, ea.acked_at
       FROM members m
       LEFT JOIN employee_acknowledgments ea
         ON ea.email = m.email AND ea.document_id = ?
       WHERE m.active = 1
       ORDER BY ea.acked_at IS NULL DESC, m.name ASC`,
      [documentId],
    );
  }

  /** Get pending acknowledgments for an employee (published, ack_required, not yet acked). */
  async getPendingAcknowledgments(email: string): Promise<AckWithDocumentRow[]> {
    return this.db.all<AckWithDocumentRow>(
      `SELECT ea_stub.document_id, d.title, d.category, d.version,
              NULL AS id, ? AS email, NULL AS acked_at
       FROM documents d
       INNER JOIN (
         SELECT document_group_id, MAX(version) AS max_version
         FROM documents
         GROUP BY document_group_id
       ) latest ON d.document_group_id = latest.document_group_id AND d.version = latest.max_version
       LEFT JOIN employee_acknowledgments ea_stub
         ON ea_stub.document_id = d.id AND ea_stub.email = ?
       WHERE d.status = 'published' AND d.ack_required = 1 AND ea_stub.id IS NULL
       ORDER BY d.published_at DESC`,
      [email, email],
    );
  }

  /** Count pending acknowledgments for an employee. */
  async countPendingAcknowledgments(email: string): Promise<number> {
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) AS cnt
       FROM documents d
       INNER JOIN (
         SELECT document_group_id, MAX(version) AS max_version
         FROM documents
         GROUP BY document_group_id
       ) latest ON d.document_group_id = latest.document_group_id AND d.version = latest.max_version
       LEFT JOIN employee_acknowledgments ea
         ON ea.document_id = d.id AND ea.email = ?
       WHERE d.status = 'published' AND d.ack_required = 1 AND ea.id IS NULL`,
      [email],
    );
    return row?.cnt ?? 0;
  }

  // ── Templates ──

  /** Create a template. */
  async createTemplate(data: {
    name: string;
    category?: string;
    contentTemplate: string;
    description?: string;
    createdBy: string;
  }): Promise<DocumentTemplateRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO document_templates (id, name, category, content_template, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.category ?? 'custom',
        data.contentTemplate,
        data.description ?? '',
        data.createdBy,
      ],
    );
    const row = await this.getTemplateById(id);
    if (!row) throw new Error('Failed to create template');
    return row;
  }

  /** Get a template by ID. */
  async getTemplateById(id: string): Promise<DocumentTemplateRow | null> {
    return this.db.get<DocumentTemplateRow>('SELECT * FROM document_templates WHERE id = ?', [id]);
  }

  /** List all templates, optionally filtered by category. */
  async listTemplates(category?: string): Promise<DocumentTemplateRow[]> {
    if (category) {
      return this.db.all<DocumentTemplateRow>(
        'SELECT * FROM document_templates WHERE category = ? ORDER BY name ASC',
        [category],
      );
    }
    return this.db.all<DocumentTemplateRow>('SELECT * FROM document_templates ORDER BY name ASC');
  }

  /** Update a template. */
  async updateTemplate(
    id: string,
    fields: Partial<
      Pick<DocumentTemplateRow, 'name' | 'category' | 'content_template' | 'description'>
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
    await this.db.run(`UPDATE document_templates SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  /** Delete a template. CASCADE removes generated_documents. */
  async deleteTemplate(id: string): Promise<void> {
    await this.db.run('DELETE FROM document_templates WHERE id = ?', [id]);
  }

  // ── Generated documents ──

  /** Save a generated document record. */
  async saveGeneratedDocument(data: {
    templateId: string;
    targetEmail: string;
    generatedBy: string;
    variablesJson: string;
    fileId?: string | null;
  }): Promise<GeneratedDocumentRow> {
    const id = uuidv4();
    await this.db.run(
      `INSERT INTO generated_documents (id, template_id, target_email, generated_by, variables_json, file_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.templateId,
        data.targetEmail,
        data.generatedBy,
        data.variablesJson,
        data.fileId ?? null,
      ],
    );
    const row = await this.db.get<GeneratedDocumentRow>(
      'SELECT * FROM generated_documents WHERE id = ?',
      [id],
    );
    if (!row) throw new Error('Failed to save generated document');
    return row;
  }

  /** Get generated documents for an employee. */
  async getGeneratedByEmail(
    email: string,
  ): Promise<(GeneratedDocumentRow & { template_name: string; template_category: string })[]> {
    return this.db.all<GeneratedDocumentRow & { template_name: string; template_category: string }>(
      `SELECT gd.*, dt.name AS template_name, dt.category AS template_category
       FROM generated_documents gd
       INNER JOIN document_templates dt ON dt.id = gd.template_id
       WHERE gd.target_email = ?
       ORDER BY gd.created_at DESC`,
      [email],
    );
  }

  /** Get a generated document by ID. */
  async getGeneratedById(id: string): Promise<GeneratedDocumentRow | null> {
    return this.db.get<GeneratedDocumentRow>('SELECT * FROM generated_documents WHERE id = ?', [
      id,
    ]);
  }

  /** List all generated documents (admin). */
  async listGenerated(): Promise<
    (GeneratedDocumentRow & { template_name: string; template_category: string })[]
  > {
    return this.db.all<GeneratedDocumentRow & { template_name: string; template_category: string }>(
      `SELECT gd.*, dt.name AS template_name, dt.category AS template_category
       FROM generated_documents gd
       INNER JOIN document_templates dt ON dt.id = gd.template_id
       ORDER BY gd.created_at DESC`,
    );
  }
}
