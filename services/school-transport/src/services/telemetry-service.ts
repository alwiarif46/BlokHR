import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { TransportRepository } from '../repositories/transport-repository';
import type { BoardingLeg, VehiclePing } from '../types';
import { computeEta, STALE_SECONDS } from './eta-math';

type ServiceError = { error: string; status: number };

const LEGS = new Set<BoardingLeg>(['pickup', 'drop']);
const MAX_BATCH = 500;
const RETENTION_DAYS = 30;
const DELAY_GRACE_MINUTES = 15;

function validLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseHhMm(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) {
    return null;
  }
  return { h, m: min };
}

function scheduledAtOnDay(day: string, hhmm: string): Date | null {
  const t = parseHhMm(hhmm);
  if (!t) return null;
  const ms = Date.parse(
    `${day}T${String(t.h).padStart(2, '0')}:${String(t.m).padStart(2, '0')}:00.000Z`,
  );
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

export class TelemetryService {
  constructor(
    private readonly repo: TransportRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async ingestPings(
    tenantId: string,
    rows: Array<{
      vehicleId: string;
      lat: number;
      lng: number;
      speedKmh?: number | null;
      at?: string;
    }>,
  ): Promise<{ pings?: VehiclePing[]; error?: ServiceError }> {
    if (!Array.isArray(rows)) {
      return { error: { error: 'body must be an array of pings', status: 400 } };
    }
    if (rows.length > MAX_BATCH) {
      return { error: { error: 'batch exceeds 500 pings', status: 400 } };
    }

    const now = this.clock().toISOString();
    const out: VehiclePing[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const vehicleId = String(row.vehicleId ?? '').trim();
      if (!vehicleId) {
        return { error: { error: `pings[${i}]: vehicle_id is required`, status: 400 } };
      }
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!validLatLng(lat, lng)) {
        return {
          error: { error: `pings[${i}]: lat/lng out of range`, status: 400 },
        };
      }
      if (!(await this.repo.getVehicle(tenantId, vehicleId))) {
        return {
          error: { error: `pings[${i}]: vehicle not found`, status: 404 },
        };
      }
      let speedKmh: number | null = null;
      if (row.speedKmh !== undefined && row.speedKmh !== null) {
        speedKmh = Number(row.speedKmh);
        if (!Number.isFinite(speedKmh) || speedKmh < 0) {
          return {
            error: { error: `pings[${i}]: speed_kmh invalid`, status: 400 },
          };
        }
      }
      const at = (row.at || '').trim() || now;
      out.push(
        await this.repo.insertPing({
          id: uuidv4(),
          tenantId,
          vehicleId,
          lat,
          lng,
          speedKmh,
          at,
        }),
      );
    }
    return { pings: out };
  }

  /**
   * Data minimisation: vehicle location is sensitive — drop pings older than 30 days.
   */
  async prunePings(
    tenantId: string,
  ): Promise<{ deleted: number }> {
    const cutoff = new Date(
      this.clock().getTime() - RETENTION_DAYS * 86_400_000,
    ).toISOString();
    const deleted = await this.repo.prunePingsOlderThan(tenantId, cutoff);
    return { deleted };
  }

  async lastKnown(
    tenantId: string,
    vehicleId: string,
  ): Promise<{
    ping?: VehiclePing;
    staleSeconds?: number;
    error?: ServiceError;
  }> {
    if (!(await this.repo.getVehicle(tenantId, vehicleId))) {
      return { error: { error: 'vehicle not found', status: 404 } };
    }
    const ping = await this.repo.getLatestPing(tenantId, vehicleId);
    if (!ping) {
      return { error: { error: 'no pings for vehicle', status: 404 } };
    }
    const staleSeconds = Math.max(
      0,
      Math.floor((this.clock().getTime() - Date.parse(ping.at)) / 1000),
    );
    return { ping, staleSeconds };
  }

  async routeEta(
    tenantId: string,
    routeId: string,
    stopId: string,
  ): Promise<{
    eta?: number | null;
    stale?: boolean;
    distanceKm?: number;
    speedKmh?: number;
    error?: ServiceError;
  }> {
    const sid = (stopId || '').trim();
    if (!sid) return { error: { error: 'stop_id is required', status: 400 } };
    const route = await this.repo.getRoute(tenantId, routeId);
    if (!route) return { error: { error: 'route not found', status: 404 } };
    const stop = await this.repo.getStop(tenantId, sid);
    if (!stop || stop.routeId !== routeId) {
      return { error: { error: 'stop not found on route', status: 404 } };
    }
    const ping = await this.repo.getLatestPing(tenantId, route.vehicleId);
    if (!ping) {
      return { eta: null, stale: true };
    }
    const recent = await this.repo.listRecentPings(tenantId, route.vehicleId, 5);
    const speeds = recent
      .map((p) => p.speedKmh)
      .filter((s): s is number => s != null && Number.isFinite(s));
    const avgSpeedKmh =
      speeds.length > 0
        ? speeds.reduce((a, b) => a + b, 0) / speeds.length
        : 0;
    const pingAgeSeconds = Math.max(
      0,
      Math.floor((this.clock().getTime() - Date.parse(ping.at)) / 1000),
    );
    const result = computeEta({
      fromLat: ping.lat,
      fromLng: ping.lng,
      toLat: stop.lat,
      toLng: stop.lng,
      avgSpeedKmh,
      pingAgeSeconds,
    });
    if (result.stale) {
      return { eta: null, stale: true };
    }
    return {
      eta: Math.round(result.etaMinutes * 10) / 10,
      stale: false,
      distanceKm: Math.round(result.distanceKm * 1000) / 1000,
      speedKmh: result.speedKmh,
    };
  }

  async checkDelay(
    tenantId: string,
    routeId: string,
    leg: BoardingLeg,
  ): Promise<{
    delayed?: boolean;
    minutesLate?: number;
    skipped?: boolean;
    error?: ServiceError;
  }> {
    if (!LEGS.has(leg)) {
      return { error: { error: 'leg must be pickup or drop', status: 400 } };
    }
    const route = await this.repo.getRoute(tenantId, routeId);
    if (!route) return { error: { error: 'route not found', status: 404 } };

    const day = this.clock().toISOString().slice(0, 10);
    if (await this.repo.hasDelayLog(tenantId, routeId, leg, day)) {
      return { delayed: false, skipped: true };
    }

    const stops = await this.repo.listStops(tenantId, routeId);
    const next = stops[0];
    if (!next) {
      return { error: { error: 'route has no stops', status: 400 } };
    }

    const etaRes = await this.routeEta(tenantId, routeId, next.id);
    if (etaRes.error) return { error: etaRes.error };
    if (etaRes.stale || etaRes.eta == null) {
      return { delayed: false };
    }

    const scheduledHhMm = leg === 'pickup' ? next.pickupTime : next.dropTime;
    const scheduled = scheduledAtOnDay(day, scheduledHhMm);
    if (!scheduled) {
      return { error: { error: 'stop schedule time invalid', status: 400 } };
    }

    const arrival = new Date(this.clock().getTime() + etaRes.eta * 60_000);
    const threshold = new Date(
      scheduled.getTime() + DELAY_GRACE_MINUTES * 60_000,
    );
    if (arrival.getTime() <= threshold.getTime()) {
      return { delayed: false };
    }

    const minutesLate = Math.floor(
      (arrival.getTime() - scheduled.getTime()) / 60_000,
    );
    await this.repo.insertDelayLog(tenantId, routeId, leg, day, minutesLate);
    await this.events.publish({
      type: 'school.transport.delayed',
      tenantId,
      occurredAt: this.clock().toISOString(),
      data: {
        route_id: routeId,
        minutes_late: minutesLate,
        leg,
        stop_id: next.id,
      },
    });
    return { delayed: true, minutesLate };
  }
}

export { STALE_SECONDS };
