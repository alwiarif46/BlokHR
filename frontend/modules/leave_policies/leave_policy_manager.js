/**
 * Shared Leave Policy Manager — list + method-aware create/edit form.
 * Used by Leave Policies sidebar module and Settings → Leave Configuration.
 * Talks only to /api/leave-policies (and accrue-now).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';

const METHODS = [
  { v: 'flat', l: 'Flat monthly' },
  { v: 'tenure_bucket', l: 'Seniority bands' },
  { v: 'annual_lump', l: 'Annual grant' },
  { v: 'unlimited', l: 'Unlimited' },
];

const METHOD_LABELS = {
  flat: 'Flat monthly',
  tenure_bucket: 'Seniority bands',
  annual_lump: 'Annual grant',
  unlimited: 'Unlimited',
};

/** @type {WeakMap<HTMLElement, { policies: any[], memberTypes: any[], editingId: number|null }>} */
const _stateByRoot = new WeakMap();

function _ensureStyles() {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.querySelector('link[data-module="leave_policies"]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'modules/leave_policies/leave_policies.css';
  link.dataset.module = 'leave_policies';
  document.head.appendChild(link);
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _getState(root) {
  let st = _stateByRoot.get(root);
  if (!st) {
    st = { policies: [], memberTypes: [], editingId: null };
    _stateByRoot.set(root, st);
  }
  return st;
}

function _methodSummary(p) {
  const cfg = p.config || {};
  switch (p.method) {
    case 'flat':
      return (cfg.accrualPerMonth != null ? Number(cfg.accrualPerMonth) : 0) + ' / month';
    case 'tenure_bucket': {
      const n = Array.isArray(cfg.buckets) ? cfg.buckets.length : 0;
      return n ? n + ' seniority band' + (n === 1 ? '' : 's') : 'seniority bands';
    }
    case 'annual_lump':
      return (cfg.annualDays != null ? Number(cfg.annualDays) : 0) + ' days / year';
    case 'unlimited':
      return 'Unlimited';
    default:
      return METHOD_LABELS[p.method] || p.method || '—';
  }
}

function _memberTypeName(st, id) {
  const mt = (st.memberTypes || []).find(function (t) { return t.id === id; });
  return mt ? mt.name : (id || '—');
}

/**
 * @param {HTMLElement} container
 * @param {{ embed?: boolean }} [opts]
 */
export function renderLeavePolicyManager(container, opts) {
  if (!container) return;
  _ensureStyles();
  const embed = !!(opts && opts.embed);
  const st = _getState(container);
  st.editingId = null;

  container.innerHTML =
    '<div class="' + (embed ? 'lp-mgr lp-mgr--embed' : 'lp-wrap lp-mgr') + '">' +
      (embed
        ? '<div class="lp-mgr-note">Configure leave types, monthly or seniority entitlements, and rules per member type. Balances update when accrual runs.</div>'
        : '') +
      '<div class="lp-toolbar">' +
        (embed
          ? '<div class="lp-toolbar-title">Leave policies</div>'
          : '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128220;</span> Leave Policies</div>') +
        '<div class="lp-spacer"></div>' +
        '<button type="button" class="lp-btn ghost" data-lp-action="accrue">Credit balances for this month</button>' +
        '<button type="button" class="lp-btn" data-lp-action="add">+ Add leave type</button>' +
      '</div>' +
      '<div class="lp-stats" data-lp-stats></div>' +
      '<div data-lp-list></div>' +
      '<div class="lp-modal" data-lp-modal><div class="lp-modal-box" data-lp-modal-box></div></div>' +
    '</div>';

  _bind(container);
  _load(container);
}

async function _load(root) {
  const st = _getState(root);
  const listEl = root.querySelector('[data-lp-list]');
  if (listEl) {
    listEl.innerHTML = '<div class="lp-empty"><div class="lp-empty-text">Loading policies…</div></div>';
  }

  const [polRes, setRes] = await Promise.all([
    api.get('/api/leave-policies/all'),
    api.get('/api/settings'),
  ]);

  if (polRes && polRes._error) {
    toast(polRes.message || 'Could not load leave policies', 'error');
    st.policies = [];
  } else {
    st.policies = (polRes && (polRes.policies || [])) || [];
    if (!Array.isArray(st.policies)) st.policies = [];
  }

  st.memberTypes = (setRes && !setRes._error && setRes.memberTypes) ? setRes.memberTypes : [];
  if (!Array.isArray(st.memberTypes) || !st.memberTypes.length) {
    st.memberTypes = [{ id: 'fte', name: 'Full-Time Employee', description: '' }];
  }

  _renderStats(root);
  _renderList(root);
}

function _renderStats(root) {
  const el = root.querySelector('[data-lp-stats]');
  if (!el) return;
  const st = _getState(root);
  const total = st.policies.length;
  const active = st.policies.filter(function (p) { return p.active; }).length;
  const inactive = total - active;
  el.innerHTML =
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--accent)">' + total + '</div><div class="lp-stat-label">Total</div></div>' +
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--status-in)">' + active + '</div><div class="lp-stat-label">Active</div></div>' +
    '<div class="lp-stat"><div class="lp-stat-num" style="color:var(--tx3)">' + inactive + '</div><div class="lp-stat-label">Inactive</div></div>';
}

