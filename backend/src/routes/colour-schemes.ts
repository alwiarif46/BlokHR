import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import type { SseBroadcaster } from '../sse/broadcaster';

interface ColourSchemeRow {
  [key: string]: unknown;
  id: string;
  name: string;
  accent: string;
  status_in: string;
  status_break: string;
  status_absent: string;
  bg0: string;
  tx: string;
  is_default: number;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function validateHex(val: unknown, field: string): string {
  if (typeof val !== 'string' || !HEX_RE.test(val)) {
    throw new AppError(`${field} must be a 6-digit hex colour (e.g. #aabbcc)`, 400);
  }
  return val;
}

export function createColourSchemesRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();

  async function requireAdmin(email: string): Promise<void> {
    const row = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
    if (!row) throw new AppError('Admin access required', 403);
  }

  /** GET /api/colour-schemes — list all presets. */
  router.get(
    '/colour-schemes',
    asyncHandler(async (_req: Request, res: Response) => {
      const rows = await db.all<ColourSchemeRow>(
        'SELECT id, name, accent, status_in, status_break, status_absent, bg0, tx, is_default FROM colour_scheme_presets ORDER BY name',
      );
      res.json({ schemes: rows.map((r) => ({ ...r, is_default: r.is_default === 1 })) });
    }),
  );

  /** POST /api/colour-schemes — create a preset (max 3). */
  router.post(
    '/colour-schemes',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const count = await db.get<{ n: number }>('SELECT COUNT(*) as n FROM colour_scheme_presets');
      if ((count?.n ?? 0) >= 3) throw new AppError('Maximum of 3 colour schemes allowed', 400);

      const b = req.body as Record<string, unknown>;
      const name = ((b.name as string) ?? '').trim();
      if (!name) throw new AppError('name is required', 400);

      const accent = validateHex(b.accent, 'accent');
      const status_in = validateHex(b.status_in, 'status_in');
      const status_break = validateHex(b.status_break, 'status_break');
      const status_absent = validateHex(b.status_absent, 'status_absent');
      const bg0 = validateHex(b.bg0, 'bg0');
      const tx = validateHex(b.tx, 'tx');

      await db.run(
        'INSERT INTO colour_scheme_presets (name, accent, status_in, status_break, status_absent, bg0, tx) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, accent, status_in, status_break, status_absent, bg0, tx],
      );

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'colour_schemes' });
      logger.info({ name, by: callerEmail }, 'Colour scheme created');
      res.status(201).json({ success: true });
    }),
  );

  /** PUT /api/colour-schemes/:id — update name and colours. */
  router.put(
    '/colour-schemes/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const existing = await db.get<ColourSchemeRow>(
        'SELECT * FROM colour_scheme_presets WHERE id = ?',
        [req.params.id],
      );
      if (!existing) throw new AppError('Colour scheme not found', 404);

      const b = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      if (b.name !== undefined) {
        const n = ((b.name as string) ?? '').trim();
        if (!n) throw new AppError('name cannot be empty', 400);
        sets.push('name = ?');
        params.push(n);
      }
      const colourFields: Array<[string, string]> = [
        ['accent', 'accent'],
        ['status_in', 'status_in'],
        ['status_break', 'status_break'],
        ['status_absent', 'status_absent'],
        ['bg0', 'bg0'],
        ['tx', 'tx'],
      ];
      for (const [col, label] of colourFields) {
        if (b[col] !== undefined) {
          sets.push(`${col} = ?`);
          params.push(validateHex(b[col], label));
        }
      }
      if (sets.length === 0) throw new AppError('No fields to update', 400);

      sets.push("updated_at = datetime('now')");
      params.push(req.params.id);
      await db.run(`UPDATE colour_scheme_presets SET ${sets.join(', ')} WHERE id = ?`, params);

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'colour_schemes' });
      res.json({ success: true });
    }),
  );

  /** DELETE /api/colour-schemes/:id — delete (blocked if is_default). */
  router.delete(
    '/colour-schemes/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const row = await db.get<ColourSchemeRow>(
        'SELECT id, is_default FROM colour_scheme_presets WHERE id = ?',
        [req.params.id],
      );
      if (!row) throw new AppError('Colour scheme not found', 404);
      if (row.is_default === 1) throw new AppError('Cannot delete the default colour scheme', 400);

      await db.run('DELETE FROM colour_scheme_presets WHERE id = ?', [req.params.id]);
      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'colour_schemes' });
      logger.info({ id: req.params.id, by: callerEmail }, 'Colour scheme deleted');
      res.json({ success: true });
    }),
  );

  /** PUT /api/colour-schemes/:id/set-default — atomically swap default flag. */
  router.put(
    '/colour-schemes/:id/set-default',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const row = await db.get('SELECT id FROM colour_scheme_presets WHERE id = ?', [
        req.params.id,
      ]);
      if (!row) throw new AppError('Colour scheme not found', 404);

      await db.run('UPDATE colour_scheme_presets SET is_default = 0');
      await db.run(
        "UPDATE colour_scheme_presets SET is_default = 1, updated_at = datetime('now') WHERE id = ?",
        [req.params.id],
      );

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'colour_schemes' });
      logger.info({ id: req.params.id, by: callerEmail }, 'Default colour scheme changed');
      res.json({ success: true });
    }),
  );

  return router;
}
