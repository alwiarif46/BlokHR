/**
 * Iris scan client abstraction.
 * Same pattern as FaceApiClient — swappable implementations.
 *
 * Hardware support: IriTech (USB), EyeLock (network REST), CMITech (embedded).
 * All output standard IrisCodes (binary templates). Device-side SDK extracts
 * the template; server receives the base64-encoded template for matching.
 *
 * Server-side matching: no cloud API needed. Hamming distance on IrisCodes
 * is sub-millisecond per comparison. 1000 employees = ~512KB in memory.
 */

// ── Types ──

export interface IrisTemplate {
  /** Base64-encoded IrisCode (typically 256 bytes = 2048 bits). */
  template: string;
}

export interface IrisMatchResult {
  email: string;
  distance: number;
  matched: boolean;
}

export interface IrisApiClientConfig {
  shouldThrow?: Error;
  extractResult?: IrisTemplate;
}

// ── Interface ──

/**
 * Abstraction for iris template extraction.
 * In production, the device SDK handles extraction on the hardware side
 * and POSTs the template to the server. This interface exists for cases
 * where server-side extraction from a raw image is needed.
 */
export interface IrisApiClient {
  /**
   * Extract an iris template from a raw eye image.
   * In most deployments, the device SDK does this — the server receives
   * the pre-extracted template directly. This method is for hardware
   * that sends raw images instead of templates.
   */
  extractTemplate(imageBuffer: Buffer): Promise<IrisTemplate>;
}

// ── Hamming distance matcher ──

/**
 * Compute the normalized Hamming distance between two IrisCodes.
 * Both templates are base64-encoded binary strings of equal length.
 * Returns a value between 0.0 (identical) and 0.5 (independent).
 * Genuine iris pairs typically have distance < 0.32.
 * Impostor pairs typically have distance > 0.35.
 *
 * Standard FAR (False Accept Rate) threshold: 0.32
 * At 0.32: FAR ≈ 1 in 1.2 million (Daugman, 2004)
 */
export function hammingDistance(templateA: string, templateB: string): number {
  const bufA = Buffer.from(templateA, 'base64');
  const bufB = Buffer.from(templateB, 'base64');

  // Templates must be same length
  const len = Math.min(bufA.length, bufB.length);
  if (len === 0) return 1.0; // No data = no match

  let diffBits = 0;
  let totalBits = 0;

  for (let i = 0; i < len; i++) {
    let xor = bufA[i] ^ bufB[i];
    totalBits += 8;
    // Count set bits (Hamming weight of XOR)
    while (xor) {
      diffBits += xor & 1;
      xor >>= 1;
    }
  }

  return totalBits > 0 ? diffBits / totalBits : 1.0;
}

/**
 * Find the best match for a probe template against a set of enrolled templates.
 * Returns the closest match if below threshold, or null if no match.
 *
 * Performance: O(n) where n = enrolled count. Each comparison is ~1μs
 * for a 256-byte template. 1000 employees = ~1ms total.
 */
export function findBestMatch(
  probeTemplate: string,
  enrolledTemplates: Array<{ email: string; template: string }>,
  threshold: number,
): IrisMatchResult | null {
  let bestMatch: IrisMatchResult | null = null;

  for (const enrolled of enrolledTemplates) {
    const distance = hammingDistance(probeTemplate, enrolled.template);
    if (distance <= threshold) {
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          email: enrolled.email,
          distance,
          matched: true,
        };
      }
    }
  }

  return bestMatch;
}

// ── Mock client for tests ──

export class MockIrisApiClient implements IrisApiClient {
  public calls: Array<{ method: string; args: unknown[] }> = [];
  private config: IrisApiClientConfig = {};

  setConfig(config: IrisApiClientConfig): void {
    this.config = config;
  }

  resetCalls(): void {
    this.calls = [];
  }

  extractTemplate(_imageBuffer: Buffer): Promise<IrisTemplate> {
    this.calls.push({ method: 'extractTemplate', args: [] });
    if (this.config.shouldThrow) return Promise.reject(this.config.shouldThrow);
    return Promise.resolve(
      this.config.extractResult ?? {
        template: Buffer.from('mock-iris-template-' + Date.now()).toString('base64'),
      },
    );
  }
}
