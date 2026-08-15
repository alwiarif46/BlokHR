import { v4 as uuidv4 } from 'uuid';
import type { TransportDb } from './db';

export type EventKind = 'board' | 'alight';

export interface CaptureMatchPort {
  processBusRfid(input: {
    payloadB64: string;
    idempotencyKey: string;
    deviceId?: string;
    context: Record<string, unknown>;
  }): Promise<{ eventId: string; subjectRef: string; decision: string }>;
}

export interface ConsentPort {
  validate(tenantId: string, consentRef: string, modality: string): Promise<boolean>;
}

/**
 * Transport / bus RFID — separate legal basis from campus roll call.
 * Does not mark school periods present/absent.
 */
export class TransportService {
  constructor(
    private readonly db: TransportDb,
    private readonly tenantId: string,
    private readonly capture: CaptureMatchPort,
    private readonly consent: ConsentPort,
  ) {}

  async recordBoarding(input: {
    payloadB64: string;
    routeId: string;
    stopId: string;
    eventKind: EventKind;
    lat?: number;
    lng?: number;
    consentRef: string;
    idempotencyKey: string;
    deviceId?: string;
  }): Promise<{ success: boolean; id?: string; subjectRef?: string; error?: string }> {
    if (!input.consentRef?.trim()) {
      return { success: false, error: 'consent_ref required (transport legal basis)' };
    }
    const ok = await this.consent.validate(this.tenantId, input.consentRef, 'bus_rfid');
    if (!ok) return { success: false, error: 'Invalid or revoked transport consent_ref' };

    const existing = await this.db.get<{ id: string; subject_ref: string }>(
      'SELECT id, subject_ref FROM transport_events WHERE tenant_id = ? AND idempotency_key = ?',
      [this.tenantId, input.idempotencyKey],
    );
    if (existing) {
      return { success: true, id: existing.id, subjectRef: existing.subject_ref };
    }

    const match = await this.capture.processBusRfid({
      payloadB64: input.payloadB64,
      idempotencyKey: `bus:${input.idempotencyKey}`,
      deviceId: input.deviceId,
      context: {
        route_id: input.routeId,
        stop_id: input.stopId,
        event_kind: input.eventKind,
        lat: input.lat,
        lng: input.lng,
        legal_basis: 'transport_bus_rfid',
      },
    });

    if (match.decision !== 'matched' || !match.subjectRef) {
      return { success: false, error: 'No RFID match — do not invent attendance' };
    }

    const id = `tr_${uuidv4().replace(/-/g, '').slice(0, 20)}`;
    await this.db.run(
      `INSERT INTO transport_events
        (id, tenant_id, subject_ref, route_id, stop_id, event_kind, lat, lng, capture_event_id, consent_ref, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        this.tenantId,
        match.subjectRef,
        input.routeId,
        input.stopId,
        input.eventKind,
        input.lat ?? null,
        input.lng ?? null,
        match.eventId,
        input.consentRef,
        input.idempotencyKey,
      ],
    );
    return { success: true, id, subjectRef: match.subjectRef };
  }

  async listForRoute(routeId: string): Promise<
    Array<{ id: string; subjectRef: string; eventKind: string; stopId: string; createdAt: string }>
  > {
    const rows = await this.db.all<{
      id: string;
      subject_ref: string;
      event_kind: string;
      stop_id: string;
      created_at: string;
    }>(
      `SELECT id, subject_ref, event_kind, stop_id, created_at
       FROM transport_events WHERE tenant_id = ? AND route_id = ?
       ORDER BY created_at DESC LIMIT 200`,
      [this.tenantId, routeId],
    );
    return rows.map((r) => ({
      id: r.id,
      subjectRef: r.subject_ref,
      eventKind: r.event_kind,
      stopId: r.stop_id,
      createdAt: r.created_at,
    }));
  }
}
