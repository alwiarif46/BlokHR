/**
 * modules/expenses/expenses.js
 * Expenses & Approvals — my claims, pending approvals, policies.
 * Pattern: renderExpensesPage() → expLoadData() → expRenderStats() → expRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'meals', label: 'Meals' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'client', label: 'Client' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed',
};

let _container = null;
let _tab = 'mine';
let _mine = [];
let _pending = [];
let _policies = [];
let _loadError = null;
let _featureOff = false;
let _saving = false;
let _editing = null;
let _pendingFileId = null;

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _labelOf(list, value) {
  const found = list.find((x) => x.value === value);
  return found ? found.label : value || '—';
}

function _fmtAmount(amount, currency) {
  const n = Number(amount) || 0;
  return (currency || 'INR') + ' ' + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function _statusBadge(status) {
  const label = STATUS_LABELS[status] || status || '—';
  let color = 'var(--tx2)';
  if (status === 'approved' || status === 'reimbursed') color = 'var(--status-in)';
  else if (status === 'submitted') color = 'var(--accent)';
  else if (status === 'rejected') color = 'var(--status-absent)';
  else if (status === 'draft') color = 'var(--tx3)';
  return (
    '<span class="exp-card-badge" style="background:var(--accent-dim);color:' +
    color +
    '">' +
    _esc(label) +
    '</span>'
  );
}

export function _normalizeExpense(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    email: raw.email || '',
    fileId: raw.file_id || raw.fileId || null,
    vendor: raw.vendor || '',
    amount: Number(raw.amount) || 0,
    currency: raw.currency || 'INR',
    receiptDate: raw.receipt_date || raw.receiptDate || '',
    category: raw.category || 'other',
    description: raw.description || '',
    status: raw.status || 'draft',
    currentLevel: Number(raw.current_level != null ? raw.current_level : raw.currentLevel) || 1,
    ocrRawJson: raw.ocr_raw_json || raw.ocrRawJson || '{}',
    approverEmail: raw.approver_email || raw.approverEmail || '',
    rejectionReason: raw.rejection_reason || raw.rejectionReason || '',
    reimbursedAt: raw.reimbursed_at || raw.reimbursedAt || null,
    reimbursedBy: raw.reimbursed_by || raw.reimbursedBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

export function _normalizePolicy(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    category: raw.category,
    maxAmountPerClaim: Number(raw.max_amount_per_claim != null ? raw.max_amount_per_claim : raw.maxAmountPerClaim) || 0,
    monthlyCap: Number(raw.monthly_cap != null ? raw.monthly_cap : raw.monthlyCap) || 0,
    requiresReceipt: !!(raw.requires_receipt === 1 || raw.requiresReceipt === true || raw.requiresReceipt === 1),
    active: raw.active !== 0 && raw.active !== false,
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

export function _normalizeApproval(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    receiptId: raw.receipt_id || raw.receiptId || '',
    level: Number(raw.level) || 1,
    role: raw.role || '',
    approverEmail: raw.approver_email || raw.approverEmail || '',
    action: raw.action || '',
    reason: raw.reason || '',
    actedAt: raw.acted_at || raw.actedAt || '',
  };
}

export function renderExpensesPage(container) {
  _container = container;
  _tab = 'mine';
  _editing = null;
  _pendingFileId = null;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="exp-wrap" id="expWrap">' +
      '<div class="exp-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128176;</span> Expenses</div>' +
        '<div class="exp-spacer"></div>' +
        '<button type="button" class="exp-btn" id="expAddBtn" style="display:none">+ Add</button>' +
      '</div>' +
      '<div class="exp-tabs" id="expTabs">' +
        '<button type="button" class="exp-tab active" data-tab="mine">My Expenses</button>' +
        '<button type="button" class="exp-tab" data-tab="approvals">Approvals</button>' +
        (admin ? '<button type="button" class="exp-tab" data-tab="policies">Policies</button>' : '') +
      '</div>' +
      '<div class="exp-stats" id="expStats"></div>' +
      '<div id="expContent"></div>' +
      '<div class="exp-modal" id="expModal"><div class="exp-modal-box wide" id="expModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _syncAddButton();
  expLoadData();
}

function _syncAddButton() {
  const btn = _container && _container.querySelector('#expAddBtn');
  if (!btn) return;
  btn.style.display = _tab === 'mine' ? '' : 'none';
}

export async function expLoadData() {
  _loadError = null;
  _featureOff = false;

  const [mineRes, pendingRes, policiesRes] = await Promise.all([
    api.get('/api/expenses/mine'),
    api.get('/api/expenses/pending-approvals'),
    _isAdmin() ? api.get('/api/expense-policies') : Promise.resolve({ policies: [] }),
  ]);

  if (mineRes && mineRes._error) {
    _mine = [];
    _loadError = mineRes.message || 'Could not load expenses';
    if (mineRes.status === 404) {
      _featureOff = true;
      _loadError = 'Expenses is disabled for this workspace';
    }
  } else {
    const rows = (mineRes && (mineRes.expenses || mineRes.receipts || mineRes)) || [];
    _mine = (Array.isArray(rows) ? rows : []).map(_normalizeExpense);
  }

  if (pendingRes && !pendingRes._error) {
    const rows = pendingRes.expenses || [];
    _pending = (Array.isArray(rows) ? rows : []).map(_normalizeExpense);
  } else {
    _pending = [];
  }

  if (policiesRes && !policiesRes._error) {
    const rows = policiesRes.policies || [];
    _policies = (Array.isArray(rows) ? rows : []).map(_normalizePolicy);
  } else {
    _policies = [];
  }

  expRenderStats();
  expRender();
}

export function expRenderStats() {
  const el = _container && _container.querySelector('#expStats');
  if (!el) return;
  const pending = _mine.filter((e) => e.status === 'submitted').length + _pending.length;
  const approved = _mine.filter((e) => e.status === 'approved').length;
  const reimbursed = _mine.filter((e) => e.status === 'reimbursed').length;
  const totalAmount = _mine.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  el.innerHTML =
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--status-break)">' +
    pending +
    '</div><div class="exp-stat-label">Pending</div></div>' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--status-in)">' +
    approved +
    '</div><div class="exp-stat-label">Approved</div></div>' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--accent)">' +
    _esc(String(Math.round(totalAmount))) +
    '</div><div class="exp-stat-label">Total Amount</div></div>' +
    '<div class="exp-stat"><div class="exp-stat-num" style="color:var(--tx2)">' +
    reimbursed +
    '</div><div class="exp-stat-label">Reimbursed</div></div>';
}

function _empty(text) {
  return (
    '<div class="exp-empty"><div class="exp-empty-icon">&#128176;</div><div class="exp-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

export function expRender() {
  const el = _container && _container.querySelector('#expContent');
  if (!el) return;
  _syncAddButton();

  if (_featureOff) {
    el.innerHTML = _empty(_loadError || 'Expenses is disabled');
    return;
  }

  if (_tab === 'mine') {
    if (_loadError && !_mine.length) {
      el.innerHTML = _empty(_loadError);
      return;
    }
    if (!_mine.length) {
      el.innerHTML = _empty('No expenses yet — add a claim');
      return;
    }
    el.innerHTML = '<div class="exp-grid">' + _mine.map(_renderMineCard).join('') + '</div>';
    return;
  }

  if (_tab === 'approvals') {
    if (!_pending.length) {
      el.innerHTML = _empty('No pending approvals');
      return;
    }
    el.innerHTML = '<div class="exp-grid">' + _pending.map(_renderApprovalCard).join('') + '</div>';
    return;
  }

  if (_tab === 'policies') {
    if (!_isAdmin()) {
      el.innerHTML = _empty('Admin only');
      return;
    }
    if (!_policies.length) {
      el.innerHTML = _empty('No policies configured');
      return;
    }
    el.innerHTML = '<div class="exp-grid">' + _policies.map(_renderPolicyCard).join('') + '</div>';
  }
}

function _renderMineCard(item, i) {
  let actions =
    '<button type="button" data-action="detail" data-id="' + _esc(item.id) + '">Detail</button>';
  if (item.status === 'draft') {
    actions +=
      '<button type="button" data-action="edit" data-id="' +
      _esc(item.id) +
      '">Edit</button>' +
      '<button type="button" data-action="submit" data-id="' +
      _esc(item.id) +
      '">Submit</button>' +
      '<button type="button" class="danger" data-action="delete" data-id="' +
      _esc(item.id) +
      '">Delete</button>';
  }
  return (
    '<div class="exp-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="exp-card-title">' +
    _esc(item.vendor || item.description || 'Expense') +
    '</div>' +
    '<div class="exp-card-amount">' +
    _esc(_fmtAmount(item.amount, item.currency)) +
    '</div>' +
    '<div class="exp-card-sub">' +
    _esc(_labelOf(CATEGORIES, item.category)) +
    (item.receiptDate ? ' · ' + _esc(item.receiptDate) : '') +
    '</div>' +
    _statusBadge(item.status) +
    '<div class="exp-card-actions">' +
    actions +
    '</div></div>'
  );
}

function _renderApprovalCard(item, i) {
  const admin = _isAdmin();
  let actions =
    '<button type="button" data-action="detail" data-id="' +
    _esc(item.id) +
    '">Detail</button>' +
    '<button type="button" data-action="approve" data-id="' +
    _esc(item.id) +
    '">Approve</button>' +
    '<button type="button" class="danger" data-action="reject" data-id="' +
    _esc(item.id) +
    '">Reject</button>';
  return (
    '<div class="exp-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="exp-card-title">' +
    _esc(item.vendor || 'Expense') +
    '</div>' +
    '<div class="exp-card-amount">' +
    _esc(_fmtAmount(item.amount, item.currency)) +
    '</div>' +
    '<div class="exp-card-sub">' +
    _esc(item.email) +
    ' · ' +
    _esc(_labelOf(CATEGORIES, item.category)) +
    ' · Level ' +
    _esc(String(item.currentLevel)) +
    '</div>' +
    _statusBadge(item.status) +
    '<div class="exp-card-actions">' +
    actions +
    (admin
      ? ''
      : '') +
    '</div></div>'
  );
}

function _renderPolicyCard(item, i) {
  return (
    '<div class="exp-card" style="animation-delay:' +
    i * 0.04 +
    's" data-category="' +
    _esc(item.category) +
    '">' +
    '<div class="exp-card-title">' +
    _esc(_labelOf(CATEGORIES, item.category)) +
    '</div>' +
    '<div class="exp-card-sub">Per claim: ' +
    _esc(item.maxAmountPerClaim > 0 ? String(item.maxAmountPerClaim) : 'Unlimited') +
    ' · Monthly: ' +
    _esc(item.monthlyCap > 0 ? String(item.monthlyCap) : 'Unlimited') +
    (item.requiresReceipt ? ' · Receipt required' : '') +
    '</div>' +
    '<div class="exp-card-actions">' +
    '<button type="button" data-action="edit-policy" data-category="' +
    _esc(item.category) +
    '">Edit</button>' +
    '</div></div>'
  );
}

function _optionsHtml(list, selected) {
  return list
    .map(
      (t) =>
        '<option value="' +
        t.value +
        '"' +
        (selected === t.value ? ' selected' : '') +
        '>' +
        _esc(t.label) +
        '</option>',
    )
    .join('');
}

function _readFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function _uploadReceiptFile(file) {
  const dataUrl = await _readFileAsDataUrl(file);
  const result = await api.post('/api/storage/upload', {
    file: dataUrl,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contextType: 'expense',
    contextId: '',
  });
  if (result && !result._error && (result.fileId || (result.file && result.file.id))) {
    return result.fileId || result.file.id;
  }
  throw new Error((result && result.message) || 'Upload failed');
}

export function expShowForm(item) {
  _editing = item || null;
  _pendingFileId = item && item.fileId ? item.fileId : null;
  const isEdit = !!item;
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="exp-modal-title">' +
    (isEdit ? 'Edit Expense' : 'New Expense') +
    '</div>' +
    '<div class="exp-row">' +
    '<div class="exp-field" style="flex:1"><label>Vendor</label><input type="text" id="expF_vendor" value="' +
    _esc(item ? item.vendor : '') +
    '"></div>' +
    '<div class="exp-field" style="flex:1"><label>Amount *</label><input type="number" id="expF_amount" min="0" step="0.01" value="' +
    _esc(item ? String(item.amount || '') : '') +
    '"></div>' +
    '</div>' +
    '<div class="exp-row">' +
    '<div class="exp-field" style="flex:1"><label>Category</label><select id="expF_category">' +
    _optionsHtml(CATEGORIES, item ? item.category : 'other') +
    '</select></div>' +
    '<div class="exp-field" style="flex:1"><label>Currency</label><input type="text" id="expF_currency" value="' +
    _esc(item ? item.currency : 'INR') +
    '"></div>' +
    '<div class="exp-field" style="flex:1"><label>Receipt Date</label><input type="date" id="expF_date" value="' +
    _esc(item ? String(item.receiptDate).slice(0, 10) : '') +
    '"></div>' +
    '</div>' +
    '<div class="exp-field"><label>Description</label><textarea id="expF_description" rows="2">' +
    _esc(item ? item.description : '') +
    '</textarea></div>' +
    '<div class="exp-field"><label>Receipt file</label><input type="file" id="expF_file" accept="image/*,.pdf">' +
    '<div class="exp-card-sub" id="expFileHint">' +
    (_pendingFileId ? 'Attached: ' + _esc(_pendingFileId) : 'Optional — required by some policies') +
    '</div></div>' +
    '<div class="exp-form-actions">' +
    '<button type="button" class="exp-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="exp-btn" id="expSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#expModal');
  if (modal) modal.classList.add('open');
  const fileInput = box.querySelector('#expF_file');
  if (fileInput) {
    fileInput.addEventListener('change', async function () {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        _pendingFileId = await _uploadReceiptFile(file);
        const hint = box.querySelector('#expFileHint');
        if (hint) hint.textContent = 'Attached: ' + _pendingFileId;
        toast('Receipt uploaded', 'success');
      } catch (err) {
        toast(err.message || 'Upload failed', 'error');
      }
    });
  }
  const saveBtn = box.querySelector('#expSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', expSave);
}

export async function expSave() {
  if (_saving) return;
  const amount = Number((_container.querySelector('#expF_amount') || {}).value);
  if (!amount || amount <= 0) {
    toast('Amount is required', 'error');
    return;
  }
  const body = {
    vendor: ((_container.querySelector('#expF_vendor') || {}).value || '').trim(),
    amount,
    currency: ((_container.querySelector('#expF_currency') || {}).value || 'INR').trim(),
    category: (_container.querySelector('#expF_category') || {}).value || 'other',
    receiptDate: ((_container.querySelector('#expF_date') || {}).value || '').trim(),
    description: ((_container.querySelector('#expF_description') || {}).value || '').trim(),
    fileId: _pendingFileId,
  };

  _saving = true;
  let result;
  if (_editing && _editing.id) {
    result = await api.put('/api/expenses/' + _editing.id, body);
  } else {
    result = await api.post('/api/expenses', body);
  }
  _saving = false;

  if (result && !result._error) {
    toast(_editing ? 'Updated' : 'Created', 'success');
    expCloseModal();
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to save', 'error');
}

export function expShowPolicyForm(category) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const policy = _policies.find((p) => p.category === category);
  if (!policy) return;
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="exp-modal-title">Policy — ' +
    _esc(_labelOf(CATEGORIES, category)) +
    '</div>' +
    '<div class="exp-field"><label>Max per claim (0 = unlimited)</label><input type="number" id="expP_max" min="0" value="' +
    _esc(String(policy.maxAmountPerClaim)) +
    '"></div>' +
    '<div class="exp-field"><label>Monthly cap (0 = unlimited)</label><input type="number" id="expP_month" min="0" value="' +
    _esc(String(policy.monthlyCap)) +
    '"></div>' +
    '<div class="exp-field"><label><input type="checkbox" id="expP_receipt"' +
    (policy.requiresReceipt ? ' checked' : '') +
    '> Requires receipt attachment</label></div>' +
    '<div class="exp-field"><label><input type="checkbox" id="expP_active"' +
    (policy.active ? ' checked' : '') +
    '> Active</label></div>' +
    '<div class="exp-form-actions">' +
    '<button type="button" class="exp-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="exp-btn" id="expPolicySave">Save</button></div>';
  const modal = _container.querySelector('#expModal');
  if (modal) modal.classList.add('open');
  const btn = box.querySelector('#expPolicySave');
  if (btn) {
    btn.addEventListener('click', async function () {
      const result = await api.put('/api/expense-policies/' + category, {
        maxAmountPerClaim: Number((_container.querySelector('#expP_max') || {}).value) || 0,
        monthlyCap: Number((_container.querySelector('#expP_month') || {}).value) || 0,
        requiresReceipt: !!(_container.querySelector('#expP_receipt') || {}).checked,
        active: !!(_container.querySelector('#expP_active') || {}).checked,
      });
      if (result && !result._error) {
        toast('Policy updated', 'success');
        expCloseModal();
        await expLoadData();
        return;
      }
      toast((result && result.message) || 'Failed', 'error');
    });
  }
}

export async function expShowDetail(id) {
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  box.innerHTML = '<div class="exp-modal-title">Loading…</div>';
  const modal = _container.querySelector('#expModal');
  if (modal) modal.classList.add('open');

  const res = await api.get('/api/expenses/' + id);
  if (res && res._error) {
    box.innerHTML =
      '<div class="exp-modal-title">Expense</div><div class="exp-empty-text">' +
      _esc(res.message || 'Not found') +
      '</div>' +
      '<div class="exp-form-actions"><button type="button" class="exp-btn ghost" data-action="close-modal">Close</button></div>';
    return;
  }

  const expense = _normalizeExpense(res.expense || res);
  const approvals = ((res.approvals) || []).map(_normalizeApproval);
  const admin = _isAdmin();

  let trailHtml = '<div class="exp-history-empty">No approval decisions yet</div>';
  if (approvals.length) {
    trailHtml = approvals
      .map(
        (a) =>
          '<div class="exp-history-row">L' +
          _esc(String(a.level)) +
          ' · ' +
          _esc(a.action) +
          ' by ' +
          _esc(a.approverEmail) +
          (a.reason ? ' — ' + _esc(a.reason) : '') +
          ' · ' +
          _esc(a.actedAt) +
          '</div>',
      )
      .join('');
  }

  let actions =
    '<button type="button" class="exp-btn ghost" data-action="close-modal">Close</button>';
  if (expense.status === 'submitted') {
    actions =
      '<button type="button" class="exp-btn" data-action="approve" data-id="' +
      _esc(expense.id) +
      '">Approve</button>' +
      '<button type="button" class="exp-btn ghost danger" data-action="reject" data-id="' +
      _esc(expense.id) +
      '">Reject</button>' +
      actions;
  }
  if (admin && expense.status === 'approved') {
    actions =
      '<button type="button" class="exp-btn" data-action="reimburse" data-id="' +
      _esc(expense.id) +
      '">Reimburse</button>' +
      actions;
  }

  box.innerHTML =
    '<div class="exp-modal-title">' +
    _esc(expense.vendor || 'Expense') +
    '</div>' +
    '<div class="exp-detail-meta">' +
    _statusBadge(expense.status) +
    ' · ' +
    _esc(_fmtAmount(expense.amount, expense.currency)) +
    '</div>' +
    '<div class="exp-detail-grid">' +
    '<div><span class="exp-detail-label">Claimant</span> ' +
    _esc(expense.email) +
    '</div>' +
    '<div><span class="exp-detail-label">Category</span> ' +
    _esc(_labelOf(CATEGORIES, expense.category)) +
    '</div>' +
    '<div><span class="exp-detail-label">Date</span> ' +
    _esc(expense.receiptDate || '—') +
    '</div>' +
    '<div><span class="exp-detail-label">Level</span> ' +
    _esc(String(expense.currentLevel)) +
    '</div>' +
    '<div><span class="exp-detail-label">Receipt</span> ' +
    _esc(expense.fileId || '—') +
    '</div>' +
    '<div><span class="exp-detail-label">Approver</span> ' +
    _esc(expense.approverEmail || '—') +
    '</div>' +
    '</div>' +
    (expense.description
      ? '<div class="exp-card-sub" style="margin:10px 0">' + _esc(expense.description) + '</div>'
      : '') +
    (expense.rejectionReason
      ? '<div class="exp-card-sub" style="color:var(--status-absent)">Rejected: ' +
        _esc(expense.rejectionReason) +
        '</div>'
      : '') +
    '<div class="exp-section-title">Approval trail</div>' +
    '<div class="exp-history">' +
    trailHtml +
    '</div>' +
    '<div class="exp-form-actions">' +
    actions +
    '</div>';
}

export async function expSubmit(id) {
  const result = await api.post('/api/expenses/' + id + '/submit', {});
  if (result && !result._error) {
    toast('Submitted', 'success');
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to submit', 'error');
}

export async function expApprove(id) {
  const result = await api.post('/api/expenses/' + id + '/approve', {});
  if (result && !result._error) {
    toast('Approved', 'success');
    expCloseModal();
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to approve', 'error');
}

export async function expReject(id) {
  const reason = window.prompt('Rejection reason', '') || '';
  const result = await api.post('/api/expenses/' + id + '/reject', { reason });
  if (result && !result._error) {
    toast('Rejected', 'success');
    expCloseModal();
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to reject', 'error');
}

export async function expReimburse(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const result = await api.post('/api/expenses/' + id + '/reimburse', {});
  if (result && !result._error) {
    toast('Reimbursed', 'success');
    expCloseModal();
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function expDelete(id) {
  if (!confirm('Delete this draft expense?')) return;
  const result = await api.delete('/api/expenses/' + id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await expLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export function expCloseModal() {
  const modal = _container && _container.querySelector('#expModal');
  if (modal) modal.classList.remove('open');
  _editing = null;
  _pendingFileId = null;
}

function _syncTabs() {
  if (!_container) return;
  _container.querySelectorAll('.exp-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _findMine(id) {
  return _mine.find((e) => e.id === id) || null;
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#expAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      expShowForm(null);
    });
  }

  const modal = container.querySelector('#expModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) expCloseModal();
    });
  }

  container.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.classList.contains('exp-tab')) {
      _tab = tab.dataset.tab || 'mine';
      _syncTabs();
      expRender();
      return;
    }
    if (e.target.closest('[data-action="close-modal"]')) {
      expCloseModal();
      return;
    }
    const inModal = e.target.closest('#expModalBox [data-action]');
    if (inModal) {
      const action = inModal.dataset.action;
      const id = inModal.dataset.id;
      if (action === 'approve') expApprove(id);
      else if (action === 'reject') expReject(id);
      else if (action === 'reimburse') expReimburse(id);
    }
  });

  const content = container.querySelector('#expContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const category = btn.dataset.category;

      if (action === 'edit') {
        const item = _findMine(id);
        if (item) expShowForm(item);
      } else if (action === 'delete') expDelete(id);
      else if (action === 'submit') expSubmit(id);
      else if (action === 'detail') expShowDetail(id);
      else if (action === 'approve') expApprove(id);
      else if (action === 'reject') expReject(id);
      else if (action === 'edit-policy') expShowPolicyForm(category);
    });
  }
}

export function _getMine() {
  return _mine;
}
export function _getPending() {
  return _pending;
}
export function _getPolicies() {
  return _policies;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _resetState() {
  _container = null;
  _tab = 'mine';
  _mine = [];
  _pending = [];
  _policies = [];
  _loadError = null;
  _featureOff = false;
  _saving = false;
  _editing = null;
  _pendingFileId = null;
}

registerModule('expenses', renderExpensesPage);
