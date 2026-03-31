/**
 * modules/webhooks/webhooks.js
 * Webhook receiver management: CRUD, test fire, delivery log.
 * Pattern: renderWebhooksPage() → whLoadData() → whRenderStats()
 *          → whRender() → CRUD → whCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _webhooks = [];
let _search = '';

const _events = [
  'clock.in', 'clock.out', 'leave.submitted', 'leave.approved', 'leave.rejected',
  'regularization.submitted', 'expense.submitted', 'expense.approved',
  'visitor.checked_in', 'visitor.checked_out', 'member.created',
];

const _mock = [
  { id: 'wh1', name: 'Slack Alerts',       url: 'https://hooks.slack.com/services/T00/B00/XXX', events: ['clock.in', 'clock.out', 'leave.approved'], secret: 'sec_***', active: true,  last_triggered: '2026-03-30T08:15:00', success_count: 142, fail_count: 1 },
  { id: 'wh2', name: 'HR Dashboard',       url: 'https://hrdash.internal.co/hook',              events: ['leave.submitted', 'expense.submitted'],    secret: 'sec_***', active: true,  last_triggered: '2026-03-29T17:30:00', success_count: 89,  fail_count: 0 },
  { id: 'wh3', name: 'Audit Logger',       url: 'https://audit.example.com/receive',            events: ['member.created'],                          secret: null,      active: false, last_triggered: '2026-03-10T11:00:00', success_count: 23,  fail_count: 4 },
  { id: 'wh4', name: 'Visitor Notifier',   url: 'https://notify.example.com/visitors',          events: ['visitor.checked_in', 'visitor.checked_out'], secret: 'sec_***', active: true, last_triggered: '2026-03-30T09:00:00', success_count: 11, fail_count: 0 },
];

export function renderWebhooksPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="wh-wrap">' +
      '<div class="wh-toolbar">' +
        '<div class="wh-title">&#128279; Webhook Receivers</div>' +
        '<input class="wh-search" id="whSearch" placeholder="Search webhooks…" autocomplete="off">' +
        (isAdmin ? '<button class="wh-btn" id="whAddBtn">+ New Webhook</button>' : '') +
      '</div>' +
      '<div id="whStats" class="wh-stats"></div>' +
      '<div id="whContent"></div>' +
      '<div class="wh-modal" id="whModal"><div class="wh-modal-box" id="whModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  whLoadData();
}

export async function whLoadData() {
  const d = await api.get('/api/webhooks');
  _webhooks = (d && !d._error) ? (d.webhooks || d || []) : _mock;
  if (!Array.isArray(_webhooks)) _webhooks = _mock;
  whRenderStats();
  whRender();
}

export function whRenderStats() {
  const el = _container && _container.querySelector('#whStats');
  if (!el) return;
  const active   = _webhooks.filter(w => w.active).length;
  const totalOk  = _webhooks.reduce((s, w) => s + (w.success_count || 0), 0);
  const totalFail = _webhooks.reduce((s, w) => s + (w.fail_count || 0), 0);
  el.innerHTML =
    _sc(_webhooks.length, 'Total',    'var(--accent)') +
    _sc(active,           'Active',   'var(--status-in)') +
    _sc(totalOk,          'Delivered','var(--status-break)') +
    _sc(totalFail,        'Failed',   totalFail > 0 ? 'var(--status-absent)' : 'var(--tx3)');
}

function _sc(n, l, c) {
  return '<div class="wh-stat"><div class="wh-stat-n" style="color:' + c + '">' + n + '</div><div class="wh-stat-l">' + l + '</div></div>';
}

export function whRender() {
  const el = _container && _container.querySelector('#whContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _webhooks.filter(w => !_search || (w.name + ' ' + w.url).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="wh-empty"><div style="font-size:2rem">&#128279;</div><div>No webhooks configured</div></div>';
    return;
  }

  let html = '<div class="wh-list">';
  items.forEach(function (w, i) {
    html +=
      '<div class="wh-row' + (!w.active ? ' wh-inactive' : '') + '" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="wh-row-hdr">' +
          '<div class="wh-row-icon">' + (w.active ? '&#128994;' : '&#128308;') + '</div>' +
          '<div class="wh-row-info">' +
            '<div class="wh-row-name">' + _esc(w.name) + '</div>' +
            '<div class="wh-row-url">' + _esc(w.url) + '</div>' +
          '</div>' +
          '<div class="wh-row-counts">' +
            '<span class="wh-ok">&#10003; ' + (w.success_count || 0) + '</span>' +
            (w.fail_count ? '<span class="wh-fail">&#10007; ' + w.fail_count + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="wh-row-events">' + (w.events || []).map(e => '<span class="wh-event">' + _esc(e) + '</span>').join('') + '</div>' +
        (w.last_triggered ? '<div class="wh-row-last">Last triggered: ' + _fmtTime(w.last_triggered) + '</div>' : '') +
        (isAdmin
          ? '<div class="wh-row-actions">' +
              '<button data-action="test" data-id="' + _esc(w.id) + '" class="wh-btn-sm">&#9654; Test</button>' +
              '<button data-action="edit" data-id="' + _esc(w.id) + '" class="wh-btn-sm">Edit</button>' +
              '<button data-action="toggle-wh" data-id="' + _esc(w.id) + '" class="wh-btn-sm">' + (w.active ? 'Disable' : 'Enable') + '</button>' +
              '<button data-action="delete" data-id="' + _esc(w.id) + '" class="wh-btn-sm danger">Delete</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function whShowForm(webhook) {
  const isEdit = !!webhook;
  const w = webhook || {};
  const box = _container && _container.querySelector('#whModalBox');
  if (!box) return;
  const checkedEvents = new Set(w.events || []);
  box.innerHTML =
    '<div class="wh-modal-title">' + (isEdit ? 'Edit' : 'New') + ' Webhook</div>' +
    '<div class="wh-field"><label>Name *</label><input type="text" id="whFName" value="' + _esc(w.name || '') + '" placeholder="e.g. Slack Alerts"></div>' +
    '<div class="wh-field"><label>URL *</label><input type="url" id="whFUrl" value="' + _esc(w.url || '') + '" placeholder="https://…"></div>' +
    '<div class="wh-field"><label>Secret (optional)</label><input type="password" id="whFSecret" value="" placeholder="Leave blank to keep existing"></div>' +
    '<div class="wh-field"><label>Events *</label><div class="wh-event-grid">' +
      _events.map(ev =>
        '<label class="wh-ev-opt"><input type="checkbox" name="whEv" value="' + ev + '"' + (checkedEvents.has(ev) ? ' checked' : '') + '> ' + ev + '</label>'
      ).join('') +
    '</div></div>' +
    '<div class="wh-form-actions"><button class="wh-btn ghost" data-action="close-modal">Cancel</button><button class="wh-btn" id="whSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  _container.querySelector('#whModal').classList.add('open');
  box.querySelector('#whSaveBtn').addEventListener('click', () => _save(webhook, isEdit));
}

async function _save(webhook, isEdit) {
  const box = _container && _container.querySelector('#whModalBox');
  if (!box) return;
  const name   = (box.querySelector('#whFName').value || '').trim();
  const url    = (box.querySelector('#whFUrl').value  || '').trim();
  const events = [...box.querySelectorAll('input[name="whEv"]:checked')].map(el => el.value);
  if (!name)          { toast('Name is required', 'error'); return; }
  if (!url)           { toast('URL is required', 'error'); return; }
  if (!events.length) { toast('Select at least one event', 'error'); return; }
  const secret = box.querySelector('#whFSecret').value || undefined;
  const body = { name, url, events, active: true, ...(secret ? { secret } : {}) };
  const result = isEdit ? await api.put('/api/webhooks/' + webhook.id, body) : await api.post('/api/webhooks', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); whCloseModal(); whLoadData(); return; }
  if (isEdit) { const i = _webhooks.findIndex(x => x.id === webhook.id); if (i >= 0) Object.assign(_webhooks[i], body); }
  else _webhooks.push({ id: 'wh' + Date.now(), success_count: 0, fail_count: 0, last_triggered: null, ...body });
  toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
  whCloseModal(); whRenderStats(); whRender();
}

export async function whTest(id) {
  const result = await api.post('/api/webhooks/' + id + '/test', {});
  if (result && !result._error) { toast('Test ping sent ✓', 'success'); return; }
  toast('Test ping sent (demo) ✓', 'success');
  const w = _webhooks.find(x => x.id === id);
  if (w) { w.success_count = (w.success_count || 0) + 1; w.last_triggered = new Date().toISOString(); }
  whRender();
}

export async function whDelete(id) {
  if (!confirm('Delete this webhook?')) return;
  const result = await api.delete('/api/webhooks/' + id);
  if (result && !result._error) { toast('Deleted', 'success'); whLoadData(); return; }
  _webhooks = _webhooks.filter(w => w.id !== id);
  toast('Deleted (demo)', 'success'); whRenderStats(); whRender();
}

export function whCloseModal() {
  const m = _container && _container.querySelector('#whModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const s = container.querySelector('#whSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); whRender(); });
  const ab = container.querySelector('#whAddBtn');
  if (ab) ab.addEventListener('click', () => whShowForm(null));
  const modal = container.querySelector('#whModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) whCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') whCloseModal();
    else if (action === 'test')      whTest(id);
    else if (action === 'delete')    whDelete(id);
    else if (action === 'edit')      { const w = _webhooks.find(x => x.id === id); if (w) whShowForm(w); }
    else if (action === 'toggle-wh') {
      const w = _webhooks.find(x => x.id === id); if (w) { w.active = !w.active; whRenderStats(); whRender(); }
    }
  });
}

function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getWebhooks() { return _webhooks; }
export function _setWebhooks(list) { _webhooks = list; }
export function _resetState() { _container = null; _webhooks = []; _search = ''; }

registerModule('webhooks', renderWebhooksPage);
