import { Router, Request, Response, NextFunction } from 'express';
import type { DirectoryService } from '../directory-service';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export interface DirectoryRouterOptions {
  tenantId?: string;
  /** When set, mutating routes require an admin identity header. */
  isAdmin?: (email: string) => Promise<boolean>;
}

function callerEmail(req: Request): string {
  const raw =
    (req.headers['x-user-email'] as string | undefined) ||
    (req as Request & { identity?: { email?: string } }).identity?.email ||
    '';
  return raw.toLowerCase().trim();
}

export function createDirectoryRouter(
  service: DirectoryService,
  options: DirectoryRouterOptions = {},
): Router {
  const router = Router();
  const tenantId = options.tenantId ?? 'default';

  async function requireAdmin(req: Request, res: Response): Promise<boolean> {
    if (!options.isAdmin) return true;
    const email = callerEmail(req);
    if (!email) {
      res.status(401).json({ error: 'Authentication required' });
      return false;
    }
    const ok = await options.isAdmin(email);
    if (!ok) {
      res.status(403).json({ error: 'Admin access required' });
      return false;
    }
    return true;
  }

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'directory' });
  });

  router.get(
    '/members',
    asyncHandler(async (req, res) => {
      const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
      const members = await service.listMembers(tenantId, { includeInactive });
      res.json({ members, count: members.length });
    }),
  );

  router.get(
    '/members/:id',
    asyncHandler(async (req, res) => {
      const member = await service.getMember(req.params.id, tenantId);
      if (!member) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }
      res.json({ member });
    }),
  );

  router.post(
    '/members',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;

      const body = req.body as Record<string, unknown>;
      const result = await service.createMember({
        tenantId,
        email: String(body.email ?? ''),
        name: String(body.name ?? ''),
        temporaryPassword:
          typeof body.temporaryPassword === 'string'
            ? body.temporaryPassword
            : typeof body.password === 'string'
              ? body.password
              : undefined,
        role: typeof body.role === 'string' ? body.role : undefined,
        groupId:
          body.groupId === null
            ? null
            : typeof body.groupId === 'string'
              ? body.groupId
              : undefined,
        designation: typeof body.designation === 'string' ? body.designation : undefined,
        phone: typeof body.phone === 'string' ? body.phone : undefined,
        timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
        individualShiftStart:
          typeof body.individualShiftStart === 'string' ? body.individualShiftStart : undefined,
        individualShiftEnd:
          typeof body.individualShiftEnd === 'string' ? body.individualShiftEnd : undefined,
        skipSeatCheck: body.skipSeatCheck === true,
        skipCredentials: body.skipCredentials === true,
      });

      if (!result.success) {
        res.status(result.status ?? 400).json({ error: result.error });
        return;
      }
      res.status(201).json({ success: true, member: result.member });
    }),
  );

  router.patch(
    '/members/:id',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const body = req.body as Record<string, unknown>;
      const result = await service.updateMember(
        req.params.id,
        {
          name: typeof body.name === 'string' ? body.name : undefined,
          role: typeof body.role === 'string' ? body.role : undefined,
          groupId:
            body.groupId === undefined
              ? undefined
              : body.groupId === null
                ? null
                : String(body.groupId),
          designation: typeof body.designation === 'string' ? body.designation : undefined,
          phone: typeof body.phone === 'string' ? body.phone : undefined,
          timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
          individualShiftStart:
            body.individualShiftStart === undefined
              ? undefined
              : body.individualShiftStart === null
                ? null
                : String(body.individualShiftStart),
          individualShiftEnd:
            body.individualShiftEnd === undefined
              ? undefined
              : body.individualShiftEnd === null
                ? null
                : String(body.individualShiftEnd),
          active: typeof body.active === 'boolean' ? body.active : undefined,
        },
        tenantId,
      );
      if (!result.success) {
        res.status(result.status ?? 400).json({ error: result.error });
        return;
      }
      res.json({ success: true, member: result.member });
    }),
  );

  router.delete(
    '/members/:id',
    asyncHandler(async (req, res) => {
      if (!(await requireAdmin(req, res))) return;
      const result = await service.deactivateMember(req.params.id, tenantId);
      if (!result.success) {
        res.status(result.status ?? 400).json({ error: result.error });
        return;
      }
      res.json({ success: true });
    }),
  );

  return router;
}
