import type { Logger } from 'pino';

// ── Types ──

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LlmResponse {
  content: string;
  tokensUsed?: number;
}

// ── Interface ──

export interface LlmClient {
  /** Send a conversation (system prompt + history) and get an assistant response. */
  chat(messages: ChatMessage[], options?: { maxTokens?: number }): Promise<LlmResponse>;
}

// ── Anthropic Implementation ──

const DEFAULT_TIMEOUT_MS = 30_000;

export class AnthropicLlmClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(
    apiKey: string,
    model: string,
    private readonly logger: Logger,
    baseUrl?: string,
  ) {
    this.apiKey = apiKey;
    this.model = model || 'claude-sonnet-4-20250514';
    this.baseUrl = (baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
  }

  async chat(messages: ChatMessage[], options?: { maxTokens?: number }): Promise<LlmResponse> {
    // Anthropic API: system goes in a separate field, not in messages array
    const systemMessages = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body = {
      model: this.model,
      max_tokens: options?.maxTokens ?? 1024,
      system: systemMessages.map((m) => m.content).join('\n\n') || undefined,
      messages: chatMessages.map((m) => ({ role: m.role, content: m.content })),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error({ status: response.status, body: errText }, 'Anthropic API error');
        throw new Error(`Anthropic API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const text = data.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('');

      return {
        content: text,
        tokensUsed: data.usage
          ? data.usage.input_tokens + data.usage.output_tokens
          : undefined,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Anthropic API request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Ollama Implementation ──

export class OllamaLlmClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey?: string;

  constructor(
    model: string,
    private readonly logger: Logger,
    baseUrl?: string,
    apiKey?: string,
  ) {
    this.model = model || 'llama3';
    this.baseUrl = (baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async chat(messages: ChatMessage[], options?: { maxTokens?: number }): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          options: options?.maxTokens ? { num_predict: options.maxTokens } : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error({ status: response.status, body: errText }, 'Ollama API error');
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        message: { role: string; content: string };
        eval_count?: number;
        prompt_eval_count?: number;
      };

      return {
        content: data.message.content,
        tokensUsed: data.eval_count && data.prompt_eval_count
          ? data.eval_count + data.prompt_eval_count
          : undefined,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Ollama API request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ── Mock Implementation ──

export interface MockLlmConfig {
  responseContent?: string;
  tokensUsed?: number;
  shouldThrow?: Error;
}

export class MockLlmClient implements LlmClient {
  public calls: Array<{ messages: ChatMessage[] }> = [];
  private config: MockLlmConfig = {};

  setConfig(config: MockLlmConfig): void {
    this.config = config;
  }

  resetCalls(): void {
    this.calls = [];
  }

  async chat(messages: ChatMessage[]): Promise<LlmResponse> {
    this.calls.push({ messages });
    if (this.config.shouldThrow) throw this.config.shouldThrow;
    return {
      content: this.config.responseContent ?? 'Mock AI response',
      tokensUsed: this.config.tokensUsed ?? 50,
    };
  }
}
