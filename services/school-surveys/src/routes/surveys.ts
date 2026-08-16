import { Router, Request, Response, NextFunction } from 'express';
import {
  enforceGuardianAccess,
  parseStudentsHeader,
} from '../internal-auth';
import type { SurveysService } from '../services/surveys-service';
import { guardRoutes } from '../role-guard';
import { SURVEYS_ROUTE_POLICIES } from '../route-policies';


function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function createSurveysRouter(
  service: SurveysService,
  internalSecret: string,
): Router {
  const router = Router({ mergeParams: true });
  guardRoutes(router, SURVEYS_ROUTE_POLICIES, { internalSecret });
  // Guardian routes BEFORE /:tenantId/:id so "guardian" is not an id
  router.get(
    '/:tenantId/guardian/pending',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianAccess(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (!gate.guardianId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentIds = parseStudentsHeader(req);
      const surveys = await service.guardianPending(
        req.params.tenantId,
        gate.guardianId,
        studentIds,
      );
      res.json({ surveys });
    }),
  );

  router.get(
    '/:tenantId/guardian/surveys/:id',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianAccess(req, internalSecret);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (!gate.guardianId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentIds = parseStudentsHeader(req);
      const result = await service.guardianGet(
        req.params.tenantId,
        req.params.id,
        gate.guardianId,
        studentIds,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ survey: result.survey });
    }),
  );

  router.post(
    '/:tenantId/guardian/surveys/:id/respond',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const studentRef = String(body.student_ref ?? body.studentRef ?? '').trim();
      const gate = enforceGuardianAccess(
        req,
        internalSecret,
        studentRef || undefined,
      );
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      if (!gate.guardianId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentIds = parseStudentsHeader(req);
      const result = await service.guardianRespond(
        req.params.tenantId,
        req.params.id,
        gate.guardianId,
        studentIds,
        body,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ response: result.response });
    }),
  );

  // Staff routes
  router.post(
    '/:tenantId',
    asyncHandler(async (req, res) => {
      const result = await service.create(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ survey: result.survey });
    }),
  );

  router.get(
    '/:tenantId',
    asyncHandler(async (req, res) => {
      const status = req.query.status as string | undefined;
      const surveys = await service.list(req.params.tenantId, status);
      res.json({ surveys });
    }),
  );

  router.put(
    '/:tenantId/:id',
    asyncHandler(async (req, res) => {
      const result = await service.update(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ survey: result.survey });
    }),
  );

  router.delete(
    '/:tenantId/:id',
    asyncHandler(async (req, res) => {
      const result = await service.delete(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.post(
    '/:tenantId/:id/publish',
    asyncHandler(async (req, res) => {
      const result = await service.publish(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.post(
    '/:tenantId/:id/close',
    asyncHandler(async (req, res) => {
      const result = await service.close(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  router.get(
    '/:tenantId/:id/results',
    asyncHandler(async (req, res) => {
      const result = await service.results(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ summary: result.summary });
    }),
  );

  router.get(
    '/:tenantId/:id/response-rate',
    asyncHandler(async (req, res) => {
      const result = await service.responseRate(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.rate);
    }),
  );

  router.get(
    '/:tenantId/:id',
    asyncHandler(async (req, res) => {
      const result = await service.get(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ survey: result.survey });
    }),
  );

  return router;
}
