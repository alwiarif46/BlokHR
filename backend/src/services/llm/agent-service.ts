import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { DatabaseEngine } from '../../db/engine';
import type { LlmClient, ChatMessage } from './llm-client';
import { TOOL_MAP, EMPLOYEE_TOOLS, ALL_TOOLS } from './tool-definitions';
import type { ToolSchema } from './tool-definitions';

// ── Row types ──

export interface ChatSessionRow {
  [key: string]: unknown;
  id: string;
  email: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  [key: string]: unknown;
  id: number;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

// ── Result types ──

export interface AgentResponse {
  sessionId: string;
  reply: string;
  toolsCalled: Array<{ tool: string; params: Record<string, unknown>; result: unknown }>;
  tokensUsed?: number;
}

export interface SessionDetail {
  session: ChatSessionRow;
  messages: ChatMessageRow[];
}

/** Max conversation messages sent to LLM to avoid token explosion. */
const MAX_HISTORY_MESSAGES = 20;

/** Max tool-call iterations per request to prevent infinite loops. */
const MAX_TOOL_ITERATIONS = 5;

/**
 * The AI Agent orchestrator.
 *
 * Flow:
 * 1. User sends a message
 * 2. Agent builds system prompt with available tools
 * 3. Agent sends conversation history + tool definitions to LLM
 * 4. If LLM responds with a tool call → execute it, feed result back, repeat (up to MAX_TOOL_ITERATIONS)
 * 5. If LLM responds with text → return it to the user
 * 6. All messages (user, assistant, tool calls/results) are persisted to chat_sessions/chat_messages
 */
export class AgentService {
  private readonly handlerMap: Map<string, (params: Record<string, unknown>, callerEmail: string) => Promise<unknown>>;

  constructor(
    private readonly db: DatabaseEngine,
    private readonly llm: LlmClient,
    handlers: Map<string, (params: Record<string, unknown>, callerEmail: string) => Promise<unknown>>,
    private readonly logger: Logger,
  ) {
    this.handlerMap = handlers;
  }

  /**
   * Process a user message through the agent.
   * Optionally continues an existing session, or creates a new one.
   */
  async chat(
    email: string,
    message: string,
    sessionId?: string,
    isAdmin = false,
  ): Promise<AgentResponse> {
    // Resolve or create session
    let sid: string;
    if (sessionId) {
      const existing = await this.getSession(sessionId);
      if (existing && existing.email === email) {
        sid = sessionId;
      } else {
        sid = await this.createSession(email, message.slice(0, 80));
      }
    } else {
      sid = await this.createSession(email, message.slice(0, 80));
    }

    // Store user message
    await this.insertMessage(sid, 'user', message);

    // Determine available tools based on role
    const availableTools = isAdmin ? ALL_TOOLS : EMPLOYEE_TOOLS;

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(email, isAdmin, availableTools);

    // Get recent history
    const history = await this.getRecentHistory(sid);

    // Build initial messages array
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
    ];

    // Agent loop: LLM may request tool calls, we execute and feed back
    const toolsCalled: Array<{ tool: string; params: Record<string, unknown>; result: unknown }> = [];
    let finalReply = '';
    let totalTokens = 0;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      let llmResponse;
      try {
        llmResponse = await this.llm.chat(messages, { maxTokens: 2048 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error({ email, sessionId: sid, err: errMsg, iteration }, 'LLM call failed');
        finalReply = 'I apologize, but I\'m unable to process your request right now. Please try again later.';
        break;
      }

      totalTokens += llmResponse.tokensUsed ?? 0;
      const content = llmResponse.content;

      // Check if the LLM wants to call a tool
      // We support a simple protocol: if the response contains <tool_call>...</tool_call>, parse it
      const toolCall = this.parseToolCall(content);

      if (toolCall) {
        const { toolName, params } = toolCall;
        const schema = TOOL_MAP.get(toolName);

        if (!schema) {
          // Unknown tool — tell the LLM
          const errorMsg = `Tool "${toolName}" does not exist. Available tools: ${availableTools.map(t => t.name).join(', ')}`;
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: `<tool_result error="true">${errorMsg}</tool_result>` });
          continue;
        }

        // Check scope
        if (schema.scope === 'admin' && !isAdmin) {
          const errorMsg = `Tool "${toolName}" requires admin privileges.`;
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: `<tool_result error="true">${errorMsg}</tool_result>` });
          continue;
        }

        // Execute the tool
        const handler = this.handlerMap.get(toolName);
        if (!handler) {
          const errorMsg = `No handler registered for tool "${toolName}".`;
          messages.push({ role: 'assistant', content });
          messages.push({ role: 'user', content: `<tool_result error="true">${errorMsg}</tool_result>` });
          continue;
        }

        let result: unknown;
        try {
          result = await handler(params, email);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.error({ toolName, params, err: errMsg }, 'Tool execution failed');
          result = { error: errMsg };
        }

        toolsCalled.push({ tool: toolName, params, result });

