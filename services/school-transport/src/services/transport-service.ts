import { v4 as uuidv4 } from 'uuid';
import type { TransportRepository } from '../repositories/transport-repository';
import type {
  ExpiryRow,
  Route,
  RouteStudent,
  Stop,
  Vehicle,
} from '../types';

type ServiceError = { error: string; status: number };

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function daysUntil(expiry: string, now: Date): number {
  const due = Date.parse(`${expiry.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(due)) return Number.POSITIVE_INFINITY;
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((due - end) / 86_400_000);
}

export class TransportService {
  constructor(
    private readonly repo: TransportRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createVehicle(
    tenantId: string,
    input: {
      registration: string;
      capacity: number;
      ais140DeviceId?: string | null;
      gpsProvider?: string | null;
      insuranceExpiry: string;
      fitnessExpiry: string;
      active?: boolean;
    },
  ): Promise<{ vehicle?: Vehicle; error?: ServiceError }> {
    const registration = (input.registration || '').trim().toUpperCase();
    if (!registration) return { error: { error: 'registration is required', status: 400 } };
    const capacity = Number(input.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { error: { error: 'capacity must be a positive integer', status: 400 } };
    }
    if (!isDate(input.insuranceExpiry) || !isDate(input.fitnessExpiry)) {
      return { error: { error: 'expiry dates must be YYYY-MM-DD', status: 400 } };
    }
    const dup = await this.repo.getVehicleByRegistration(tenantId, registration);
    if (dup) return { error: { error: 'registration already exists', status: 409 } };

    const now = this.clock().toISOString();
    const vehicle = await this.repo.insertVehicle({
      id: uuidv4(),
      tenantId,
      registration,
      capacity,
      ais140DeviceId: input.ais140DeviceId?.trim() || null,
      gpsProvider: input.gpsProvider?.trim() || null,
      insuranceExpiry: input.insuranceExpiry,
      fitnessExpiry: input.fitnessExpiry,
      active: input.active === undefined ? true : Boolean(input.active),
      createdAt: now,
      updatedAt: now,
    });
    return { vehicle };
  }

  async listVehicles(tenantId: string): Promise<{ vehicles: Vehicle[] }> {
    return { vehicles: await this.repo.listVehicles(tenantId) };
  }

  async getVehicle(
    tenantId: string,
    id: string,
  ): Promise<{ vehicle?: Vehicle; error?: ServiceError }> {
    const vehicle = await this.repo.getVehicle(tenantId, id);
    if (!vehicle) return { error: { error: 'vehicle not found', status: 404 } };
    return { vehicle };
  }

  async updateVehicle(
    tenantId: string,
    id: string,
    input: Partial<{
      registration: string;
      capacity: number;
      ais140DeviceId: string | null;
      gpsProvider: string | null;
      insuranceExpiry: string;
      fitnessExpiry: string;
      active: boolean;
    }>,
  ): Promise<{ vehicle?: Vehicle; error?: ServiceError }> {
    const existing = await this.repo.getVehicle(tenantId, id);
    if (!existing) return { error: { error: 'vehicle not found', status: 404 } };

    const registration =
      input.registration !== undefined
        ? input.registration.trim().toUpperCase()
        : existing.registration;
    if (!registration) return { error: { error: 'registration is required', status: 400 } };
    const capacity =
      input.capacity !== undefined ? Number(input.capacity) : existing.capacity;
    if (!Number.isInteger(capacity) || capacity < 1) {
      return { error: { error: 'capacity must be a positive integer', status: 400 } };
    }
    const insuranceExpiry = input.insuranceExpiry ?? existing.insuranceExpiry;
    const fitnessExpiry = input.fitnessExpiry ?? existing.fitnessExpiry;
    if (!isDate(insuranceExpiry) || !isDate(fitnessExpiry)) {
      return { error: { error: 'expiry dates must be YYYY-MM-DD', status: 400 } };
    }
    if (registration !== existing.registration) {
      const dup = await this.repo.getVehicleByRegistration(tenantId, registration);
      if (dup) return { error: { error: 'registration already exists', status: 409 } };
    }

    const vehicle = await this.repo.updateVehicle({
      ...existing,
      registration,
      capacity,
      ais140DeviceId:
        input.ais140DeviceId !== undefined
          ? input.ais140DeviceId?.trim() || null
          : existing.ais140DeviceId,
      gpsProvider:
        input.gpsProvider !== undefined
          ? input.gpsProvider?.trim() || null
          : existing.gpsProvider,
      insuranceExpiry,
      fitnessExpiry,
      active: input.active !== undefined ? Boolean(input.active) : existing.active,
      updatedAt: this.clock().toISOString(),
    });
    if (!vehicle) return { error: { error: 'vehicle not found', status: 404 } };
    return { vehicle };
  }

  async deleteVehicle(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteVehicle(tenantId, id);
    if (!ok) return { error: { error: 'vehicle not found', status: 404 } };
    return { ok: true };
  }

  async createRoute(
    tenantId: string,
    input: {
      label: string;
      vehicleId: string;
      attendantName?: string | null;
      active?: boolean;
    },
  ): Promise<{ route?: Route; error?: ServiceError }> {
    const label = (input.label || '').trim();
    const vehicleId = (input.vehicleId || '').trim();
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!vehicleId) return { error: { error: 'vehicle_id is required', status: 400 } };
    const vehicle = await this.repo.getVehicle(tenantId, vehicleId);
    if (!vehicle) return { error: { error: 'vehicle not found', status: 404 } };

    const now = this.clock().toISOString();
    const route = await this.repo.insertRoute({
      id: uuidv4(),
      tenantId,
      label,
      vehicleId,
      attendantName: input.attendantName?.trim() || null,
      active: input.active === undefined ? true : Boolean(input.active),
      createdAt: now,
      updatedAt: now,
    });
    return { route };
  }

  async listRoutes(tenantId: string): Promise<{ routes: Route[] }> {
    return { routes: await this.repo.listRoutes(tenantId) };
  }

  async getRoute(
    tenantId: string,
    id: string,
  ): Promise<{ route?: Route; error?: ServiceError }> {
    const route = await this.repo.getRoute(tenantId, id);
    if (!route) return { error: { error: 'route not found', status: 404 } };
    return { route };
  }

  async updateRoute(
    tenantId: string,
    id: string,
    input: Partial<{
      label: string;
      vehicleId: string;
      attendantName: string | null;
      active: boolean;
    }>,
  ): Promise<{ route?: Route; error?: ServiceError }> {
    const existing = await this.repo.getRoute(tenantId, id);
    if (!existing) return { error: { error: 'route not found', status: 404 } };
    const vehicleId = input.vehicleId ?? existing.vehicleId;
    if (!(await this.repo.getVehicle(tenantId, vehicleId))) {
      return { error: { error: 'vehicle not found', status: 404 } };
    }
    const route = await this.repo.updateRoute({
      ...existing,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      vehicleId,
      attendantName:
        input.attendantName !== undefined
          ? input.attendantName?.trim() || null
          : existing.attendantName,
      active: input.active !== undefined ? Boolean(input.active) : existing.active,
      updatedAt: this.clock().toISOString(),
    });
    if (!route) return { error: { error: 'route not found', status: 404 } };
    return { route };
  }

  async deleteRoute(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteRoute(tenantId, id);
    if (!ok) return { error: { error: 'route not found', status: 404 } };
    return { ok: true };
  }

  async createStop(
    tenantId: string,
    input: {
      routeId: string;
      sequence?: number;
      label: string;
      lat: number;
      lng: number;
      pickupTime: string;
      dropTime: string;
    },
  ): Promise<{ stop?: Stop; error?: ServiceError }> {
    const routeId = (input.routeId || '').trim();
    const label = (input.label || '').trim();
    if (!routeId) return { error: { error: 'route_id is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }
    const lat = Number(input.lat);
    const lng = Number(input.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return { error: { error: 'lat must be between -90 and 90', status: 400 } };
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return { error: { error: 'lng must be between -180 and 180', status: 400 } };
    }
    const existing = await this.repo.listStops(tenantId, routeId);
    const sequence =
      input.sequence !== undefined
        ? Number(input.sequence)
        : existing.length === 0
          ? 1
          : Math.max(...existing.map((s) => s.sequence)) + 1;
    if (!Number.isInteger(sequence) || sequence < 1) {
      return { error: { error: 'sequence must be a positive integer', status: 400 } };
    }

    const stop = await this.repo.insertStop({
      id: uuidv4(),
      tenantId,
      routeId,
      sequence,
      label,
      lat,
      lng,
      pickupTime: String(input.pickupTime || '').trim() || '00:00',
      dropTime: String(input.dropTime || '').trim() || '00:00',
      createdAt: this.clock().toISOString(),
    });
    return { stop };
  }

  async listStops(
    tenantId: string,
    routeId: string,
  ): Promise<{ stops?: Stop[]; error?: ServiceError }> {
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }
    return { stops: await this.repo.listStops(tenantId, routeId) };
  }

  async updateStop(
    tenantId: string,
    id: string,
    input: Partial<{
      label: string;
      lat: number;
      lng: number;
      pickupTime: string;
      dropTime: string;
      sequence: number;
    }>,
  ): Promise<{ stop?: Stop; error?: ServiceError }> {
    const existing = await this.repo.getStop(tenantId, id);
    if (!existing) return { error: { error: 'stop not found', status: 404 } };
    const stop = await this.repo.updateStop({
      ...existing,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      lat: input.lat !== undefined ? Number(input.lat) : existing.lat,
      lng: input.lng !== undefined ? Number(input.lng) : existing.lng,
      pickupTime:
        input.pickupTime !== undefined ? input.pickupTime.trim() : existing.pickupTime,
      dropTime: input.dropTime !== undefined ? input.dropTime.trim() : existing.dropTime,
      sequence:
        input.sequence !== undefined ? Number(input.sequence) : existing.sequence,
    });
    if (!stop) return { error: { error: 'stop not found', status: 404 } };
    return { stop };
  }

  async deleteStop(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteStop(tenantId, id);
    if (!ok) return { error: { error: 'stop not found', status: 404 } };
    return { ok: true };
  }

  async resequenceStops(
    tenantId: string,
    routeId: string,
    orderedStopIds: string[],
  ): Promise<{ stops?: Stop[]; error?: ServiceError }> {
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }
    if (!Array.isArray(orderedStopIds) || orderedStopIds.length === 0) {
      return { error: { error: 'stop_ids must be a non-empty array', status: 400 } };
    }
    const existing = await this.repo.listStops(tenantId, routeId);
    if (orderedStopIds.length !== existing.length) {
      return { error: { error: 'stop_ids must include every stop on the route', status: 400 } };
    }
    const set = new Set(existing.map((s) => s.id));
    for (const id of orderedStopIds) {
      if (!set.has(id)) {
        return { error: { error: `stop not on route: ${id}`, status: 400 } };
      }
    }

    // Two-phase update to avoid unique (route, sequence) collisions
    await this.repo.setStopSequences(
      tenantId,
      orderedStopIds.map((id, i) => ({ id, sequence: -(i + 1) })),
    );
    await this.repo.setStopSequences(
      tenantId,
      orderedStopIds.map((id, i) => ({ id, sequence: i + 1 })),
    );
    return { stops: await this.repo.listStops(tenantId, routeId) };
  }

  async assignStudent(
    tenantId: string,
    input: { routeId: string; stopId: string; studentRef: string },
  ): Promise<{ assignment?: RouteStudent; error?: ServiceError }> {
    const routeId = (input.routeId || '').trim();
    const stopId = (input.stopId || '').trim();
    const studentRef = (input.studentRef || '').trim();
    if (!routeId || !stopId || !studentRef) {
      return {
        error: { error: 'route_id, stop_id, and student_ref are required', status: 400 },
      };
    }
    const route = await this.repo.getRoute(tenantId, routeId);
    if (!route) return { error: { error: 'route not found', status: 404 } };
    const stop = await this.repo.getStop(tenantId, stopId);
    if (!stop || stop.routeId !== routeId) {
      return { error: { error: 'stop not found on route', status: 400 } };
    }
    const vehicle = await this.repo.getVehicle(tenantId, route.vehicleId);
    if (!vehicle) return { error: { error: 'vehicle not found', status: 404 } };

    const existing = await this.repo.getRouteStudent(tenantId, routeId, studentRef);
    if (existing) {
      return { error: { error: 'student already assigned to route', status: 409 } };
    }

    const count = await this.repo.countRouteStudents(tenantId, routeId);
    if (count >= vehicle.capacity) {
      return { error: { error: 'route is at vehicle capacity', status: 409 } };
    }

    const assignment = await this.repo.insertRouteStudent({
      routeId,
      stopId,
      studentRef,
      tenantId,
      createdAt: this.clock().toISOString(),
    });
    return { assignment };
  }

  async unassignStudent(
    tenantId: string,
    routeId: string,
    studentRef: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deleteRouteStudent(
      tenantId,
      routeId,
      (studentRef || '').trim(),
    );
    if (!ok) return { error: { error: 'assignment not found', status: 404 } };
    return { ok: true };
  }

  async listAssignments(
    tenantId: string,
    routeId: string,
  ): Promise<{ assignments?: RouteStudent[]; error?: ServiceError }> {
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }
    return { assignments: await this.repo.listRouteStudents(tenantId, routeId) };
  }

  async listExpiries(
    tenantId: string,
    withinDays: number,
  ): Promise<{ expiries?: ExpiryRow[]; error?: ServiceError }> {
    if (!Number.isFinite(withinDays) || withinDays < 0) {
      return { error: { error: 'within_days must be a non-negative number', status: 400 } };
    }
    const now = this.clock();
    const rows: ExpiryRow[] = [];
    for (const v of await this.repo.listVehicles(tenantId)) {
      if (!v.active) continue;
      const ins = daysUntil(v.insuranceExpiry, now);
      if (ins <= withinDays) {
        rows.push({
          vehicleId: v.id,
          registration: v.registration,
          kind: 'insurance',
          expiryDate: v.insuranceExpiry,
          daysUntil: ins,
        });
      }
      const fit = daysUntil(v.fitnessExpiry, now);
      if (fit <= withinDays) {
        rows.push({
          vehicleId: v.id,
          registration: v.registration,
          kind: 'fitness',
          expiryDate: v.fitnessExpiry,
          daysUntil: fit,
        });
      }
    }
    rows.sort((a, b) => a.daysUntil - b.daysUntil || a.registration.localeCompare(b.registration));
    return { expiries: rows };
  }
}
