/**
 * modules/assets/assets.js
 * Asset management: assign/return/maintenance, status tracking.
 * Pattern: renderAssetsPage() → astLoadData() → astRenderStats()
 *          → astRender() → CRUD → astCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _assets = [];
let _tab = 'all';      // 'all' | 'mine' | 'available'
let _search = '';
let _filterStatus = '';
let _filterType = '';

const _assetTypes = ['Laptop', 'Monitor', 'Keyboard', 'Mouse', 'Phone', 'Headset', 'Chair', 'Desk', 'Tablet', 'Other'];

const _mock = [
  { id: 'a1', name: 'MacBook Pro 14"',    type: 'Laptop',   serial: 'MBP-2024-001', status: 'in_use',    assigned_to: 'arif@co.com',   assigned_name: 'Arif Alwi',    assigned_date: '2024-01-15', value: 185000, condition: 'good' },
  { id: 'a2', name: 'Dell Monitor 27"',   type: 'Monitor',  serial: 'DEL-MON-042',  status: 'in_use',    assigned_to: 'sarah@co.com',  assigned_name: 'Sarah Chen',   assigned_date: '2023-06-01', value: 28000,  condition: 'good' },
  { id: 'a3', name: 'iPhone 15 Pro',      type: 'Phone',    serial: 'APL-IP15-007', status: 'available', assigned_to: null,             assigned_name: null,           assigned_date: null,         value: 92000,  condition: 'good' },
  { id: 'a4', name: 'Logitech MX Keys',   type: 'Keyboard', serial: 'LGT-MXK-015',  status: 'in_use',    assigned_to: 'bob@co.com',    assigned_name: 'Bob Builder',  assigned_date: '2023-09-10', value: 9500,   condition: 'good' },
  { id: 'a5', name: 'ThinkPad X1 Carbon', type: 'Laptop',   serial: 'LNV-TP-2023',  status: 'maintenance', assigned_to: null,           assigned_name: null,           assigned_date: null,         value: 125000, condition: 'needs_repair' },
  { id: 'a6', name: 'Sony WH-1000XM5',   type: 'Headset',  serial: 'SNY-WH-022',   status: 'available', assigned_to: null,             assigned_name: null,           assigned_date: null,         value: 29999,  condition: 'good' },
  { id: 'a7', name: 'iPad Pro 12.9"',     type: 'Tablet',   serial: 'APL-IPD-003',  status: 'in_use',    assigned_to: 'priya@co.com',  assigned_name: 'Priya Sharma', assigned_date: '2024-02-01', value: 95000,  condition: 'good' },
];

export function renderAssetsPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="ast-wrap">' +
      '<div class="ast-toolbar">' +
        '<div class="ast-tabs" id="astTabs">' +
          '<button class="ast-tab active" data-tab="all">All Assets</button>' +
          '<button class="ast-tab" data-tab="mine">My Assets</button>' +
          '<button class="ast-tab" data-tab="available">Available</button>' +
        '</div>' +
        '<input class="ast-search" id="astSearch" placeholder="Search assets…" autocomplete="off">' +
        '<select class="ast-select" id="astStatusFilter">' +
          '<option value="">All Status</option>' +
          '<option value="available">Available</option>' +
          '<option value="in_use">In Use</option>' +
          '<option value="maintenance">Maintenance</option>' +
          '<option value="retired">Retired</option>' +
        '</select>' +
        '<select class="ast-select" id="astTypeFilter">' +
          '<option value="">All Types</option>' +
          _assetTypes.map(t => '<option value="' + t + '">' + t + '</option>').join('') +
        '</select>' +
        (isAdmin ? '<button class="ast-btn" id="astAddBtn">+ Add Asset</button>' : '') +
      '</div>' +
      '<div id="astStats" class="ast-stats"></div>' +
      '<div id="astContent"></div>' +
      '<div class="ast-modal" id="astModal"><div class="ast-modal-box" id="astModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  astLoadData();
}

export async function astLoadData() {
  const d = await api.get('/api/assets');
  _assets = (d && !d._error) ? (d.assets || d || []) : _mock;
  if (!Array.isArray(_assets)) _assets = _mock;
  astRenderStats();
  astRender();
}

export function astRenderStats() {
  const el = _container && _container.querySelector('#astStats');
  if (!el) return;
  const available = _assets.filter(a => a.status === 'available').length;
  const inUse = _assets.filter(a => a.status === 'in_use').length;
  const maintenance = _assets.filter(a => a.status === 'maintenance').length;
  const totalValue = _assets.reduce((s, a) => s + (a.value || 0), 0);
  el.innerHTML =
    _sc(_assets.length, 'Total', 'var(--tx2)') +
    _sc(available, 'Available', 'var(--status-in)') +
    _sc(inUse, 'In Use', 'var(--accent)') +
    _sc(maintenance, 'Maintenance', 'var(--status-absent)') +
    _sc('₹' + (totalValue / 100000).toFixed(1) + 'L', 'Total Value', 'var(--status-break)');
}

function _sc(n, l, c) {
  return '<div class="ast-stat"><div class="ast-stat-n" style="color:' + c + '">' + n + '</div><div class="ast-stat-l">' + l + '</div></div>';
}

export function astRender() {
  const el = _container && _container.querySelector('#astContent');
  if (!el) return;
  const session = getSession();
  const email = session && session.email;
  const isAdmin = session && session.is_admin;
  let items = _assets;
  if (_tab === 'mine') items = items.filter(a => a.assigned_to === email);
  else if (_tab === 'available') items = items.filter(a => a.status === 'available');
  if (_filterStatus) items = items.filter(a => a.status === _filterStatus);
  if (_filterType) items = items.filter(a => a.type === _filterType);
  if (_search) items = items.filter(a => (a.name + ' ' + a.serial + ' ' + (a.assigned_name || '')).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="ast-empty"><div style="font-size:2rem">&#128187;</div><div>No assets found</div></div>';
    return;
  }

  let html = '<div class="ast-grid">';
  items.forEach(function (a, i) {
    const statusColor = { available: 'var(--status-in)', in_use: 'var(--accent)', maintenance: 'var(--status-absent)', retired: 'var(--tx3)' }[a.status] || 'var(--tx3)';
    html +=
      '<div class="ast-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="ast-card-hdr">' +
          '<div class="ast-type-icon">' + _typeIcon(a.type) + '</div>' +
          '<div class="ast-card-info">' +
            '<div class="ast-card-name">' + _esc(a.name) + '</div>' +
            '<div class="ast-card-serial">' + _esc(a.serial || '') + ' &middot; ' + _esc(a.type || '') + '</div>' +
          '</div>' +
          '<span class="ast-badge" style="background:' + statusColor + '20;color:' + statusColor + '">' + _esc((a.status || '').replace(/_/g, ' ')) + '</span>' +
        '</div>' +
        '<div class="ast-card-body">' +
          (a.assigned_to
            ? '<div class="ast-assigned"><span class="ast-assigned-lbl">Assigned to</span> <strong>' + _esc(a.assigned_name || a.assigned_to) + '</strong>' + (a.assigned_date ? ' since ' + _fmtDate(a.assigned_date) : '') + '</div>'
            : '<div class="ast-unassigned">Not assigned</div>') +
          (a.value ? '<div class="ast-value">Value: ₹' + (a.value || 0).toLocaleString('en-IN') + '</div>' : '') +
        '</div>' +
        (isAdmin
          ? '<div class="ast-card-actions">' +
              (a.status === 'available' ? '<button data-action="assign" data-id="' + _esc(a.id) + '" class="ast-btn-sm">Assign</button>' : '') +
              (a.status === 'in_use' ? '<button data-action="return" data-id="' + _esc(a.id) + '" class="ast-btn-sm">Return</button>' : '') +
              (a.status !== 'maintenance' && a.status !== 'retired' ? '<button data-action="maintenance" data-id="' + _esc(a.id) + '" class="ast-btn-sm warn">Maintenance</button>' : '') +
              '<button data-action="edit" data-id="' + _esc(a.id) + '" class="ast-btn-sm">Edit</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function astShowForm(asset) {
  const isEdit = !!asset;
  const a = asset || {};
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ast-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Asset</div>' +
    '<div class="ast-field"><label>Asset Name *</label><input type="text" id="astFName" value="' + _esc(a.name || '') + '" placeholder="e.g. MacBook Pro 14"></div>' +
    '<div class="ast-row2">' +
      '<div class="ast-field"><label>Type</label><select id="astFType">' + _assetTypes.map(t => '<option value="' + t + '"' + (a.type === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>' +
      '<div class="ast-field"><label>Serial Number</label><input type="text" id="astFSerial" value="' + _esc(a.serial || '') + '"></div>' +
    '</div>' +
    '<div class="ast-row2">' +
      '<div class="ast-field"><label>Value (INR)</label><input type="number" id="astFValue" value="' + (a.value || '') + '" min="0"></div>' +
      '<div class="ast-field"><label>Condition</label><select id="astFCond">' +
        '<option value="good"' + (!a.condition || a.condition === 'good' ? ' selected' : '') + '>Good</option>' +
        '<option value="fair"' + (a.condition === 'fair' ? ' selected' : '') + '>Fair</option>' +
        '<option value="needs_repair"' + (a.condition === 'needs_repair' ? ' selected' : '') + '>Needs Repair</option>' +
        '<option value="retired"' + (a.condition === 'retired' ? ' selected' : '') + '>Retired</option>' +
      '</select></div>' +
    '</div>' +
    '<div class="ast-form-actions">' +
      '<button class="ast-btn ghost" data-action="close-modal">Cancel</button>' +
      '<button class="ast-btn" id="astSaveBtn">' + (isEdit ? 'Update' : 'Add') + '</button>' +
    '</div>';
  _container.querySelector('#astModal').classList.add('open');
  box.querySelector('#astSaveBtn').addEventListener('click', () => _save(asset, isEdit));
}

async function _save(asset, isEdit) {
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  const name = (box.querySelector('#astFName').value || '').trim();
  if (!name) { toast('Asset name is required', 'error'); return; }
  const body = {
    name,
    type: box.querySelector('#astFType').value,
    serial: (box.querySelector('#astFSerial').value || '').trim(),
    value: parseFloat(box.querySelector('#astFValue').value) || 0,
    condition: box.querySelector('#astFCond').value,
    status: asset ? asset.status : 'available',
  };
  const result = isEdit ? await api.put('/api/assets/' + asset.id, body) : await api.post('/api/assets', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Added', 'success'); astCloseModal(); astLoadData(); return; }
  if (isEdit) { const i = _assets.findIndex(a => a.id === asset.id); if (i >= 0) Object.assign(_assets[i], body); }
  else _assets.push({ id: 'a' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Added') + ' (demo)', 'success');
  astCloseModal(); astRenderStats(); astRender();
}

export async function astAssign(id) {
  const email = prompt('Assign to email:');
  if (!email) return;
  const result = await api.put('/api/assets/' + id + '/assign', { email, assigned_date: new Date().toISOString().split('T')[0] });
  if (result && !result._error) { toast('Assigned', 'success'); astLoadData(); return; }
  const a = _assets.find(x => x.id === id);
  if (a) { a.status = 'in_use'; a.assigned_to = email; a.assigned_name = email; a.assigned_date = new Date().toISOString().split('T')[0]; }
  toast('Assigned (demo)', 'success'); astRenderStats(); astRender();
}

export async function astReturn(id) {
  if (!confirm('Mark this asset as returned?')) return;
  const result = await api.put('/api/assets/' + id + '/return', {});
  if (result && !result._error) { toast('Returned', 'success'); astLoadData(); return; }
  const a = _assets.find(x => x.id === id);
  if (a) { a.status = 'available'; a.assigned_to = null; a.assigned_name = null; a.assigned_date = null; }
  toast('Returned (demo)', 'success'); astRenderStats(); astRender();
}

export async function astMaintenance(id) {
  if (!confirm('Send this asset to maintenance?')) return;
  const result = await api.put('/api/assets/' + id + '/maintenance', {});
  if (result && !result._error) { toast('Sent to maintenance', 'success'); astLoadData(); return; }
  const a = _assets.find(x => x.id === id);
  if (a) { a.status = 'maintenance'; a.assigned_to = null; a.assigned_name = null; }
  toast('Sent to maintenance (demo)', 'success'); astRenderStats(); astRender();
}

export function astCloseModal() {
  const m = _container && _container.querySelector('#astModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#astTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.ast-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.ast-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    astRender();
  });
  const s = container.querySelector('#astSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); astRender(); });
  const sf = container.querySelector('#astStatusFilter');
  if (sf) sf.addEventListener('change', function () { _filterStatus = this.value; astRender(); });
  const tf = container.querySelector('#astTypeFilter');
  if (tf) tf.addEventListener('change', function () { _filterType = this.value; astRender(); });
  const ab = container.querySelector('#astAddBtn');
  if (ab) ab.addEventListener('click', () => astShowForm(null));
  const modal = container.querySelector('#astModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) astCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') astCloseModal();
    else if (action === 'assign') astAssign(id);
    else if (action === 'return') astReturn(id);
    else if (action === 'maintenance') astMaintenance(id);
    else if (action === 'edit') { const a = _assets.find(x => x.id === id); if (a) astShowForm(a); }
  });
}

function _typeIcon(type) {
  const icons = { Laptop: '&#128187;', Monitor: '&#128444;', Phone: '&#128242;', Keyboard: '&#9000;', Mouse: '&#128400;', Headset: '&#127911;', Chair: '&#129683;', Tablet: '&#128218;', Other: '&#128230;' };
  return icons[type] || '&#128230;';
}
function _fmtDate(ds) { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getAssets() { return _assets; }
export function _setAssets(list) { _assets = list; }
export function _resetState() { _container = null; _assets = []; _tab = 'all'; _search = ''; _filterStatus = ''; _filterType = ''; }

registerModule('assets', renderAssetsPage);