function _renderList(root) {
  const el = root.querySelector('[data-lp-list]');
  if (!el) return;
  const st = _getState(root);

  if (!st.policies.length) {
    el.innerHTML =
      '<div class="lp-empty">' +
        '<div class="lp-empty-icon">&#128220;</div>' +
        '<div class="lp-empty-text">Add your first leave type</div>' +
        '<button type="button" class="lp-btn" data-lp-action="add" style="margin-top:12px">+ Add leave type</button>' +
      '</div>';
    return;
  }

  let html = '<div class="lp-grid">';
  st.policies.forEach(function (p, i) {
    const badge = p.active
      ? '<span class="lp-card-badge" style="background:var(--accent-dim);color:var(--accent)">Active</span>'
      : '<span class="lp-card-badge" style="background:var(--bg3);color:var(--tx3)">Inactive</span>';
    html +=
      '<div class="lp-card" style="animation-delay:' + (i * 0.03) + 's" data-id="' + _esc(p.id) + '">' +
        '<div class="lp-card-title">' + _esc(p.leaveType) + '</div>' +
        '<div class="lp-card-sub">' +
          _esc(_memberTypeName(st, p.memberTypeId)) + ' · ' +
          _esc(METHOD_LABELS[p.method] || p.method) + ' · ' +
          _esc(_methodSummary(p)) +
        '</div>' +
        badge +
        '<div class="lp-card-meta">' +
          (p.isPaid ? 'Paid' : 'Unpaid') +
          (p.requiresApproval ? ' · Approval' : '') +
          (p.allowHalfDay ? ' · Half-day' : '') +
        '</div>' +
        '<div class="lp-card-actions">' +
          '<button type="button" data-lp-action="edit" data-idx="' + i + '">Edit</button>' +
          (p.active
            ? '<button type="button" class="danger" data-lp-action="deactivate" data-idx="' + i + '">Deactivate</button>'
            : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _bind(root) {
  root.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-lp-action]');
    if (!btn || !root.contains(btn)) return;
    const action = btn.dataset.lpAction;
    const st = _getState(root);
    const idx = parseInt(btn.dataset.idx, 10);

    if (action === 'add') {
      _showForm(root, null);
      return;
    }
    if (action === 'edit') {
      _showForm(root, st.policies[idx] || null);
      return;
    }
    if (action === 'deactivate') {
      _deactivate(root, st.policies[idx]);
      return;
    }
    if (action === 'accrue') {
      _accrueNow(root);
      return;
    }
    if (action === 'close-modal') {
      _closeModal(root);
      return;
    }
    if (action === 'add-bucket') {
      _addBucketRow(root);
      return;
    }
    if (action === 'remove-bucket') {
      const row = btn.closest('[data-bucket-row]');
      if (row) row.remove();
      return;
    }
    if (action === 'save') {
      _save(root);
      return;
    }
  });

  const modal = root.querySelector('[data-lp-modal]');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) _closeModal(root);
    });
  }

  root.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'lpF_method') {
      _renderConfigPanel(root, e.target.value, null);
    }
  });
}

