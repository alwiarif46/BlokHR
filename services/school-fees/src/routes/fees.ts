import { Router, Request, Response, NextFunction } from 'express';
import type { FeesService } from '../services/fees-service';
import type { InvoiceService } from '../services/invoice-service';
import type { PaymentService } from '../services/payment-service';
import type { ConcessionKind, FeeHeadKind, FeePayer, PaymentMethod } from '../types';
import { resolveInternalSecret } from '../internal-auth';
import { guardRoutes } from '../role-guard';
import { FEES_ROUTE_POLICIES } from '../route-policies';


function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function createFeesRouter(
  service: FeesService,
  invoices: InvoiceService,
  payments: PaymentService,
  opts: { internalSecret?: string } = {},
): Router {
  const router = Router({ mergeParams: true });
  const internalSecret = opts.internalSecret ?? resolveInternalSecret();
  guardRoutes(router, FEES_ROUTE_POLICIES, { internalSecret });
  router.post(
    '/:tenantId/heads',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createHead(req.params.tenantId, {
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        kind: String(body.kind ?? '') as FeeHeadKind,
        taxable: body.taxable !== undefined ? Boolean(body.taxable) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.head);
    }),
  );

  router.get(
    '/:tenantId/heads',
    asyncHandler(async (req, res) => {
      const result = await service.listHeads(req.params.tenantId);
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/heads/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getHead(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.head);
    }),
  );

  router.patch(
    '/:tenantId/heads/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateHead(req.params.tenantId, req.params.id, {
        code: body.code !== undefined ? String(body.code) : undefined,
        label: body.label !== undefined ? String(body.label) : undefined,
        kind: body.kind !== undefined ? (String(body.kind) as FeeHeadKind) : undefined,
        taxable: body.taxable !== undefined ? Boolean(body.taxable) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.head);
    }),
  );

  router.delete(
    '/:tenantId/heads/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteHead(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/structures',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createStructure(req.params.tenantId, {
        academicSessionRef: String(
          body.academic_session_ref ?? body.academicSessionRef ?? '',
        ),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        label: String(body.label ?? ''),
        lines: body.lines,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.structure);
    }),
  );

  router.get(
    '/:tenantId/structures',
    asyncHandler(async (req, res) => {
      const result = await service.listStructures(req.params.tenantId);
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/structures/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getStructure(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.structure);
    }),
  );

  router.patch(
    '/:tenantId/structures/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.updateStructure(req.params.tenantId, req.params.id, {
        academicSessionRef:
          body.academic_session_ref !== undefined || body.academicSessionRef !== undefined
            ? String(body.academic_session_ref ?? body.academicSessionRef)
            : undefined,
        classLabel:
          body.class_label !== undefined || body.classLabel !== undefined
            ? String(body.class_label ?? body.classLabel)
            : undefined,
        label: body.label !== undefined ? String(body.label) : undefined,
        lines: body.lines,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.structure);
    }),
  );

  router.delete(
    '/:tenantId/structures/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteStructure(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/concessions',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      let appliesToHeads: string[] | null | undefined = undefined;
      if (
        body.applies_to_heads !== undefined ||
        body.appliesToHeads !== undefined
      ) {
        const raw = body.applies_to_heads ?? body.appliesToHeads;
        appliesToHeads =
          raw === null
            ? null
            : Array.isArray(raw)
              ? raw.map((x) => String(x))
              : [];
      }
      const result = await service.createConcession(req.params.tenantId, {
        code: String(body.code ?? ''),
        label: String(body.label ?? ''),
        kind: String(body.kind ?? '') as ConcessionKind,
        value: Number(body.value),
        appliesToHeads,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.concession);
    }),
  );

  router.get(
    '/:tenantId/concessions',
    asyncHandler(async (req, res) => {
      const result = await service.listConcessions(req.params.tenantId);
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/concessions/:id',
    asyncHandler(async (req, res) => {
      const result = await service.getConcession(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.concession);
    }),
  );

  router.patch(
    '/:tenantId/concessions/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      let appliesToHeads: string[] | null | undefined = undefined;
      if (
        body.applies_to_heads !== undefined ||
        body.appliesToHeads !== undefined
      ) {
        const raw = body.applies_to_heads ?? body.appliesToHeads;
        appliesToHeads =
          raw === null
            ? null
            : Array.isArray(raw)
              ? raw.map((x) => String(x))
              : [];
      }
      const result = await service.updateConcession(req.params.tenantId, req.params.id, {
        code: body.code !== undefined ? String(body.code) : undefined,
        label: body.label !== undefined ? String(body.label) : undefined,
        kind: body.kind !== undefined ? (String(body.kind) as ConcessionKind) : undefined,
        value: body.value !== undefined ? Number(body.value) : undefined,
        appliesToHeads,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.concession);
    }),
  );

  router.delete(
    '/:tenantId/concessions/:id',
    asyncHandler(async (req, res) => {
      const result = await service.deleteConcession(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ ok: true });
    }),
  );

  router.post(
    '/:tenantId/assignments',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const concessionRaw = body.concession_ids ?? body.concessionIds;
      const result = await invoices.createAssignment(req.params.tenantId, {
        studentRef: String(body.student_ref ?? body.studentRef ?? ''),
        feeStructureId: String(body.fee_structure_id ?? body.feeStructureId ?? ''),
        payer:
          body.payer !== undefined
            ? (String(body.payer) as FeePayer)
            : undefined,
        concessionIds: Array.isArray(concessionRaw)
          ? concessionRaw.map((x) => String(x))
          : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.assignment);
    }),
  );

  router.get(
    '/:tenantId/assignments',
    asyncHandler(async (req, res) => {
      const result = await invoices.listAssignments(req.params.tenantId);
      res.json(result);
    }),
  );

  router.post(
    '/:tenantId/invoices/generate',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await invoices.generateInvoices(req.params.tenantId, {
        academicSessionRef: String(
          body.academic_session_ref ?? body.academicSessionRef ?? '',
        ),
        periodLabel: String(body.period_label ?? body.periodLabel ?? ''),
        classLabel:
          body.class_label !== undefined || body.classLabel !== undefined
            ? String(body.class_label ?? body.classLabel)
            : undefined,
        stateCode:
          body.state_code !== undefined || body.stateCode !== undefined
            ? String(body.state_code ?? body.stateCode)
            : undefined,
        dueOn:
          body.due_on !== undefined || body.dueOn !== undefined
            ? String(body.due_on ?? body.dueOn)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({
        created: result.created,
        skipped: result.skipped,
        rteClaim: result.rteClaim ?? null,
      });
    }),
  );

  router.get(
    '/:tenantId/invoices',
    asyncHandler(async (req, res) => {
      const result = await invoices.listInvoices(req.params.tenantId);
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/rte-claims',
    asyncHandler(async (req, res) => {
      const result = await invoices.listRteClaims(req.params.tenantId);
      res.json(result);
    }),
  );

  router.post(
    '/:tenantId/rte-claims/:id/submit',
    asyncHandler(async (req, res) => {
      const result = await invoices.submitRteClaim(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.claim);
    }),
  );

  router.post(
    '/:tenantId/rte-claims/:id/receive',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await invoices.receiveRteClaim(
        req.params.tenantId,
        req.params.id,
        String(body.reference ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.claim);
    }),
  );

  router.post(
    '/:tenantId/rte-claims/:id/reject',
    asyncHandler(async (req, res) => {
      const result = await invoices.rejectRteClaim(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.claim);
    }),
  );

  router.post(
    '/:tenantId/payments/reconcile',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const raw = Array.isArray(body.rows) ? body.rows : [];
      const rows = raw.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          utr: String(row.utr ?? ''),
          amountPaise: Number(row.amount_paise ?? row.amountPaise),
          date:
            row.date !== undefined
              ? String(row.date)
              : undefined,
        };
      });
      const result = await payments.reconcile(req.params.tenantId, rows);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({
        verified: result.verified,
        unmatched: result.unmatched,
        mismatched: result.mismatched,
      });
    }),
  );

  router.post(
    '/:tenantId/payments',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await payments.recordPayment(req.params.tenantId, {
        invoiceId: String(body.invoice_id ?? body.invoiceId ?? ''),
        amountPaise: Number(body.amount_paise ?? body.amountPaise),
        method: String(body.method ?? '') as PaymentMethod,
        utr:
          body.utr !== undefined
            ? body.utr == null
              ? null
              : String(body.utr)
            : undefined,
        gatewayRef:
          body.gateway_ref !== undefined || body.gatewayRef !== undefined
            ? body.gateway_ref == null && body.gatewayRef == null
              ? null
              : String(body.gateway_ref ?? body.gatewayRef)
            : undefined,
        receivedOn:
          body.received_on !== undefined || body.receivedOn !== undefined
            ? String(body.received_on ?? body.receivedOn)
            : undefined,
        recordedBy: String(body.recorded_by ?? body.recordedBy ?? ''),
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json({ payment: result.payment, invoice: result.invoice });
    }),
  );

  router.post(
    '/:tenantId/payments/:id/bounce',
    asyncHandler(async (req, res) => {
      const result = await payments.bouncePayment(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ payment: result.payment, invoice: result.invoice });
    }),
  );

  router.get(
    '/:tenantId/outstanding',
    asyncHandler(async (req, res) => {
      const minRaw = req.query.min_days_overdue ?? req.query.minDaysOverdue;
      const result = await payments.listOutstanding(req.params.tenantId, {
        classLabel:
          typeof req.query.class === 'string'
            ? req.query.class
            : typeof req.query.class_label === 'string'
              ? req.query.class_label
              : undefined,
        minDaysOverdue:
          typeof minRaw === 'string' ? Number(minRaw) : undefined,
      });
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/students/:ref/ledger',
    asyncHandler(async (req, res) => {
      const result = await payments.studentLedger(req.params.tenantId, req.params.ref);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ entries: result.entries });
    }),
  );

  return router;
}
