import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { NotificationDispatcher } from '../services/notification/dispatcher';
import { AppError, asyncHandler } from '../app';
import { AuditService } from '../audit/audit-service';
import { DocumentService } from '../services/document-service';

/**
 * Document Management routes:
 *
 * Documents:
 *   POST   /api/documents                         — create a document (draft)
 *   GET    /api/documents                          — list documents (latest version per group)
 *   GET    /api/documents/:id                      — get a single document
 *   PUT    /api/documents/:id                      — update a draft document
 *   DELETE /api/documents/:id                      — delete a draft document
 *   POST   /api/documents/:id/publish              — publish a draft
 *   POST   /api/documents/:id/archive              — archive a document
 *   POST   /api/documents/:id/version              — create a new version
 *   GET    /api/documents/:id/versions              — get version history
 *
 * Acknowledgments:
 *   POST   /api/documents/:id/acknowledge           — acknowledge a published document
 *   GET    /api/documents/:id/acknowledgments        — get ack report (admin)
 *   GET    /api/documents/my/pending-acks            — pending acknowledgments for current user
 *
 * Templates:
 *   POST   /api/document-templates                   — create a template
 *   GET    /api/document-templates                   — list templates
 *   GET    /api/document-templates/variables          — available template variables
 *   GET    /api/document-templates/:id                — get a single template
 *   PUT    /api/document-templates/:id                — update a template
 *   DELETE /api/document-templates/:id                — delete a template
 *
 * Generation:
 *   POST   /api/document-templates/:id/generate       — generate a document from template
 *   POST   /api/document-templates/:id/preview        — preview merge without saving
 *   GET    /api/generated-documents                    — list all generated (admin)
 *   GET    /api/generated-documents/mine               — generated documents for current user
 *   GET    /api/generated-documents/:id                — get a single generated document
 */
