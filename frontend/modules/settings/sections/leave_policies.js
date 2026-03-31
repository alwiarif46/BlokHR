/**
 * modules/leave_policies/leave_policies.js
 * Leave policy management: types, accrual rules, sandwich policy, encashment.
 * Pattern: renderLeavePoliciesPage() → lpLoadData() → lpRenderStats()
 *          → lpRender() → CRUD → lpCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _policies = [];
let _tab = 'policies'; // 'policies' | 'accrual'
let _search = '';

const _mock = [
  { id: 'lp1', name: 'Annual Leave',      accrual_rate: 1.5, max_days: 18, carry_forward: true,  carry_forward_limit: 5, medical_cert_days: 0, min_notice_days: 7,  max_consecutive_days: 15, probation_mode: 'no_accrual', sandwich_policy: 'exclude_weekends', allow_half_day: true,  allow_negative: false, enabled: true },
  { id: 'lp2', name: 'Sick Leave',        accrual_rate: 1.0, max_days: 12, carry_forward: false, carry_forward_limit: 0, medical_cert_days: 3, min_notice_days: 0,  max_consecutive_days: 7,  probation_mode: 'full',        sandwich_policy: 'exclude_weekends', allow_half_day: true,  allow_negative: false, enabled: true },
  { id: 'lp3', name: 'Casual Leave',      accrual_rate: 0.5, max_days: 7,  carry_forward: false, carry_forward_limit: 0, medical_cert_days: 0, min_notice_days: 1,  max_consecutive_days: 3,  probation_mode: 'reduced_rate',sandwich_policy: 'count_weekends',   allow_half_day: true,  allow_negative: false, enabled: true },
  { id: 'lp4', name: 'Maternity Leave',   accrual_rate: 0,   max_days: 182,carry_forward: false, carry_forward_limit: 0, medical_cert_days: 0, min_notice_days: 30, max_consecutive_days: 182,probation_mode: 'no_accrual',   sandwich_policy: 'count_weekends',   allow_half_day: false, allow_negative: false, enabled: true },
  { id: 'lp5', name: 'Comp Off',          accrual_rate: 0,   max_days: 3,  carry_forward: false, carry_forward_limit: 0, medical_cert_days: 0, min_notice_days: 0,  max_consecutive_days: 2,  probation_mode: 'full',         sandwich_policy: 'exclude_weekends', allow_half_day: true,  allow_negative: false, enabled: true },
  { id: 'lp6', name: 'Paternity Leave',   accrual_rate: 0,   max_days: 15, carry_forward: false, carry_forward_limit: 0, medical_cert_days: 0, min_notice_days: 7,  max_consecutive_days: 15, probation_mode: 'no_accrual',   sandwich_policy: 'count_weekends',   allow_half_day: false, allow_negative: false, enabled: true },
];

export function renderLeavePoliciesPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="lp-wrap">' +
      '<div class="lp-toolbar">' +
        '<div class="lp-tabs" id="lpTabs">' +
          '<button class="lp-tab active" data-tab="policies">Leave Types</button>' +
          '<button class="lp-tab" data-tab="accrual">Accrual Rules</button>' +
        '</div>' +
        '<input class="lp-search" id="lpSearch" placeholder="Search policies…" autocomplete="off">' +
        (isAdmin ? '<button class="lp-btn" id="lpAddBtn">+ Add Policy</button>' : '') +
      '</div>' +
      '<div id="lpStats" class="lp-stats"></div>' +
      '<div id="lpContent"></div>' +
      '<div class="lp-modal" id="lpModal"><div class="lp-modal-box" id="lpModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  lpLoadData();
}

export async function lpLoadData() {
  const d = await api.get('/api/leave-policies');
  _policies = (d && !d._error) ? (d.policies || d || []) : _mock;
  if (!Array.isArray(_policies)) _policies = _mock;
  lpRenderStats();
  lpRender();
}

export function lpRenderStats() {
  const el = _container && _container.querySelector('#lpStats');
  if (!el) return;
  const enabled = _policies.filter(p => p.enabled !== false).length;
  const totalDays = _policies.reduce((s, p) => s + (p.max_days || 0), 0);
  const withCF = _policies.filter(p => p.carry_forward).length;
  el.innerHTML =
    _sc(_policies.length, 'Total Policies', 'var(--accent)') +
    _sc(enabled, 'Active', 'var(--status-in)') +
    _sc(totalDays, 'Max Days/Yr', 'var(--status-break)') +
    _sc(withCF, 'Carry Forward', 'var(--status-absent)');
}

function _sc(n, l, c) {
  return '<div class="lp-stat"><div class="lp-stat-n" style="color:' + c + '">' + n + '</div><div class="lp-stat-l">' + l + '</div></div>';
}

export function lpRender() {
  const el = _container && _container.querySelector('#lpContent');
  if (!el) return;
  _tab === 'accrual' ? _renderAccrual(el) : _renderPolicies(el);
}

function _renderPolicies(el) {
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _policies.filter(p => !_search || (p.name || '').toLowerCase().includes(_search));
  if (!items.length) {
    el.innerHTML = '<div class="lp-empty"><div style="font-size:2rem">&#128203;</div><div>No policies found</div></div>';
    return;
  }
  let html = '<div class="lp-grid">';
  items.forEach(function (p, i) {
    const enabled = p.enabled !== false;
    html +=
      '<div class="lp-card' + (!enabled ? ' lp-disabled' : '') + '" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="lp-card-hdr">' +
          '<div class="lp-card-name">' + _esc(p.name) + '</div>' +
          '<span class="lp-badge ' + (enabled ? 'lp-active' : 'lp-inactive') + '">' + (enabled ? 'Active' : 'Disabled') + '</span>' +
        '</div>' +
        '<div class="lp-card-meta">' +
          '<div class="lp-meta-item"><span class="lp-meta-lbl">Max Days</span><span class="lp-meta-val">' + (p.max_days || 0) + '</span></div>' +
          '<div class="lp-meta-item"><span class="lp-meta-lbl">Accrual</span><span class="lp-meta-val">' + (p.accrual_rate || 0) + '/mo</span></div>' +
          '<div class="lp-meta-item"><span class="lp-meta-lbl">Carry Fwd</span><span class="lp-meta-val">' + (p.carry_forward ? (p.carry_forward_limit ? p.carry_forward_limit + 'd' : 'Yes') : 'No') + '</span></div>' +
          '<div class="lp-meta-item"><span class="lp-meta-lbl">Min Notice</span><span class="lp-meta-val">' + (p.min_notice_days || 0) + 'd</span></div>' +
        '</div>' +
        '<div class="lp-card-flags">' +
          (p.allow_half_day ? '<span class="lp-flag">Half Day</span>' : '') +
          (p.allow_negative ? '<span class="lp-flag lp-flag-warn">Allow Negative</span>' : '') +
          (p.medical_cert_days ? '<span class="lp-flag">Cert after ' + p.medical_cert_days + 'd</span>' : '') +
        '</div>' +
        (isAdmin
          ? '<div class="lp-card-actions">' +
              '<button data-action="toggle" data-id="' + _esc(p.id) + '" class="lp-btn-sm">' + (enabled ? 'Disable' : 'Enable') + '</button>' +
              '<button data-action="edit" data-id="' + _esc(p.id) + '" class="lp-btn-sm">Edit</button>' +
              '<button data-action="delete" data-id="' + _esc(p.id) + '" class="lp-btn-sm danger">Delete</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderAccrual(el) {
  const items = _policies.filter(p => p.accrual_rate > 0 && !_search || (p.name || '').toLowerCase().includes(_search));
  let html = '<div class="lp-table-wrap"><table class="lp-table"><thead><tr><th>Policy</th><th>Rate/Month</th><th>Max Days</th><th>Probation</th><th>Sandwich</th></tr></thead><tbody>';
  items.forEach(function (p) {
    html += '<tr>' +
      '<td>' + _esc(p.name) + '</td>' +
      '<td>' + (p.accrual_rate || 0) + ' days</td>' +
      '<td>' + (p.max_days || 0) + '</td>' +
      '<td>' + _esc((p.probation_mode || 'full').replace(/_/g, ' ')) + '</td>' +
      '<td>' + _esc((p.sandwich_policy || 'exclude_weekends').replace(/_/g, ' ')) + '</td>' +
    '</tr>';
  });
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

export function lpShowForm(policy) {
  const isEdit = !!policy;
  const p = policy || {};
  const box = _container && _container.querySelector('#lpModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="lp-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Leave Policy</div>' +
    '<div class="lp-field"><label>Policy Name *</label><input type="text" id="lpFName" value="' + _esc(p.name || '') + '"></div>' +
    '<div class="lp-row2">' +
      '<div class="lp-field"><label>Max Days/Year</label><input type="number" id="lpFMax" value="' + (p.max_days || 0) + '" min="0" max="365"></div>' +
      '<div class="lp-field"><label>Accrual Rate/Month</label><input type="number" id="lpFAccrual" value="' + (p.accrual_rate || 0) + '" min="0" step="0.25" max="30"></div>' +
    '</div>' +
    '<div class="lp-row2">' +
      '<div class="lp-field"><label>Min Notice (days)</label><input type="number" id="lpFNotice" value="' + (p.min_notice_days || 0) + '" min="0"></div>' +
      '<div class="lp-field"><label>Max Consecutive (days)</label><input type="number" id="lpFConsec" value="' + (p.max_consecutive_days || 0) + '" min="0"></div>' +
    '</div>' +
    '<div class="lp-row2">' +
      '<div class="lp-field"><label>Medical Cert After (days)</label><input type="number" id="lpFCert" value="' + (p.medical_cert_days || 0) + '" min="0"></div>' +
      '<div class="lp-field"><label>Carry Fwd Limit</label><input type="number" id="lpFCF" value="' + (p.carry_forward_limit || 0) + '" min="0"></div>' +
    '</div>' +
    '<div class="lp-field"><label>Probation Mode</label><select id="lpFProb">' +
      '<option value="no_accrual"' + (p.probation_mode === 'no_accrual' ? ' selected' : '') + '>No Accrual</option>' +
      '<option value="reduced_rate"' + (p.probation_mode === 'reduced_rate' ? ' selected' : '') + '>Reduced Rate</option>' +
      '<option value="accrue_no_use"' + (p.probation_mode === 'accrue_no_use' ? ' selected' : '') + '>Accrue No Use</option>' +
      '<option value="full"' + (!p.probation_mode || p.probation_mode === 'full' ? ' selected' : '') + '>Full</option>' +
    '</select></div>' +
    '<div class="lp-field"><label>Sandwich Policy</label><select id="lpFSand">' +
      '<option value="exclude_weekends"' + (!p.sandwich_policy || p.sandwich_policy === 'exclude_weekends' ? ' selected' : '') + '>Exclude Weekends</option>' +
      '<option value="count_weekends"' + (p.sandwich_policy === 'count_weekends' ? ' selected' : '') + '>Count Weekends</option>' +
    '</select></div>' +
    '<div class="lp-checkrow">' +
      '<label><input type="checkbox" id="lpFHalf"' + (p.allow_half_day !== false ? ' checked' : '') + '> Allow Half Day</label>' +
      '<label><input type="checkbox" id="lpFCFEnabled"' + (p.carry_forward ? ' checked' : '') + '> Carry Forward</label>' +
      '<label><input type="checkbox" id="lpFNeg"' + (p.allow_negative ? ' checked' : '') + '> Allow Negative Balance</label>' +
    '</div>' +
    '<div class="lp-form-actions">' +
      '<button class="lp-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="lp-btn" id="lpSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button>' +
    '</div>';
  _container.querySelector('#lpModal').classList.add('open');
  box.querySelector('#lpSaveBtn').addEventListener('click', () => _save(policy, isEdit));
}

async function _save(policy, isEdit) {
  const box = _container && _container.querySelector('#lpModalBox');
  if (!box) return;
  const name = (box.querySelector('#lpFName').value || '').trim();
  if (!name) { toast('Policy name is required', 'error'); return; }
  const body = {
    name,
    max_days: parseFloat(box.querySelector('#lpFMax').value) || 0,
    accrual_rate: parseFloat(box.querySelector('#lpFAccrual').value) || 0,
    min_notice_days: parseInt(box.querySelector('#lpFNotice').value) || 0,
    max_consecutive_days: parseInt(box.querySelector('#lpFConsec').value) || 0,
    medical_cert_days: parseInt(box.querySelector('#lpFCert').value) || 0,
    carry_forward: box.querySelector('#lpFCFEnabled').checked,
    carry_forward_limit: parseInt(box.querySelector('#lpFCF').value) || 0,
    probation_mode: box.querySelector('#lpFProb').value,
    sandwich_policy: box.querySelector('#lpFSand').value,
    allow_half_day: box.querySelector('#lpFHalf').checked,
    allow_negative: box.querySelector('#lpFNeg').checked,
    enabled: true,
  };
  const result = isEdit ? await api.put('/api/leave-policies/' + policy.id, body) : await api.post('/api/leave-policies', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); lpCloseModal(); lpLoadData(); return; }
  if (isEdit) { const i = _policies.findIndex(p => p.id === policy.id); if (i >= 0) Object.assign(_policies[i], body); }
  else _policies.push({ id: 'lp' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
  lpCloseModal(); lpRenderStats(); lpRender();
}

export async function lpToggle(id) {
  const p = _policies.find(x => x.id === id);
  if (!p) return;
  const newEnabled = !(p.enabled !== false);
  const result = await api.put('/api/leave-policies/' + id, { enabled: newEnabled });
  if (result && !result._error) { toast(newEnabled ? 'Enabled' : 'Disabled', 'success'); lpLoadData(); return; }
  p.enabled = newEnabled;
  toast((newEnabled ? 'Enabled' : 'Disabled') + ' (demo)', 'success');
  lpRenderStats(); lpRender();
}

export async function lpDelete(id) {
  if (!confirm('Delete this leave policy? This cannot be undone.')) return;
  const result = await api.delete('/api/leave-policies/' + id);
  if (result && !result._error) { toast('Deleted', 'success'); lpLoadData(); return; }
  _policies = _policies.filter(p => p.id !== id);
  toast('Deleted (demo)', 'success'); lpRenderStats(); lpRender();
}

export function lpCloseModal() {
  const m = _container && _container.querySelector('#lpModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#lpTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.lp-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.lp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    lpRender();
  });
  const s = container.querySelector('#lpSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); lpRender(); });
  const ab = container.querySelector('#lpAddBtn');
  if (ab) ab.addEventListener('click', () => lpShowForm(null));
  const modal = container.querySelector('#lpModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) lpCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') lpCloseModal();
    else if (action === 'edit') { const p = _policies.find(x => x.id === id); if (p) lpShowForm(p); }
    else if (action === 'delete') lpDelete(id);
    else if (action === 'toggle') lpToggle(id);
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getPolicies() { return _policies; }
export function _setPolicies(list) { _policies = list; }
export function _resetState() { _container = null; _policies = []; _tab = 'policies'; _search = ''; }

registerModule('leave_policies', renderLeavePoliciesPage);