function _showForm(root, item) {
  const st = _getState(root);
  st.editingId = item && item.id != null ? item.id : null;
  const box = root.querySelector('[data-lp-modal-box]');
  const modal = root.querySelector('[data-lp-modal]');
  if (!box || !modal) return;

  const isEdit = !!item;
  const mtOpts = st.memberTypes.map(function (t) {
    const sel = item && item.memberTypeId === t.id ? ' selected' : (!item && t.id === 'fte' ? ' selected' : '');
    return '<option value="' + _esc(t.id) + '"' + sel + '>' + _esc(t.name) + '</option>';
  }).join('');

  const method = (item && item.method) || 'flat';
  const methodOpts = METHODS.map(function (m) {
    return '<option value="' + m.v + '"' + (method === m.v ? ' selected' : '') + '>' + m.l + '</option>';
  }).join('');

  box.innerHTML =
    '<div class="lp-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' leave policy</div>' +
    '<div class="lp-field"><label>Leave type *</label>' +
      '<input type="text" id="lpF_leaveType" value="' + _esc(item && item.leaveType) + '" placeholder="e.g. Casual" ' + (isEdit ? 'readonly' : '') + '></div>' +
    '<div class="lp-field"><label>Member type *</label>' +
      '<select id="lpF_memberType"' + (isEdit ? ' disabled' : '') + '>' + mtOpts + '</select></div>' +
    '<div class="lp-field"><label>Accrual method</label>' +
      '<select id="lpF_method">' + methodOpts + '</select></div>' +
    '<div id="lpConfigPanel"></div>' +
    '<div class="lp-form-grid">' +
      '<div class="lp-field"><label>Probation months</label><input type="number" id="lpF_probationMonths" min="0" step="1" value="' + _esc((item && item.probationMonths) != null ? item.probationMonths : 0) + '"></div>' +
      '<div class="lp-field"><label>Probation accrual / month</label><input type="number" id="lpF_probationAccrual" min="0" step="0.25" value="' + _esc((item && item.probationAccrual) != null ? item.probationAccrual : 0) + '"></div>' +
      '<div class="lp-field"><label>Max carry-forward</label><input type="number" id="lpF_maxCarry" min="0" step="0.5" value="' + _esc((item && item.maxCarryForward) != null ? item.maxCarryForward : 0) + '"></div>' +
      '<div class="lp-field"><label>Max accumulation</label><input type="number" id="lpF_maxAccum" min="0" step="0.5" value="' + _esc((item && item.maxAccumulation) != null ? item.maxAccumulation : 30) + '"></div>' +
      '<div class="lp-field"><label>Min notice days</label><input type="number" id="lpF_minNotice" min="0" step="1" value="' + _esc((item && item.minNoticeDays) != null ? item.minNoticeDays : 0) + '"></div>' +
    '</div>' +
    '<div class="lp-checks">' +
      '<label class="lp-check"><input type="checkbox" id="lpF_isPaid"' + (!(item) || item.isPaid ? ' checked' : '') + '> Paid</label>' +
      '<label class="lp-check"><input type="checkbox" id="lpF_requiresApproval"' + (!(item) || item.requiresApproval ? ' checked' : '') + '> Requires approval</label>' +
      '<label class="lp-check"><input type="checkbox" id="lpF_allowHalfDay"' + (!(item) || item.allowHalfDay !== false ? ' checked' : '') + '> Allow half-day</label>' +
      '<label class="lp-check"><input type="checkbox" id="lpF_encashable"' + (item && item.encashable ? ' checked' : '') + '> Encashable</label>' +
    '</div>' +
    '<div class="lp-form-actions">' +
      '<button type="button" class="lp-btn ghost" data-lp-action="close-modal">Cancel</button>' +
      '<button type="button" class="lp-btn" data-lp-action="save">' + (isEdit ? 'Update' : 'Create') + '</button>' +
    '</div>';

  _renderConfigPanel(root, method, item && item.config);
  modal.classList.add('open');
}

