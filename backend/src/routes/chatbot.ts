import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import { getTenantId } from '../tenant/context';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
import { FeatureFlagService } from '../services/feature-flags';
import {
  AgentService,
  AnthropicLlmClient,
  OllamaLlmClient,
  buildHandlerMap,
  PROVIDER_PARSERS,
  SUPPORTED_PROVIDERS,
  handleExternalRequest,
  ALL_TOOLS,
  EMPLOYEE_TOOLS,
  ADMIN_TOOLS,
} from '../services/llm';
import type { LlmClient, ToolSchema } from '../services/llm';

/**
 * AI Agent routes:
 *   POST   /api/chat                      — send message to AI agent
 *   POST   /api/chat/tool                 — execute a tool directly (no LLM)
 *   POST   /api/chat/external/:provider   — webhook for external AI providers
 *   GET    /api/chat/tools                — list available tools
 *   GET    /api/chat/providers            — list supported external providers
 *   GET    /api/chat/sessions             — list user's sessions
 *   GET    /api/chat/sessions/:id         — get session with messages
 *   DELETE /api/chat/sessions/:id         — delete a session
 */
export function createChatbotRouter(
  db: DatabaseEngine,
  config: AppConfig,
  logger: Logger,
  llmOverride?: LlmClient,
  featureFlags?: FeatureFlagService,
): Router {
  const router = Router();

  const handlers = buildHandlerMap(db, logger);

  let llmClient: LlmClient | null;
  if (llmOverride) {
    llmClient = llmOverride;
  } else if (config.llmProvider === 'anthropic' && config.llmApiKey) {
    llmClient = new AnthropicLlmClient(
      config.llmApiKey,
      config.llmModel ?? 'claude-sonnet-4-20250514',
      logger,
      config.llmBaseUrl,
    );
  } else if (config.llmProvider === 'ollama') {
    llmClient = new OllamaLlmClient(
      config.llmModel ?? 'llama3',
      logger,
      config.llmBaseUrl,
      config.llmApiKey,
    );
  } else {
    llmClient = null;
  }

  const filterTools = (tools: ToolSchema[]): ToolSchema[] => {
    if (!featureFlags) return tools;
    return featureFlags.filterTools(tools);
  };

  const agentService = llmClient
    ? new AgentService(db, llmClient, handlers, logger, filterTools)
    : null;

  async function requireAuth(req: Request): Promise<string> {
    const email = (req.identity?.email ?? '').toLowerCase().trim();
    if (!email) throw new AppError('Authentication required', 401);
    return email;
  }

  async function resolveIsAdmin(email: string): Promise<boolean> {
    const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE tenant_id = ? AND email = ?', [
      getTenantId(), email,
    ]);
    return !!row;
  }

  /**
   * POST /api/chat — conversational AI agent
   * Body: { message, sessionId? }
   */
  router.post(
    '/chat',
    asyncHandler(async (req: Request, res: Response) => {
      if (!agentService) {
        throw new AppError(
          'AI Chat is not configured. Set LLM_PROVIDER and LLM_API_KEY. You can still use POST /api/chat/tool for direct tool execution.',
          503,
        );
      }

      const email = await requireAuth(req);
      const body = req.body as Record<string, unknown>;
      const message = ((body.message as string) ?? '').trim();
      const sessionId = (body.sessionId as string) || undefined;
      const isAdmin = await resolveIsAdmin(email);

      if (!message) throw new AppError('message is required', 400);

      const result = await agentService.chat(email, message, sessionId, isAdmin);
      res.json(result);
    }),
  );

  /**
   * POST /api/chat/tool — direct tool execution (no LLM needed)
   * Body: { toolName, params? }
   */
  router.post(
    '/chat/tool',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const body = req.body as Record<string, unknown>;
      const toolName = (body.toolName as string) ?? '';
      const params = (body.params as Record<string, unknown>) ?? {};
      const isAdmin = await resolveIsAdmin(email);

      if (!toolName) throw new AppError('toolName is required', 400);

      const handler = handlers.get(toolName);
      if (!handler) throw new AppError(`Unknown tool: ${toolName}`, 400);

      const toolDef = ALL_TOOLS.find((t) => t.name === toolName);
      if (toolDef?.scope === 'admin' && !isAdmin) {
        throw new AppError(`Tool "${toolName}" requires admin privileges`, 403);
      }

      const allowed = filterTools(isAdmin ? ALL_TOOLS : EMPLOYEE_TOOLS);
      if (!allowed.find((t) => t.name === toolName)) {
        throw new AppError(`Tool "${toolName}" is not available`, 403);
      }

      try {
        const result = await handler(params, email);
        res.json({ success: true, tool: toolName, result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(`Tool execution failed: ${msg}`, 500);
      }
    }),
  );

  /**
   * POST /api/chat/external/:provider — webhook for external AI providers
   * Accepts payloads from Leena AI, Darwinbox, Phia, Rezolve.ai, Moveworks, Workativ, MS Copilot
   */
  router.post(
    '/chat/external/:provider',
    asyncHandler(async (req: Request, res: Response) => {
      const expected = (config.actionLinkSecret ?? '').trim();
      if (!expected) {
        throw new AppError('External chat webhook is not configured', 503);
      }
      const provided = String(
        req.headers['x-chat-webhook-secret'] ?? req.headers['x-blok-webhook-secret'] ?? '',
      );
      if (provided !== expected) {
        throw new AppError('Unauthorized', 401);
      }

      const provider = req.params.provider.toLowerCase();
      const parser = PROVIDER_PARSERS[provider];
      if (!parser) {
        throw new AppError(
          `Unsupported provider: ${provider}. Supported: ${SUPPORTED_PROVIDERS.join(', ')}`,
          400,
        );
      }

      const request = parser(req.body as Record<string, unknown>);

      if (!request.email) {
        throw new AppError('Could not determine employee email from the provider payload', 400);
      }

      if (request.toolName) {
        const handler = handlers.get(request.toolName);
        if (!handler) throw new AppError(`Unknown tool: ${request.toolName}`, 400);
        const toolDef = ALL_TOOLS.find((t) => t.name === request.toolName);
        if (toolDef?.scope === 'admin' && !request.isAdmin) {
          throw new AppError(`Tool "${request.toolName}" requires admin privileges`, 403);
        }
        try {
          const result = await handler(request.toolParams ?? {}, request.email);
          res.json({ provider, tool: request.toolName, result });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new AppError(`Tool execution failed: ${msg}`, 500);
        }
        return;
      }

      if (!agentService) {
        throw new AppError(
          'AI Chat is not configured. External providers can still use toolName for direct tool execution.',
          503,
        );
      }

      const response = await handleExternalRequest(request, agentService, logger);
      res.json({ provider, ...response });
    }),
  );

  /**
   * GET /api/chat/tools — list available tools for the authenticated user
   */
  router.get(
    '/chat/tools',
    asyncHandler(async (req: Request, res: Response) => {
      const email = await requireAuth(req);
      const isAdmin = await resolveIsAdmin(email);
      const base = isAdmin ? ALL_TOOLS : EMPLOYEE_TOOLS;
      const tools = filterTools(base);
      res.json({
        total: tools.length,
        employeeTools: filterTools(EMPLOYEE_TOOLS).length,
        adminTools: ADMIN_TOOLS.length,
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          scope: t.scope,
          category: t.category,
          parameters: t.parameters,
        })),
      });
    }),
  );

  /**
   * GET /api/chat/providers — list supported external providers
   */
  router.get(
    '/chat/providers',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        providers: SUPPORTED_PROVIDERS.map((p) => ({
          id: p,
          webhookEndpoint: `/api/chat/external/${p}`,
        })),
      });
    }),
  );

  /**
   * GET /api/chat/sessions — list caller's sessions
   */
  router.get(
    '/chat/sessions',
    asyncHandler(async (req: Request, res: Response) => {
      if (!agentService) throw new AppError('AI Chat not configured', 503);
      const email = await requireAuth(req);
      const sessions = await agentService.listSessions(email);
      res.json({ sessions });
    }),
  );

  /**
   * GET /api/chat/sessions/:id
   */
  router.get(
    '/chat/sessions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      if (!agentService) throw new AppError('AI Chat not configured', 503);
      const email = await requireAuth(req);
      const detail = await agentService.getSessionDetail(req.params.id, email);
      if (!detail) throw new AppError('Session not found', 404);
      res.json(detail);
    }),
  );

  /**
   * DELETE /api/chat/sessions/:id
   */
  router.delete(
    '/chat/sessions/:id',
    asyncHandler(async (req: Request, res: Response) => {
      if (!agentService) throw new AppError('AI Chat not configured', 503);
      const email = await requireAuth(req);
      const deleted = await agentService.deleteSession(req.params.id, email);
      if (!deleted) throw new AppError('Session not found', 404);
      res.json({ success: true });
    }),
  );

  return router;
}
