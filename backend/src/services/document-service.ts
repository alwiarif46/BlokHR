import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AuditService } from '../audit/audit-service';
import type { NotificationDispatcher } from './notification/dispatcher';
import {
  DocumentRepository,
  type DocumentRow,
  type AcknowledgmentRow,
  type AckWithDocumentRow,
  type AckStatusRow,
  type DocumentTemplateRow,
  type GeneratedDocumentRow,
} from '../repositories/document-repository';
import { TemplateEngine, type TemplateContext, type TemplateVariables } from './template-engine';

// ── Result types ──

interface ServiceResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

// ── Internal row types ──

interface MemberRow {
  [key: string]: unknown;
  email: string;
  name: string;
  active: number;
}

// ── Valid categories ──

const VALID_DOCUMENT_CATEGORIES = [
  'policy',
  'handbook',
  'code_of_conduct',
  'procedure',
  'guidelines',
  'form',
  'other',
];

const VALID_TEMPLATE_CATEGORIES = [
  'offer_letter',
  'appraisal_letter',
  'warning_letter',
  'experience_certificate',
  'salary_certificate',
  'custom',
];

/**
 * Document Management service — business logic for document lifecycle,
 * acknowledgments, template merging, and generated documents.
 *
 * Every write operation is audit-logged. Publishing with ack_required
 * triggers notifications to all active employees.
 */
