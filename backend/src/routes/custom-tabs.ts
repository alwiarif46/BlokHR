import { Router, type Request, type Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import type { SseBroadcaster } from '../sse/broadcaster';

interface TabRow {
  [key: string]: unknown;
  id: string;
  label: string;
  src: string;
  icon: string;
  enabled: number;
  sort_order: number;
}

export function createCustomTabsRouter(
  db: DatabaseEngine,
  logger: Logger,
  broadcaster?: SseBroadcaster,
): Router {
  const router = Router();

  async function requireAdmin(email: string): Promise<void> {
    const row = await db.get('SELECT email FROM admins WHERE email = ?', [email]);
    if (!row) throw new AppError('Admin access required', 403);
  }

  async function requireTab(id: string): Promise<TabRow> {
    const row = await db.get<TabRow>('SELECT * FROM custom_tabs WHERE id = ?', [id]);
    if (!row) throw new AppError('Tab not found', 404);
    return row;
  }

  /** GET /api/custom-tabs — list all tabs with visibility groups. */
  router.get(
    '/custom-tabs',
    asyncHandler(async (_req: Request, res: Response) => {
      const tabs = await db.all<TabRow>(
        'SELECT id, label, src, icon, enabled, sort_order FROM custom_tabs ORDER BY sort_order, label',
      );
      const vis = await db.all<{ tab_id: string; group_id: string }>(
        'SELECT tab_id, group_id FROM custom_tab_visibility',
      );
      const visMap = new Map<string, string[]>();
      for (const v of vis) {
        if (!visMap.has(v.tab_id)) visMap.set(v.tab_id, []);
        visMap.get(v.tab_id)!.push(v.group_id);
      }
      res.json({
        tabs: tabs.map((t) => ({
          ...t,
          enabled: t.enabled === 1,
          visibility: visMap.get(t.id) ?? [],
        })),
      });
    }),
  );

  /** POST /api/custom-tabs — create a tab. */
  router.post(
    '/custom-tabs',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const b = req.body as Record<string, unknown>;
      const label = ((b.label as string) ?? '').trim();
      if (!label || label.length > 30)
        throw new AppError('label is required and must be 1–30 characters', 400);

      const src = ((b.src as string) ?? '').trim();
      const icon = ((b.icon as string) ?? '').trim();
      const enabled = b.enabled !== undefined ? (b.enabled ? 1 : 0) : 1;
      const sort_order = b.sort_order !== undefined ? Number(b.sort_order) : 0;
      const visibility = Array.isArray(b.visibility) ? (b.visibility as string[]) : [];

      const result = await db.run(
        'INSERT INTO custom_tabs (label, src, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?)',
        [label, src, icon, enabled, sort_order],
      );
      const newId = await db.get<{ id: string }>(
        'SELECT id FROM custom_tabs ORDER BY rowid DESC LIMIT 1',
      );
      if (newId && visibility.length > 0) {
        for (const gid of visibility) {
          await db.run(
            'INSERT OR IGNORE INTO custom_tab_visibility (tab_id, group_id) VALUES (?, ?)',
            [newId.id, gid],
          );
        }
      }

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'custom_tabs' });
      logger.info({ label, by: callerEmail }, 'Custom tab created');
      void result;
      res.status(201).json({ success: true, id: newId?.id });
    }),
  );

  /** PUT /api/custom-tabs/reorder — bulk reorder by tab ID array. Must be before /:id. */
  router.put(
    '/custom-tabs/reorder',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);

      const b = req.body as Record<string, unknown>;
      const tabIds = b.tabIds as string[] | undefined;
      if (!Array.isArray(tabIds) || tabIds.length === 0)
        throw new AppError('tabIds array is required', 400);

      for (let i = 0; i < tabIds.length; i++) {
        await db.run(
          "UPDATE custom_tabs SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
          [i, tabIds[i]],
        );
      }

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'custom_tabs' });
      res.json({ success: true });
    }),
  );

  /** PUT /api/custom-tabs/:id — update a tab. */
  router.put(
    '/custom-tabs/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);
      await requireTab(req.params.id);

      const b = req.body as Record<string, unknown>;
      const sets: string[] = [];
      const params: unknown[] = [];

      if (b.label !== undefined) {
        const l = ((b.label as string) ?? '').trim();
        if (!l || l.length > 30) throw new AppError('label must be 1–30 characters', 400);
        sets.push('label = ?');
        params.push(l);
      }
      if (b.src !== undefined) {
        sets.push('src = ?');
        params.push(((b.src as string) ?? '').trim());
      }
      if (b.icon !== undefined) {
        sets.push('icon = ?');
        params.push(((b.icon as string) ?? '').trim());
      }
      if (b.enabled !== undefined) {
        sets.push('enabled = ?');
        params.push(b.enabled ? 1 : 0);
      }
      if (b.sort_order !== undefined) {
        sets.push('sort_order = ?');
        params.push(Number(b.sort_order));
      }

      if (sets.length > 0) {
        sets.push("updated_at = datetime('now')");
        params.push(req.params.id);
        await db.run(`UPDATE custom_tabs SET ${sets.join(', ')} WHERE id = ?`, params);
      }

      // Replace visibility if provided
      if (Array.isArray(b.visibility)) {
        const visibility = b.visibility as string[];
        await db.run('DELETE FROM custom_tab_visibility WHERE tab_id = ?', [req.params.id]);
        for (const gid of visibility) {
          await db.run(
            'INSERT OR IGNORE INTO custom_tab_visibility (tab_id, group_id) VALUES (?, ?)',
            [req.params.id, gid],
          );
        }
      }

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'custom_tabs' });
      res.json({ success: true });
    }),
  );

  /** DELETE /api/custom-tabs/:id — delete a tab (cascades visibility). */
  router.delete(
    '/custom-tabs/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const callerEmail = req.identity?.email ?? '';
      if (!callerEmail) throw new AppError('Authentication required', 401);
      await requireAdmin(callerEmail);
      await requireTab(req.params.id);

      await db.run('DELETE FROM custom_tab_visibility WHERE tab_id = ?', [req.params.id]);
      await db.run('DELETE FROM custom_tabs WHERE id = ?', [req.params.id]);

      if (broadcaster) broadcaster.broadcast('settings-update', { source: 'custom_tabs' });
      logger.info({ id: req.params.id, by: callerEmail }, 'Custom tab deleted');
      res.json({ success: true });
    }),
  );

  return router;
}
