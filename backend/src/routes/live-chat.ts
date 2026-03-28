import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { AppError, asyncHandler } from '../app';
import { LiveChatRepository } from '../repositories/live-chat-repository';
import { LiveChatService } from '../services/live-chat-service';
import type { SseBroadcaster } from '../sse/broadcaster';

/**
 * Live Chat routes:
 *   GET    /api/channels                    — list channels for user
 *   POST   /api/channels                    — create a channel
 *   GET    /api/channels/:id                — get channel detail
 *   PUT    /api/channels/:id                — update a channel
 *   POST   /api/channels/:id/archive        — archive a channel
 *   GET    /api/channels/:id/members        — list channel members
 *   POST   /api/channels/:id/join           — join a channel
 *   POST   /api/channels/:id/leave          — leave a channel
 *   GET    /api/channels/:id/messages       — get channel messages
 *   POST   /api/channels/:id/messages       — post a message
 *   GET    /api/channels/:id/pinned         — get pinned messages
 *   GET    /api/channels/:id/unread         — get unread count
 *   PUT    /api/messages/:id                — edit a message
 *   DELETE /api/messages/:id                — delete a message
 *   POST   /api/messages/:id/pin            — pin/unpin a message
 *   POST   /api/messages/:id/read           — mark a message read
 *   POST   /api/dm                          — send a direct message
 *   GET    /api/dm/:email                   — get DM conversation
 *   GET    /api/dm/contacts                 — list DM contacts
 *   POST   /api/dm/:email/read              — mark DMs from user as read
 *   GET    /api/dm/unread                   — total unread DM count
 */
export function createLiveChatRouter(
  db: DatabaseEngine,
  broadcaster: SseBroadcaster | null,
  logger: Logger,
): Router {
  const router = Router();
  const repo = new LiveChatRepository(db);
  const service = new LiveChatService(repo, db, broadcaster, logger);

  // ── Channels ──

  router.get(
    '/channels',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      const channels = await service.getChannels(email || '');
      res.json({ channels });
    }),
  );

  router.post(
    '/channels',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const name = (body.name as string) ?? '';
      const createdBy = req.identity?.email ?? ((body.createdBy as string) ?? '').toLowerCase().trim();
      if (!name) throw new AppError('name is required', 400);
      if (!createdBy) throw new AppError('createdBy is required', 400);

      const channel = await service.createChannel({
        name,
        type: (body.type as string) || 'custom',
        description: (body.description as string) || '',
        groupId: (body.groupId as string) || '',
        createdBy,
      });
      res.status(201).json(channel);
    }),
  );

  router.get(
    '/channels/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const channel = await service.getChannelById(req.params.id);
      if (!channel) throw new AppError('Channel not found', 404);
      res.json(channel);
    }),
  );

  router.put(
    '/channels/:id',
    asyncHandler(async (req: Request, res: Response) => {
      await service.updateChannel(req.params.id, req.body as Record<string, unknown>);
      res.json({ success: true });
    }),
  );

  router.post(
    '/channels/:id/archive',
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.archiveChannel(req.params.id);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.get(
    '/channels/:id/members',
    asyncHandler(async (req: Request, res: Response) => {
      const members = await service.getMembers(req.params.id);
      res.json({ members });
    }),
  );

  router.post(
    '/channels/:id/join',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const result = await service.joinChannel(req.params.id, email);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/channels/:id/leave',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const result = await service.leaveChannel(req.params.id, email);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  // ── Channel Messages ──

  router.get(
    '/channels/:id/messages',
    asyncHandler(async (req: Request, res: Response) => {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = (req.query.before as string) || undefined;
      const messages = await service.getMessages(req.params.id, limit, before);
      res.json({ messages });
    }),
  );

  router.post(
    '/channels/:id/messages',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const senderEmail = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      const content = (body.content as string) ?? '';
      if (!senderEmail) throw new AppError('email is required', 400);
      if (!content.trim()) throw new AppError('content is required', 400);

      const result = await service.postMessage({
        channelId: req.params.id,
        senderEmail,
        content,
        messageType: (body.messageType as string) || 'message',
      });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json(result.message);
    }),
  );

  router.get(
    '/channels/:id/pinned',
    asyncHandler(async (req: Request, res: Response) => {
      const messages = await service.getPinnedMessages(req.params.id);
      res.json({ messages });
    }),
  );

  router.get(
    '/channels/:id/unread',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const count = await service.getUnreadCount(req.params.id, email);
      res.json({ unread: count });
    }),
  );

  // ── Message operations ──

  router.put(
    '/messages/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      const content = ((req.body as { content?: string }).content ?? '').trim();
      if (!email) throw new AppError('email is required', 400);
      if (!content) throw new AppError('content is required', 400);
      const result = await service.editMessage(req.params.id, email, content);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.delete(
    '/messages/:id',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const result = await service.deleteMessage(req.params.id, email);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/messages/:id/pin',
    asyncHandler(async (req: Request, res: Response) => {
      const pin = (req.body as { pin?: boolean }).pin !== false;
      const result = await service.pinMessage(req.params.id, pin);
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.json({ success: true });
    }),
  );

  router.post(
    '/messages/:id/read',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      await service.markRead(req.params.id, email);
      res.json({ success: true });
    }),
  );

  // ── Direct Messages ──

  router.get(
    '/dm/contacts',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const contacts = await service.getDmContacts(email);
      res.json({ contacts });
    }),
  );

  router.get(
    '/dm/unread',
    asyncHandler(async (req: Request, res: Response) => {
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
      const count = await service.getTotalUnreadDms(email);
      res.json({ unread: count });
    }),
  );

  router.post(
    '/dm',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const senderEmail = req.identity?.email ?? ((body.senderEmail as string) ?? '').toLowerCase().trim();
      const recipientEmail = ((body.recipientEmail as string) ?? '').toLowerCase().trim();
      const content = (body.content as string) ?? '';
      if (!senderEmail) throw new AppError('senderEmail is required', 400);
      if (!recipientEmail) throw new AppError('recipientEmail is required', 400);
      if (!content.trim()) throw new AppError('content is required', 400);

      const result = await service.sendDm({ senderEmail, recipientEmail, content });
      if (!result.success) throw new AppError(result.error ?? 'Failed', 400);
      res.status(201).json(result.dm);
    }),
  );

  router.get(
    '/dm/:email',
    asyncHandler(async (req: Request, res: Response) => {
      const myEmail = req.identity?.email ?? ((req.query.myEmail as string) ?? '').toLowerCase().trim();
      const otherEmail = req.params.email.toLowerCase().trim();
      if (!myEmail) throw new AppError('myEmail query param is required', 400);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const before = (req.query.before as string) || undefined;
      const messages = await service.getDmConversation(myEmail, otherEmail, limit, before);
      res.json({ messages });
    }),
  );

  router.post(
    '/dm/:email/read',
    asyncHandler(async (req: Request, res: Response) => {
      const myEmail = req.identity?.email ?? ((req.body as { email?: string }).email ?? '').toLowerCase().trim();
      const senderEmail = req.params.email.toLowerCase().trim();
      if (!myEmail) throw new AppError('email is required', 400);
      const marked = await service.markDmRead(senderEmail, myEmail);
      res.json({ success: true, markedRead: marked });
    }),
  );

  return router;
}
