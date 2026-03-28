import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { StorageService } from '../services/storage';
import type { StorageProvider } from '../services/storage';

/**
 * File Storage routes:
 *   GET    /api/storage/config          — get current storage config
 *   PUT    /api/storage/config          — update storage config (setup wizard + settings)
 *   POST   /api/storage/upload          — upload a file (base64 in JSON body)
 *   GET    /api/storage/files           — list uploaded files
 *   GET    /api/storage/files/:id       — get file metadata
 *   GET    /api/storage/files/:id/download — download a file
 *   DELETE /api/storage/files/:id       — delete a file
 */
export function createStorageRouter(
  db: DatabaseEngine,
  logger: Logger,
  providerOverride?: StorageProvider,
): Router {
  const router = Router();
  const service = new StorageService(db, logger, providerOverride);

  router.get(
    '/storage/config',
    asyncHandler(async (_req: Request, res: Response) => {
      const config = await service.getConfig();
      // Never return secrets to the client
      res.json({
        provider: config.provider,
        localPath: config.localPath,
        azureContainer: config.azureContainer,
        awsRegion: config.awsRegion,
        awsBucket: config.awsBucket,
        maxFileSizeMb: config.maxFileSizeMb,
        // Mask secrets
        azureConnectionStringSet: !!config.azureConnectionString,
        awsAccessKeySet: !!config.awsAccessKey,
        awsSecretKeySet: !!config.awsSecretKey,
      });
    }),
  );

  router.put(
    '/storage/config',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateConfig({
        provider: body.provider as 'local' | 'azure_blob' | 'aws_s3' | 'none' | undefined,
        localPath: body.localPath as string | undefined,
        azureConnectionString: body.azureConnectionString as string | undefined,
        azureContainer: body.azureContainer as string | undefined,
        awsRegion: body.awsRegion as string | undefined,
        awsBucket: body.awsBucket as string | undefined,
        awsAccessKey: body.awsAccessKey as string | undefined,
        awsSecretKey: body.awsSecretKey as string | undefined,
        maxFileSizeMb: body.maxFileSizeMb as number | undefined,
      });
      if (!result.success) throw new AppError(result.error ?? 'Update failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/storage/upload',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const fileBase64 = (body.file as string) ?? '';
      const originalName = (body.originalName as string) ?? (body.fileName as string) ?? 'unnamed';
      const mimeType = (body.mimeType as string) ?? 'application/octet-stream';
      const uploadedBy = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      const contextType = (body.contextType as string) ?? '';
      const contextId = (body.contextId as string) ?? '';

      if (!fileBase64) throw new AppError('file (base64) is required', 400);
      if (!uploadedBy) throw new AppError('email is required', 400);

      let buffer: Buffer;
      try {
        const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
        buffer = Buffer.from(raw, 'base64');
      } catch {
        throw new AppError('Invalid base64 file data', 400);
      }

      if (buffer.length === 0) throw new AppError('File data is empty', 400);

      const result = await service.upload({
        buffer,
        originalName,
        mimeType,
        uploadedBy,
        contextType,
        contextId,
      });

      if (!result.success) throw new AppError(result.error ?? 'Upload failed', 400);
      res.status(201).json(result.file);
    }),
  );

  router.get(
    '/storage/files',
    asyncHandler(async (req: Request, res: Response) => {
      const files = await service.listFiles({
        uploadedBy: (req.query.email as string) || undefined,
        contextType: (req.query.contextType as string) || undefined,
        contextId: (req.query.contextId as string) || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      });
      res.json({ files });
    }),
  );

  router.get(
    '/storage/files/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const file = await service.getFileInfo(req.params.id);
      if (!file) throw new AppError('File not found', 404);
      res.json(file);
    }),
  );

  router.get(
    '/storage/files/:id/download',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.download(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Download failed', 404);

      res.setHeader('Content-Type', result.mimeType ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${result.originalName}"`);
      res.send(result.buffer);
    }),
  );

  router.delete(
    '/storage/files/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.deleteFile(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Delete failed', 400);
      res.json({ success: true });
    }),
  );

  return router;
}
