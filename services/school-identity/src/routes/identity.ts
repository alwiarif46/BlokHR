import { Router, Request, Response, NextFunction } from 'express';
import type { IdentityService } from '../services/identity-service';
import type {
  ConsentKind,
  ConsentState,
  ConsentVerificationMethod,
  CreateStudentInput,
  GuardianRelation,
  PatchStudentInput,
  StudentCategory,
  StudentGender,
  StudentStatus,
} from '../types';
import { enforceGuardianPrincipal } from '../internal-auth';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function pickStudentBody(body: Record<string, unknown>): CreateStudentInput {
  return {
    admissionNumber: String(body.admission_number ?? body.admissionNumber ?? ''),
    firstName: String(body.first_name ?? body.firstName ?? ''),
    lastName: String(body.last_name ?? body.lastName ?? ''),
    dob: String(body.dob ?? ''),
    gender: String(body.gender ?? '') as StudentGender,
    admissionDate: String(body.admission_date ?? body.admissionDate ?? ''),
    status: String(body.status ?? 'enquiry') as StudentStatus,
    category: String(body.category ?? '') as StudentCategory,
    stateCategoryCode:
      body.state_category_code != null || body.stateCategoryCode != null
        ? String(body.state_category_code ?? body.stateCategoryCode)
        : null,
    stateStudentId:
      body.state_student_id != null || body.stateStudentId != null
        ? String(body.state_student_id ?? body.stateStudentId)
        : null,
    motherName: String(body.mother_name ?? body.motherName ?? ''),
    fatherName: String(body.father_name ?? body.fatherName ?? ''),
    guardianContact: String(body.guardian_contact ?? body.guardianContact ?? ''),
    aadhaarLast4:
      body.aadhaar_last4 != null || body.aadhaarLast4 != null
        ? String(body.aadhaar_last4 ?? body.aadhaarLast4)
        : null,
    apaarId:
      body.apaar_id != null || body.apaarId != null
        ? String(body.apaar_id ?? body.apaarId)
        : null,
    penId: body.pen_id != null || body.penId != null ? String(body.pen_id ?? body.penId) : null,
    udiseExportOk: body.udise_export_ok === true || body.udiseExportOk === true,
    isCwsn: body.is_cwsn === true || body.isCwsn === true,
    cwsnCategory:
      body.cwsn_category != null || body.cwsnCategory != null
        ? String(body.cwsn_category ?? body.cwsnCategory)
        : null,
    cwsnDisability:
      body.cwsn_disability != null || body.cwsnDisability != null
        ? String(body.cwsn_disability ?? body.cwsnDisability)
        : null,
    cwsnCertificate: body.cwsn_certificate === true || body.cwsnCertificate === true,
    isRte: body.is_rte === true || body.isRte === true,
    photoRef:
      body.photo_ref != null || body.photoRef != null
        ? String(body.photo_ref ?? body.photoRef)
        : null,
  };
}

