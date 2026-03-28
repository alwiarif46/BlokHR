import { Router, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { AppConfig } from '../config';
import { AppError, asyncHandler } from '../app';
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
import type { LlmClient } from '../services/llm';

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
): Router {
  const router = Router();

  // Build handler map (always available — tools work even without LLM)
  const handlers = buildHandlerMap(db, logger);

  // Build LLM client: override (tests) → anthropic → ollama → null
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

  // Agent service — only if LLM is configured (tool execution still works without it)
  const agentService = llmClient
    ? new AgentService(db, llmClient, handlers, logger)
    : null;

  /**
   * POST /api/chat — conversational AI agent
   * Body: { email?, message, sessionId?, isAdmin? }
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

      const body = req.body as Record<string, unknown>;
      const email = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      const message = ((body.message as string) ?? '').trim();
      const sessionId = (body.sessionId as string) || undefined;
      const isAdmin = body.isAdmin === true;

      if (!email) throw new AppError('email is required', 400);
      if (!message) throw new AppError('message is required', 400);

      const result = await agentService.chat(email, message, sessionId, isAdmin);
      res.json(result);
    }),
  );

  /**
   * POST /api/chat/tool — direct tool execution (no LLM needed)
   * Body: { email?, toolName, params?, isAdmin? }
   */
  router.post(
    '/chat/tool',
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body as Record<string, unknown>;
      const email = req.identity?.email ?? ((body.email as string) ?? '').toLowerCase().trim();
      const toolName = (body.toolName as string) ?? '';
      const params = (body.params as Record<string, unknown>) ?? {};
      const isAdmin = body.isAdmin === true;

      if (!email) throw new AppError('email is required', 400);
      if (!toolName) throw new AppError('toolName is required', 400);

      const handler = handlers.get(toolName);
      if (!handler) throw new AppError(`Unknown tool: ${toolName}`, 400);

      // Check scope
      const toolDef = ALL_TOOLS.find(t => t.name === toolName);
      if (toolDef?.scope === 'admin' && !isAdmin) {
        throw new AppError(`Tool "${toolName}" requires admin privileges`, 403);
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

      // If the provider sends a tool call, we can execute it even without LLM
      if (request.toolName) {
        const handler = handlers.get(request.toolName);
        if (!handler) throw new AppError(`Unknown tool: ${request.toolName}`, 400);
        const toolDef = ALL_TOOLS.find(t => t.name === request.toolName);
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

      // If message, need agent service
      if (!agentService) {
        throw new AppError('AI Chat is not configured. External providers can still use toolName for direct tool execution.', 503);
      }

      const response = await handleExternalRequest(request, agentService, logger);
      res.json({ provider, ...response });
    }),
  );

  /**
   * GET /api/chat/tools — list available tools
   * Query: isAdmin=true for admin tools
   */
  router.get(
    '/chat/tools',
    asyncHandler(async (req: Request, res: Response) => {
      const isAdmin = req.query.isAdmin === 'true';
      const tools = isAdmin ? ALL_TOOLS : EMPLOYEE_TOOLS;
      const adminOnly = ADMIN_TOOLS.length;
      res.json({
        total: tools.length,
        employeeTools: EMPLOYEE_TOOLS.length,
        adminTools: adminOnly,
        tools: tools.map(t => ({
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
        providers: SUPPORTED_PROVIDERS.map(p => ({
          id: p,
          webhookEndpoint: `/api/chat/external/${p}`,
        })),
      });
    }),
  );

  /**
   * GET /api/chat/sessions — list user's sessions
   */
  router.get(
    '/chat/sessions',
    asyncHandler(async (req: Request, res: Response) => {
      if (!agentService) throw new AppError('AI Chat not configured', 503);
      const email = req.identity?.email ?? ((req.query.email as string) ?? '').toLowerCase().trim();
      if (!email) throw new AppError('email is required', 400);
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
      const detail = await agentService.getSessionDetail(req.params.id);
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
      const deleted = await agentService.deleteSession(req.params.id);
      if (!deleted) throw new AppError('Session not found', 404);
      res.json({ success: true });
    }),
  );

  return router;
}
