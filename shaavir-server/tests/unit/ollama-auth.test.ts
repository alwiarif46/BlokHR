import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaLlmClient, AnthropicLlmClient, MockLlmClient } from '../../src/services/llm/llm-client';
import { testLogger } from '../helpers/setup';

describe('Ollama Auth Header (Gap 3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('without apiKey sends no Authorization header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: { role: 'assistant', content: 'hi' } }), { status: 200 }),
    );

    const client = new OllamaLlmClient('llama3', testLogger);
    await client.chat([{ role: 'user', content: 'hello' }]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('with apiKey sends correct Bearer header', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: { role: 'assistant', content: 'hi' } }), { status: 200 }),
    );

    const client = new OllamaLlmClient('llama3', testLogger, undefined, 'my-secret-key');
    await client.chat([{ role: 'user', content: 'hello' }]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-secret-key');
  });

  it('Anthropic client still sends x-api-key (regression)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 10, output_tokens: 5 } }),
        { status: 200 },
      ),
    );

    const client = new AnthropicLlmClient('test-key', 'claude-sonnet-4-20250514', testLogger);
    await client.chat([{ role: 'user', content: 'hello' }]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = fetchSpy.mock.calls[0];
    const headers = (callArgs[1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
  });

  it('MockLlmClient unaffected (regression)', async () => {
    const mock = new MockLlmClient();
    const result = await mock.chat([{ role: 'user', content: 'hello' }]);
    expect(result.content).toBe('Mock AI response');
    expect(mock.calls).toHaveLength(1);
  });
});