export function createIdentityRouter(
  service: IdentityService,
  opts: { internalSecret?: string } = {},
): Router {
  const internalSecret = opts.internalSecret ?? '';
  const router = Router({ mergeParams: true });

  router.get(
    '/state-packs',
    asyncHandler(async (_req, res) => {
      res.json({ packs: service.listStatePackSummaries() });
    }),
  );

  router.get(
    '/state-packs/:code',
    asyncHandler(async (req, res) => {
      const pack = service.getStatePackDetail(req.params.code);
      if (!pack) {
        res.status(404).json({ error: 'State pack not found' });
        return;
      }
      res.json(pack);
    }),
  );

  router.put(
    '/:tenantId/state-pack',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.setTenantStatePack(
        req.params.tenantId,
        String(body.pack_code ?? body.packCode ?? ''),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ packCode: result.packCode, pack: result.pack });
    }),
  );

  router.get(
    '/:tenantId/state-pack',
    asyncHandler(async (req, res) => {
      const result = await service.getTenantStatePack(req.params.tenantId);
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/sessions',
    asyncHandler(async (req, res) => {
      const sessions = await service.listSessions(req.params.tenantId);
      res.json({ sessions });
    }),
  );

  router.post(
    '/:tenantId/sessions',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createSession(req.params.tenantId, {
        label: String(body.label ?? ''),
        startsOn: String(body.starts_on ?? body.startsOn ?? ''),
        endsOn: String(body.ends_on ?? body.endsOn ?? ''),
        isCurrent: body.is_current === true || body.isCurrent === true,
      });
      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.status(201).json(result.session);
    }),
  );

  router.get(
    '/:tenantId/students',
    asyncHandler(async (req, res) => {
      const result = await service.listStudents(req.params.tenantId, {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        classLabel:
          typeof req.query.class === 'string'
            ? req.query.class
            : typeof req.query.class_label === 'string'
              ? req.query.class_label
              : undefined,
        section: typeof req.query.section === 'string' ? req.query.section : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      res.json(result);
    }),
  );

  router.post(
    '/:tenantId/students',
    asyncHandler(async (req, res) => {
      const aadhaarErr = service.rejectFullAadhaar(req.body);
      if (aadhaarErr) {
        res.status(aadhaarErr.status).json({ error: aadhaarErr.error });
        return;
      }
      const result = await service.createStudent(
        req.params.tenantId,
        pickStudentBody(req.body as Record<string, unknown>),
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.student);
    }),
  );

  router.get(
    '/:tenantId/students/:id',
    asyncHandler(async (req, res) => {
      const student = await service.getStudent(req.params.tenantId, req.params.id);
      if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      res.json(student);
    }),
  );

  router.patch(
    '/:tenantId/students/:id',
    asyncHandler(async (req, res) => {
      const aadhaarErr = service.rejectFullAadhaar(req.body);
      if (aadhaarErr) {
        res.status(aadhaarErr.status).json({ error: aadhaarErr.error });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const patch: PatchStudentInput = {};
      if ('admission_number' in body || 'admissionNumber' in body) {
        patch.admissionNumber = String(body.admission_number ?? body.admissionNumber ?? '');
      }
      const base = pickStudentBody({ ...body, admission_number: 'x' });
      if ('first_name' in body || 'firstName' in body) patch.firstName = base.firstName;
      if ('last_name' in body || 'lastName' in body) patch.lastName = base.lastName;
      if ('dob' in body) patch.dob = base.dob;
      if ('gender' in body) patch.gender = base.gender;
      if ('admission_date' in body || 'admissionDate' in body) patch.admissionDate = base.admissionDate;
      if ('status' in body) patch.status = base.status;
      if ('category' in body) patch.category = base.category;
      if ('state_category_code' in body || 'stateCategoryCode' in body) {
        patch.stateCategoryCode = base.stateCategoryCode;
      }
      if ('state_student_id' in body || 'stateStudentId' in body) {
        patch.stateStudentId = base.stateStudentId;
      }
      if ('mother_name' in body || 'motherName' in body) patch.motherName = base.motherName;
      if ('father_name' in body || 'fatherName' in body) patch.fatherName = base.fatherName;
      if ('guardian_contact' in body || 'guardianContact' in body) {
        patch.guardianContact = base.guardianContact;
      }
      if ('aadhaar_last4' in body || 'aadhaarLast4' in body) patch.aadhaarLast4 = base.aadhaarLast4;
      if ('apaar_id' in body || 'apaarId' in body) patch.apaarId = base.apaarId;
      if ('pen_id' in body || 'penId' in body) patch.penId = base.penId;
      if ('udise_export_ok' in body || 'udiseExportOk' in body) {
        patch.udiseExportOk = base.udiseExportOk;
      }
      if ('is_cwsn' in body || 'isCwsn' in body) patch.isCwsn = base.isCwsn;
      if ('cwsn_category' in body || 'cwsnCategory' in body) patch.cwsnCategory = base.cwsnCategory;
      if ('cwsn_disability' in body || 'cwsnDisability' in body) {
        patch.cwsnDisability = base.cwsnDisability;
      }
      if ('cwsn_certificate' in body || 'cwsnCertificate' in body) {
        patch.cwsnCertificate = base.cwsnCertificate;
      }
      if ('is_rte' in body || 'isRte' in body) patch.isRte = base.isRte;
      if ('photo_ref' in body || 'photoRef' in body) patch.photoRef = base.photoRef;

      const result = await service.patchStudent(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.student);
    }),
  );

  router.post(
    '/:tenantId/students/:id/enrol',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.enrolStudent(req.params.tenantId, req.params.id, {
        academicSessionId: String(body.academic_session_id ?? body.academicSessionId ?? ''),
        classLabel: String(body.class_label ?? body.classLabel ?? ''),
        section: String(body.section ?? ''),
        rollNumber: String(body.roll_number ?? body.rollNumber ?? ''),
        house:
          body.house != null ? String(body.house) : null,
        enrolledOn:
          body.enrolled_on != null || body.enrolledOn != null
            ? String(body.enrolled_on ?? body.enrolledOn)
            : undefined,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.enrolment);
    }),
  );

  router.post(
    '/:tenantId/students/:id/exit',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.exitStudent(req.params.tenantId, req.params.id, {
        exitedOn: String(body.exited_on ?? body.exitedOn ?? ''),
        exitReason: String(body.exit_reason ?? body.exitReason ?? ''),
        newStatus: String(body.new_status ?? body.newStatus ?? '') as StudentStatus,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.student);
    }),
  );

  router.get(
    '/:tenantId/guardians',
    asyncHandler(async (req, res) => {
      const guardians = await service.listGuardians(req.params.tenantId);
      res.json({ guardians });
    }),
  );

  router.post(
    '/:tenantId/guardians',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.createGuardian(req.params.tenantId, {
        firstName: String(body.first_name ?? body.firstName ?? ''),
        lastName: String(body.last_name ?? body.lastName ?? ''),
        relation: String(body.relation ?? '') as GuardianRelation,
        phone: String(body.phone ?? ''),
        email:
          body.email != null ? String(body.email) : null,
        preferredLanguage:
          body.preferred_language != null || body.preferredLanguage != null
            ? String(body.preferred_language ?? body.preferredLanguage)
            : 'en',
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.guardian);
    }),
  );

  router.get(
    '/:tenantId/guardians/:id/students',
    asyncHandler(async (req, res) => {
      const gate = enforceGuardianPrincipal(req, internalSecret, {
        mustMatchGuardianId: req.params.id,
      });
      if ('error' in gate) {
        res.status(gate.status).json({ error: gate.error });
        return;
      }
      const result = await service.listStudentsForGuardian(
        req.params.tenantId,
        req.params.id,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ students: result.students });
    }),
  );

  router.get(
    '/:tenantId/guardians/:id',
    asyncHandler(async (req, res) => {
      const guardian = await service.getGuardian(req.params.tenantId, req.params.id);
      if (!guardian) {
        res.status(404).json({ error: 'Guardian not found' });
        return;
      }
      res.json(guardian);
    }),
  );

  router.patch(
    '/:tenantId/guardians/:id',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const patch: {
        firstName?: string;
        lastName?: string;
        relation?: GuardianRelation;
        phone?: string;
        email?: string | null;
        preferredLanguage?: string;
      } = {};
      if ('first_name' in body || 'firstName' in body) {
        patch.firstName = String(body.first_name ?? body.firstName ?? '');
      }
      if ('last_name' in body || 'lastName' in body) {
        patch.lastName = String(body.last_name ?? body.lastName ?? '');
      }
      if ('relation' in body) patch.relation = String(body.relation) as GuardianRelation;
      if ('phone' in body) patch.phone = String(body.phone ?? '');
      if ('email' in body) patch.email = body.email == null ? null : String(body.email);
      if ('preferred_language' in body || 'preferredLanguage' in body) {
        patch.preferredLanguage = String(body.preferred_language ?? body.preferredLanguage ?? '');
      }
      const result = await service.patchGuardian(req.params.tenantId, req.params.id, patch);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result.guardian);
    }),
  );

  router.get(
    '/:tenantId/students/:id/guardians',
    asyncHandler(async (req, res) => {
      const result = await service.listGuardiansForStudent(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ guardians: result.guardians });
    }),
  );

  router.post(
    '/:tenantId/students/:id/guardians',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.linkGuardian(req.params.tenantId, req.params.id, {
        guardianId: String(body.guardian_id ?? body.guardianId ?? ''),
        isPrimary: body.is_primary === true || body.isPrimary === true,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.link);
    }),
  );

  router.delete(
    '/:tenantId/students/:id/guardians/:guardianId',
    asyncHandler(async (req, res) => {
      const result = await service.unlinkGuardian(
        req.params.tenantId,
        req.params.id,
        req.params.guardianId,
      );
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(204).send();
    }),
  );

  router.get(
    '/:tenantId/consents/summary',
    asyncHandler(async (req, res) => {
      const summary = await service.consentSummary(req.params.tenantId);
      res.json({ summary });
    }),
  );

  router.get(
    '/:tenantId/udise/preflight',
    asyncHandler(async (req, res) => {
      const sessionId =
        typeof req.query.session_id === 'string'
          ? req.query.session_id
          : typeof req.query.sessionId === 'string'
            ? req.query.sessionId
            : '';
      const result = await service.udisePreflight(req.params.tenantId, sessionId, {
        limit: req.query.limit ? Number(req.query.limit) : 50,
        offset: req.query.offset ? Number(req.query.offset) : 0,
      });
      if ('error' in result) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json(result);
    }),
  );

  router.get(
    '/:tenantId/students/:id/consents',
    asyncHandler(async (req, res) => {
      const result = await service.listStudentConsents(req.params.tenantId, req.params.id);
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.json({ consents: result.consents });
    }),
  );

  router.post(
    '/:tenantId/students/:id/consents',
    asyncHandler(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const result = await service.transitionConsent(req.params.tenantId, req.params.id, {
        kind: String(body.kind ?? '') as ConsentKind,
        state: String(body.state ?? '') as ConsentState,
        grantedByGuardianId:
          body.granted_by_guardian_id != null || body.grantedByGuardianId != null
            ? String(body.granted_by_guardian_id ?? body.grantedByGuardianId)
            : null,
        artefactRef:
          body.artefact_ref != null || body.artefactRef != null
            ? String(body.artefact_ref ?? body.artefactRef)
            : null,
        verificationMethod:
          body.verification_method != null || body.verificationMethod != null
            ? (String(body.verification_method ?? body.verificationMethod) as ConsentVerificationMethod)
            : null,
        notedBy: String(body.noted_by ?? body.notedBy ?? ''),
        reason: body.reason != null ? String(body.reason) : null,
      });
      if (result.error) {
        res.status(result.error.status).json({ error: result.error.error });
        return;
      }
      res.status(201).json(result.consent);
    }),
  );

  return router;
}