        // Feed the result back to the LLM
        const resultStr = JSON.stringify(result, null, 2);
        messages.push({ role: 'assistant', content });
        messages.push({ role: 'user', content: `<tool_result tool="${toolName}">${resultStr}</tool_result>` });
        continue;
      }

      // No tool call — this is the final response
      finalReply = content;
      break;
    }

    // If we exhausted iterations without a final reply
    if (!finalReply && toolsCalled.length > 0) {
      finalReply = 'I executed the requested actions. Here\'s a summary of what was done:\n\n' +
        toolsCalled.map(tc => `• **${tc.tool}**: ${JSON.stringify(tc.result)}`).join('\n');
    }
    if (!finalReply) {
      finalReply = 'I wasn\'t able to determine a response. Please try rephrasing your question.';
    }

    // Store assistant reply
    await this.insertMessage(sid, 'assistant', finalReply);

    // If tools were called, store a summary message for context
    if (toolsCalled.length > 0) {
      const toolSummary = toolsCalled.map(tc =>
        `[Tool: ${tc.tool}, Params: ${JSON.stringify(tc.params)}, Result: ${JSON.stringify(tc.result)}]`
      ).join('\n');
      await this.insertMessage(sid, 'system', `Tool calls executed:\n${toolSummary}`);
    }

    // Update session timestamp
    await this.db.run("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?", [sid]);

    return { sessionId: sid, reply: finalReply, toolsCalled, tokensUsed: totalTokens };
  }

  /** Execute a tool directly by name (for external providers / webhooks). */
  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
    callerEmail: string,
    isAdmin = false,
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const schema = TOOL_MAP.get(toolName);
    if (!schema) return { success: false, error: `Unknown tool: ${toolName}` };

    if (schema.scope === 'admin' && !isAdmin) {
      return { success: false, error: `Tool "${toolName}" requires admin privileges` };
    }

    const handler = this.handlerMap.get(toolName);
    if (!handler) return { success: false, error: `No handler for tool: ${toolName}` };

    try {
      const result = await handler(params, callerEmail);
      return { success: true, result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /** List available tools (for external providers to discover capabilities). */
  getAvailableTools(isAdmin = false): ToolSchema[] {
    return isAdmin ? ALL_TOOLS : EMPLOYEE_TOOLS;
  }

  // ── Session management ──

  async listSessions(email: string): Promise<ChatSessionRow[]> {
    return this.db.all<ChatSessionRow>(
      'SELECT * FROM chat_sessions WHERE email = ? ORDER BY updated_at DESC', [email],
    );
  }

  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    const session = await this.getSession(sessionId);
    if (!session) return null;
    const messages = await this.db.all<ChatMessageRow>(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at', [sessionId],
    );
    return { session, messages };
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;
    await this.db.run('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
    return true;
  }

  // ── Private ──

  private async getSession(id: string): Promise<ChatSessionRow | null> {
    return this.db.get<ChatSessionRow>('SELECT * FROM chat_sessions WHERE id = ?', [id]);
  }

  private async createSession(email: string, title: string): Promise<string> {
    const id = uuidv4();
    await this.db.run('INSERT INTO chat_sessions (id, email, title) VALUES (?, ?, ?)',
      [id, email, title.trim() || 'New conversation']);
    return id;
  }

  private async insertMessage(sessionId: string, role: string, content: string): Promise<void> {
    await this.db.run('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
      [sessionId, role, content]);
  }

  private async getRecentHistory(sessionId: string): Promise<ChatMessage[]> {
    const rows = await this.db.all<ChatMessageRow>(
      `SELECT role, content FROM chat_messages
       WHERE session_id = ? AND role IN ('user', 'assistant')
       ORDER BY created_at DESC LIMIT ?`,
      [sessionId, MAX_HISTORY_MESSAGES],
    );
    return rows.reverse().map(r => ({
      role: r.role as 'user' | 'assistant',
      content: r.content,
    }));
  }

  /**
   * Build the system prompt that instructs the LLM how to use tools.
   */
  private buildSystemPrompt(email: string, isAdmin: boolean, tools: ToolSchema[]): string {
    const toolList = tools.map(t => {
      const params = t.parameters.length > 0
        ? t.parameters.map(p => `  - ${p.name} (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`).join('\n')
        : '  (no parameters)';
      return `${t.name}: ${t.description}\n${params}`;
    }).join('\n\n');

    return `You are Shaavir AI, an intelligent HR assistant. You help employees and managers with attendance, leaves, overtime, timesheets, time tracking, meetings, and all HR operations.

Current user: ${email}
Role: ${isAdmin ? 'Admin / Manager' : 'Employee'}
Today: ${new Date().toISOString().slice(0, 10)}

## Tool Usage

You have access to tools that can read data and perform actions in the HR system. To call a tool, respond with:

<tool_call>
{"tool": "tool_name", "params": {"param1": "value1", "param2": "value2"}}
</tool_call>

After you call a tool, the system will execute it and return the result in a <tool_result> tag. Use that result to formulate your response to the user. You can call multiple tools in sequence (one per message turn).

RULES:
- Always call the appropriate tool when the user asks for data or wants to perform an action. Do NOT make up data.
- If a tool returns an error, explain it to the user in plain language.
- If the user asks something you can answer from tool results, do so concisely.
- For date parameters, always use YYYY-MM-DD format. Today is ${new Date().toISOString().slice(0, 10)}.
- For the current user's own data, you don't need their email — it's automatically set to ${email}.
- If the user's request is ambiguous, ask for clarification before calling a tool.
- Keep responses concise, friendly, and professional.
- For policy questions you cannot answer from tools, suggest contacting HR.

## Available Tools

${toolList}`;
  }

  /**
   * Parse a tool call from the LLM response.
   * Looks for <tool_call>{"tool": "...", "params": {...}}</tool_call>
   */
  private parseToolCall(content: string): { toolName: string; params: Record<string, unknown> } | null {
    const match = content.match(/<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[1]) as { tool?: string; params?: Record<string, unknown> };
      if (!parsed.tool || typeof parsed.tool !== 'string') return null;
      return {
        toolName: parsed.tool,
        params: parsed.params ?? {},
      };
    } catch {
      this.logger.warn({ raw: match[1] }, 'Failed to parse tool call JSON');
      return null;
    }
  }
}
