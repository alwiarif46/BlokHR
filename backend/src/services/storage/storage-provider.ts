import type { Logger } from 'pino';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──

export interface StorageFile {
  key: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
}

export interface StorageConfig {
  provider: 'local' | 'azure_blob' | 'aws_s3' | 'none';
  localPath?: string;
  azureConnectionString?: string;
  azureContainer?: string;
  awsRegion?: string;
  awsBucket?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  maxFileSizeMb?: number;
}

// ── Interface ──

export interface StorageProvider {
  /** Upload a file. Returns the storage key (path/identifier). */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;
  /** Download a file. Returns the raw bytes. */
  download(key: string): Promise<Buffer>;
  /** Delete a file. */
  delete(key: string): Promise<void>;
  /** Check if a file exists. */
  exists(key: string): Promise<boolean>;
  /** Get a public/signed URL for the file (if applicable). */
  getUrl(key: string): Promise<string>;
}

// ── Local Filesystem ──

export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string;

  constructor(
    basePath: string,
    private readonly logger: Logger,
  ) {
    this.basePath = path.resolve(basePath);
    // Ensure directory exists
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(key: string, buffer: Buffer, _mimeType: string): Promise<string> {
    const filePath = this.resolve(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    this.logger.debug({ key, size: buffer.length }, 'Local file uploaded');
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.resolve(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.readFileSync(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolve(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.logger.debug({ key }, 'Local file deleted');
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.resolve(key));
  }

  async getUrl(key: string): Promise<string> {
    return `/files/${key}`;
  }

  private resolve(key: string): string {
    // Prevent path traversal
    const resolved = path.resolve(this.basePath, key);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Invalid file path — path traversal detected');
    }
    return resolved;
  }
}

// ── Azure Blob Storage ──

export class AzureBlobStorageProvider implements StorageProvider {
  private readonly connectionString: string;
  private readonly container: string;

  constructor(
    connectionString: string,
    container: string,
    private readonly logger: Logger,
  ) {
    this.connectionString = connectionString;
    this.container = container;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    // Uses Azure Storage REST API directly (no SDK dependency)
    const url = this.buildBlobUrl(key);
    const headers = this.buildHeaders(mimeType, buffer.length);

    const response = await fetch(url, {
      method: 'PUT',
      body: buffer,
      headers: { ...headers, 'x-ms-blob-type': 'BlockBlob' },
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error(
        { key, status: response.status, error: errText },
        'Azure Blob upload failed',
      );
      throw new Error(`Azure Blob upload failed: ${response.status}`);
    }

    this.logger.debug(
      { key, size: buffer.length, container: this.container },
      'Azure Blob uploaded',
    );
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const url = this.buildBlobUrl(key);
    const headers = this.buildHeaders();

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Azure Blob download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const url = this.buildBlobUrl(key);
    const headers = this.buildHeaders();

    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Azure Blob delete failed: ${response.status}`);
    }
    this.logger.debug({ key }, 'Azure Blob deleted');
  }

  async exists(key: string): Promise<boolean> {
    const url = this.buildBlobUrl(key);
    const headers = this.buildHeaders();

    const response = await fetch(url, { method: 'HEAD', headers });
    return response.ok;
  }

  async getUrl(key: string): Promise<string> {
    return this.buildBlobUrl(key);
  }

  private buildBlobUrl(key: string): string {
    // Parse account from connection string
    const match = this.connectionString.match(/AccountName=([^;]+)/);
    const account = match?.[1] ?? '';
    return `https://${account}.blob.core.windows.net/${this.container}/${encodeURIComponent(key)}`;
  }

  private buildHeaders(mimeType?: string, contentLength?: number): Record<string, string> {
    const headers: Record<string, string> = {
      'x-ms-version': '2020-10-02',
      'x-ms-date': new Date().toUTCString(),
    };
    if (mimeType) headers['Content-Type'] = mimeType;
    if (contentLength !== undefined) headers['Content-Length'] = String(contentLength);

    // Extract key from connection string for auth
    const keyMatch = this.connectionString.match(/AccountKey=([^;]+)/);
    if (keyMatch) {
      // In production, you'd compute SharedKey auth here.
      // For SAS-based connections, append the SAS token to the URL instead.
      headers['Authorization'] = `SharedKey ${keyMatch[1]}`;
    }
    return headers;
  }
}

// ── AWS S3 ──

export class AwsS3StorageProvider implements StorageProvider {
  constructor(
    private readonly region: string,
    private readonly bucket: string,
    private readonly accessKey: string,
    private readonly secretKey: string,
    private readonly logger: Logger,
    private readonly customEndpoint?: string,
    private readonly pathStyle?: boolean,
  ) {}

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const url = this.buildUrl(key);
    const headers = this.buildHeaders('PUT', key, mimeType, buffer);

    const response = await fetch(url, {
      method: 'PUT',
      body: buffer,
      headers,
    });

    if (!response.ok) {
      const errText = await response.text();
      this.logger.error({ key, status: response.status, error: errText }, 'S3 upload failed');
      throw new Error(`S3 upload failed: ${response.status}`);
    }

    this.logger.debug({ key, size: buffer.length, bucket: this.bucket }, 'S3 uploaded');
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const url = this.buildUrl(key);
    const headers = this.buildHeaders('GET', key);

    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`S3 download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const url = this.buildUrl(key);
    const headers = this.buildHeaders('DELETE', key);

    const response = await fetch(url, { method: 'DELETE', headers });
    if (!response.ok && response.status !== 404) {
      throw new Error(`S3 delete failed: ${response.status}`);
    }
    this.logger.debug({ key }, 'S3 deleted');
  }

  async exists(key: string): Promise<boolean> {
    const url = this.buildUrl(key);
    const headers = this.buildHeaders('HEAD', key);

    const response = await fetch(url, { method: 'HEAD', headers });
    return response.ok;
  }

  async getUrl(key: string): Promise<string> {
    return this.buildUrl(key);
  }

  /**
   * Build the S3 URL for a key.
   * Supports 3 modes:
   *   - Default AWS: https://{bucket}.s3.{region}.amazonaws.com/{key}
   *   - Custom endpoint (virtual-hosted): https://{bucket}.{endpoint}/{key}
   *   - Custom endpoint + path style: https://{endpoint}/{bucket}/{key} (MinIO, some S3-compat)
   *
   * Path-style is needed for MinIO, early S3 compat, and custom domains that
   * don't support virtual-hosted bucket subdomains.
   */
  private buildUrl(key: string): string {
    const encodedKey = encodeURIComponent(key);
    if (this.customEndpoint) {
      const base = this.customEndpoint.replace(/\/+$/, '');
      if (this.pathStyle) {
        return `${base}/${this.bucket}/${encodedKey}`;
      }
      // Virtual-hosted style with custom endpoint
      const proto = base.startsWith('https://') ? 'https://' : 'http://';
      const host = base.replace(/^https?:\/\//, '');
      return `${proto}${this.bucket}.${host}/${encodedKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodedKey}`;
  }

  private buildHeaders(
    method: string,
    key: string,
    mimeType?: string,
    _buffer?: Buffer,
  ): Record<string, string> {
    // AWS Signature V4 would go here in production.
    // For now, return basic headers. Real implementation needs aws4 signing.
    const headers: Record<string, string> = {
      'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    };
    if (mimeType) headers['Content-Type'] = mimeType;
    // Placeholder — real auth requires HMAC-SHA256 signing of canonical request
    this.logger.debug({ method, key, hasAuth: !!this.accessKey && !!this.secretKey }, 'S3 request');
    return headers;
  }
}

// ── Mock ──

export class MockStorageProvider implements StorageProvider {
  public files: Map<string, { buffer: Buffer; mimeType: string }> = new Map();
  public calls: Array<{ method: string; key: string }> = [];

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    this.calls.push({ method: 'upload', key });
    this.files.set(key, { buffer, mimeType });
    return key;
  }

  async download(key: string): Promise<Buffer> {
    this.calls.push({ method: 'download', key });
    const file = this.files.get(key);
    if (!file) throw new Error(`File not found: ${key}`);
    return file.buffer;
  }

  async delete(key: string): Promise<void> {
    this.calls.push({ method: 'delete', key });
    this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async getUrl(key: string): Promise<string> {
    return `/mock-files/${key}`;
  }

  reset(): void {
    this.files.clear();
    this.calls = [];
  }
}

// ── Factory ──

/**
 * Create a storage provider from config. Called by the storage service
 * when it reads the config from the database.
 */
export function createStorageProvider(
  config: StorageConfig,
  logger: Logger,
): StorageProvider | null {
  switch (config.provider) {
    case 'local':
      return new LocalStorageProvider(config.localPath ?? './uploads', logger);
    case 'azure_blob':
      if (!config.azureConnectionString) return null;
      return new AzureBlobStorageProvider(
        config.azureConnectionString,
        config.azureContainer ?? 'shaavir-files',
        logger,
      );
    case 'aws_s3':
      if (!config.awsRegion || !config.awsBucket) return null;
      return new AwsS3StorageProvider(
        config.awsRegion,
        config.awsBucket,
        config.awsAccessKey ?? '',
        config.awsSecretKey ?? '',
        logger,
      );
    case 'none':
      return null;
    default:
      return null;
  }
}