function _renderConfigPanel(root, method, config) {
  const panel = root.querySelector('#lpConfigPanel');
  if (!panel) return;
  const cfg = config || {};

  if (method === 'flat') {
    panel.innerHTML =
      '<div class="lp-field"><label>Days per month *</label>' +
        '<input type="number" id="lpF_accrualPerMonth" min="0" step="0.25" value="' +
        _esc(cfg.accrualPerMonth != null ? cfg.accrualPerMonth : 1) + '"></div>';
    return;
  }

  if (method === 'annual_lump') {
    panel.innerHTML =
      '<div class="lp-field"><label>Days per year *</label>' +
        '<input type="number" id="lpF_annualDays" min="0" step="0.5" value="' +
        _esc(cfg.annualDays != null ? cfg.annualDays : 12) + '"></div>';
    return;
  }

  if (method === 'unlimited') {
    panel.innerHTML = '<div class="lp-field-hint">No accrual limit — balance is not capped by monthly credit.</div>';
    return;
  }

  if (method === 'tenure_bucket') {
    const buckets = Array.isArray(cfg.buckets) && cfg.buckets.length
      ? cfg.buckets
      : [
          { minMonths: 0, maxMonths: 12, accrualPerMonth: 1 },
          { minMonths: 12, maxMonths: null, accrualPerMonth: 1.5 },
        ];
    let html = '<div class="lp-field"><label>Seniority bands</label><div class="lp-buckets" id="lpBuckets">';
    buckets.forEach(function (b) {
      html += _bucketRowHtml(b);
    });
    html += '</div><button type="button" class="lp-btn ghost" data-lp-action="add-bucket" style="margin-top:8px">+ Add band</button></div>';
    panel.innerHTML = html;
    return;
  }

  panel.innerHTML = '';
}

function _bucketRowHtml(b) {
  const maxVal = b.maxMonths == null || b.maxMonths === '' ? '' : b.maxMonths;
  return (
    '<div class="lp-bucket-row" data-bucket-row>' +
      '<input type="number" data-b="min" placeholder="Min mo" min="0" value="' + _esc(b.minMonths != null ? b.minMonths : 0) + '">' +
      '<input type="number" data-b="max" placeholder="Max mo (blank=∞)" min="0" value="' + _esc(maxVal) + '">' +
      '<input type="number" data-b="rate" placeholder="Days/mo" min="0" step="0.25" value="' + _esc(b.accrualPerMonth != null ? b.accrualPerMonth : 1) + '">' +
      '<button type="button" class="lp-bucket-remove" data-lp-action="remove-bucket" title="Remove">×</button>' +
    '</div>'
  );
}

function _addBucketRow(root) {
  const wrap = root.querySelector('#lpBuckets');
  if (!wrap) return;
  wrap.insertAdjacentHTML('beforeend', _bucketRowHtml({ minMonths: 0, maxMonths: null, accrualPerMonth: 1 }));
}

function _readConfig(root, method) {
  if (method === 'flat') {
    const el = root.querySelector('#lpF_accrualPerMonth');
    const n = el ? parseFloat(el.value) : NaN;
    if (isNaN(n) || n < 0) return { error: 'Days per month must be a non-negative number' };
    return { config: { accrualPerMonth: n } };
  }
  if (method === 'annual_lump') {
    const el = root.querySelector('#lpF_annualDays');
    const n = el ? parseFloat(el.value) : NaN;
    if (isNaN(n) || n < 0) return { error: 'Days per year must be a non-negative number' };
    return { config: { annualDays: n } };
  }
  if (method === 'unlimited') {
    return { config: {} };
  }
  if (method === 'tenure_bucket') {
    const rows = root.querySelectorAll('#lpBuckets [data-bucket-row]');
    const buckets = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const minEl = row.querySelector('[data-b="min"]');
      const maxEl = row.querySelector('[data-b="max"]');
      const rateEl = row.querySelector('[data-b="rate"]');
      const minMonths = minEl ? parseFloat(minEl.value) : NaN;
      const maxRaw = maxEl ? maxEl.value.trim() : '';
      const maxMonths = maxRaw === '' ? null : parseFloat(maxRaw);
      const accrualPerMonth = rateEl ? parseFloat(rateEl.value) : NaN;
      if (isNaN(minMonths)) return { error: 'Band ' + (i + 1) + ': min months required' };
      if (maxMonths !== null && isNaN(maxMonths)) return { error: 'Band ' + (i + 1) + ': max months invalid' };
      if (isNaN(accrualPerMonth) || accrualPerMonth < 0) return { error: 'Band ' + (i + 1) + ': rate required' };
      buckets.push({ minMonths: minMonths, maxMonths: maxMonths, accrualPerMonth: accrualPerMonth });
    }
    if (!buckets.length) return { error: 'Add at least one seniority band' };
    return { config: { buckets: buckets } };
  }
  return { error: 'Unsupported method' };
}

