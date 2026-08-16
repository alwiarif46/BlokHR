/**
 * shared/modal.js — Theme-Aware Overlays
 *
 * The monolith implements 4 different detail view patterns depending on theme:
 *
 *  | Theme     | Pattern       | Container                          |
 *  |-----------|---------------|------------------------------------|
 *  | Chromium  | Modal overlay | #modalOverlay + #modalBox centered |
 *  | Neural    | Split panel   | #splitPanel sidebar alongside grid |
 *  | Holodeck  | Inline expand | Card expands in-place within grid  |
 *  | Clean     | Drawer        | #drawerPanel slides from right     |
 *
 * Responsibilities:
 *  - Detect current theme
 *  - Open appropriate container with content
 *  - Close/dismiss handling (click outside, ESC key, close button)
 *  - Generic modal for CRUD forms (always uses overlay pattern)
 */

import { getTheme } from './themes.js';

let _detailOpen = false;
let _expandedCard = null;
let _escHandler = null;

/**
 * Open a detail view using the theme-appropriate pattern.
 *
 * @param {string} html         — rendered HTML content to show
 * @param {{ email?: string, cardSelector?: string }} [opts]
 */
export function openDetail(html, opts) {
  const theme = getTheme();
  _detailOpen = true;
  const email = (opts && opts.email) || '';

  if (theme === 'chromium') {
    const box = document.getElementById('modalBox');
    const overlay = document.getElementById('modalOverlay');
    if (box) box.innerHTML = html;
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else if (theme === 'neural') {
    const inner = document.getElementById('splitInner');
    const panel = document.getElementById('splitPanel');
    if (inner) inner.innerHTML = html;
    if (panel) panel.classList.add('open');
    if (email) {
      document.querySelectorAll('.ec').forEach(function (c) {
        c.classList.toggle('selected', c.dataset.email === email);
      });
    }
  } else if (theme === 'holodeck') {
    closeDetail();
    _detailOpen = true;
    const sel =
      opts && opts.cardSelector ? opts.cardSelector : '.ec[data-email="' + CSS.escape(email) + '"]';
    const card = document.querySelector(sel);
    if (card) {
      _expandedCard = card;
      card.classList.add('expanded');
      const ed = document.createElement('div');
      ed.className = 'expand-detail';
      ed.innerHTML =
        '<button class="expand-close" data-action="close-detail">&#10005;</button>' + html;
      card.appendChild(ed);
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } else {
    /* clean — drawer */
    const drawer = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer) {
      drawer.innerHTML = html;
      drawer.classList.add('open');
    }
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  _bindEsc();
}

/**
 * Close whatever detail view is currently open.
 */
export function closeDetail() {
  _detailOpen = false;

  const modalOverlay = document.getElementById('modalOverlay');
  if (modalOverlay) modalOverlay.classList.remove('open');

  const splitPanel = document.getElementById('splitPanel');
  if (splitPanel) splitPanel.classList.remove('open');

  const drawerPanel = document.getElementById('drawerPanel');
  if (drawerPanel) drawerPanel.classList.remove('open');

  const drawerOverlay = document.getElementById('drawerOverlay');
  if (drawerOverlay) drawerOverlay.classList.remove('open');

  document.body.style.overflow = '';

  document.querySelectorAll('.ec.selected').forEach(function (c) {
    c.classList.remove('selected');
  });

  if (_expandedCard) {
    const ed = _expandedCard.querySelector('.expand-detail');
    if (ed) ed.remove();
    _expandedCard.classList.remove('expanded');
    _expandedCard = null;
  }

  _unbindEsc();
}

/**
 * Open a generic CRUD modal (always overlay style, regardless of theme).
 * Used by module forms (create/edit).
 *
 * @param {string} html — modal content HTML
 * @param {{ title?: string, width?: string, onClose?: function }} [opts]
 */
export function openModal(html, opts) {
  let overlay = document.getElementById('crudModalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'crudModalOverlay';
    overlay.className = 'crud-modal-overlay';
    overlay.innerHTML = '<div id="crudModalBox" class="crud-modal-box"></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });
  }

  const box = document.getElementById('crudModalBox');
  if (box) {
    if (opts && opts.width) box.style.maxWidth = opts.width;
    else box.style.maxWidth = '';

    let titleHtml = '';
    if (opts && opts.title) {
      titleHtml =
        '<div class="crud-modal-header"><span class="crud-modal-title">' +
        _esc(opts.title) +
        '</span><button class="crud-modal-close" data-action="close-modal">&#10005;</button></div>';
    }
    box.innerHTML = titleHtml + '<div class="crud-modal-body">' + html + '</div>';
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  _onClose = (opts && opts.onClose) || null;
  _bindEsc();
}

let _onClose = null;

/**
 * Close the generic CRUD modal.
 */
export function closeModal() {
  const overlay = document.getElementById('crudModalOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (_onClose) {
    _onClose();
    _onClose = null;
  }
  _unbindEsc();
}

/**
 * Promise-based confirm dialog (CRUD overlay).
 *
 * Use this instead of window.confirm: native dialogs do not render inside
 * embedded webviews, where confirm() returns true immediately and lets
 * destructive actions run without the user ever seeing a prompt.
 *
 * @param {{ title?: string, message: string, confirmLabel?: string, cancelLabel?: string, danger?: boolean }} opts
 * @returns {Promise<boolean>}
 */
export function confirmDialog(opts) {
  const message = (opts && opts.message) || '';
  const confirmLabel = (opts && opts.confirmLabel) || 'Continue';
  const cancelLabel = (opts && opts.cancelLabel) || 'Cancel';
  const danger = !!(opts && opts.danger);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
      closeModal();
    };

    const html =
      '<p class="crud-confirm-msg">' +
      _esc(message) +
      '</p><div class="crud-confirm-actions">' +
      '<button type="button" class="crud-confirm-cancel" data-confirm="no">' +
      _esc(cancelLabel) +
      '</button>' +
      '<button type="button" class="crud-confirm-ok' +
      (danger ? ' danger' : '') +
      '" data-confirm="yes">' +
      _esc(confirmLabel) +
      '</button></div>';

    openModal(html, {
      title: (opts && opts.title) || 'Confirm',
      onClose: () => finish(false),
    });

    const box = document.getElementById('crudModalBox');
    if (!box) {
      finish(false);
      return;
    }
    const yes = box.querySelector('[data-confirm="yes"]');
    const no = box.querySelector('[data-confirm="no"]');
    if (yes) yes.addEventListener('click', () => finish(true));
    if (no) no.addEventListener('click', () => finish(false));
  });
}

