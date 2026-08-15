/**
 * HTTP client for the entitlements service (same host when embedded on gateway).
 */
export class EntitlementsClient {
  constructor(
    private readonly baseUrl: string,
    private readonly defaultTenantId = 'default',
  ) {}

  async get(tenantId = this.defaultTenantId): Promise<Record<string, unknown> | null> {
    const res = await fetch(
      `${this.baseUrl}/api/entitlements/${encodeURIComponent(tenantId)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`entitlements get failed: ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  }

  async startTrial(
    tenantId = this.defaultTenantId,
    seatLimit?: number,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(
      `${this.baseUrl}/api/entitlements/${encodeURIComponent(tenantId)}/trial`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatLimit }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`start trial failed: ${res.status} ${body}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }

  async activateLicense(
    licenseToken: string,
    tenantId = this.defaultTenantId,
  ): Promise<Record<string, unknown>> {
    const res = await fetch(
      `${this.baseUrl}/api/entitlements/${encodeURIComponent(tenantId)}/activate-license`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseToken }),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error || `activate license failed: ${res.status}`);
    }
    return (await res.json()) as Record<string, unknown>;
  }
}