export class DocumentService {
  private readonly repo: DocumentRepository;
  private readonly templateEngine: TemplateEngine;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly auditService?: AuditService,
    private readonly dispatcher?: NotificationDispatcher | null,
  ) {
    this.repo = new DocumentRepository(db);
    this.templateEngine = new TemplateEngine();
  }

  // ── Document CRUD ──

  async createDocument(
    data: {
      title: string;
      category?: string;
      content?: string;
      fileId?: string | null;
      ackRequired?: boolean;
    },
    actorEmail: string,
  ): Promise<ServiceResult<DocumentRow>> {
    if (!data.title || !data.title.trim()) {
      return { success: false, error: 'Document title is required' };
    }

    if (data.category && !VALID_DOCUMENT_CATEGORIES.includes(data.category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_DOCUMENT_CATEGORIES.join(', ')}`,
      };
    }

    const doc = await this.repo.createDocument({
      title: data.title.trim(),
      category: data.category,
      content: data.content,
      fileId: data.fileId,
      ackRequired: data.ackRequired,
      createdBy: actorEmail,
    });

    this.logger.info(
      { documentId: doc.id, groupId: doc.document_group_id, title: doc.title, actor: actorEmail },
      'Document created',
    );

    this.logAudit('document', doc.id, 'created', actorEmail, {
      title: doc.title,
      category: doc.category,
      version: doc.version,
    });

    return { success: true, data: doc };
  }

  async createVersion(
    documentGroupId: string,
    data: {
      title?: string;
      category?: string;
      content?: string;
      fileId?: string | null;
      ackRequired?: boolean;
    },
    actorEmail: string,
  ): Promise<ServiceResult<DocumentRow>> {
    const latest = await this.repo.getLatestVersion(documentGroupId);
    if (!latest) {
      return { success: false, error: 'Document group not found' };
    }

    if (data.category && !VALID_DOCUMENT_CATEGORIES.includes(data.category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_DOCUMENT_CATEGORIES.join(', ')}`,
      };
    }

    const doc = await this.repo.createVersion({
      documentGroupId,
      title: data.title?.trim(),
      category: data.category,
      content: data.content,
      fileId: data.fileId,
      ackRequired: data.ackRequired,
      createdBy: actorEmail,
    });

    this.logger.info(
      { documentId: doc.id, groupId: documentGroupId, version: doc.version, actor: actorEmail },
      'Document version created',
    );

    this.logAudit('document', doc.id, 'version_created', actorEmail, {
      title: doc.title,
      version: doc.version,
      previousVersion: latest.version,
    });

    return { success: true, data: doc };
  }

  async updateDocument(
    id: string,
    fields: {
      title?: string;
      category?: string;
      content?: string;
      fileId?: string | null;
      ackRequired?: boolean;
    },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const doc = await this.repo.getDocumentById(id);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    if (doc.status !== 'draft') {
      return { success: false, error: 'Only draft documents can be edited' };
    }

    if (fields.title !== undefined && !fields.title.trim()) {
      return { success: false, error: 'Document title cannot be empty' };
    }

    if (fields.category && !VALID_DOCUMENT_CATEGORIES.includes(fields.category)) {
      return {
        success: false,
        error: `Invalid category. Must be one of: ${VALID_DOCUMENT_CATEGORIES.join(', ')}`,
      };
    }

    const dbFields: Record<string, unknown> = {};
    if (fields.title !== undefined) dbFields.title = fields.title.trim();
    if (fields.category !== undefined) dbFields.category = fields.category;
    if (fields.content !== undefined) dbFields.content = fields.content;
    if (fields.fileId !== undefined) dbFields.file_id = fields.fileId;
    if (fields.ackRequired !== undefined) dbFields.ack_required = fields.ackRequired ? 1 : 0;

    await this.repo.updateDocument(id, dbFields as Parameters<typeof this.repo.updateDocument>[1]);

    this.logger.info(
      { documentId: id, fields: Object.keys(dbFields), actor: actorEmail },
      'Document updated',
    );

    this.logAudit('document', id, 'updated', actorEmail, dbFields);

    return { success: true };
  }

  async publishDocument(id: string, actorEmail: string): Promise<ServiceResult> {
    const doc = await this.repo.getDocumentById(id);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    if (doc.status !== 'draft') {
      return { success: false, error: 'Only draft documents can be published' };
    }

    await this.repo.publishDocument(id, actorEmail);

    this.logger.info({ documentId: id, title: doc.title, actor: actorEmail }, 'Document published');

    this.logAudit('document', id, 'published', actorEmail, {
      title: doc.title,
      version: doc.version,
      ackRequired: doc.ack_required,
    });

    // Notify all active employees if acknowledgment is required
    if (doc.ack_required && this.dispatcher) {
      this.notifyPublished(doc).catch((err) => {
        this.logger.error({ err, documentId: id }, 'Document publish notification failed');
      });
    }

    return { success: true };
  }

  async archiveDocument(id: string, actorEmail: string): Promise<ServiceResult> {
    const doc = await this.repo.getDocumentById(id);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    if (doc.status === 'archived') {
      return { success: false, error: 'Document is already archived' };
    }

    await this.repo.archiveDocument(id);

    this.logger.info({ documentId: id, title: doc.title, actor: actorEmail }, 'Document archived');

    this.logAudit('document', id, 'archived', actorEmail, { title: doc.title });

    return { success: true };
  }

  async deleteDocument(id: string, actorEmail: string): Promise<ServiceResult> {
    const doc = await this.repo.getDocumentById(id);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    if (doc.status !== 'draft') {
      return { success: false, error: 'Only draft documents can be deleted' };
    }

    await this.repo.deleteDocument(id);

    this.logger.info({ documentId: id, title: doc.title, actor: actorEmail }, 'Document deleted');

    this.logAudit('document', id, 'deleted', actorEmail, { title: doc.title });

    return { success: true };
  }

  async getDocumentById(id: string): Promise<DocumentRow | null> {
    return this.repo.getDocumentById(id);
  }

  async getVersionHistory(documentGroupId: string): Promise<DocumentRow[]> {
    return this.repo.getVersionHistory(documentGroupId);
  }

  async listDocuments(filters?: { status?: string; category?: string }): Promise<DocumentRow[]> {
    return this.repo.listDocuments(filters);
  }

  // ── Acknowledgments ──

  async acknowledge(documentId: string, email: string): Promise<ServiceResult<AcknowledgmentRow>> {
    const doc = await this.repo.getDocumentById(documentId);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    if (doc.status !== 'published') {
      return { success: false, error: 'Only published documents can be acknowledged' };
    }

    if (!doc.ack_required) {
      return { success: false, error: 'This document does not require acknowledgment' };
    }

    // Validate member exists
    const member = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [email],
    );
    if (!member) {
      return { success: false, error: 'Employee not found or inactive' };
    }

    // Check if already acknowledged
    const already = await this.repo.hasAcknowledged(documentId, email);
    if (already) {
      return { success: false, error: 'Already acknowledged' };
    }

    const ack = await this.repo.acknowledge(documentId, email);

    this.logger.info({ documentId, email, title: doc.title }, 'Document acknowledged');

    this.logAudit('acknowledgment', String(ack.id), 'created', email, {
      documentId,
      documentTitle: doc.title,
      version: doc.version,
    });

    return { success: true, data: ack };
  }

  async getPendingAcknowledgments(email: string): Promise<AckWithDocumentRow[]> {
    return this.repo.getPendingAcknowledgments(email);
  }

  async countPendingAcknowledgments(email: string): Promise<number> {
    return this.repo.countPendingAcknowledgments(email);
  }

  async getAckReport(documentId: string): Promise<ServiceResult<AckStatusRow[]>> {
    const doc = await this.repo.getDocumentById(documentId);
    if (!doc) {
      return { success: false, error: 'Document not found' };
    }

    const report = await this.repo.getAckReport(documentId);
    return { success: true, data: report };
  }

  // ── Templates ──

  async createTemplate(
    data: {
      name: string;
      category?: string;
      contentTemplate: string;
      description?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult<DocumentTemplateRow>> {
    if (!data.name || !data.name.trim()) {
      return { success: false, error: 'Template name is required' };
    }

    if (!data.contentTemplate || !data.contentTemplate.trim()) {
      return { success: false, error: 'Template content is required' };
    }

    if (data.category && !VALID_TEMPLATE_CATEGORIES.includes(data.category)) {
      return {
        success: false,
        error: `Invalid template category. Must be one of: ${VALID_TEMPLATE_CATEGORIES.join(', ')}`,
      };
    }

    const template = await this.repo.createTemplate({
      name: data.name.trim(),
      category: data.category,
      contentTemplate: data.contentTemplate,
      description: data.description,
      createdBy: actorEmail,
    });

    this.logger.info(
      { templateId: template.id, name: template.name, actor: actorEmail },
      'Document template created',
    );

    this.logAudit('document_template', template.id, 'created', actorEmail, {
      name: template.name,
      category: template.category,
    });

    return { success: true, data: template };
  }

  async updateTemplate(
    id: string,
    fields: {
      name?: string;
      category?: string;
      contentTemplate?: string;
      description?: string;
    },
    actorEmail: string,
  ): Promise<ServiceResult> {
    const existing = await this.repo.getTemplateById(id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    if (fields.name !== undefined && !fields.name.trim()) {
      return { success: false, error: 'Template name cannot be empty' };
    }

    if (fields.category && !VALID_TEMPLATE_CATEGORIES.includes(fields.category)) {
      return {
        success: false,
        error: `Invalid template category. Must be one of: ${VALID_TEMPLATE_CATEGORIES.join(', ')}`,
      };
    }

    const dbFields: Record<string, unknown> = {};
    if (fields.name !== undefined) dbFields.name = fields.name.trim();
    if (fields.category !== undefined) dbFields.category = fields.category;
    if (fields.contentTemplate !== undefined) dbFields.content_template = fields.contentTemplate;
    if (fields.description !== undefined) dbFields.description = fields.description;

    await this.repo.updateTemplate(id, dbFields as Parameters<typeof this.repo.updateTemplate>[1]);

    this.logger.info(
      { templateId: id, fields: Object.keys(dbFields), actor: actorEmail },
      'Template updated',
    );

    this.logAudit('document_template', id, 'updated', actorEmail, dbFields);

    return { success: true };
  }

  async deleteTemplate(id: string, actorEmail: string): Promise<ServiceResult> {
    const existing = await this.repo.getTemplateById(id);
    if (!existing) {
      return { success: false, error: 'Template not found' };
    }

    await this.repo.deleteTemplate(id);

    this.logger.info(
      { templateId: id, name: existing.name, actor: actorEmail },
      'Template deleted',
    );

    this.logAudit('document_template', id, 'deleted', actorEmail, { name: existing.name });

    return { success: true };
  }

  async getTemplateById(id: string): Promise<DocumentTemplateRow | null> {
    return this.repo.getTemplateById(id);
  }

  async listTemplates(category?: string): Promise<DocumentTemplateRow[]> {
    return this.repo.listTemplates(category);
  }

  /** Returns all available template variable names for the builder UI. */
  getAvailableVariables(): readonly string[] {
    return this.templateEngine.getAvailableVariables();
  }

  // ── Template merging / document generation ──

  /**
   * Generate a document from a template for a target employee.
   * Merges the template with employee data, saves the result,
   * and returns the merged content + the generated document record.
   */
  async generateDocument(
    templateId: string,
    targetEmail: string,
    actorEmail: string,
    extraVariables?: TemplateVariables,
  ): Promise<
    ServiceResult<{ content: string; variables: TemplateVariables; record: GeneratedDocumentRow }>
  > {
    const template = await this.repo.getTemplateById(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // Validate target employee
    const member = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [targetEmail],
    );
    if (!member) {
      return { success: false, error: 'Target employee not found or inactive' };
    }

    const context: TemplateContext = {
      email: targetEmail,
      db: this.db,
      extraVariables,
    };

    const { content, variables } = await this.templateEngine.merge(
      template.content_template,
      context,
    );

    const record = await this.repo.saveGeneratedDocument({
      templateId,
      targetEmail,
      generatedBy: actorEmail,
      variablesJson: JSON.stringify(variables),
      fileId: null, // File creation (PDF) is handled by the caller if needed
    });

    this.logger.info(
      { generatedId: record.id, templateId, targetEmail, actor: actorEmail },
      'Document generated from template',
    );

    this.logAudit('generated_document', record.id, 'created', actorEmail, {
      templateId,
      templateName: template.name,
      targetEmail,
    });

    return { success: true, data: { content, variables, record } };
  }

  /**
   * Preview a template merge without saving.
   * Useful for the template builder to show a preview before generating.
   */
  async previewTemplate(
    templateId: string,
    targetEmail: string,
    extraVariables?: TemplateVariables,
  ): Promise<ServiceResult<{ content: string; variables: TemplateVariables }>> {
    const template = await this.repo.getTemplateById(templateId);
    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const member = await this.db.get<MemberRow>(
      'SELECT email, name, active FROM members WHERE email = ? AND active = 1',
      [targetEmail],
    );
    if (!member) {
      return { success: false, error: 'Target employee not found or inactive' };
    }

    const context: TemplateContext = {
      email: targetEmail,
      db: this.db,
      extraVariables,
    };

    const result = await this.templateEngine.merge(template.content_template, context);
    return { success: true, data: result };
  }

  async getGeneratedByEmail(
    email: string,
  ): Promise<(GeneratedDocumentRow & { template_name: string; template_category: string })[]> {
    return this.repo.getGeneratedByEmail(email);
  }

  async getGeneratedById(id: string): Promise<GeneratedDocumentRow | null> {
    return this.repo.getGeneratedById(id);
  }

  async listGenerated(): Promise<
    (GeneratedDocumentRow & { template_name: string; template_category: string })[]
  > {
    return this.repo.listGenerated();
  }

  // ── Notification helpers ──

  private async notifyPublished(doc: DocumentRow): Promise<void> {
    if (!this.dispatcher) return;

    // Get all active employees
    const members = await this.db.all<MemberRow>(
      'SELECT email, name, active FROM members WHERE active = 1',
    );

    if (members.length === 0) return;

    await this.dispatcher.notify({
      eventType: 'document:published',
      entityType: 'document',
      entityId: doc.id,
      recipients: members.map((m) => ({ email: m.email, name: m.name, role: 'employee' })),
      data: {
        documentId: doc.id,
        title: doc.title,
        category: doc.category,
        version: doc.version,
        ackRequired: !!doc.ack_required,
      },
    });
  }

  // ── Audit helper ──

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
