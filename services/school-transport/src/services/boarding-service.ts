import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { TransportRepository } from '../repositories/transport-repository';
import type {
  BoardingDirection,
  BoardingEvent,
  BoardingLeg,
  ManifestStudent,
  Route,
  RouteStudent,
  Stop,
  TransportBinding,
} from '../types';

type ServiceError = { error: string; status: number };

const DIRECTIONS = new Set<BoardingDirection>(['board', 'alight']);
const LEGS = new Set<BoardingLeg>(['pickup', 'drop']);

/** Mirror school-attendance capture hash — raw card bytes never stored. */
export function hashCapturePayloadB64(payloadB64: string): string {
  const bytes = Buffer.from(payloadB64, 'base64');
  return createHash('sha256').update(bytes).digest('hex');
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export class BoardingService {
  constructor(
    private readonly repo: TransportRepository,
    private readonly events: EventPublisher,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createBinding(
    tenantId: string,
    input: { studentRef: string; payloadB64: string },
  ): Promise<{ binding?: TransportBinding; error?: ServiceError }> {
    const studentRef = (input.studentRef || '').trim();
    const payloadB64 = (input.payloadB64 || '').trim();
    if (!studentRef) return { error: { error: 'student_ref is required', status: 400 } };
    if (!payloadB64) return { error: { error: 'payload_b64 is required', status: 400 } };

    let payloadHash: string;
    try {
      payloadHash = hashCapturePayloadB64(payloadB64);
    } catch {
      return { error: { error: 'payload_b64 is invalid', status: 400 } };
    }

    const existing = await this.repo.findActiveBindingByHash(tenantId, payloadHash);
    if (existing) {
      return {
        error: {
          error: 'payload already bound; deactivate previous binding first',
          status: 409,
        },
      };
    }

    const binding = await this.repo.insertBinding({
      id: uuidv4(),
      tenantId,
      studentRef,
      payloadHash,
      isActive: true,
      createdAt: this.clock().toISOString(),
    });
    return { binding };
  }

  async deactivateBinding(
    tenantId: string,
    id: string,
  ): Promise<{ ok?: boolean; error?: ServiceError }> {
    const ok = await this.repo.deactivateBinding(tenantId, id);
    if (!ok) return { error: { error: 'binding not found', status: 404 } };
    return { ok: true };
  }

  async recordBoarding(
    tenantId: string,
    input: {
      payloadB64?: string;
      studentRef?: string;
      direction: BoardingDirection;
      leg: BoardingLeg;
      routeId: string;
      at?: string;
      lat?: number | null;
      lng?: number | null;
      deviceId?: string | null;
      idempotencyKey?: string | null;
    },
  ): Promise<{
    event?: BoardingEvent;
    unmatched?: boolean;
    error?: ServiceError;
  }> {
    if (!DIRECTIONS.has(input.direction)) {
      return { error: { error: 'direction must be board or alight', status: 400 } };
    }
    if (!LEGS.has(input.leg)) {
      return { error: { error: 'leg must be pickup or drop', status: 400 } };
    }
    const routeId = (input.routeId || '').trim();
    if (!routeId) return { error: { error: 'route_id is required', status: 400 } };

    const route = await this.repo.getRoute(tenantId, routeId);
    if (!route) return { error: { error: 'route not found', status: 404 } };

    const idempotencyKey =
      input.idempotencyKey === undefined || input.idempotencyKey === null
        ? null
        : String(input.idempotencyKey).trim() || null;
    if (idempotencyKey) {
      const prior = await this.repo.getBoardingByIdempotency(tenantId, idempotencyKey);
      if (prior) return { event: prior, unmatched: prior.unmatched };
    }

    let studentRef: string | null = null;
    let source: 'rfid' | 'manual' = 'manual';
    const payloadB64 = (input.payloadB64 || '').trim();
    const explicitRef = (input.studentRef || '').trim();

    if (payloadB64) {
      source = 'rfid';
      let payloadHash: string;
      try {
        payloadHash = hashCapturePayloadB64(payloadB64);
      } catch {
        return { error: { error: 'payload_b64 is invalid', status: 400 } };
      }
      const binding = await this.repo.findActiveBindingByHash(tenantId, payloadHash);
      if (binding) studentRef = binding.studentRef;
    } else if (explicitRef) {
      studentRef = explicitRef;
    } else {
      return {
        error: { error: 'payload_b64 or student_ref is required', status: 400 },
      };
    }

    const at = (input.at || '').trim() || this.clock().toISOString();
    const unmatched = !studentRef;

    const event = await this.repo.insertBoardingEvent({
      id: uuidv4(),
      tenantId,
      routeId,
      vehicleId: route.vehicleId,
      studentRef,
      direction: input.direction,
      leg: input.leg,
      at,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      source,
      deviceId: input.deviceId?.trim() || null,
      idempotencyKey,
      unmatched,
      createdAt: this.clock().toISOString(),
    });

    if (unmatched) {
      return { event, unmatched: true };
    }

    const assignment = await this.repo.getRouteStudent(tenantId, routeId, studentRef!);
    let stopHint: string | null = null;
    if (assignment) {
      const stop = await this.repo.getStop(tenantId, assignment.stopId);
      stopHint = stop?.label ?? assignment.stopId;
    }

    const eventType =
      input.direction === 'board'
        ? 'school.transport.boarded'
        : 'school.transport.alighted';
    await this.events.publish({
      type: eventType,
      tenantId,
      occurredAt: at,
      data: {
        student_ref: studentRef,
        route: route.label,
        route_id: routeId,
        stop_hint: stopHint,
        at,
        leg: input.leg,
      },
    });

    if (input.direction === 'alight') {
      const day = dayOf(at);
      const hadBoard = await this.repo.hasBoardEvent(
        tenantId,
        routeId,
        studentRef!,
        input.leg,
        day,
      );
      if (!hadBoard) {
        await this.events.publish({
          type: 'school.transport.anomaly',
          tenantId,
          occurredAt: at,
          data: {
            kind: 'alight_without_board',
            student_ref: studentRef,
            route_id: routeId,
            leg: input.leg,
            at,
          },
        });
      }
    }

    return { event, unmatched: false };
  }

  async sweepMissed(
    tenantId: string,
    input: { routeId: string; leg: BoardingLeg; date: string },
  ): Promise<{
    emitted?: number;
    skipped?: boolean;
    error?: ServiceError;
  }> {
    const routeId = (input.routeId || '').trim();
    const date = (input.date || '').trim();
    if (!routeId) return { error: { error: 'route_id is required', status: 400 } };
    if (!LEGS.has(input.leg)) {
      return { error: { error: 'leg must be pickup or drop', status: 400 } };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: { error: 'date must be YYYY-MM-DD', status: 400 } };
    }
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }

    if (await this.repo.getSweepLog(tenantId, routeId, input.leg, date)) {
      return { emitted: 0, skipped: true };
    }

    const assigned = await this.repo.listRouteStudents(tenantId, routeId);
    let emitted = 0;
    for (const a of assigned) {
      const boarded = await this.repo.hasBoardEvent(
        tenantId,
        routeId,
        a.studentRef,
        input.leg,
        date,
      );
      if (boarded) continue;
      await this.events.publish({
        type: 'school.transport.missed_boarding',
        tenantId,
        occurredAt: this.clock().toISOString(),
        data: {
          student_ref: a.studentRef,
          route_id: routeId,
          leg: input.leg,
          date,
        },
      });
      emitted += 1;
    }

    await this.repo.insertSweepLog(tenantId, routeId, input.leg, date);
    return { emitted, skipped: false };
  }

  async manifest(
    tenantId: string,
    routeId: string,
    date: string,
  ): Promise<{ students?: ManifestStudent[]; error?: ServiceError }> {
    const day = (date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { error: { error: 'date must be YYYY-MM-DD', status: 400 } };
    }
    if (!(await this.repo.getRoute(tenantId, routeId))) {
      return { error: { error: 'route not found', status: 404 } };
    }

    const assigned = await this.repo.listRouteStudents(tenantId, routeId);
    const events = await this.repo.listBoardingForRouteDay(tenantId, routeId, day);
    const students: ManifestStudent[] = [];

    for (const a of assigned) {
      const stop = await this.repo.getStop(tenantId, a.stopId);
      const studentEvents = events.filter(
        (e) => e.studentRef === a.studentRef && !e.unmatched,
      );
      const pickupBoarded = studentEvents.some(
        (e) => e.leg === 'pickup' && e.direction === 'board',
      );
      const pickupAlighted = studentEvents.some(
        (e) => e.leg === 'pickup' && e.direction === 'alight',
      );
      const dropBoarded = studentEvents.some(
        (e) => e.leg === 'drop' && e.direction === 'board',
      );
      const dropAlighted = studentEvents.some(
        (e) => e.leg === 'drop' && e.direction === 'alight',
      );
      students.push({
        studentRef: a.studentRef,
        stopId: a.stopId,
        stopLabel: stop?.label ?? null,
        pickup: {
          boarded: pickupBoarded,
          alighted: pickupAlighted,
          missed: !pickupBoarded,
        },
        drop: {
          boarded: dropBoarded,
          alighted: dropAlighted,
          missed: !dropBoarded,
        },
      });
    }

    return { students };
  }

  async getGuardianStudentStatus(
    tenantId: string,
    studentRef: string,
    telemetry: {
      routeEta: (
        tenantId: string,
        routeId: string,
        stopId: string,
      ) => Promise<{
        eta?: number | null;
        stale?: boolean;
        error?: { error: string; status: number };
      }>;
    },
  ): Promise<{
    assignment?: RouteStudent;
    stop?: Stop | null;
    route?: Route;
    eta?: { minutes: number | null; stale: boolean } | null;
    recentBoarding?: BoardingEvent[];
    error?: ServiceError;
  }> {
    const ref = (studentRef || '').trim();
    if (!ref) return { error: { error: 'student_ref is required', status: 400 } };
    const assignment = await this.repo.findRouteStudentByStudentRef(tenantId, ref);
    if (!assignment) {
      return { error: { error: 'transport assignment not found', status: 404 } };
    }
    const route = await this.repo.getRoute(tenantId, assignment.routeId);
    if (!route) {
      return { error: { error: 'route not found', status: 404 } };
    }
    const stop = await this.repo.getStop(tenantId, assignment.stopId);
    // Vehicle GPS only via routeEta — never expose raw person GPS.
    const etaRes = await telemetry.routeEta(tenantId, assignment.routeId, assignment.stopId);
    const recentBoarding = await this.repo.listBoardingForStudent(tenantId, ref, 20);
    return {
      assignment,
      stop: stop ?? null,
      route,
      eta: etaRes.error
        ? null
        : {
            minutes: etaRes.eta ?? null,
            stale: Boolean(etaRes.stale),
          },
      recentBoarding,
    };
  }
}
