/**
 * shared/toast.js — Toast Notification System
 *
 * Extracted from the monolith's toast(msg, type) function.
 *
 * Responsibilities:
 *  - Create toast DOM element with type class (success/error/info)
 *  - Auto-dismiss after configurable duration (from settings, default 3500ms)
 *  - Fade-out animation before removal
 *  - Stack multiple toasts vertically
 */

let _defaultDuration = 3500;
let _container = null;

/**
 * Set the toast auto-dismiss duration.
 * Called when tenant settings load (settings_json.ui.toastDurationMs).
 * @param {number} ms
 */
export function setToastDuration(ms) {
  if (typeof ms === 'number' && ms >= 500 && ms <= 15000) {
    _defaultDuration = ms;
  }
}

/**
 * Ensure the toast container exists in the DOM.
 * @returns {HTMLElement}
 */
function getContainer() {
  if (_container && _container.parentNode) return _container;
  _container = document.getElementById('toasts');
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'toasts';
    _container.className = 'toasts';
    document.body.appendChild(_container);
  }
  return _container;
}

/**
 * Show a toast notification.
 *
 * @param {string} msg   — The message text
 * @param {'success'|'error'|'info'|''} [type=''] — Visual style class
 * @param {{ duration?: number }} [opts]
 */
export function toast(msg, type, opts) {
  const container = getContainer();
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  container.appendChild(el);

  const duration = (opts && opts.duration) || _defaultDuration;

  const dismissTimer = setTimeout(function () {
    el.classList.add('fade-out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 350);
  }, duration);

  el.addEventListener('click', function () {
    clearTimeout(dismissTimer);
    el.classList.add('fade-out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 350);
  });
}
