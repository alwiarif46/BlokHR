/**
 * modules/visitors/visitors.js
 * Visitor management: check-in/out, host notification, badge printing.
 * Pattern: renderVisitorsPage() → visLoadData() → visRenderStats()
 *          → visRender() → CRUD → visCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _visitors = [];
let _tab = 'today';   // 'today' | 'upcoming' | 'all'
let _search = '';
let _filterStatus = '';

const _mock = [
  { id: 'v1', name: 'Ramesh Kumar',    company: 'TechCorp',    host: 'Arif Alwi',    host_email: 'arif@co.com',  purpose: 'Partnership meeting', status: 'checked_in',  checked_in_at: '2026-03-30T09:15:00', checked_out_at: null,           visit_date: '2026-03-30', badge_no: 'B-001' },
  { id: 'v2', name: 'Anita Sharma',    company: 'DesignStudio', host: 'Sarah Chen',   host_email: 'sarah@co.com', purpose: 'Project review',       status: 'checked_in',  checked_in_at: '2026-03-30T10:00:00', checked_out_at: null,           visit_date: '2026-03-30', badge_no: 'B-002' },
  { id: 'v3', name: 'James Lee',       company: 'InvestCo',    host: 'Admin',        host_email: 'admin@co.com', purpose: 'Board meeting',        status: 'checked_out', checked_in_at: '2026-03-29T14:00:00', checked_out_at: '2026-03-29T16:30:00', visit_date: '2026-03-29', badge_no: 'B-003' },
  { id: 'v4', name: 'Priya Nair',      company: 'ConsultFirm', host: 'Arif Alwi',    host_email: 'arif@co.com',  purpose: 'Product demo',         status: 'expected',    checked_in_at: null,                  checked_out_at: null,           visit_date: '2026-03-30', badge_no: null },
  { id: 'v5', name: 'Carlos Mendes',   company: 'CloudBase',   host: 'Bob Builder',  host_email: 'bob@co.com',   purpose: 'Technical audit',      status: 'expected',    checked_in_at: null,                  checked_out_at: null,           visit_date: '2026-03-31', badge_no: null },
  { id: 'v6', name: 'Sunita Verma',    company: 'LegalAssoc',  host: 'Admin',        host_email: 'admin@co.com', purpose: 'Contract signing',     status: 'cancelled',   checked_in_at: null,                  checked_out_at: null,           visit_date: '2026-03-28', badge_no: null },
];

export function renderVisitorsPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && (session.is_admin || session.is_manager);
  container.innerHTML =
    '<div class="vis-wrap">' +
      '<div class="vis-toolbar">' +
        '<div class="vis-tabs" id="visTabs">' +
          '<button class="vis-tab active" data-tab="today">Today</button>' +
          '<button class="vis-tab" data-tab="upcoming">Upcoming</button>' +
          '<button class="vis-tab" data-tab="all">All Visitors</button>' +
        '</div>' +
        '<input class="vis-search" id="visSearch" placeholder="Search visitors…" autocomplete="off">' +
        '<select class="vis-select" id="visStatusFilter">' +
          '<option value="">All Status</option>' +
          '<option value="expected">Expected</option>' +
          '<option value="checked_in">Checked In</option>' +
          '<option value="checked_out">Checked Out</option>' +
          '<option value="cancelled">Cancelled</option>' +
        '</select>' +
        '<button class="vis-btn" id="visAddBtn">+ Pre-register</button>' +
      '</div>' +
      '<div id="visStats" class="vis-stats"></div>' +
      '<div id="visContent"></div>' +
      '<div class="vis-modal" id="visModal"><div class="vis-modal-box" id="visModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  visLoadData();
}

export async function visLoadData() {
  const d = await api.get('/api/visitors');
  _visitors = (d && !d._error) ? (d.visitors || d || []) : _mock;
  if (!Array.isArray(_visitors)) _visitors = _mock;
  visRenderStats();
  visRender();
}

export function visRenderStats() {
  const el = _container && _container.querySelector('#visStats');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const checkedIn  = _visitors.filter(v => v.status === 'checked_in').length;
  const todayCount = _visitors.filter(v => v.visit_date === today).length;
  const expected   = _visitors.filter(v => v.status === 'expected').length;
  el.innerHTML =
    _sc(checkedIn,  'On-site Now',  'var(--status-in)') +
    _sc(todayCount, 'Today Total',  'var(--accent)') +
    _sc(expected,   'Expected',     'var(--status-break)') +
    _sc(_visitors.length, 'All Time', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="vis-stat"><div class="vis-stat-n" style="color:' + c + '">' + n + '</div><div class="vis-stat-l">' + l + '</div></div>';
}

export function visRender() {
  const el = _container && _container.querySelector('#visContent');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  let items = _visitors;

  if (_tab === 'today')    items = items.filter(v => v.visit_date === today);
  else if (_tab === 'upcoming') items = items.filter(v => v.visit_date > today && v.status === 'expected');

  if (_filterStatus) items = items.filter(v => v.status === _filterStatus);
  if (_search) items = items.filter(v => (v.name + ' ' + v.company + ' ' + v.host).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="vis-empty"><div style="font-size:2rem">&#128101;</div><div>No visitors found</div></div>';
    return;
  }

  let html = '<div class="vis-grid">';
  items.forEach(function (v, i) {
    const sc = { expected: 'var(--status-break)', checked_in: 'var(--status-in)', checked_out: 'var(--tx3)', cancelled: 'var(--status-absent)' }[v.status] || 'var(--tx3)';
    html +=
      '<div class="vis-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="vis-card-hdr">' +
          '<div class="vis-av">' + _ini(v.name) + '</div>' +
          '<div class="vis-card-info">' +
            '<div class="vis-card-name">' + _esc(v.name) + '</div>' +
            '<div class="vis-card-co">' + _esc(v.company || '') + '</div>' +
          '</div>' +
          '<span class="vis-badge" style="background:' + sc + '20;color:' + sc + '">' + _esc(v.status.replace(/_/g, ' ')) + '</span>' +
        '</div>' +
        '<div class="vis-card-body">' +
          '<div class="vis-detail"><span class="vis-lbl">Host</span> ' + _esc(v.host) + '</div>' +
          '<div class="vis-detail"><span class="vis-lbl">Purpose</span> ' + _esc(v.purpose || '') + '</div>' +
          '<div class="vis-detail"><span class="vis-lbl">Date</span> ' + _fmtDate(v.visit_date) + '</div>' +
          (v.checked_in_at ? '<div class="vis-detail"><span class="vis-lbl">Checked in</span> ' + _fmtTime(v.checked_in_at) + '</div>' : '') +
          (v.checked_out_at ? '<div class="vis-detail"><span class="vis-lbl">Checked out</span> ' + _fmtTime(v.checked_out_at) + '</div>' : '') +
          (v.badge_no ? '<div class="vis-badge-no">Badge: ' + _esc(v.badge_no) + '</div>' : '') +
        '</div>' +
        '<div class="vis-card-actions">' +
          (v.status === 'expected' ? '<button data-action="checkin" data-id="' + _esc(v.id) + '" class="vis-btn-sm approve">Check In</button>' : '') +
          (v.status === 'checked_in' ? '<button data-action="checkout" data-id="' + _esc(v.id) + '" class="vis-btn-sm">Check Out</button>' : '') +
          (v.status === 'expected' ? '<button data-action="cancel-vis" data-id="' + _esc(v.id) + '" class="vis-btn-sm danger">Cancel</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function visShowForm(visitor) {
  const isEdit = !!visitor;
  const v = visitor || {};
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;
  const today = new Date().toISOString().split('T')[0];
  box.innerHTML =
    '<div class="vis-modal-title">' + (isEdit ? 'Edit' : 'Pre-register') + ' Visitor</div>' +
    '<div class="vis-field"><label>Visitor Name *</label><input type="text" id="visFName" value="' + _esc(v.name || '') + '" placeholder="Full name"></div>' +
    '<div class="vis-field"><label>Company</label><input type="text" id="visFCo" value="' + _esc(v.company || '') + '" placeholder="Company / Organisation"></div>' +
    '<div class="vis-row2">' +
      '<div class="vis-field"><label>Visit Date *</label><input type="date" id="visFDate" value="' + _esc(v.visit_date || today) + '"></div>' +
      '<div class="vis-field"><label>Host *</label><input type="text" id="visFHost" value="' + _esc(v.host || '') + '" placeholder="Host employee name"></div>' +
    '</div>' +
    '<div class="vis-field"><label>Purpose of Visit</label><input type="text" id="visFPurpose" value="' + _esc(v.purpose || '') + '" placeholder="e.g. Partnership meeting"></div>' +
    '<div class="vis-form-actions">' +
      '<button class="vis-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="vis-btn" id="visSaveBtn">' + (isEdit ? 'Update' : 'Register') + '</button>' +
    '</div>';
  _container.querySelector('#visModal').classList.add('open');
  box.querySelector('#visSaveBtn').addEventListener('click', () => _save(visitor, isEdit));
}

async function _save(visitor, isEdit) {
  const box = _container && _container.querySelector('#visModalBox');
  if (!box) return;
  const name    = (box.querySelector('#visFName').value || '').trim();
  const date    = box.querySelector('#visFDate').value;
  const host    = (box.querySelector('#visFHost').value || '').trim();
  const company = (box.querySelector('#visFCo').value || '').trim();
  const purpose = (box.querySelector('#visFPurpose').value || '').trim();
  if (!name)  { toast('Visitor name is required', 'error'); return; }
  if (!date)  { toast('Visit date is required', 'error'); return; }
  if (!host)  { toast('Host name is required', 'error'); return; }
  const body = { name, company, host, purpose, visit_date: date, status: 'expected', checked_in_at: null, checked_out_at: null, badge_no: null };
  const result = isEdit ? await api.put('/api/visitors/' + visitor.id, body) : await api.post('/api/visitors', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Registered', 'success'); visCloseModal(); visLoadData(); return; }
  if (isEdit) { const i = _visitors.findIndex(x => x.id === visitor.id); if (i >= 0) Object.assign(_visitors[i], body); }
  else _visitors.unshift({ id: 'v' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Registered') + ' (demo)', 'success');
  visCloseModal(); visRenderStats(); visRender();
}

export async function visCheckIn(id) {
  const now = new Date().toISOString();
  const result = await api.put('/api/visitors/' + id + '/checkin', { checked_in_at: now });
  if (result && !result._error) { toast('Checked in', 'success'); visLoadData(); return; }
  const v = _visitors.find(x => x.id === id);
  if (v) { v.status = 'checked_in'; v.checked_in_at = now; v.badge_no = 'B-' + String(Date.now()).slice(-3); }
  toast('Checked in (demo)', 'success'); visRenderStats(); visRender();
}

export async function visCheckOut(id) {
  const now = new Date().toISOString();
  const result = await api.put('/api/visitors/' + id + '/checkout', { checked_out_at: now });
  if (result && !result._error) { toast('Checked out', 'success'); visLoadData(); return; }
  const v = _visitors.find(x => x.id === id);
  if (v) { v.status = 'checked_out'; v.checked_out_at = now; }
  toast('Checked out (demo)', 'success'); visRenderStats(); visRender();
}

export function visCloseModal() {
  const m = _container && _container.querySelector('#visModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#visTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.vis-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.vis-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    visRender();
  });
  const s = container.querySelector('#visSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); visRender(); });
  const sf = container.querySelector('#visStatusFilter');
  if (sf) sf.addEventListener('change', function () { _filterStatus = this.value; visRender(); });
  const ab = container.querySelector('#visAddBtn');
  if (ab) ab.addEventListener('click', () => visShowForm(null));
  const modal = container.querySelector('#visModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) visCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal')  visCloseModal();
    else if (action === 'checkin')  visCheckIn(id);
    else if (action === 'checkout') visCheckOut(id);
    else if (action === 'cancel-vis') {
      if (confirm('Cancel this visitor?')) {
        const v = _visitors.find(x => x.id === id); if (v) v.status = 'cancelled';
        toast('Cancelled (demo)', 'success'); visRenderStats(); visRender();
      }
    }
  });
}

function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); }
function _fmtDate(ds) { if (!ds) return ''; return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); }
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getVisitors() { return _visitors; }
export function _setVisitors(list) { _visitors = list; }
export function _resetState() { _container = null; _visitors = []; _tab = 'today'; _search = ''; _filterStatus = ''; }

registerModule('visitors', renderVisitorsPage);