/**
 * Promise-based text prompt (CRUD overlay).
 *
 * Use this instead of window.prompt, which in embedded webviews resolves to its
 * default value — or to '' when there is no default — without ever rendering.
 * That silently turned "enter a rejection reason" into "reject with no reason".
 *
 * Resolves to the trimmed input, or null when cancelled. With `required`, the
 * confirm button stays disabled until the field has content.
 *
 * @param {{
 *   title?: string,
 *   label?: string,
 *   value?: string,
 *   placeholder?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   required?: boolean,
 *   multiline?: boolean,
 *   danger?: boolean
 * }} opts
 * @returns {Promise<string|null>}
 */
export function promptDialog(opts) {
  const o = opts || {};
  const value = o.value == null ? '' : String(o.value);
  const confirmLabel = o.confirmLabel || 'Save';
  const cancelLabel = o.cancelLabel || 'Cancel';
  const required = !!o.required;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
      closeModal();
    };

    const field = o.multiline
      ? '<textarea id="crudPromptInput" rows="3" placeholder="' +
        _esc(o.placeholder || '') +
        '">' +
        _esc(value) +
        '</textarea>'
      : '<input type="text" id="crudPromptInput" autocomplete="off" value="' +
        _esc(value) +
        '" placeholder="' +
        _esc(o.placeholder || '') +
        '">';

    const html =
      '<div class="crud-prompt-field">' +
      (o.label ? '<label for="crudPromptInput">' + _esc(o.label) + '</label>' : '') +
      field +
      '</div><div class="crud-confirm-actions">' +
      '<button type="button" class="crud-confirm-cancel" data-confirm="no">' +
      _esc(cancelLabel) +
      '</button>' +
      '<button type="button" class="crud-confirm-ok' +
      (o.danger ? ' danger' : '') +
      '" data-confirm="yes"' +
      (required && !value.trim() ? ' disabled' : '') +
      '>' +
      _esc(confirmLabel) +
      '</button></div>';

    openModal(html, {
      title: o.title || 'Enter a value',
      onClose: () => finish(null),
    });

    const box = document.getElementById('crudModalBox');
    if (!box) {
      finish(null);
      return;
    }
    const input = box.querySelector('#crudPromptInput');
    const yes = box.querySelector('[data-confirm="yes"]');
    const no = box.querySelector('[data-confirm="no"]');

    const submit = () => {
      const v = input ? input.value.trim() : '';
      if (required && !v) return;
      finish(v);
    };

    if (input) {
      if (required && yes) {
        input.addEventListener('input', () => {
          yes.disabled = !input.value.trim();
        });
      }
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !o.multiline) {
          e.preventDefault();
          submit();
        }
      });
      input.focus();
      input.select();
    }
    if (yes) yes.addEventListener('click', submit);
    if (no) no.addEventListener('click', () => finish(null));
  });
}

/**
 * Check if a detail view is currently open.
 * @returns {boolean}
 */
export function isDetailOpen() {
  return _detailOpen;
}

/* ── Internal helpers ── */

function _bindEsc() {
  if (_escHandler) return;
  _escHandler = function (e) {
    if (e.key === 'Escape') {
      const crudOverlay = document.getElementById('crudModalOverlay');
      if (crudOverlay && crudOverlay.classList.contains('open')) {
        closeModal();
      } else if (_detailOpen) {
        closeDetail();
      }
    }
  };
  document.addEventListener('keydown', _escHandler);
}

function _unbindEsc() {
  const crudOverlay = document.getElementById('crudModalOverlay');
  const crudOpen = crudOverlay && crudOverlay.classList.contains('open');
  if (!_detailOpen && !crudOpen && _escHandler) {
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
}

function _esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

/* Global click handler for data-action="close-detail" and "close-modal" */
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'close-detail') closeDetail();
  if (btn.dataset.action === 'close-modal') closeModal();
});
