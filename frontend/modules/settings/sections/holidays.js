/**
 * modules/holidays/holidays.js
 * Holiday management: public + optional holidays, list + calendar view.
 * Pattern: renderHolidaysPage() → holLoadData() → holRenderStats()
 *          → holRenderList() → CRUD → holCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _holidays = [];
let _view = 'list';
let _search = '';
let _filterType = '';

const _mock = [
  { id: 'h1',  name: "New Year's Day",    date: '2026-01-01', optional: false, description: 'New Year celebration' },
  { id: 'h2',  name: 'Republic Day',       date: '2026-01-26', optional: false, description: 'National holiday' },
  { id: 'h3',  name: 'Holi',               date: '2026-03-20', optional: false, description: 'Festival of colours' },
  { id: 'h4',  name: 'Good Friday',        date: '2026-04-03', optional: true,  description: 'Optional holiday' },
  { id: 'h5',  name: 'Eid ul-Fitr',        date: '2026-04-11', optional: true,  description: 'Optional holiday' },
  { id: 'h6',  name: 'Independence Day',   date: '2026-08-15', optional: false, description: 'National holiday' },
  { id: 'h7',  name: 'Gandhi Jayanti',     date: '2026-10-02', optional: false, description: 'National holiday' },
  { id: 'h8',  name: 'Dussehra',           date: '2026-10-05', optional: true,  description: 'Optional holiday' },
  { id: 'h9',  name: 'Diwali',             date: '2026-10-19', optional: false, description: 'Festival of lights' },
  { id: 'h10', name: 'Christmas Day',      date: '2026-12-25', optional: false, description: 'Christmas celebration' },
];

export function renderHolidaysPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="hol-wrap">' +
      '<div class="hol-toolbar">' +
        '<div class="hol-view-tabs" id="holViewTabs">' +
          '<button class="hol-vtab active" data-view="list">List</button>' +
          '<button class="hol-vtab" data-view="calendar">Calendar</button>' +
        '</div>' +
        '<input class="hol-search" id="holSearch" placeholder="Search…" autocomplete="off">' +
        '<select class="hol-select" id="holTypeFilter">' +
          '<option value="">All Types</option>' +
          '<option value="public">Public</option>' +
          '<option value="optional">Optional</option>' +
        '</select>' +
        (isAdmin ? '<button class="hol-btn" id="holAddBtn">+ Add Holiday</button>' : '') +
      '</div>' +
      '<div id="holStats" class="hol-stats"></div>' +
      '<div id="holContent"></div>' +
      '<div class="hol-modal" id="holModal"><div class="hol-modal-box" id="holModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  holLoadData();
}

export async function holLoadData() {
  const d = await api.get('/api/holidays');
  _holidays = (d && !d._error) ? (d.holidays || d || []) : _mock;
  if (!Array.isArray(_holidays)) _holidays = _mock;
  _holidays.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  holRenderStats();
  _view === 'calendar' ? _renderCalendar() : holRenderList();
}

export function holRenderStats() {
  const el = _container && _container.querySelector('#holStats');
  if (!el) return;
  const now = new Date().toISOString().split('T')[0];
  const pub = _holidays.filter(h => !h.optional).length;
  const opt = _holidays.filter(h => h.optional).length;
  const upcoming = _holidays.filter(h => h.date >= now).length;
  el.innerHTML =
    _sc(_holidays.length, 'Total', 'var(--accent)') +
    _sc(pub, 'Public', 'var(--status-in)') +
    _sc(opt, 'Optional', 'var(--status-break)') +
    _sc(upcoming, 'Upcoming', 'var(--status-absent)');
}

function _sc(n, l, c) {
  return '<div class="hol-stat"><div class="hol-stat-n" style="color:' + c + '">' + n + '</div><div class="hol-stat-l">' + l + '</div></div>';
}

export function holRenderList() {
  const el = _container && _container.querySelector('#holContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _filtered();
  if (!items.length) {
    el.innerHTML = '<div class="hol-empty"><div style="font-size:2rem">&#127973;</div><div>No holidays found</div></div>';
    return;
  }
  const now = new Date().toISOString().split('T')[0];
  let html = '<div class="hol-list">';
  items.forEach(function (h, i) {
    const past = h.date < now;
    const dAway = _daysAway(h.date);
    html +=
      '<div class="hol-row' + (past ? ' hol-past' : '') + '" style="animation-delay:' + (i * 0.03) + 's">' +
        '<div class="hol-date-col">' +
          '<div class="hol-date-d">' + _dayNum(h.date) + '</div>' +
          '<div class="hol-date-m">' + _monShort(h.date) + '</div>' +
        '</div>' +
        '<div class="hol-info-col">' +
          '<div class="hol-row-name">' + _esc(h.name) + '</div>' +
          '<div class="hol-row-meta">' + _fmtDate(h.date) + (h.description ? ' &middot; ' + _esc(h.description) : '') + '</div>' +
        '</div>' +
        '<div class="hol-right-col">' +
          '<span class="hol-badge ' + (h.optional ? 'hol-opt' : 'hol-pub') + '">' + (h.optional ? 'Optional' : 'Public') + '</span>' +
          '<span class="hol-away">' + dAway + '</span>' +
          (isAdmin
            ? '<div class="hol-actions">' +
                '<button data-action="edit" data-id="' + _esc(h.id) + '" class="hol-icon-btn" title="Edit">&#9998;</button>' +
                '<button data-action="delete" data-id="' + _esc(h.id) + '" class="hol-icon-btn danger" title="Delete">&#128465;</button>' +
              '</div>'
            : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderCalendar() {
  const el = _container && _container.querySelector('#holContent');
  if (!el) return;
  const year = new Date().getFullYear();
  let html = '<div class="hol-cal">';
  for (let m = 0; m < 12; m++) {
    const mHols = _holidays.filter(h => {
      const d = new Date(h.date + 'T00:00:00');
      return d.getFullYear() === year && d.getMonth() === m;
    });
    if (!mHols.length) continue;
    html += '<div class="hol-cal-mon"><div class="hol-cal-mon-name">' + _monName(m) + ' ' + year + '</div>';
    mHols.forEach(h => {
      html += '<div class="hol-cal-item' + (h.optional ? ' hol-cal-opt' : '') + '">' +
        '<span class="hol-cal-dot" style="background:' + (h.optional ? 'var(--status-break)' : 'var(--status-in)') + '"></span>' +
        '<span class="hol-cal-dn">' + _dayNum(h.date) + '</span>' +
        '<span class="hol-cal-nm">' + _esc(h.name) + '</span>' +
        '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

export function holShowForm(hol) {
  const isEdit = !!hol;
  const box = _container && _container.querySelector('#holModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="hol-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Holiday</div>' +
    '<div class="hol-field"><label>Name *</label><input type="text" id="holFN" value="' + _esc((hol && hol.name) || '') + '" placeholder="e.g. Diwali"></div>' +
    '<div class="hol-field"><label>Date *</label><input type="date" id="holFD" value="' + _esc((hol && hol.date) || '') + '"></div>' +
    '<div class="hol-field"><label>Type</label><select id="holFT">' +
      '<option value="public"' + (!hol || !hol.optional ? ' selected' : '') + '>Public</option>' +
      '<option value="optional"' + (hol && hol.optional ? ' selected' : '') + '>Optional</option>' +
    '</select></div>' +
    '<div class="hol-field"><label>Description</label><input type="text" id="holFDs" value="' + _esc((hol && hol.description) || '') + '"></div>' +
    '<div class="hol-form-actions">' +
      '<button class="hol-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="hol-btn" id="holSaveBtn">' + (isEdit ? 'Update' : 'Add') + '</button>' +
    '</div>';
  _container.querySelector('#holModal').classList.add('open');
  box.querySelector('#holSaveBtn').addEventListener('click', () => _save(hol, isEdit));
}

async function _save(hol, isEdit) {
  const box = _container && _container.querySelector('#holModalBox');
  if (!box) return;
  const name = (box.querySelector('#holFN').value || '').trim();
  const date = box.querySelector('#holFD').value;
  const optional = box.querySelector('#holFT').value === 'optional';
  const description = (box.querySelector('#holFDs').value || '').trim();
  if (!name) { toast('Name is required', 'error'); return; }
  if (!date) { toast('Date is required', 'error'); return; }
  const body = { name, date, optional, description };
  const result = isEdit ? await api.put('/api/holidays/' + hol.id, body) : await api.post('/api/holidays', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Added', 'success'); holCloseModal(); holLoadData(); return; }
  if (isEdit) { const i = _holidays.findIndex(h => h.id === hol.id); if (i >= 0) Object.assign(_holidays[i], body); }
  else { _holidays.push({ id: 'h' + Date.now(), ...body }); _holidays.sort((a, b) => a.date.localeCompare(b.date)); }
  toast((isEdit ? 'Updated' : 'Added') + ' (demo)', 'success');
  holCloseModal(); holRenderStats(); holRenderList();
}

export async function holDelete(id) {
  if (!confirm('Delete this holiday?')) return;
  const r = await api.delete('/api/holidays/' + id);
  if (r && !r._error) { toast('Deleted', 'success'); holLoadData(); return; }
  _holidays = _holidays.filter(h => h.id !== id);
  toast('Deleted (demo)', 'success'); holRenderStats(); holRenderList();
}

export function holCloseModal() {
  const m = _container && _container.querySelector('#holModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const vt = container.querySelector('#holViewTabs');
  if (vt) vt.addEventListener('click', function (e) {
    const tab = e.target.closest('.hol-vtab');
    if (!tab) return;
    _view = tab.dataset.view;
    vt.querySelectorAll('.hol-vtab').forEach(t => t.classList.toggle('active', t.dataset.view === _view));
    _view === 'calendar' ? _renderCalendar() : holRenderList();
  });
  const s = container.querySelector('#holSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); holRenderList(); });
  const f = container.querySelector('#holTypeFilter');
  if (f) f.addEventListener('change', function () { _filterType = this.value; holRenderList(); });
  const ab = container.querySelector('#holAddBtn');
  if (ab) ab.addEventListener('click', () => holShowForm(null));
  const modal = container.querySelector('#holModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) holCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') holCloseModal();
    else if (action === 'edit') { const h = _holidays.find(x => x.id === id); if (h) holShowForm(h); }
    else if (action === 'delete') holDelete(id);
  });
}

function _filtered() {
  return _holidays.filter(h => {
    if (_filterType === 'public' && h.optional) return false;
    if (_filterType === 'optional' && !h.optional) return false;
    if (_search && !(h.name + ' ' + (h.description || '')).toLowerCase().includes(_search)) return false;
    return true;
  });
}

function _daysAway(ds) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(ds + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 0) return Math.abs(diff) + 'd ago';
  return diff + 'd away';
}
function _dayNum(ds) { return new Date(ds + 'T00:00:00').getDate(); }
function _monShort(ds) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][new Date(ds + 'T00:00:00').getMonth()]; }
function _monName(m) { return ['January','February','March','April','May','June','July','August','September','October','November','December'][m]; }
function _fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getHolidays() { return _holidays; }
export function _setHolidays(list) { _holidays = list; }
export function _resetState() { _container = null; _holidays = []; _view = 'list'; _search = ''; _filterType = ''; }

registerModule('holidays', renderHolidaysPage);
