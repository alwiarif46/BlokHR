export class EntitlementsHttpClient {
  constructor(private readonly baseUrl: string) {}

  async applySubscription(input: {
    tenantId: string;
    plan: string;
    status: string;
    seatLimit: number;
    renewsAt?: string | null;
    source?: 'razorpay' | 'manual';
  }): Promise<void> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/entitlements/${encodeURIComponent(input.tenantId)}/subscription`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: input.plan,
          status: input.status,
          seatLimit: input.seatLimit,
          renewsAt: input.renewsAt,
          source: input.source ?? 'razorpay',
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Entitlements update failed: ${res.status} ${text}`);
    }
  }

  async startTrial(tenantId: string, seatLimit?: number): Promise<unknown> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/entitlements/${encodeURIComponent(tenantId)}/trial`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatLimit }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Start trial failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  async activateLicense(tenantId: string, licenseToken: string): Promise<unknown> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/entitlements/${encodeURIComponent(tenantId)}/activate-license`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseToken }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Activate license failed: ${res.status} ${text}`);
    }
    return res.json();
  }

  async get(tenantId: string): Promise<unknown | null> {
    const res = await fetch(
      `${this.baseUrl.replace(/\/$/, '')}/api/entitlements/${encodeURIComponent(tenantId)}`,
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Get entitlement failed: ${res.status} ${text}`);
    }
    return res.json();
  }
}