function _num(root, id, fallback) {
  const el = root.querySelector('#' + id);
  if (!el || el.value === '') return fallback;
  const n = parseFloat(el.value);
  return isNaN(n) ? fallback : n;
}

async function _save(root) {
  const st = _getState(root);
  const leaveTypeEl = root.querySelector('#lpF_leaveType');
  const memberTypeEl = root.querySelector('#lpF_memberType');
  const methodEl = root.querySelector('#lpF_method');
  const leaveType = leaveTypeEl ? leaveTypeEl.value.trim() : '';
  const memberTypeId = memberTypeEl ? memberTypeEl.value : 'fte';
  const method = methodEl ? methodEl.value : 'flat';

  if (!leaveType) {
    toast('Leave type is required', 'error');
    return;
  }

  const cfgResult = _readConfig(root, method);
  if (cfgResult.error) {
    toast(cfgResult.error, 'error');
    return;
  }

  const body = {
    leaveType: leaveType,
    memberTypeId: memberTypeId,
    method: method,
    config: cfgResult.config,
    probationMonths: _num(root, 'lpF_probationMonths', 0),
    probationAccrual: _num(root, 'lpF_probationAccrual', 0),
    maxCarryForward: _num(root, 'lpF_maxCarry', 0),
    maxAccumulation: _num(root, 'lpF_maxAccum', 30),
    minNoticeDays: _num(root, 'lpF_minNotice', 0),
    isPaid: !!(root.querySelector('#lpF_isPaid') && root.querySelector('#lpF_isPaid').checked),
    requiresApproval: !!(root.querySelector('#lpF_requiresApproval') && root.querySelector('#lpF_requiresApproval').checked),
    allowHalfDay: !!(root.querySelector('#lpF_allowHalfDay') && root.querySelector('#lpF_allowHalfDay').checked),
    encashable: !!(root.querySelector('#lpF_encashable') && root.querySelector('#lpF_encashable').checked),
  };

  let result;
  if (st.editingId != null) {
    const updateBody = Object.assign({}, body);
    delete updateBody.leaveType;
    delete updateBody.memberTypeId;
    result = await api.put('/api/leave-policies/' + st.editingId, updateBody);
  } else {
    result = await api.post('/api/leave-policies', body);
  }

  if (result && result._error) {
    toast(result.message || 'Failed to save policy', 'error');
    return;
  }
  if (result && result.success === false) {
    toast(result.error || 'Failed to save policy', 'error');
    return;
  }

  toast(st.editingId != null ? 'Policy updated' : 'Policy created', 'success');
  _closeModal(root);
  await _load(root);
}

async function _deactivate(root, item) {
  if (!item || !item.id) return;
  if (!(await confirmDialog({ message: 'Deactivate policy "' + item.leaveType + '" for ' + (item.memberTypeId || '') + '?', confirmLabel: 'Deactivate', danger: true }))) return;
  const result = await api.delete('/api/leave-policies/' + item.id);
  if (result && result._error) {
    toast(result.message || 'Failed to deactivate', 'error');
    return;
  }
  toast('Policy deactivated', 'success');
  await _load(root);
}

async function _accrueNow(root) {
  const result = await api.post('/api/leave-policies/accrue-now', {});
  if (result && result._error) {
    toast(result.message || 'Accrual failed', 'error');
    return;
  }
  const n = result && result.accrualCount != null ? result.accrualCount : 0;
  toast('Credited ' + n + ' balance update' + (n === 1 ? '' : 's') + ' for this month', 'success');
}

function _closeModal(root) {
  const modal = root.querySelector('[data-lp-modal]');
  if (modal) modal.classList.remove('open');
  const st = _getState(root);
  st.editingId = null;
}
