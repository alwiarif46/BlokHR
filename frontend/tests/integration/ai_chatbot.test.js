import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ai_chatbot module', () => {
  /** @type {typeof import('../../modules/ai_chatbot/ai_chatbot.js')} */
  let mod;
  let apiGet;
  let apiPost;
  let apiDelete;
  let toastFn;

  beforeEach(async () => {
    vi.resetModules();
    document.body.innerHTML = '<div id="toasts"></div><div id="root"></div>';

    apiGet = vi.fn(async (path) => {
      if (path === '/api/chat/sessions') {
        return {
          sessions: [
            { id: 'sess-1', title: 'Shift question', email: 'alice@test.com', updated_at: '2026-03-21' },
          ],
        };
      }
      if (path === '/api/chat/tools') {
        return { total: 42, tools: [{ name: 'my_shift' }] };
      }
      if (path === '/api/chat/sessions/sess-1') {
        return {
          session: { id: 'sess-1', title: 'Shift question' },
          messages: [
            { id: 1, role: 'user', content: "What's my shift?" },
            { id: 2, role: 'assistant', content: 'Your shift is 09:00–18:00.' },
          ],
        };
      }
      return {};
    });

    apiPost = vi.fn(async (path, body) => {
      if (path === '/api/chat') {
        return {
          sessionId: body.sessionId || 'sess-new',
          reply: 'You have no pending leaves.',
          toolsCalled: [{ tool: 'my_pending_leaves' }],
        };
      }
      return { success: true };
    });

    apiDelete = vi.fn(async () => ({ success: true }));
    toastFn = vi.fn();

    vi.doMock('../../shared/toast.js', () => ({ toast: toastFn }));
    vi.doMock('../../shared/session.js', () => ({
      getSession: () => ({ email: 'alice@test.com', name: 'Alice' }),
    }));
    vi.doMock('../../shared/router.js', () => ({ registerModule: vi.fn() }));
    vi.doMock('../../shared/api.js', () => ({
      api: {
        get: apiGet,
        post: apiPost,
        delete: apiDelete,
      },
    }));

    mod = await import('../../modules/ai_chatbot/ai_chatbot.js');
    mod._resetState();
  });

  afterEach(() => {
    mod._resetState();
    vi.clearAllMocks();
  });

  it('loads sessions and tools on render', async () => {
    mod.renderAiChatbotPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Shift question');
      expect(document.body.textContent).toContain('42');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/chat/sessions');
    expect(apiGet).toHaveBeenCalledWith('/api/chat/tools');
    expect(document.body.textContent).toContain('Start a conversation');
  });

  it('opens a session thread and shows messages', async () => {
    mod.renderAiChatbotPage(document.getElementById('root'));
    await vi.waitFor(() => expect(document.body.textContent).toContain('Shift question'));

    document.querySelector('[data-action="select-session"][data-id="sess-1"]').click();
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("What's my shift?");
      expect(document.body.textContent).toContain('Your shift is 09:00–18:00.');
    });
    expect(apiGet).toHaveBeenCalledWith('/api/chat/sessions/sess-1');
  });

  it('sends a message and renders the assistant reply with tool chips', async () => {
    mod.renderAiChatbotPage(document.getElementById('root'));
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/chat/sessions'));

    const input = document.getElementById('chatInput');
    input.value = 'Any pending leaves?';
    document.getElementById('chatComposer').requestSubmit();

    await vi.waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/api/chat', { message: 'Any pending leaves?' });
    });
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('You have no pending leaves.');
      expect(document.body.textContent).toContain('my_pending_leaves');
    });
  });

  it('shows LLM unavailable state on 503', async () => {
    apiGet.mockImplementation(async (path) => {
      if (path === '/api/chat/sessions') {
        return { _error: true, status: 503, message: 'AI Chat not configured' };
      }
      if (path === '/api/chat/tools') {
        return { total: 10, tools: [] };
      }
      return {};
    });

    mod.renderAiChatbotPage(document.getElementById('root'));
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('LLM not configured');
    });
    expect(document.getElementById('chatSendBtn').disabled).toBe(true);
  });
});
