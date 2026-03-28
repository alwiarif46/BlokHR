/**
 * shared/lottie.js — Lottie Overlay System
 *
 * Provides full-screen Lottie animation feedback on clock events.
 *
 * Responsibilities:
 *  - triggerLottie(action)      — check settings for Lottie data, show overlay
 *  - dismissLottieOverlay()     — close overlay
 *  - loadLottiePlayer()         — lazy-load lottie-web library
 *  - Auto-dismiss after configured duration
 *  - Dismiss button for user to close early
 *
 * The overlay element is created once and reused.
 *
 * Admin configures animations per clock action in settings_json.lottie:
 *   { 'clock-in': { data, duration }, 'clock-out': { data, duration }, ... }
 */

let _overlay = null;
let _animContainer = null;
let _animLabel = null;
let _dismissTimer = null;
let _lottieLib = null;
let _currentAnim = null;

const ACTION_LABELS = {
  'clock-in': 'CLOCKED IN',
  'clock-out': 'CLOCKED OUT',
  break: 'ON BREAK',
  back: 'BACK FROM BREAK',
};

/**
 * Trigger a Lottie animation for a clock action.
 *
 * @param {string} action  — one of: 'clock-in', 'clock-out', 'break', 'back'
 * @param {object} settingsCache — tenant settings object with lottie config
 */
export async function triggerLottie(action, settingsCache) {
  if (!settingsCache || !settingsCache.lottie) return;
  const config = settingsCache.lottie[action];
  if (!config || !config.data) return;

  await loadLottiePlayer();
  if (!_lottieLib) return;

  _ensureOverlay();
  _clearAnim();

  const label = ACTION_LABELS[action] || action.toUpperCase();
  if (_animLabel) _animLabel.textContent = label;

  try {
    _currentAnim = _lottieLib.loadAnimation({
      container: _animContainer,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
    });
  } catch (_e) {
    return;
  }

  _overlay.classList.remove('hidden');

  const duration = (config.duration || 3) * 1000;
  _dismissTimer = setTimeout(dismissLottieOverlay, duration);
}

/**
 * Dismiss the Lottie overlay immediately.
 */
export function dismissLottieOverlay() {
  if (_dismissTimer) {
    clearTimeout(_dismissTimer);
    _dismissTimer = null;
  }
  _clearAnim();
  if (_overlay) _overlay.classList.add('hidden');
}

/**
 * Lazy-load the lottie-web library from CDN.
 * @returns {Promise<void>}
 */
export async function loadLottiePlayer() {
  if (_lottieLib) return;
  if (typeof window.lottie !== 'undefined') {
    _lottieLib = window.lottie;
    return;
  }

  return new Promise(function (resolve) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    script.onload = function () {
      _lottieLib = window.lottie || null;
      resolve();
    };
    script.onerror = function () {
      _lottieLib = null;
      resolve();
    };
    document.head.appendChild(script);
  });
}

/* ── Internal helpers ── */

function _ensureOverlay() {
  if (_overlay) return;

  _overlay = document.getElementById('lottieOverlay');
  if (!_overlay) {
    _overlay = document.createElement('div');
    _overlay.id = 'lottieOverlay';
    _overlay.className = 'lottie-overlay hidden';
    _overlay.innerHTML =
      '<div id="lottieAnimContainer" class="lottie-anim-container"></div>' +
      '<div id="lottieAnimLabel" class="lottie-anim-label"></div>' +
      '<button type="button" class="lottie-dismiss-btn" id="lottieDismissBtn">Dismiss</button>';
    document.body.appendChild(_overlay);

    document.getElementById('lottieDismissBtn').addEventListener('click', dismissLottieOverlay);
  }

  _animContainer = document.getElementById('lottieAnimContainer');
  _animLabel = document.getElementById('lottieAnimLabel');
}

function _clearAnim() {
  if (_currentAnim) {
    try {
      _currentAnim.destroy();
    } catch (_e) {
      /* noop */
    }
    _currentAnim = null;
  }
  if (_animContainer) _animContainer.innerHTML = '';
}
