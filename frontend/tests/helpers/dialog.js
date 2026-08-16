/**
 * Helpers for driving shared/modal.js dialogs in tests.
 *
 * Modules used to call window.prompt / window.confirm, which tests stubbed out.
 * Those dialogs now render real DOM, so tests interact with them instead.
 */

/** Wait for a condition, polling the DOM. */
async function waitForEl(selector, tries = 50) {
  for (let i = 0; i < tries; i += 1) {
    const el = document.querySelector(selector);
    if (el) return el;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Timed out waiting for ' + selector);
}

/**
 * Fill the open promptDialog and confirm it.
 * @param {string} value
 */
export async function answerPrompt(value) {
  const input = await waitForEl('#crudPromptInput');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('[data-confirm="yes"]').click();
}

/** Dismiss the open prompt/confirm dialog. */
export async function dismissDialog() {
  const btn = await waitForEl('[data-confirm="no"]');
  btn.click();
}

/** Accept the open confirmDialog. */
export async function acceptConfirm() {
  const btn = await waitForEl('[data-confirm="yes"]');
  btn.click();
}
