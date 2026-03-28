import type { Logger } from 'pino';

// ── Types ──

export interface DetectedFace {
  faceId: string;
  faceRectangle: { top: number; left: number; width: number; height: number };
}

export interface IdentifyCandidate {
  personId: string;
  confidence: number;
}

export interface IdentifyResult {
  faceId: string;
  candidates: IdentifyCandidate[];
}

export interface FaceApiError {
  code: string;
  message: string;
}

// ── Interface ──

/**
 * Abstraction over a face recognition API provider.
 * Keeps the service layer decoupled from Azure/AWS/local implementation.
 */
export interface FaceApiClient {
  /** Create a person group (one-time per installation). */
  createPersonGroup(groupId: string, name: string): Promise<void>;

  /** Create a person within a group. Returns the Azure-assigned person ID. */
  createPerson(groupId: string, name: string): Promise<string>;

  /** Add a face image to a person. imageBuffer is the raw image bytes. */
  addPersonFace(groupId: string, personId: string, imageBuffer: Buffer): Promise<string>;

  /** Start training the person group (async on Azure side). */
  trainPersonGroup(groupId: string): Promise<void>;

  /** Detect faces in an image. Returns detected face IDs for identification. */
  detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]>;

  /** Identify detected faces against a person group. */
  identifyFaces(groupId: string, faceIds: string[]): Promise<IdentifyResult[]>;
}

// ── Azure Face API v1.0 Implementation ──

/** Timeout for Azure API calls (ms). */
const API_TIMEOUT_MS = 15_000;

/** Max retries on 429 (Too Many Requests). */
const MAX_RETRIES = 2;

export class AzureFaceApiClient implements FaceApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    endpoint: string,
    apiKey: string,
    private readonly logger: Logger,
  ) {
    // Ensure no trailing slash
    this.baseUrl = endpoint.replace(/\/+$/, '') + '/face/v1.0';
    this.apiKey = apiKey;
  }

  async createPersonGroup(groupId: string, name: string): Promise<void> {
    await this.request(`/persongroups/${encodeURIComponent(groupId)}`, {
      method: 'PUT',
      body: JSON.stringify({ name, recognitionModel: 'recognition_04' }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async createPerson(groupId: string, name: string): Promise<string> {
    const data = await this.request<{ personId: string }>(
      `/persongroups/${encodeURIComponent(groupId)}/persons`,
      {
        method: 'POST',
        body: JSON.stringify({ name }),
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return data.personId;
  }

  async addPersonFace(
    groupId: string,
    personId: string,
    imageBuffer: Buffer,
  ): Promise<string> {
    const data = await this.request<{ persistedFaceId: string }>(
      `/persongroups/${encodeURIComponent(groupId)}/persons/${encodeURIComponent(personId)}/persistedfaces`,
      {
        method: 'POST',
        body: imageBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    );
    return data.persistedFaceId;
  }

  async trainPersonGroup(groupId: string): Promise<void> {
    await this.request(
      `/persongroups/${encodeURIComponent(groupId)}/train`,
      { method: 'POST' },
    );
  }

  async detectFaces(imageBuffer: Buffer): Promise<DetectedFace[]> {
    return this.request<DetectedFace[]>(
      '/detect?returnFaceId=true&recognitionModel=recognition_04&detectionModel=detection_03',
      {
        method: 'POST',
        body: imageBuffer,
        headers: { 'Content-Type': 'application/octet-stream' },
      },
    );
  }

  async identifyFaces(
    groupId: string,
    faceIds: string[],
  ): Promise<IdentifyResult[]> {
    return this.request<IdentifyResult[]>('/identify', {
      method: 'POST',
      body: JSON.stringify({
        personGroupId: groupId,
        faceIds,
        maxNumOfCandidatesReturned: 1,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── HTTP helper with timeout + retry on 429 ──

  private async request<T>(
    path: string,
    init: {
      method: string;
      body?: string | Buffer;
      headers?: Record<string, string>;
    },
    retries = 0,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: init.method,
        body: init.body,
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          ...init.headers,
        },
        signal: controller.signal,
      });

      if (response.status === 429 && retries < MAX_RETRIES) {
        // Retry after delay (Azure Retry-After header or default 1s)
        const retryAfter = parseInt(response.headers.get('Retry-After') ?? '1', 10);
        this.logger.warn({ path, retryAfter, attempt: retries + 1 }, 'Azure Face API rate limited, retrying');
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        return this.request<T>(path, init, retries + 1);
      }

      if (response.status === 200 || response.status === 202) {
        const text = await response.text();
        if (!text) return undefined as unknown as T;
        return JSON.parse(text) as T;
      }

      // Error response
      const errorText = await response.text();
      let errorBody: FaceApiError;
      try {
        const parsed = JSON.parse(errorText);
        errorBody = parsed.error ?? { code: String(response.status), message: errorText };
      } catch {
        errorBody = { code: String(response.status), message: errorText };
      }

      this.logger.error(
        { path, status: response.status, error: errorBody },
        'Azure Face API error',
      );
      throw new Error(`Azure Face API error: ${errorBody.code} — ${errorBody.message}`);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error({ path }, 'Azure Face API request timed out');
        throw new Error('Azure Face API request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Mock Implementation for Testing ──

export interface MockFaceApiConfig {
  detectResult?: DetectedFace[];
  identifyResult?: IdentifyResult[];
  createPersonResult?: string;
  addFaceResult?: string;
  shouldThrow?: Error;
}

/**
 * Mock client for tests. Configure responses per-call via setConfig().
 */
export class MockFaceApiClient implements FaceApiClient {
  public calls: Array<{ method: string; args: unknown[] }> = [];
  private config: MockFaceApiConfig = {};

  setConfig(config: MockFaceApiConfig): void {
    this.config = config;
  }

  resetCalls(): void {
    this.calls = [];
  }

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }

  private checkThrow(): void {
    if (this.config.shouldThrow) throw this.config.shouldThrow;
  }

  async createPersonGroup(groupId: string, name: string): Promise<void> {
    this.record('createPersonGroup', groupId, name);
    this.checkThrow();
  }

  async createPerson(groupId: string, name: string): Promise<string> {
    this.record('createPerson', groupId, name);
    this.checkThrow();
    return this.config.createPersonResult ?? 'mock-person-id-' + Date.now();
  }

  async addPersonFace(groupId: string, personId: string, _imageBuffer: Buffer): Promise<string> {
    this.record('addPersonFace', groupId, personId);
    this.checkThrow();
    return this.config.addFaceResult ?? 'mock-face-id-' + Date.now();
  }

  async trainPersonGroup(groupId: string): Promise<void> {
    this.record('trainPersonGroup', groupId);
    this.checkThrow();
  }

  async detectFaces(_imageBuffer: Buffer): Promise<DetectedFace[]> {
    this.record('detectFaces');
    this.checkThrow();
    return this.config.detectResult ?? [
      { faceId: 'mock-face-001', faceRectangle: { top: 0, left: 0, width: 100, height: 100 } },
    ];
  }

  async identifyFaces(groupId: string, faceIds: string[]): Promise<IdentifyResult[]> {
    this.record('identifyFaces', groupId, faceIds);
    this.checkThrow();
    return this.config.identifyResult ?? faceIds.map((faceId) => ({
      faceId,
      candidates: [{ personId: 'mock-person-id', confidence: 0.95 }],
    }));
  }
}
