import type { Logger } from 'pino';
import type { AgentService } from './agent-service';

// ── Provider config types ──

export interface ExternalProviderConfig {
  provider: string;
  enabled: boolean;
  webhookUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  metadata?: Record<string, string>;
}

/** Standardized inbound request from any external provider. */
export interface ExternalChatRequest {
  provider: string;
  userId: string;
  email: string;
  message?: string;
  toolName?: string;
  toolParams?: Record<string, unknown>;
  isAdmin?: boolean;
  sessionId?: string;
  rawPayload?: unknown;
}

/** Standardized outbound response to any external provider. */
export interface ExternalChatResponse {
  reply?: string;
  toolResult?: unknown;
  sessionId?: string;
  error?: string;
}

// ── Provider parsers ──

/**
 * Each provider has a parser that normalizes their webhook payload
 * into an ExternalChatRequest. The route handler calls the appropriate parser,
 * then routes to the agent service.
 */

/** Leena AI — sends JSON with user_email, query, intent (optional). */
export function parseLeenaAiPayload(body: Record<string, unknown>): ExternalChatRequest {
  return {
    provider: 'leena-ai',
    userId: (body.user_id as string) ?? '',
    email: ((body.user_email as string) ?? (body.email as string) ?? '').toLowerCase().trim(),
    message: (body.query as string) ?? (body.message as string) ?? '',
    toolName: (body.intent as string) ?? (body.tool as string) ?? undefined,
    toolParams: (body.params as Record<string, unknown>) ?? undefined,
    isAdmin: body.is_admin === true,
    sessionId: (body.session_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** Darwinbox Sense — sends JSON with employee_code, text, action_type. */
export function parseDarwinboxPayload(body: Record<string, unknown>): ExternalChatRequest {
  return {
    provider: 'darwinbox',
    userId: (body.employee_code as string) ?? '',
    email: ((body.email as string) ?? '').toLowerCase().trim(),
    message: (body.text as string) ?? (body.query as string) ?? '',
    toolName: (body.action_type as string) ?? (body.tool as string) ?? undefined,
    toolParams: (body.action_params as Record<string, unknown>) ?? (body.params as Record<string, unknown>) ?? undefined,
    isAdmin: body.is_admin === true || body.role === 'admin',
    sessionId: (body.conversation_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** Phia (PeopleStrong) — sends JSON with emp_id, message, context. */
export function parsePhiaPayload(body: Record<string, unknown>): ExternalChatRequest {
  return {
    provider: 'phia',
    userId: (body.emp_id as string) ?? '',
    email: ((body.email as string) ?? '').toLowerCase().trim(),
    message: (body.message as string) ?? (body.query as string) ?? '',
    toolName: (body.action as string) ?? undefined,
    toolParams: (body.parameters as Record<string, unknown>) ?? undefined,
    isAdmin: body.is_admin === true,
    sessionId: (body.session_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** Rezolve.ai — sends JSON with requester_email, description, action. */
export function parseRezolvePayload(body: Record<string, unknown>): ExternalChatRequest {
  return {
    provider: 'rezolve',
    userId: (body.requester_id as string) ?? '',
    email: ((body.requester_email as string) ?? (body.email as string) ?? '').toLowerCase().trim(),
    message: (body.description as string) ?? (body.message as string) ?? '',
    toolName: (body.action as string) ?? (body.intent as string) ?? undefined,
    toolParams: (body.action_data as Record<string, unknown>) ?? undefined,
    isAdmin: body.is_admin === true,
    sessionId: (body.ticket_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** Moveworks — sends JSON with user.email, message.text, intent. */
export function parseMoveworksPayload(body: Record<string, unknown>): ExternalChatRequest {
  const user = (body.user as Record<string, unknown>) ?? {};
  const msg = (body.message as Record<string, unknown>) ?? {};
  return {
    provider: 'moveworks',
    userId: (user.id as string) ?? '',
    email: ((user.email as string) ?? '').toLowerCase().trim(),
    message: (msg.text as string) ?? (body.query as string) ?? '',
    toolName: (body.intent as string) ?? undefined,
    toolParams: (body.entities as Record<string, unknown>) ?? undefined,
    isAdmin: user.role === 'admin',
    sessionId: (body.conversation_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** Workativ — sends JSON with user_email, utterance, workflow_action. */
export function parseWorkativPayload(body: Record<string, unknown>): ExternalChatRequest {
  return {
    provider: 'workativ',
    userId: (body.user_id as string) ?? '',
    email: ((body.user_email as string) ?? '').toLowerCase().trim(),
    message: (body.utterance as string) ?? (body.message as string) ?? '',
    toolName: (body.workflow_action as string) ?? undefined,
    toolParams: (body.workflow_params as Record<string, unknown>) ?? undefined,
    isAdmin: body.is_admin === true,
    sessionId: (body.session_id as string) ?? undefined,
    rawPayload: body,
  };
}

/** MS Copilot Plugin — sends adaptive card action or message extension. */
export function parseCopilotPayload(body: Record<string, unknown>): ExternalChatRequest {
  // Copilot sends either a message extension query or an adaptive card action
  const value = (body.value as Record<string, unknown>) ?? {};
  const from = (body.from as Record<string, unknown>) ?? {};
  return {
    provider: 'copilot',
    userId: (from.id as string) ?? '',
    email: ((from.email as string) ?? (value.email as string) ?? '').toLowerCase().trim(),
    message: (value.query as string) ?? (body.text as string) ?? '',
    toolName: (value.action as string) ?? (value.tool as string) ?? undefined,
    toolParams: (value.params as Record<string, unknown>) ?? (value.data as Record<string, unknown>) ?? undefined,
    isAdmin: value.is_admin === true,
    sessionId: (body.conversation_id as string) ?? (value.session_id as string) ?? undefined,
    rawPayload: body,
  };
}

// ── Provider registry ──

export type ProviderParser = (body: Record<string, unknown>) => ExternalChatRequest;

export const PROVIDER_PARSERS: Record<string, ProviderParser> = {
  'leena-ai': parseLeenaAiPayload,
  'darwinbox': parseDarwinboxPayload,
  'phia': parsePhiaPayload,
  'rezolve': parseRezolvePayload,
  'moveworks': parseMoveworksPayload,
  'workativ': parseWorkativPayload,
  'copilot': parseCopilotPayload,
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDER_PARSERS);

/**
 * Route an external provider's request to the agent service.
 * If the provider sends a specific toolName, execute that tool directly.
 * If the provider sends a message, run it through the full agent loop.
 */
export async function handleExternalRequest(
  request: ExternalChatRequest,
  agentService: AgentService,
  logger: Logger,
): Promise<ExternalChatResponse> {
  if (!request.email) {
    return { error: 'Email is required to identify the employee' };
  }

  // Direct tool execution (provider already resolved intent)
  if (request.toolName) {
    logger.info(
      { provider: request.provider, email: request.email, tool: request.toolName },
      'External provider direct tool call',
    );
    const result = await agentService.executeTool(
      request.toolName,
      request.toolParams ?? {},
      request.email,
      request.isAdmin,
    );
    return {
      toolResult: result.result,
      error: result.error,
    };
  }

  // Full agent conversation
  if (request.message) {
    logger.info(
      { provider: request.provider, email: request.email },
      'External provider chat message',
    );
    const response = await agentService.chat(
      request.email,
      request.message,
      request.sessionId,
      request.isAdmin,
    );
    return {
      reply: response.reply,
      sessionId: response.sessionId,
    };
  }

  return { error: 'Either message or toolName is required' };
}