export function createDocumentRouter(
  db: DatabaseEngine,
  logger: Logger,
  dispatcher?: NotificationDispatcher,
): Router {
  const router = Router();
  const auditService = new AuditService(db, logger);
  const service = new DocumentService(db, logger, auditService, dispatcher ?? null);

  // ── Documents CRUD ──

  /** POST /api/documents — create a new document (draft). */
  router.post(
    '/documents',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { title, category, content, fileId, ackRequired } = req.body as {
        title?: string;
        category?: string;
        content?: string;
        fileId?: string | null;
        ackRequired?: boolean;
      };

      if (!title) throw new AppError('title is required', 400);

      const result = await service.createDocument(
        { title, category, content, fileId, ackRequired },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to create document', 400);
      res.status(201).json({ document: result.data });
    }),
  );

  /** GET /api/documents — list documents (latest version per group). */
  router.get(
    '/documents',
    asyncHandler(async (req: Request, res: Response) => {
      const status = req.query.status as string | undefined;
      const category = req.query.category as string | undefined;
      const documents = await service.listDocuments({ status, category });
      res.json({ documents });
    }),
  );

  /**
   * GET /api/documents/my/pending-acks — pending acknowledgments for current user.
   * MUST be before /api/documents/:id to avoid "my" being treated as an ID.
   */
  router.get(
    '/documents/my/pending-acks',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const pending = await service.getPendingAcknowledgments(email);
      const count = await service.countPendingAcknowledgments(email);
      res.json({ pending, count });
    }),
  );

  /** GET /api/documents/:id — get a single document. */
  router.get(
    '/documents/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const doc = await service.getDocumentById(req.params.id);
      if (!doc) throw new AppError('Document not found', 404);
      res.json({ document: doc });
    }),
  );

  /** PUT /api/documents/:id — update a draft document. */
  router.put(
    '/documents/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { title, category, content, fileId, ackRequired } = req.body as {
        title?: string;
        category?: string;
        content?: string;
        fileId?: string | null;
        ackRequired?: boolean;
      };

      const result = await service.updateDocument(
        req.params.id,
        { title, category, content, fileId, ackRequired },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to update document', 400);
      res.json({ success: true });
    }),
  );

  /** DELETE /api/documents/:id — delete a draft document. */
  router.delete(
    '/documents/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteDocument(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed to delete document', 400);
      res.json({ success: true });
    }),
  );

  /** POST /api/documents/:id/publish — publish a draft document. */
  router.post(
    '/documents/:id/publish',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.publishDocument(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed to publish document', 400);
      res.json({ success: true });
    }),
  );

  /** POST /api/documents/:id/archive — archive a document. */
  router.post(
    '/documents/:id/archive',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.archiveDocument(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed to archive document', 400);
      res.json({ success: true });
    }),
  );

  /** POST /api/documents/:id/version — create a new version of a document. */
  router.post(
    '/documents/:id/version',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';

      // The :id here is the document_group_id of the document to version
      const doc = await service.getDocumentById(req.params.id);
      if (!doc) throw new AppError('Document not found', 404);

      const { title, category, content, fileId, ackRequired } = req.body as {
        title?: string;
        category?: string;
        content?: string;
        fileId?: string | null;
        ackRequired?: boolean;
      };

      const result = await service.createVersion(
        doc.document_group_id,
        { title, category, content, fileId, ackRequired },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to create version', 400);
      res.status(201).json({ document: result.data });
    }),
  );

  /** GET /api/documents/:id/versions — get version history for a document. */
  router.get(
    '/documents/:id/versions',
    asyncHandler(async (req: Request, res: Response) => {
      const doc = await service.getDocumentById(req.params.id);
      if (!doc) throw new AppError('Document not found', 404);
      const versions = await service.getVersionHistory(doc.document_group_id);
      res.json({ versions });
    }),
  );

  // ── Acknowledgments ──

  /** POST /api/documents/:id/acknowledge — acknowledge a published document. */
  router.post(
    '/documents/:id/acknowledge',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);

      const result = await service.acknowledge(req.params.id, email);
      if (!result.success) throw new AppError(result.error ?? 'Failed to acknowledge', 400);
      res.json({ acknowledgment: result.data });
    }),
  );

  /** GET /api/documents/:id/acknowledgments — acknowledgment report for a document. */
  router.get(
    '/documents/:id/acknowledgments',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getAckReport(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Failed to get report', 400);
      res.json({ report: result.data });
    }),
  );

  // ── Templates ──

  /** POST /api/document-templates — create a new template. */
  router.post(
    '/document-templates',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { name, category, contentTemplate, description } = req.body as {
        name?: string;
        category?: string;
        contentTemplate?: string;
        description?: string;
      };

      if (!name) throw new AppError('name is required', 400);
      if (!contentTemplate) throw new AppError('contentTemplate is required', 400);

      const result = await service.createTemplate(
        { name, category, contentTemplate, description },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to create template', 400);
      res.status(201).json({ template: result.data });
    }),
  );

  /** GET /api/document-templates — list all templates. */
  router.get(
    '/document-templates',
    asyncHandler(async (req: Request, res: Response) => {
      const category = req.query.category as string | undefined;
      const templates = await service.listTemplates(category);
      res.json({ templates });
    }),
  );

  /** GET /api/document-templates/variables — available template variables. */
  router.get('/document-templates/variables', (_req: Request, res: Response) => {
    const variables = service.getAvailableVariables();
    res.json({ variables });
  });

  /** GET /api/document-templates/:id — get a single template. */
  router.get(
    '/document-templates/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const template = await service.getTemplateById(req.params.id);
      if (!template) throw new AppError('Template not found', 404);
      res.json({ template });
    }),
  );

  /** PUT /api/document-templates/:id — update a template. */
  router.put(
    '/document-templates/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { name, category, contentTemplate, description } = req.body as {
        name?: string;
        category?: string;
        contentTemplate?: string;
        description?: string;
      };

      const result = await service.updateTemplate(
        req.params.id,
        { name, category, contentTemplate, description },
        actor,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to update template', 400);
      res.json({ success: true });
    }),
  );

  /** DELETE /api/document-templates/:id — delete a template. */
  router.delete(
    '/document-templates/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const result = await service.deleteTemplate(req.params.id, actor);
      if (!result.success) throw new AppError(result.error ?? 'Failed to delete template', 400);
      res.json({ success: true });
    }),
  );

  // ── Generation ──

  /** POST /api/document-templates/:id/generate — generate a document from template. */
  router.post(
    '/document-templates/:id/generate',
    asyncHandler(async (req: Request, res: Response) => {
      const actor = req.identity?.email ?? '';
      const { targetEmail, extraVariables } = req.body as {
        targetEmail?: string;
        extraVariables?: Record<string, string | number | boolean | null>;
      };

      if (!targetEmail) throw new AppError('targetEmail is required', 400);

      const result = await service.generateDocument(
        req.params.id,
        targetEmail.toLowerCase().trim(),
        actor,
        extraVariables,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to generate document', 400);
      res.status(201).json({
        content: result.data!.content,
        variables: result.data!.variables,
        record: result.data!.record,
      });
    }),
  );

  /** POST /api/document-templates/:id/preview — preview merge without saving. */
  router.post(
    '/document-templates/:id/preview',
    asyncHandler(async (req: Request, res: Response) => {
      const { targetEmail, extraVariables } = req.body as {
        targetEmail?: string;
        extraVariables?: Record<string, string | number | boolean | null>;
      };

      if (!targetEmail) throw new AppError('targetEmail is required', 400);

      const result = await service.previewTemplate(
        req.params.id,
        targetEmail.toLowerCase().trim(),
        extraVariables,
      );

      if (!result.success) throw new AppError(result.error ?? 'Failed to preview template', 400);
      res.json({ content: result.data!.content, variables: result.data!.variables });
    }),
  );

  /** GET /api/generated-documents — list all generated documents (admin). */
  router.get(
    '/generated-documents',
    asyncHandler(async (_req: Request, res: Response) => {
      const docs = await service.listGenerated();
      res.json({ documents: docs });
    }),
  );

  /** GET /api/generated-documents/mine — generated documents for current user. */
  router.get(
    '/generated-documents/mine',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email;
      if (!email) throw new AppError('Authentication required', 401);
      const docs = await service.getGeneratedByEmail(email);
      res.json({ documents: docs });
    }),
  );

  /** GET /api/generated-documents/:id — get a single generated document. */
  router.get(
    '/generated-documents/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const doc = await service.getGeneratedById(req.params.id);
      if (!doc) throw new AppError('Generated document not found', 404);
      res.json({ document: doc });
    }),
  );

  return router;
}
