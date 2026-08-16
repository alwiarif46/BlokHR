/**
 * shared/modal.js — confirmDialog / promptDialog
 *
 * These replaced window.confirm / window.prompt, which never render inside
 * embedded webviews: confirm() returned true and prompt() returned its default,
 * so destructive actions ran with no dialog and rejections got no reason.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { confirmDialog, promptDialog, closeModal } from '../../shared/modal.js';

function box() {
  return document.getElementById('crudModalBox');
}
function okBtn() {
  return document.querySelector('[data-confirm="yes"]');
}
function cancelBtn() {
  return document.querySelector('[data-confirm="no"]');
}
function input() {
  return document.getElementById('crudPromptInput');
}
function tick() {
  return new Promise((r) => setTimeout(r, 0));
}

describe('shared/modal.js dialogs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    closeModal();
    document.body.innerHTML = '';
  });

  describe('confirmDialog', () => {
    it('renders a real dialog rather than resolving immediately', async () => {
      let settled = false;
      const p = confirmDialog({ message: 'Delete this asset?' }).then((v) => {
        settled = true;
        return v;
      });
      await tick();

      expect(box().textContent).toContain('Delete this asset?');
      expect(settled).toBe(false);

      okBtn().click();
      await expect(p).resolves.toBe(true);
    });

    it('resolves false when cancelled', async () => {
      const p = confirmDialog({ message: 'Delete this asset?' });
      await tick();
      cancelBtn().click();
      await expect(p).resolves.toBe(false);
    });

    it('marks the confirm button danger for destructive actions', async () => {
      const p = confirmDialog({ message: 'Delete', confirmLabel: 'Delete', danger: true });
      await tick();
      expect(okBtn().classList.contains('danger')).toBe(true);
      expect(okBtn().textContent).toBe('Delete');
      cancelBtn().click();
      await p;
    });

    it('uses the supplied labels', async () => {
      const p = confirmDialog({
        message: 'Cancel this visit?',
        confirmLabel: 'Cancel visit',
        cancelLabel: 'Keep',
      });
      await tick();
      expect(okBtn().textContent).toBe('Cancel visit');
      expect(cancelBtn().textContent).toBe('Keep');
      cancelBtn().click();
      await p;
    });
  });

  describe('promptDialog', () => {
    it('resolves the trimmed input', async () => {
      const p = promptDialog({ title: 'New class', label: 'Class name' });
      await tick();
      expect(box().textContent).toContain('Class name');

      input().value = '  Grade 5A  ';
      okBtn().click();
      await expect(p).resolves.toBe('Grade 5A');
    });

    it('resolves null when cancelled', async () => {
      const p = promptDialog({ title: 'New class' });
      await tick();
      cancelBtn().click();
      await expect(p).resolves.toBe(null);
    });

    it('prefills the supplied value', async () => {
      const p = promptDialog({ title: 'New period', value: 'Period 3' });
      await tick();
      expect(input().value).toBe('Period 3');
      cancelBtn().click();
      await p;
    });

    it('blocks confirmation until a required field is filled', async () => {
      const p = promptDialog({ title: 'Reject', label: 'Reason', required: true });
      await tick();

      // This is the case that used to slip through as an empty rejection reason.
      expect(okBtn().disabled).toBe(true);
      okBtn().click();
      await tick();
      expect(box()).toBeTruthy();

      input().value = 'Missing receipts';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      expect(okBtn().disabled).toBe(false);

      okBtn().click();
      await expect(p).resolves.toBe('Missing receipts');
    });

    it('ignores Enter while a required field is empty', async () => {
      const p = promptDialog({ title: 'Reject', required: true });
      await tick();

      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await tick();
      expect(box()).toBeTruthy();

      input().value = 'No approval';
      input().dispatchEvent(new Event('input', { bubbles: true }));
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await expect(p).resolves.toBe('No approval');
    });

    it('submits on Enter for optional fields', async () => {
      const p = promptDialog({ title: 'Check in', label: 'Notes' });
      await tick();
      input().value = 'Has laptop';
      input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await expect(p).resolves.toBe('Has laptop');
    });

    it('renders a textarea when multiline', async () => {
      const p = promptDialog({ title: 'Reason', multiline: true, value: 'x' });
      await tick();
      expect(input().tagName).toBe('TEXTAREA');
      expect(input().value).toBe('x');
      cancelBtn().click();
      await p;
    });

    it('escapes markup in labels and values', async () => {
      const p = promptDialog({
        title: 'New class',
        label: '<img src=x onerror=alert(1)>',
        value: '<b>bold</b>',
      });
      await tick();
      expect(box().querySelector('img')).toBe(null);
      expect(box().querySelector('label').textContent).toBe('<img src=x onerror=alert(1)>');
      expect(input().value).toBe('<b>bold</b>');
      cancelBtn().click();
      await p;
    });
  });
});
