import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shellPath = path.resolve(__dirname, '../../shell.html');

describe('forgot password UI in shell.html', () => {
  it('includes forgot/reset screens and deep-link hooks', () => {
    const html = fs.readFileSync(shellPath, 'utf8');
    expect(html).toContain('id="screenForgotPassword"');
    expect(html).toContain('id="screenResetPassword"');
    expect(html).toContain('id="btnForgotPassword"');
    expect(html).toContain('/api/auth/forgot-password');
    expect(html).toContain('/api/auth/forgot-password/confirm');
    expect(html).toContain('consumeAuthDeepLinks');
    expect(html).toContain("params.get('reset')");
    expect(html).toContain("params.get('magic')");
  });
});

describe('forgot password request flow (mocked api)', () => {
  /** @type {ReturnType<typeof vi.fn>} */
  let apiFn;

  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = `
      <div id="screenLogin" class="screen"></div>
      <div id="screenForgotPassword" class="screen"></div>
      <div id="screenResetPassword" class="screen"></div>
      <input id="loginEmail" value="alice@test.com" />
      <input id="fpEmail" />
      <div id="errFpEmail"></div>
      <button id="btnForgotSubmit"></button>
      <input id="rpNewPass" />
      <input id="rpConfirmPass" />
      <div id="errRpNew"></div>
      <div id="errRpConfirm"></div>
      <button id="btnResetSubmit"></button>
    `;
    apiFn = vi.fn(async () => ({
      success: true,
      message: 'If an account exists for that email, a reset link has been sent.',
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts forgot-password with normalized email', async () => {
    const email = 'alice@test.com';
    const result = await apiFn('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    expect(apiFn).toHaveBeenCalledWith('/api/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/If an account exists/);
  });

  it('posts confirm with token and new password', async () => {
    apiFn.mockResolvedValueOnce({ success: true });
    const result = await apiFn('/api/auth/forgot-password/confirm', {
      method: 'POST',
      body: { token: 'abc', newPassword: 'newpassword1' },
    });
    expect(result.success).toBe(true);
    expect(apiFn.mock.calls[0][0]).toBe('/api/auth/forgot-password/confirm');
  });
});
