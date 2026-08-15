import { Router, Request, Response, NextFunction } from 'express';
import type { TransportService } from '../services/transport-service';
import type { BoardingService } from '../services/boarding-service';
import type { BoardingDirection, BoardingLeg } from '../types';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createTransportRouter(
  service: TransportService,
  boarding: BoardingService,
): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/:tenantId/vehicles',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createVehicle(req.params.tenantId, {
        registration: String(body.registration ?? ''),
        capacity: Number(body.capacity),
        ais140DeviceId:
          body.ais140_device_id !== undefined || body.ais140DeviceId !== undefined
            ? body.ais140_device_id == null && body.ais140DeviceId == null
              ? null
              : String(body.ais140_device_id ?? body.ais140DeviceId)
            : undefined,
        gpsProvider:
          body.gps_provider !== undefined || body.gpsProvider !== undefined
            ? body.gps_provider == null && body.gpsProvider == null
              ? null
              : String(body.gps_provider ?? body.gpsProvider)
            : undefined,
        insuranceExpiry: String(body.insurance_expiry ?? body.insuranceExpiry ?? ''),
        fitnessExpiry: String(body.fitness_expiry ?? body.fitnessExpiry ?? ''),
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.vehicle);
    }),
  );

  router.get(
    '/:tenantId/vehicles',
    asyncHandler(async (req, res) => {
      res.json(await service.listVehicles(req.params.tenantId));
    }),
  );

  router.get(
    '/:tenantId/vehicles/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getVehicle(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.vehicle);
    }),
  );

  router.patch(
    '/:tenantId/vehicles/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateVehicle(req.params.tenantId, req.params.id, {
        registration:
          body.registration !== undefined ? String(body.registration) : undefined,
        capacity: body.capacity !== undefined ? Number(body.capacity) : undefined,
        insuranceExpiry:
          body.insurance_expiry !== undefined || body.insuranceExpiry !== undefined
            ? String(body.insurance_expiry ?? body.insuranceExpiry)
            : undefined,
        fitnessExpiry:
          body.fitness_expiry !== undefined || body.fitnessExpiry !== undefined
            ? String(body.fitness_expiry ?? body.fitnessExpiry)
            : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.vehicle);
    }),
  );

  router.delete(
    '/:tenantId/vehicles/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteVehicle(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.get(
    '/:tenantId/expiries',
    asyncHandler(async (req, res) => {
      const raw = req.query.within_days ?? req.query.withinDays ?? '30';
      const withinDays = typeof raw === 'string' ? Number(raw) : Number(raw);
      const result = await service.listExpiries(req.params.tenantId, withinDays);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ expiries: result.expiries });
    }),
  );

  router.post(
    '/:tenantId/routes',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createRoute(req.params.tenantId, {
        label: String(body.label ?? ''),
        vehicleId: String(body.vehicle_id ?? body.vehicleId ?? ''),
        attendantName:
          body.attendant_name !== undefined || body.attendantName !== undefined
            ? body.attendant_name == null && body.attendantName == null
              ? null
              : String(body.attendant_name ?? body.attendantName)
            : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.route);
    }),
  );

  router.get(
    '/:tenantId/routes',
    asyncHandler(async (req, res) => {
      res.json(await service.listRoutes(req.params.tenantId));
    }),
  );

  router.get(
    '/:tenantId/routes/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getRoute(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.route);
    }),
  );

  router.patch(
    '/:tenantId/routes/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateRoute(req.params.tenantId, req.params.id, {
        label: body.label !== undefined ? String(body.label) : undefined,
        vehicleId:
          body.vehicle_id !== undefined || body.vehicleId !== undefined
            ? String(body.vehicle_id ?? body.vehicleId)
            : undefined,
        attendantName:
          body.attendant_name !== undefined || body.attendantName !== undefined
            ? body.attendant_name == null && body.attendantName == null
              ? null
              : String(body.attendant_name ?? body.attendantName)
            : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.route);
    }),
  );

  router.delete(
    '/:tenantId/routes/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteRoute(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/routes/:routeId/stops',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createStop(req.params.tenantId, {
        routeId: req.params.routeId,
        sequence: body.sequence !== undefined ? Number(body.sequence) : undefined,
        label: String(body.label ?? ''),
        lat: Number(body.lat),
        lng: Number(body.lng),
        pickupTime: String(body.pickup_time ?? body.pickupTime ?? ''),
        dropTime: String(body.drop_time ?? body.dropTime ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.stop);
    }),
  );

  router.get(
    '/:tenantId/routes/:routeId/stops',
    asyncHandler(async (req, res) => {
      const result = await service.listStops(req.params.tenantId, req.params.routeId);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ stops: result.stops });
    }),
  );

  router.post(
    '/:tenantId/routes/:routeId/stops/resequence',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const raw = body.stop_ids ?? body.stopIds;
      const ordered = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
      const result = await service.resequenceStops(
        req.params.tenantId,
        req.params.routeId,
        ordered,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ stops: result.stops });
    }),
  );

  router.patch(
    '/:tenantId/stops/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateStop(req.params.tenantId, req.params.id, {
        label: body.label !== undefined ? String(body.label) : undefined,
        lat: body.lat !== undefined ? Number(body.lat) : undefined,
        lng: body.lng !== undefined ? Number(body.lng) : undefined,
        pickupTime:
          body.pickup_time !== undefined || body.pickupTime !== undefined
            ? String(body.pickup_time ?? body.pickupTime)
            : undefined,
        dropTime:
          body.drop_time !== undefined || body.dropTime !== undefined
            ? String(body.drop_time ?? body.dropTime)
            : undefined,
        sequence: body.sequence !== undefined ? Number(body.sequence) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.stop);
    }),
  );

  router.delete(
    '/:tenantId/stops/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteStop(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/routes/:routeId/students',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.assignStudent(req.params.tenantId, {
        routeId: req.params.routeId,
        stopId: String(body.stop_id ?? body.stopId ?? ''),
        studentRef: String(body.student_ref ?? body.studentRef ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.assignment);
    }),
  );

  router.get(
    '/:tenantId/routes/:routeId/students',
    asyncHandler(async (req, res) => {
      const result = await service.listAssignments(
        req.params.tenantId,
        req.params.routeId,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ assignments: result.assignments });
    }),
  );

  router.delete(
    '/:tenantId/routes/:routeId/students/:studentRef',
    asyncHandler(async (req, res) => {
      const result = await service.unassignStudent(
        req.params.tenantId,
        req.params.routeId,
        req.params.studentRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/bindings',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await boarding.createBinding(req.params.tenantId, {
        studentRef: String(body.student_ref ?? body.studentRef ?? ''),
        payloadB64: String(body.payload_b64 ?? body.payloadB64 ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.binding);
    }),
  );

  router.post(
    '/:tenantId/bindings/:id/deactivate',
    asyncHandler(async (req, res) => {
      const result = await boarding.deactivateBinding(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/boarding',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await boarding.recordBoarding(req.params.tenantId, {
        payloadB64:
          body.payload_b64 !== undefined || body.payloadB64 !== undefined
            ? String(body.payload_b64 ?? body.payloadB64)
            : undefined,
        studentRef:
          body.student_ref !== undefined || body.studentRef !== undefined
            ? String(body.student_ref ?? body.studentRef)
            : undefined,
        direction: String(body.direction ?? '') as BoardingDirection,
        leg: String(body.leg ?? '') as BoardingLeg,
        routeId: String(body.route_id ?? body.routeId ?? ''),
        at: body.at !== undefined ? String(body.at) : undefined,
        lat: body.lat !== undefined ? Number(body.lat) : undefined,
        lng: body.lng !== undefined ? Number(body.lng) : undefined,
        deviceId:
          body.device_id !== undefined || body.deviceId !== undefined
            ? body.device_id == null && body.deviceId == null
              ? null
              : String(body.device_id ?? body.deviceId)
            : undefined,
        idempotencyKey:
          body.idempotency_key !== undefined || body.idempotencyKey !== undefined
            ? body.idempotency_key == null && body.idempotencyKey == null
              ? null
              : String(body.idempotency_key ?? body.idempotencyKey)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(200).json({
        event: result.event,
        unmatched: result.unmatched ?? false,
      });
    }),
  );

  router.post(
    '/:tenantId/sweep-missed',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await boarding.sweepMissed(req.params.tenantId, {
        routeId: String(body.route_id ?? body.routeId ?? ''),
        leg: String(body.leg ?? '') as BoardingLeg,
        date: String(body.date ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ emitted: result.emitted, skipped: result.skipped });
    }),
  );

  router.get(
    '/:tenantId/routes/:id/manifest',
    asyncHandler(async (req, res) => {
      const date =
        typeof req.query.date === 'string'
          ? req.query.date
          : '';
      const result = await boarding.manifest(
        req.params.tenantId,
        req.params.id,
        date,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ students: result.students });
    }),
  );

  return router;
}
