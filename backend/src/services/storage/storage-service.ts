import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';
import type { StorageProvider, StorageConfig } from './storage-provider';
import { createStorageProvider } from './storage-provider';

// ── Row types ──

export interface FileUploadRow {
  [key: string]: unknown;
  id: string;
  original_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: string;
  storage_path: string;
  storage_url: string;
  uploaded_by: string;
  context_type: string;
  context_id: string;
  created_at: string;
}

// ── Result types ──

export interface UploadResult {
  success: boolean;
  file?: FileUploadRow;
  error?: string;
}

export interface DownloadResult {
  success: boolean;
  buffer?: Buffer;
  mimeType?: string;
  originalName?: string;
  error?: string;
}

export class StorageService {
  private provider: StorageProvider | null = null;
  private config: StorageConfig | null = null;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    providerOverride?: StorageProvider,
  ) {
    if (providerOverride) {
      this.provider = providerOverride;
    }
  }

  /**
   * Load (or reload) storage config from the database.
   * Called lazily on first operation, or explicitly after config change.
   */
  async loadConfig(): Promise<StorageConfig> {
    const row = await this.db.get<{
      storage_provider: string;
      storage_local_path: string;
      storage_azure_connection_string: string;
      storage_azure_container: string;
      storage_aws_region: string;
      storage_aws_bucket: string;
      storage_aws_access_key: string;
      storage_aws_secret_key: string;
      storage_max_file_size_mb: number;
      [key: string]: unknown;
    }>('SELECT * FROM branding WHERE id = 1', []);

    this.config = {
      provider: (row?.storage_provider as StorageConfig['provider']) ?? 'local',
      localPath: row?.storage_local_path ?? './uploads',
      azureConnectionString: row?.storage_azure_connection_string ?? '',
      azureContainer: row?.storage_azure_container ?? 'shaavir-files',
      awsRegion: row?.storage_aws_region ?? '',
      awsBucket: row?.storage_aws_bucket ?? '',
      awsAccessKey: row?.storage_aws_access_key ?? '',
      awsSecretKey: row?.storage_aws_secret_key ?? '',
      maxFileSizeMb: row?.storage_max_file_size_mb ?? 25,
    };

    // Only rebuild provider if not overridden
    if (!this.provider || this.provider.constructor.name === 'LocalStorageProvider' ||
        this.provider.constructor.name === 'AzureBlobStorageProvider' ||
        this.provider.constructor.name === 'AwsS3StorageProvider') {
      this.provider = createStorageProvider(this.config, this.logger);
    }

    return this.config;
  }

  /** Get current storage config (reads from DB if not loaded). */
  async getConfig(): Promise<StorageConfig> {
    if (!this.config) await this.loadConfig();
    return this.config!;
  }

  /**
   * Update storage configuration in the database.
   * Called during setup wizard or from settings.
   */
  async updateConfig(config: Partial<StorageConfig>): Promise<{ success: boolean; error?: string }> {
    const colMap: Record<string, string> = {
      provider: 'storage_provider',
      localPath: 'storage_local_path',
      azureConnectionString: 'storage_azure_connection_string',
      azureContainer: 'storage_azure_container',
      awsRegion: 'storage_aws_region',
      awsBucket: 'storage_aws_bucket',
      awsAccessKey: 'storage_aws_access_key',
      awsSecretKey: 'storage_aws_secret_key',
      maxFileSizeMb: 'storage_max_file_size_mb',
    };

    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, val] of Object.entries(config)) {
      if (val === undefined) continue;
      const col = colMap[key];
      if (!col) continue;
      sets.push(`${col} = ?`);
      vals.push(val);
    }

    if (sets.length === 0) return { success: false, error: 'No fields to update' };

    sets.push("updated_at = datetime('now')");
    vals.push(1);
    await this.db.run(`UPDATE branding SET ${sets.join(', ')} WHERE id = ?`, vals);

    // Reload config to pick up changes
    await this.loadConfig();

    this.logger.info({ provider: config.provider }, 'Storage config updated');
    return { success: true };
  }

  /**
   * Upload a file.
   * Validates size, stores via provider, tracks in file_uploads table.
   */
  async upload(data: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    uploadedBy: string;
    contextType?: string;
    contextId?: string;
  }): Promise<UploadResult> {
    const config = await this.getConfig();
    if (config.provider === 'none') {
      return { success: false, error: 'File storage is not configured' };
    }

    if (!this.provider) {
      await this.loadConfig();
      if (!this.provider) return { success: false, error: 'Storage provider could not be initialized' };
    }

    // Size check
    const maxBytes = (config.maxFileSizeMb ?? 25) * 1024 * 1024;
    if (data.buffer.length > maxBytes) {
      return { success: false, error: `File exceeds maximum size of ${config.maxFileSizeMb}MB` };
    }

    // Generate storage key
    const id = uuidv4();
    const ext = path.extname(data.originalName) || '';
    const storedName = `${id}${ext}`;
    const contextPrefix = data.contextType ? `${data.contextType}/` : '';
    const key = `${contextPrefix}${storedName}`;

    try {
      await this.provider.upload(key, data.buffer, data.mimeType);
      const url = await this.provider.getUrl(key);

      // Track in DB
      await this.db.run(
        `INSERT INTO file_uploads (id, original_name, stored_name, mime_type, size_bytes,
          storage_provider, storage_path, storage_url, uploaded_by, context_type, context_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, data.originalName, storedName, data.mimeType, data.buffer.length,
          config.provider, key, url, data.uploadedBy,
          data.contextType ?? '', data.contextId ?? '',
        ],
      );

      const row = await this.db.get<FileUploadRow>('SELECT * FROM file_uploads WHERE id = ?', [id]);
      this.logger.info(
        { fileId: id, name: data.originalName, size: data.buffer.length, provider: config.provider },
        'File uploaded',
      );
      return { success: true, file: row ?? undefined };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error({ err: msg, name: data.originalName }, 'File upload failed');
      return { success: false, error: `Upload failed: ${msg}` };
    }
  }

  /** Download a file by ID. */
  async download(fileId: string): Promise<DownloadResult> {
    if (!this.provider) {
      await this.loadConfig();
      if (!this.provider) return { success: false, error: 'Storage provider not initialized' };
    }

    const row = await this.db.get<FileUploadRow>(
      'SELECT * FROM file_uploads WHERE id = ?', [fileId],
    );
    if (!row) return { success: false, error: 'File not found' };

    try {
      const buffer = await this.provider.download(row.storage_path);
      return { success: true, buffer, mimeType: row.mime_type, originalName: row.original_name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Download failed: ${msg}` };
    }
  }

  /** Delete a file by ID. */
  async deleteFile(fileId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.provider) {
      await this.loadConfig();
      if (!this.provider) return { success: false, error: 'Storage provider not initialized' };
    }

    const row = await this.db.get<FileUploadRow>(
      'SELECT * FROM file_uploads WHERE id = ?', [fileId],
    );
    if (!row) return { success: false, error: 'File not found' };

    try {
      await this.provider.delete(row.storage_path);
      await this.db.run('DELETE FROM file_uploads WHERE id = ?', [fileId]);
      this.logger.info({ fileId, name: row.original_name }, 'File deleted');
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Delete failed: ${msg}` };
    }
  }

  /** List files, optionally filtered by uploader or context. */
  async listFiles(filters: {
    uploadedBy?: string;
    contextType?: string;
    contextId?: string;
    limit?: number;
  }): Promise<FileUploadRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.uploadedBy) { conditions.push('uploaded_by = ?'); params.push(filters.uploadedBy); }
    if (filters.contextType) { conditions.push('context_type = ?'); params.push(filters.contextType); }
    if (filters.contextId) { conditions.push('context_id = ?'); params.push(filters.contextId); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filters.limit ?? 100);
    return this.db.all<FileUploadRow>(
      `SELECT * FROM file_uploads ${where} ORDER BY created_at DESC LIMIT ?`, params,
    );
  }

  /** Get a file metadata row by ID. */
  async getFileInfo(fileId: string): Promise<FileUploadRow | null> {
    return this.db.get<FileUploadRow>('SELECT * FROM file_uploads WHERE id = ?', [fileId]);
  }
}
