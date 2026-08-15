/**
 * modules/kiosk/kiosk.js
 * Shared-device kiosk: search employee → PIN → clock in/out/break/back → idle.
 * Does not persist an employee session in localStorage.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _enabled = false;
/** @type {'idle'|'pick'|'pin'|'actions'} */
let _step = 'idle';
/** @type {{ email: string, name: string } | null} */
let _selected = null;
let _pin = '';
let _token = '';
let _members = [];
let _searchTimer = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _ini(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export function renderKioskPage(container) {
  _container = container;
  _step = 'idle';
  _selected = null;
  _pin = '';
  _token = '';
  _members = [];

  container.innerHTML =
    '<div class="kiosk-shell" id="kioskShell">' +
      '<div class="kiosk-top">' +
        '<div class="kiosk-brand">BlokHR Kiosk</div>' +
        '<div class="kiosk-status" id="kioskStatus">Checking…</div>' +
      '</div>' +
      '<div class="kiosk-stage" id="kioskStage"></div>' +
    '</div>';

  _boot();
}

async function _boot() {
  const status = await api.get('/api/kiosk/status');
  _enabled = !!(status && !status._error && status.enabled);
  const statusEl = _container && _container.querySelector('#kioskStatus');
  if (statusEl) {
    statusEl.textContent = _enabled ? 'Ready' : 'Disabled';
    statusEl.className = 'kiosk-status' + (_enabled ? ' on' : ' off');
  }
  if (!_enabled) {
    _renderDisabled();
    return;
  }
  _goIdle();
}

function _renderDisabled() {
  const stage = _container && _container.querySelector('#kioskStage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="kiosk-card kiosk-idle">' +
      '<div class="kiosk-headline">Kiosk mode is off</div>' +
      '<div class="kiosk-sub">Enable it in Settings → Attendance Rules, then launch again.</div>' +
    '</div>';
}

function _goIdle() {
  _step = 'idle';
  _selected = null;
  _pin = '';
  _token = '';
  const stage = _container && _container.querySelector('#kioskStage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="kiosk-card kiosk-idle">' +
      '<div class="kiosk-headline">Tap to clock in</div>' +
      '<div class="kiosk-sub">Shared device · use your PIN · no personal login left behind</div>' +
      '<button type="button" class="kiosk-cta" data-kiosk="start">Start</button>' +
    '</div>';
  _bindStage(stage);
}

function _goPick() {
  _step = 'pick';
  _selected = null;
  _pin = '';
  _token = '';
  const stage = _container && _container.querySelector('#kioskStage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="kiosk-card">' +
      '<div class="kiosk-headline">Who are you?</div>' +
      '<input class="kiosk-search" id="kioskSearch" type="search" placeholder="Search name or email" autocomplete="off">' +
      '<div class="kiosk-list" id="kioskList"><div class="kiosk-muted">Type to find your name</div></div>' +
      '<button type="button" class="kiosk-link" data-kiosk="cancel">Cancel</button>' +
    '</div>';
  _bindStage(stage);
  const input = stage.querySelector('#kioskSearch');
  if (input) {
    input.focus();
    input.addEventListener('input', function () {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(function () { _search(input.value); }, 180);
    });
  }
  _search('');
}

async function _search(q) {
  const list = _container && _container.querySelector('#kioskList');
  if (!list) return;
  const res = await api.get('/api/kiosk/members?q=' + encodeURIComponent(q || ''));
  if (res && res._error) {
    list.innerHTML = '<div class="kiosk-muted">' + _esc(res.message || 'Could not load people') + '</div>';
    return;
  }
  _members = (res && res.members) || [];
  if (!_members.length) {
    list.innerHTML = '<div class="kiosk-muted">No matches</div>';
    return;
  }
  let html = '';
  _members.forEach(function (m, i) {
    html +=
      '<button type="button" class="kiosk-person" data-kiosk="select" data-idx="' + i + '">' +
        '<span class="kiosk-av">' + _esc(_ini(m.name)) + '</span>' +
        '<span class="kiosk-person-text">' +
          '<span class="kiosk-person-name">' + _esc(m.name) + '</span>' +
          '<span class="kiosk-person-email">' + _esc(m.email) + '</span>' +
        '</span>' +
      '</button>';
  });
  list.innerHTML = html;
}

function _goPin(member) {
  _step = 'pin';
  _selected = { email: member.email, name: member.name };
  _pin = '';
  _token = '';
  const stage = _container && _container.querySelector('#kioskStage');
  if (!stage) return;
  stage.innerHTML =
    '<div class="kiosk-card">' +
      '<div class="kiosk-headline">Enter PIN</div>' +
      '<div class="kiosk-sub">' + _esc(member.name) + '</div>' +
      '<div class="kiosk-pin-display" id="kioskPinDots"></div>' +
      '<div class="kiosk-pad" id="kioskPad">' +
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'del'].map(function (k) {
          if (k === 'clear') return '<button type="button" class="kiosk-key ghost" data-kiosk="key" data-key="clear">C</button>';
          if (k === 'del') return '<button type="button" class="kiosk-key ghost" data-kiosk="key" data-key="del">⌫</button>';
          return '<button type="button" class="kiosk-key" data-kiosk="key" data-key="' + k + '">' + k + '</button>';
        }).join('') +
      '</div>' +
      '<button type="button" class="kiosk-cta" data-kiosk="verify" disabled id="kioskVerifyBtn">Continue</button>' +
      '<button type="button" class="kiosk-link" data-kiosk="back-pick">Back</button>' +
    '</div>';
  _paintPin();
  _bindStage(stage);
}

function _paintPin() {
  const dots = _container && _container.querySelector('#kioskPinDots');
  const btn = _container && _container.querySelector('#kioskVerifyBtn');
  if (dots) {
    const shown = _pin.length ? '•'.repeat(_pin.length) : '····';
    dots.textContent = shown;
  }
  if (btn) btn.disabled = _pin.length < 4;
}

function _goActions() {
  _step = 'actions';
  const stage = _container && _container.querySelector('#kioskStage');
  if (!stage || !_selected) return;
  stage.innerHTML =
    '<div class="kiosk-card">' +
      '<div class="kiosk-headline">Hi, ' + _esc(_selected.name.split(' ')[0] || _selected.name) + '</div>' +
      '<div class="kiosk-sub">Choose an action</div>' +
      '<div class="kiosk-actions">' +
        '<button type="button" class="kiosk-action in" data-kiosk="clock" data-action="in">Clock in</button>' +
        '<button type="button" class="kiosk-action out" data-kiosk="clock" data-action="out">Clock out</button>' +
        '<button type="button" class="kiosk-action break" data-kiosk="clock" data-action="break">Break</button>' +
        '<button type="button" class="kiosk-action back" data-kiosk="clock" data-action="back">Back</button>' +
      '</div>' +
      '<button type="button" class="kiosk-link" data-kiosk="cancel">Cancel</button>' +
    '</div>';
  _bindStage(stage);
}

function _bindStage(stage) {
  stage.onclick = async function (e) {
    const btn = e.target.closest('[data-kiosk]');
    if (!btn) return;
    const op = btn.dataset.kiosk;

    if (op === 'start') {
      _goPick();
      return;
    }
    if (op === 'cancel') {
      _goIdle();
      return;
    }
    if (op === 'back-pick') {
      _goPick();
      return;
    }
    if (op === 'select') {
      const idx = parseInt(btn.dataset.idx, 10);
      const m = _members[idx];
      if (m) _goPin(m);
      return;
    }
    if (op === 'key') {
      const key = btn.dataset.key;
      if (key === 'clear') _pin = '';
      else if (key === 'del') _pin = _pin.slice(0, -1);
      else if (_pin.length < 12) _pin += key;
      _paintPin();
      return;
    }
    if (op === 'verify') {
      await _verify();
      return;
    }
    if (op === 'clock') {
      await _clock(btn.dataset.action);
      return;
    }
  };
}

async function _verify() {
  if (!_selected || _pin.length < 4) return;
  const btn = _container.querySelector('#kioskVerifyBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Checking…';
  }
  const res = await api.post('/api/kiosk/verify', {
    email: _selected.email,
    pin: _pin,
  });
  if (res && res._error) {
    toast(res.message || 'Verification failed', 'error');
    _pin = '';
    _paintPin();
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Continue';
    }
    return;
  }
  if (!res || !res.success || !res.token) {
    toast((res && res.error) || 'Invalid PIN', 'error');
    _pin = '';
    _paintPin();
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Continue';
    }
    return;
  }
  _token = res.token;
  _pin = '';
  _goActions();
}

async function _clock(action) {
  if (!_selected || !_token) {
    toast('Session expired — enter PIN again', 'error');
    if (_selected) _goPin(_selected);
    return;
  }
  const res = await api.post('/api/kiosk/clock', {
    email: _selected.email,
    token: _token,
    action: action,
  });
  _token = '';
  if (res && res._error) {
    toast(res.message || 'Clock failed', 'error');
    _goIdle();
    return;
  }
  if (res && (res.blocked || res.duplicate || res.success === false)) {
    toast(res.error || 'Could not complete action', 'error');
    _goIdle();
    return;
  }
  const labels = { in: 'Clocked in', out: 'Clocked out', break: 'On break', back: 'Back from break' };
  toast((labels[action] || 'Done') + ' · ' + (_selected.name || ''), 'success');
  _goIdle();
}

registerModule('kiosk', renderKioskPage);
