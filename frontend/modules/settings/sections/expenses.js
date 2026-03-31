/**
 * modules/expenses/expenses.js
 * Expense management: submit receipts, approve/reject, category breakdown.
 * Pattern: renderExpensesPage() → expLoadData() → expRenderStats()
 *          → expRender() → CRUD → expCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _expenses = [];
let _tab = 'my';   // 'my' | 'approvals' | 'all'
let _search = '';
let _filterStatus = '';
let _filterCat = '';

const _cats = ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Software', 'Hardware', 'Training', 'Other'];

const _mock = [
  { id: 'ex1', email: 'arif@co.com',  name: 'Arif Alwi',    category: 'Travel',          amount: 1850,  currency: 'INR', date: '2026-03-27', description: 'Cab to client office',   status: 'pending',  receipt: true },
  { id: 'ex2', email: 'arif@co.com',  name: 'Arif Alwi',    category: 'Meals',           amount: 450,   currency: 'INR', date: '2026-03-26', description: 'Team lunch',             status: 'approved', receipt: true,  approved_by: 'Admin' },
  { id: 'ex3', email: 'sarah@co.com', name: 'Sarah Chen',   category: 'Software',        amount: 2999,  currency: 'INR', date: '2026-03-25', description: 'Figma annual plan',      status: 'approved', receipt: true,  approved_by: 'Admin' },
  { id: 'ex4', email: 'bob@co.com',   name: 'Bob Builder',  category: 'Accommodation',   amount: 5200,  currency: 'INR', date: '2026-03-24', description: 'Hotel for client visit', status: 'pending',  receipt: true },
  { id: 'ex5', email: 'priya@co.com', name: 'Priya Sharma', category: 'Office Supplies', amount: 380,   currency: 'INR', date: '2026-03-20', description: 'Stationery',             status: 'rejected', receipt: false, rejection_reason: 'Missing receipt' },
  { id: 'ex6', email: 'arif@co.com',  name: 'Arif Alwi',    category: 'Training',        amount: 12500, currency: 'INR', date: '2026-03-18', description: 'React conf ticket',      status: 'approved', receipt: true,  approved_by: 'Admin' },
];

export function renderExpensesPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && (session.is_admin || session.is_manager);
  container.innerHTML =
    '<div class="exp-wrap">' +
      '<div class="exp-toolbar">' +
        '<div class="exp-tabs" id="expTabs">' +
          '<button class="exp-tab active" data-tab="my">My Expenses</button>' +
          (isAdmin ? '<button class="exp-tab" data-tab="approvals">Approvals</button>' : '') +
          (isAdmin ? '<button class="exp-tab" data-tab="all">All Expenses</button>' : '') +
        '</div>' +
        '<input class="exp-search" id="expSearch" placeholder="Search…" autocomplete="off">' +
        '<select class="exp-select" id="expStatusFilter">' +
          '<option value="">All Status</option>' +
          '<option value="pending">Pending</option>' +
          '<option value="approved">Approved</option>' +
          '<option value="rejected">Rejected</option>' +
        '</select>' +
        '<select class="exp-select" id="expCatFilter">' +
          '<option value="">All Categories</option>' +
          _cats.map(c => '<option value="' + c + '">' + c + '</option>').join('') +
        '</select>' +
        '<button class="exp-btn" id="expAddBtn">+ Submit Expense</button>' +
      '</div>' +
      '<div id="expStats" class="exp-stats"></div>' +
      '<div id="expContent"></div>' +
      '<div class="exp-modal" id="expModal"><div class="exp-modal-box" id="expModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  expLoadData();
}

export async function expLoadData() {
  const d = await api.get('/api/expenses');
  _expenses = (d && !d._error) ? (d.expenses || d || []) : _mock;
  if (!Array.isArray(_expenses)) _expenses = _mock;
  expRenderStats();
  expRender();
}

export function expRenderStats() {
  const el = _container && _container.querySelector('#expStats');
  if (!el) return;
  const session = getSession();
  const email = session && session.email;
  const mine = _expenses.filter(e => e.email === email);
  const pending = _expenses.filter(e => e.status === 'pending').length;
  const myTotal = mine.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0);
  const allApproved = _expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount || 0), 0);
  el.innerHTML =
    _sc(pending, 'Pending', 'var(--status-absent)') +
    _sc(_fmtAmt(myTotal), 'My Approved', 'var(--status-in)') +
    _sc(_fmtAmt(allApproved), 'Total Approved', 'var(--accent)') +
    _sc(_expenses.length, 'Total', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="exp-stat"><div class="exp-stat-n" style="color:' + c + '">' + n + '</div><div class="exp-stat-l">' + l + '</div></div>';
}

export function expRender() {
  const el = _container && _container.querySelector('#expContent');
  if (!el) return;
  const session = getSession();
  const email = session && session.email;
  const isAdmin = session && (session.is_admin || session.is_manager);
  let items = _expenses;
  if (_tab === 'my') items = items.filter(e => e.email === email || !email);
  else if (_tab === 'approvals') items = items.filter(e => e.status === 'pending');
  if (_filterStatus) items = items.filter(e => e.status === _filterStatus);
  if (_filterCat) items = items.filter(e => e.category === _filterCat);
  if (_search) items = items.filter(e => (e.description + ' ' + e.category + ' ' + (e.name || '')).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="exp-empty"><div style="font-size:2rem">&#129299;</div><div>No expenses found</div></div>';
    return;
  }

  let html = '<div class="exp-grid">';
  items.forEach(function (e, i) {
    const showAct = (_tab === 'approvals' || _tab === 'all') && isAdmin && e.status === 'pending';
    const canCancel = _tab === 'my' && e.status === 'pending';
    html +=
      '<div class="exp-card exp-card-' + e.status + '" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="exp-card-hdr">' +
          (_tab !== 'my' ? '<div class="exp-av">' + _ini(e.name) + '</div>' : '') +
          '<div class="exp-card-info">' +
            '<div class="exp-card-desc">' + _esc(e.description) + '</div>' +
            '<div class="exp-card-meta">' + _esc(e.category) + ' &middot; ' + _fmtDate(e.date) + (_tab !== 'my' ? ' &middot; ' + _esc(e.name) : '') + '</div>' +
          '</div>' +
          '<div class="exp-card-right">' +
            '<div class="exp-amount">' + _fmtAmt(e.amount) + '</div>' +
            '<span class="exp-badge exp-badge-' + e.status + '">' + e.status + '</span>' +
          '</div>' +
        '</div>' +
        (e.approved_by ? '<div class="exp-card-note positive">Approved by ' + _esc(e.approved_by) + '</div>' : '') +
        (e.rejection_reason ? '<div class="exp-card-note negative">Reason: ' + _esc(e.rejection_reason) + '</div>' : '') +
        (!e.receipt ? '<div class="exp-card-note warn">&#9888; No receipt attached</div>' : '') +
        '<div class="exp-card-actions">' +
          (showAct ? '<button data-action="approve" data-id="' + _esc(e.id) + '" class="exp-btn-sm approve">Approve</button>' : '') +
          (showAct ? '<button data-action="reject" data-id="' + _esc(e.id) + '" class="exp-btn-sm danger">Reject</button>' : '') +
          (canCancel ? '<button data-action="cancel" data-id="' + _esc(e.id) + '" class="exp-btn-sm danger">Cancel</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function expShowForm(exp) {
  const isEdit = !!exp;
  const e = exp || {};
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="exp-modal-title">' + (isEdit ? 'Edit' : 'Submit') + ' Expense</div>' +
    '<div class="exp-field"><label>Description *</label><input type="text" id="expFDesc" value="' + _esc(e.description || '') + '" placeholder="e.g. Cab to client office"></div>' +
    '<div class="exp-row2">' +
      '<div class="exp-field"><label>Amount (INR) *</label><input type="number" id="expFAmt" value="' + (e.amount || '') + '" min="0" step="0.01"></div>' +
      '<div class="exp-field"><label>Date *</label><input type="date" id="expFDate" value="' + _esc(e.date || '') + '"></div>' +
    '</div>' +
    '<div class="exp-field"><label>Category *</label><select id="expFCat">' +
      _cats.map(c => '<option value="' + c + '"' + (e.category === c ? ' selected' : '') + '>' + c + '</option>').join('') +
    '</select></div>' +
    '<div class="exp-field"><label>Receipt</label>' +
      '<div class="exp-receipt-row">' +
        '<input type="file" id="expFFile" accept="image/*,.pdf" style="display:none">' +
        '<button class="exp-btn-sm" id="expFFileBtn">&#128206; Attach Receipt</button>' +
        '<span id="expFFileName" class="exp-filename">' + (e.receipt ? 'Attached' : 'None') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="exp-form-actions">' +
      '<button class="exp-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="exp-btn" id="expSaveBtn">' + (isEdit ? 'Update' : 'Submit') + '</button>' +
    '</div>';
  _container.querySelector('#expModal').classList.add('open');
  box.querySelector('#expFFileBtn').addEventListener('click', () => box.querySelector('#expFFile').click());
  box.querySelector('#expFFile').addEventListener('change', function () {
    const fn = box.querySelector('#expFFileName');
    if (fn && this.files[0]) fn.textContent = this.files[0].name;
  });
  box.querySelector('#expSaveBtn').addEventListener('click', () => _save(exp, isEdit));
}

async function _save(exp, isEdit) {
  const box = _container && _container.querySelector('#expModalBox');
  if (!box) return;
  const description = (box.querySelector('#expFDesc').value || '').trim();
  const amount = parseFloat(box.querySelector('#expFAmt').value);
  const date = box.querySelector('#expFDate').value;
  const category = box.querySelector('#expFCat').value;
  if (!description) { toast('Description is required', 'error'); return; }
  if (!amount || amount <= 0) { toast('Valid amount is required', 'error'); return; }
  if (!date) { toast('Date is required', 'error'); return; }
  const session = getSession() || {};
  const body = { description, amount, date, category, currency: 'INR', status: 'pending', email: session.email, name: session.name, receipt: !!box.querySelector('#expFFile').files.length };
  const result = isEdit ? await api.put('/api/expenses/' + exp.id, body) : await api.post('/api/expenses', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Submitted', 'success'); expCloseModal(); expLoadData(); return; }
  if (isEdit) { const i = _expenses.findIndex(e => e.id === exp.id); if (i >= 0) Object.assign(_expenses[i], body); }
  else _expenses.unshift({ id: 'ex' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Submitted') + ' (demo)', 'success');
  expCloseModal(); expRenderStats(); expRender();
}

export async function expApprove(id) {
  const result = await api.put('/api/expenses/' + id + '/approve', {});
  if (result && !result._error) { toast('Approved', 'success'); expLoadData(); return; }
  const e = _expenses.find(x => x.id === id);
  if (e) { e.status = 'approved'; e.approved_by = (getSession() || {}).name || 'Admin'; }
  toast('Approved (demo)', 'success'); expRenderStats(); expRender();
}

export async function expReject(id) {
  const reason = prompt('Rejection reason:');
  if (reason === null) return;
  const result = await api.put('/api/expenses/' + id + '/reject', { reason });
  if (result && !result._error) { toast('Rejected', 'success'); expLoadData(); return; }
  const e = _expenses.find(x => x.id === id);
  if (e) { e.status = 'rejected'; e.rejection_reason = reason; }
  toast('Rejected (demo)', 'success'); expRenderStats(); expRender();
}

export function expCloseModal() {
  const m = _container && _container.querySelector('#expModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#expTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.exp-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.exp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    expRender();
  });
  const s = container.querySelector('#expSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); expRender(); });
  const sf = container.querySelector('#expStatusFilter');
  if (sf) sf.addEventListener('change', function () { _filterStatus = this.value; expRender(); });
  const cf = container.querySelector('#expCatFilter');
  if (cf) cf.addEventListener('change', function () { _filterCat = this.value; expRender(); });
  const ab = container.querySelector('#expAddBtn');
  if (ab) ab.addEventListener('click', () => expShowForm(null));
  const modal = container.querySelector('#expModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) expCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') expCloseModal();
    else if (action === 'approve') expApprove(id);
    else if (action === 'reject') expReject(id);
    else if (action === 'cancel') {
      if (confirm('Cancel this expense?')) { const ex = _expenses.find(x => x.id === id); if (ex) ex.status = 'cancelled'; expRenderStats(); expRender(); toast('Cancelled (demo)', 'success'); }
    }
  });
}

function _fmtAmt(n) { return '₹' + (n || 0).toLocaleString('en-IN'); }
function _fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getExpenses() { return _expenses; }
export function _setExpenses(list) { _expenses = list; }
export function _resetState() { _container = null; _expenses = []; _tab = 'my'; _search = ''; _filterStatus = ''; _filterCat = ''; }

registerModule('expenses', renderExpensesPage);
