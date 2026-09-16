import { Router, Request, Response, NextFunction } from 'express';
import type { CirculationService } from '../services/circulation-service';
import type { FineService } from '../services/fine-service';
import type { LibraryService } from '../services/library-service';
import {
  enforceGuardianAccess,
  isGuardianPrincipal,
  resolveInternalSecret,
} from '../internal-auth';
import { guardRoutes } from '../role-guard';
import { LIBRARY_ROUTE_POLICIES } from '../route-policies';


function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createLibraryRouter(
  service: LibraryService,
  circulation: CirculationService,
  fines: FineService,
  opts: { internalSecret?: string } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts.internalSecret ?? resolveInternalSecret();
  guardRoutes(router, LIBRARY_ROUTE_POLICIES, { internalSecret });
  router.post(
    '/:tenantId/titles',
    asyncHandler(async (req, res) => {
      const result = await service.createTitle(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.title);
    }),
  );

  router.get(
    '/:tenantId/titles',
    asyncHandler(async (req, res) => {
      const result = await service.listTitles(req.params.tenantId, {
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        subject:
          typeof req.query.subject === 'string' ? req.query.subject : undefined,
      });
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/titles/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getTitle(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.title);
    }),
  );

  router.patch(
    '/:tenantId/titles/:id',
    asyncHandler(async (req, res) => {
      const result = await service.updateTitle(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.title);
    }),
  );

  router.delete(
    '/:tenantId/titles/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteTitle(
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
    '/:tenantId/copies',
    asyncHandler(async (req, res) => {
      const result = await service.createCopy(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.copy);
    }),
  );

  router.get(
    '/:tenantId/copies',
    asyncHandler(async (req, res) => {
      const result = await service.listCopies(req.params.tenantId, {
        titleId:
          typeof req.query.title_id === 'string'
            ? req.query.title_id
            : undefined,
        status:
          typeof req.query.status === 'string' ? req.query.status : undefined,
        barcode:
          typeof req.query.barcode === 'string' ? req.query.barcode : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ copies: result.copies });
    }),
  );

  router.get(
    '/:tenantId/copies/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getCopy(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.copy);
    }),
  );

  router.patch(
    '/:tenantId/copies/:id',
    asyncHandler(async (req, res) => {
      const result = await service.updateCopy(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.copy);
    }),
  );

  router.delete(
    '/:tenantId/copies/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteCopy(
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

  router.get(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const result = await circulation.getSettings(req.params.tenantId);
      res.json(result.settings);
    }),
  );

  router.put(
    '/:tenantId/settings',
    asyncHandler(async (req, res) => {
      const result = await circulation.putSettings(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.settings);
    }),
  );

  router.post(
    '/:tenantId/loans/mark-overdue',
    asyncHandler(async (req, res) => {
      const result = await circulation.markOverdue(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      res.json(result);
    }),
  );

  router.post(
    '/:tenantId/loans',
    asyncHandler(async (req, res) => {
      const result = await circulation.issueLoan(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        const body: Record<string, unknown> = { error: result.error.error };
        if (result.open_fines_paise !== undefined) {
          body.open_fines_paise = result.open_fines_paise;
        }
        res.status(result.error.status).json(body);
        return;
      }
      res.status(201).json(result.loan);
    }),
  );

  router.get(
    '/:tenantId/loans',
    asyncHandler(async (req, res) => {
      const result = await circulation.listLoans(req.params.tenantId, {
        studentRef:
          typeof req.query.student_ref === 'string'
            ? req.query.student_ref
            : undefined,
        status:
          typeof req.query.status === 'string' ? req.query.status : undefined,
        overdue: req.query.overdue === '1' || req.query.overdue === 'true',
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ loans: result.loans });
    }),
  );

  router.post(
    '/:tenantId/loans/:id/return',
    asyncHandler(async (req, res) => {
      const result = await circulation.returnLoan(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.loan);
    }),
  );

  router.post(
    '/:tenantId/loans/:id/renew',
    asyncHandler(async (req, res) => {
      const result = await circulation.renewLoan(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.loan);
    }),
  );

  router.post(
    '/:tenantId/holds',
    asyncHandler(async (req, res) => {
      const result = await circulation.placeHold(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.hold);
    }),
  );

  router.get(
    '/:tenantId/holds',
    asyncHandler(async (req, res) => {
      const result = await circulation.listHolds(req.params.tenantId, {
        titleId:
          typeof req.query.title_id === 'string'
            ? req.query.title_id
            : undefined,
        studentRef:
          typeof req.query.student_ref === 'string'
            ? req.query.student_ref
            : undefined,
        status:
          typeof req.query.status === 'string' ? req.query.status : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ holds: result.holds });
    }),
  );

  router.post(
    '/:tenantId/holds/:id/cancel',
    asyncHandler(async (req, res) => {
      const result = await circulation.cancelHold(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.hold);
    }),
  );

  router.post(
    '/:tenantId/holds/:id/fulfill',
    asyncHandler(async (req, res) => {
      const result = await circulation.fulfillHold(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.loan);
    }),
  );

  router.post(
    '/:tenantId/fines/assess',
    asyncHandler(async (req, res) => {
      const result = await fines.assessAll(
        req.params.tenantId,
        req.body as Record<string, unknown>,
      );
      if ('error' in result) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/fines',
    asyncHandler(async (req, res) => {
      const result = await fines.listFines(req.params.tenantId, {
        studentRef:
          typeof req.query.student_ref === 'string'
            ? req.query.student_ref
            : undefined,
        status:
          typeof req.query.status === 'string' ? req.query.status : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ fines: result.fines });
    }),
  );

  router.post(
    '/:tenantId/fines/:id/pay',
    asyncHandler(async (req, res) => {
      const result = await fines.payFine(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.fine);
    }),
  );

  router.post(
    '/:tenantId/fines/:id/waive',
    asyncHandler(async (req, res) => {
      const result = await fines.waiveFine(
        req.params.tenantId,
        req.params.id,
        req.body as Record<string, unknown>,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.fine);
    }),
  );

  router.get(
    '/:tenantId/students/:studentRef/library-summary',
    asyncHandler(async (req, res) => {
      const result = await fines.librarySummary(
        req.params.tenantId,
        req.params.studentRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.summary);
    }),
  );

  router.get(
    '/:tenantId/guardian/students/:studentRef/library-summary',
    asyncHandler(async (req, res) => {
      if (!isGuardianPrincipal(req)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const studentRef = req.params.studentRef;
      const gate = enforceGuardianAccess(req, internalSecret, studentRef);
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const result = await fines.librarySummary(
        req.params.tenantId,
        studentRef,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.summary);
    }),
  );

  return router;
}
