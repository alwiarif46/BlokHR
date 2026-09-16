/**
 * modules/people/people.js
 *
 * Admin People directory — list employees and add new ones with a temporary password.
 * Maps to services/directory (/api/directory/members).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { registerModule, navigateToModule } from '../../shared/router.js';

let _container = null;
let _members = [];

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function _ini(name) {
  if (!name) return '??';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export function renderPeoplePage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ppl-wrap" id="pplWrap">' +
      '<div class="ppl-toolbar">' +
        '<div class="ppl-title"><span>&#128101;</span> People</div>' +
        '<div class="ppl-spacer"></div>' +
        '<button class="ppl-btn" type="button" id="pplAddBtn">+ Add employee</button>' +
      '</div>' +
      '<div class="ppl-hint mf">Add teammates with a temporary password. They must change it on first sign-in. Seats follow your plan.</div>' +
      '<div class="ppl-stats" id="pplStats"></div>' +
      '<div id="pplContent"></div>' +
      '<div class="ppl-modal" id="pplModal"><div class="ppl-modal-box" id="pplModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  pplLoadData();
}

export async function pplLoadData() {
  const d = await api.get('/api/directory/members');
  if (d && !d._error && Array.isArray(d.members)) {
    _members = d.members;
  } else {
    _members = [];
    if (d && d._error) toast(d.message || 'Could not load people', 'error');
  }
  pplRenderStats();
  pplRender();
}

export function pplRenderStats() {
  const el = _container && _container.querySelector('#pplStats');
  if (!el) return;
  const active = _members.filter(function (m) { return m.active !== false; }).length;
  el.innerHTML =
    '<div class="ppl-stat"><div class="ppl-stat-num" style="color:var(--accent)">' +
    active +
    '</div><div class="ppl-stat-label">Active seats</div></div>';
}

export function pplRender() {
  const el = _container && _container.querySelector('#pplContent');
  if (!el) return;
  if (!_members.length) {
    el.innerHTML =
      '<div class="ppl-empty">' +
        '<div class="ppl-empty-icon">&#128101;</div>' +
        '<div class="ppl-empty-text">No employees yet</div>' +
        '<div class="ppl-empty-sub">Add your first teammate to populate the attendance board.</div>' +
        '<button class="ppl-btn" type="button" id="pplEmptyAdd">+ Add employee</button>' +
      '</div>';
    const btn = el.querySelector('#pplEmptyAdd');
    if (btn) btn.addEventListener('click', function () { pplShowForm(); });
    return;
  }

  let html = '<div class="ppl-list">';
  _members.forEach(function (m, i) {
    html +=
      '<div class="ppl-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="ppl-av">' + _esc(_ini(m.name)) + '</div>' +
        '<div class="ppl-info">' +
          '<div class="ppl-name">' + _esc(m.name) + '</div>' +
          '<div class="ppl-email">' + _esc(m.email) + '</div>' +
        '</div>' +
        '<div class="ppl-meta">' +
          '<span class="ppl-badge">' + _esc(m.role || 'employee') + '</span>' +
          (m.groupId ? '<span class="ppl-group">' + _esc(m.groupId) + '</span>' : '') +
        '</div>' +
        '<div class="ppl-row-actions">' +
          '<button class="ppl-btn ghost" type="button" data-action="set-pin" data-email="' +
            _esc(m.email) +
            '" data-name="' +
            _esc(m.name) +
          '">Set kiosk PIN</button>' +
          '<button class="ppl-btn ghost danger" type="button" data-action="deactivate" data-id="' +
            _esc(m.id) +
          '">Deactivate</button>' +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function pplShowForm() {
  const box = _container && _container.querySelector('#pplModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ppl-modal-title">Add employee</div>' +
    '<div class="ppl-field"><label>Full name *</label><input type="text" id="pplF_name" placeholder="Jane Doe" autocomplete="name"></div>' +
    '<div class="ppl-field"><label>Work email *</label><input type="email" id="pplF_email" placeholder="jane@company.com" autocomplete="off"></div>' +
    '<div class="ppl-field"><label>Temporary password *</label><input type="password" id="pplF_pass" placeholder="Minimum 8 characters" autocomplete="new-password"></div>' +
    '<div class="ppl-field"><label>Role</label><select id="pplF_role">' +
      '<option value="employee">Employee</option>' +
      '<option value="manager">Manager</option>' +
      '<option value="hr">HR</option>' +
      '<option value="teacher">Teacher</option>' +
      '<option value="office">Office</option>' +
      '<option value="school_admin">School admin</option>' +
      '<option value="parent">Parent</option>' +
      '<option value="admin">Admin</option>' +
    '</select></div>' +
    '<div class="ppl-form-actions">' +
      '<button class="ppl-btn ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="ppl-btn" type="button" id="pplSaveBtn">Create</button>' +
    '</div>';
  const modal = _container.querySelector('#pplModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#pplSaveBtn').addEventListener('click', pplCreate);
  const nameInput = box.querySelector('#pplF_name');
  if (nameInput) nameInput.focus();
}

export async function pplCreate() {
  const name = ((_container.querySelector('#pplF_name') || {}).value || '').trim();
  const email = ((_container.querySelector('#pplF_email') || {}).value || '').trim().toLowerCase();
  const temporaryPassword = ((_container.querySelector('#pplF_pass') || {}).value || '').trim();
  const role = ((_container.querySelector('#pplF_role') || {}).value || 'employee').trim();

  if (!name) {
    toast('Name is required', 'error');
    return;
  }
  if (!email || email.indexOf('@') < 0) {
    toast('Valid email is required', 'error');
    return;
  }
  if (temporaryPassword.length < 8) {
    toast('Temporary password must be at least 8 characters', 'error');
    return;
  }

  const btn = _container.querySelector('#pplSaveBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Creating…';
  }

  const result = await api('/api/directory/members', {
    method: 'POST',
    body: { name, email, temporaryPassword, role },
  });

  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Create';
  }

  if (!result || result._error) {
    toast((result && result.message) || 'Failed to create employee', 'error');
    return;
  }

  pplCloseModal();
  toast('Employee added — they must change password on first login', 'success');
  await pplLoadData();
}

export async function pplDeactivate(id) {
  if (!id) return;
  if (!(await confirmDialog({ title: 'Deactivate this employee?', message: 'They will leave the attendance roster.', confirmLabel: 'Deactivate', danger: true }))) return;
  const result = await api.delete('/api/directory/members/' + encodeURIComponent(id));
  if (result && result._error) {
    toast(result.message || 'Failed to deactivate', 'error');
    return;
  }
  toast('Employee deactivated', 'success');
  await pplLoadData();
}

export function pplCloseModal() {
  const modal = _container && _container.querySelector('#pplModal');
  if (modal) modal.classList.remove('open');
}

export function pplShowPinForm(email, name) {
  const box = _container && _container.querySelector('#pplModalBox');
  if (!box || !email) return;
  box.innerHTML =
    '<div class="ppl-modal-title">Set kiosk PIN</div>' +
    '<div class="ppl-hint mf" style="margin-bottom:12px">' +
      _esc(name || email) +
      ' — numeric PIN for the shared device (4–12 digits).' +
    '</div>' +
    '<div class="ppl-field"><label>New PIN *</label><input type="password" id="pplF_pin" inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="e.g. 1234" autocomplete="new-password"></div>' +
    '<div class="ppl-field"><label>Confirm PIN *</label><input type="password" id="pplF_pin2" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="new-password"></div>' +
    '<div class="ppl-form-actions">' +
      '<button class="ppl-btn ghost" type="button" data-action="close-modal">Cancel</button>' +
      '<button class="ppl-btn ghost danger" type="button" id="pplClearPinBtn">Clear PIN</button>' +
      '<button class="ppl-btn" type="button" id="pplSavePinBtn">Save PIN</button>' +
    '</div>';
  const modal = _container.querySelector('#pplModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#pplSavePinBtn').addEventListener('click', function () {
    pplSavePin(email);
  });
  box.querySelector('#pplClearPinBtn').addEventListener('click', function () {
    pplClearPin(email);
  });
  const pinInput = box.querySelector('#pplF_pin');
  if (pinInput) pinInput.focus();
}

export async function pplSavePin(email) {
  const pin = ((_container.querySelector('#pplF_pin') || {}).value || '').trim();
  const pin2 = ((_container.querySelector('#pplF_pin2') || {}).value || '').trim();
  if (!/^\d{4,12}$/.test(pin)) {
    toast('PIN must be 4–12 digits', 'error');
    return;
  }
  if (pin !== pin2) {
    toast('PIN confirmation does not match', 'error');
    return;
  }
  const result = await api.put('/api/kiosk/pins/' + encodeURIComponent(email), { pin: pin });
  if (result && result._error) {
    toast(result.message || 'Failed to set PIN', 'error');
    return;
  }
  if (result && result.success === false) {
    toast(result.error || 'Failed to set PIN', 'error');
    return;
  }
  pplCloseModal();
  toast('Kiosk PIN saved', 'success');
}

export async function pplClearPin(email) {
  if (!(await confirmDialog({ message: 'Clear kiosk PIN for ' + email + '?', confirmLabel: 'Clear PIN', danger: true }))) return;
  const result = await api.delete('/api/kiosk/pins/' + encodeURIComponent(email));
  if (result && result._error) {
    toast(result.message || 'Failed to clear PIN', 'error');
    return;
  }
  pplCloseModal();
  toast('Kiosk PIN cleared', 'success');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#pplAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { pplShowForm(); });

  container.addEventListener('click', function (e) {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const action = t.dataset.action;
    if (action === 'close-modal') pplCloseModal();
    if (action === 'deactivate') pplDeactivate(t.dataset.id);
    if (action === 'set-pin') pplShowPinForm(t.dataset.email, t.dataset.name);
  });
}

registerModule('people', renderPeoplePage);

/** Used by attendance empty-state CTA */
export function goToPeople() {
  navigateToModule('people');
}
