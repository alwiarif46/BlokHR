/**
 * modules/audit_trail/audit_trail.js
 * Audit trail: event log of all admin and user actions.
 * Pattern: renderAuditTrailPage() → auditLoadData() → auditRenderStats()
 *          → auditRender() (read-only, no modal)
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _events = [];
let _search = '';
let _filterAction = '';
let _page = 1;
const PAGE_SIZE = 20;

const _actions = [
  'clock.in', 'clock.out', 'leave.submitted', 'leave.approved', 'leave.rejected',
  'settings.updated', 'member.created', 'member.updated', 'admin.promoted',
  'feature.toggled', 'expense.approved', 'visitor.checked_in',
];

const _mock = [
  { id: 'e1',  action: 'settings.updated',   actor: 'admin@co.com',  actor_name: 'Admin',         target: 'branding',          detail: 'Company name updated',          timestamp: '2026-03-30T09:00:00' },
  { id: 'e2',  action: 'clock.in',            actor: 'arif@co.com',   actor_name: 'Arif Alwi',     target: null,                detail: 'Clocked in at 09:05',           timestamp: '2026-03-30T09:05:00' },
  { id: 'e3',  action: 'leave.approved',      actor: 'admin@co.com',  actor_name: 'Admin',         target: 'sarah@co.com',      detail: 'Annual leave approved (5 days)','timestamp': '2026-03-30T09:15:00' },
  { id: 'e4',  action: 'clock.in',            actor: 'sarah@co.com',  actor_name: 'Sarah Chen',    target: null,                detail: 'Clocked in at 09:20',           timestamp: '2026-03-30T09:20:00' },
  { id: 'e5',  action: 'member.created',      actor: 'admin@co.com',  actor_name: 'Admin',         target: 'priya@co.com',      detail: 'New member Priya Sharma added', timestamp: '2026-03-29T14:00:00' },
  { id: 'e6',  action: 'feature.toggled',     actor: 'admin@co.com',  actor_name: 'Admin',         target: 'geo_fencing',       detail: 'geo_fencing disabled',          timestamp: '2026-03-29T11:30:00' },
  { id: 'e7',  action: 'expense.approved',    actor: 'admin@co.com',  actor_name: 'Admin',         target: 'arif@co.com',       detail: '₹12,500 Training expense',      timestamp: '2026-03-28T16:00:00' },
  { id: 'e8',  action: 'admin.promoted',      actor: 'admin@co.com',  actor_name: 'Admin',         target: 'bob@co.com',        detail: 'Bob Builder promoted to admin', timestamp: '2026-03-27T10:00:00' },
  { id: 'e9',  action: 'leave.submitted',     actor: 'bob@co.com',    actor_name: 'Bob Builder',   target: null,                detail: 'Annual leave 3 days submitted', timestamp: '2026-03-26T09:00:00' },
  { id: 'e10', action: 'visitor.checked_in',  actor: 'reception@co.com', actor_name: 'Reception', target: 'Ramesh Kumar',      detail: 'Visitor from TechCorp',         timestamp: '2026-03-25T10:00:00' },
];

export function renderAuditTrailPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  if (!isAdmin) {
    container.innerHTML = '<div class="audit-no-access"><div style="font-size:3rem">&#128274;</div><div>Admin access required to view the audit trail.</div></div>';
    return;
  }
  container.innerHTML =
    '<div class="audit-wrap">' +
      '<div class="audit-toolbar">' +
        '<div class="audit-title">&#128196; Audit Trail</div>' +
        '<input class="audit-search" id="auditSearch" placeholder="Search events…" autocomplete="off">' +
        '<select class="audit-select" id="auditActionFilter">' +
          '<option value="">All Actions</option>' +
          _actions.map(a => '<option value="' + a + '">' + a + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div id="auditStats" class="audit-stats"></div>' +
      '<div id="auditContent"></div>' +
      '<div id="auditPager" class="audit-pager"></div>' +
    '</div>';
  _bindEvents(container);
  auditLoadData();
}

export async function auditLoadData() {
  const d = await api.get('/api/audit?page=' + _page + '&limit=' + PAGE_SIZE);
  _events = (d && !d._error) ? (d.events || d || []) : _mock;
  if (!Array.isArray(_events)) _events = _mock;
  auditRenderStats();
  auditRender();
}

export function auditRenderStats() {
  const el = _container && _container.querySelector('#auditStats');
  if (!el) return;
  const today = new Date().toISOString().split('T')[0];
  const todayCount = _events.filter(e => (e.timestamp || '').startsWith(today)).length;
  const byAdmin    = _events.filter(e => (e.actor || '').includes('admin')).length;
  el.innerHTML =
    _sc(_events.length, 'Total Events', 'var(--accent)') +
    _sc(todayCount,     'Today',        'var(--status-in)') +
    _sc(byAdmin,        'By Admin',     'var(--status-break)') +
    _sc(_actions.length,'Action Types', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="audit-stat"><div class="audit-stat-n" style="color:' + c + '">' + n + '</div><div class="audit-stat-l">' + l + '</div></div>';
}

export function auditRender() {
  const el = _container && _container.querySelector('#auditContent');
  if (!el) return;
  let items = _events;
  if (_filterAction) items = items.filter(e => e.action === _filterAction);
  if (_search) items = items.filter(e => (e.action + ' ' + e.actor_name + ' ' + e.detail + ' ' + (e.target || '')).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="audit-empty"><div style="font-size:2rem">&#128202;</div><div>No events found</div></div>';
    _renderPager(0, items);
    return;
  }

  let html = '<div class="audit-list">';
  items.forEach(function (e, i) {
    const cat = e.action ? e.action.split('.')[0] : 'other';
    const catColor = { clock: 'var(--status-in)', leave: 'var(--accent)', settings: 'var(--status-break)', member: 'var(--status-absent)', feature: 'var(--tx2)', expense: 'var(--status-in)', visitor: 'var(--status-break)', admin: 'var(--status-absent)' }[cat] || 'var(--tx3)';
    html +=
      '<div class="audit-row" style="animation-delay:' + i * 0.02 + 's">' +
        '<div class="audit-dot" style="background:' + catColor + '"></div>' +
        '<div class="audit-row-info">' +
          '<div class="audit-row-action"><span class="audit-action-tag" style="border-color:' + catColor + ';color:' + catColor + '">' + _esc(e.action || '') + '</span>' +
          (e.target ? ' &rarr; <span class="audit-target">' + _esc(e.target) + '</span>' : '') + '</div>' +
          '<div class="audit-row-detail">' + _esc(e.detail || '') + '</div>' +
        '</div>' +
        '<div class="audit-row-right">' +
          '<div class="audit-actor">' + _esc(e.actor_name || e.actor || '') + '</div>' +
          '<div class="audit-time">' + _fmtTime(e.timestamp) + '</div>' +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
  _renderPager(items.length, items);
}

function _renderPager(total) {
  const el = _container && _container.querySelector('#auditPager');
  if (!el) return;
  el.innerHTML = total > 0
    ? '<div class="audit-pager-info">Showing ' + total + ' events' + (_page > 1 ? ' (page ' + _page + ')' : '') + '</div>'
    : '';
}

function _bindEvents(container) {
  const s = container.querySelector('#auditSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); auditRender(); });
  const af = container.querySelector('#auditActionFilter');
  if (af) af.addEventListener('change', function () { _filterAction = this.value; auditRender(); });
}

function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getEvents() { return _events; }
export function _setEvents(list) { _events = list; }
export function _resetState() { _container = null; _events = []; _search = ''; _filterAction = ''; _page = 1; }

registerModule('audit_trail', renderAuditTrailPage);
