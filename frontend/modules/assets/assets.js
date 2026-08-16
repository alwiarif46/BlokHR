/**
 * modules/assets/assets.js
 * Asset Management — inventory, assignments, maintenance.
 * Pattern: renderAssetsPage() → astLoadData() → astRenderStats() → astRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { promptDialog, confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const ASSET_TYPES = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'parking', label: 'Parking' },
  { value: 'other', label: 'Other' },
];

const STATUS_LABELS = {
  available: 'Available',
  assigned: 'Assigned',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

const DEPRECIATION_METHODS = [
  { value: 'straight_line', label: 'Straight line' },
  { value: 'declining_balance', label: 'Declining balance' },
  { value: 'none', label: 'None' },
];

let _container = null;
let _tab = 'inventory';
let _assets = [];
let _mine = [];
let _openMaintenance = [];
let _filterType = '';
let _filterStatus = '';
let _loadError = null;
let _featureOff = false;
let _saving = false;
let _editing = null;

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

function _statusBadge(status) {
  const label = STATUS_LABELS[status] || status || '—';
  let color = 'var(--tx2)';
  let bg = 'var(--accent-dim)';
  if (status === 'available') {
    color = 'var(--status-in)';
  } else if (status === 'assigned') {
    color = 'var(--accent)';
  } else if (status === 'maintenance') {
    color = 'var(--status-break)';
  } else if (status === 'retired') {
    color = 'var(--tx3)';
  }
  return (
    '<span class="ast-card-badge" style="background:' +
    bg +
    ';color:' +
    color +
    '">' +
    _esc(label) +
    '</span>'
  );
}

/** Normalize asset row from API (snake_case). */
export function _normalizeAsset(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    assetTag: raw.asset_tag || raw.assetTag || '',
    assetType: raw.asset_type || raw.assetType || 'other',
    name: raw.name || '',
    description: raw.description || '',
    serialNumber: raw.serial_number || raw.serialNumber || '',
    purchaseDate: raw.purchase_date || raw.purchaseDate || '',
    purchaseCost: Number(raw.purchase_cost != null ? raw.purchase_cost : raw.purchaseCost) || 0,
    warrantyExpiry: raw.warranty_expiry || raw.warrantyExpiry || '',
    status: raw.status || 'available',
    depreciationMethod:
      raw.depreciation_method || raw.depreciationMethod || 'straight_line',
    usefulLifeYears:
      Number(raw.useful_life_years != null ? raw.useful_life_years : raw.usefulLifeYears) || 3,
    location: raw.location || '',
    notes: raw.notes || '',
    createdBy: raw.created_by || raw.createdBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    updatedAt: raw.updated_at || raw.updatedAt || '',
  };
}

/** Normalize assignment row. */
export function _normalizeAssignment(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    assetId: raw.asset_id || raw.assetId || '',
    email: raw.email || '',
    assignedDate: raw.assigned_date || raw.assignedDate || '',
    returnedDate: raw.returned_date || raw.returnedDate || null,
    conditionOnAssign: raw.condition_on_assign || raw.conditionOnAssign || '',
    conditionOnReturn: raw.condition_on_return || raw.conditionOnReturn || '',
    assignedBy: raw.assigned_by || raw.assignedBy || '',
    notes: raw.notes || '',
    createdAt: raw.created_at || raw.createdAt || '',
    assetName: raw.asset_name || raw.assetName || '',
    assetType: raw.asset_type || raw.assetType || '',
  };
}

/** Normalize maintenance record. */
export function _normalizeMaintenance(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    assetId: raw.asset_id || raw.assetId || '',
    scheduledDate: raw.scheduled_date || raw.scheduledDate || '',
    completedDate: raw.completed_date || raw.completedDate || null,
    cost: Number(raw.cost) || 0,
    notes: raw.notes || '',
    createdBy: raw.created_by || raw.createdBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    assetName: raw.asset_name || raw.assetName || '',
    assetTag: raw.asset_tag || raw.assetTag || '',
  };
}

export function renderAssetsPage(container) {
  _container = container;
  _tab = 'inventory';
  _editing = null;
  _filterType = '';
  _filterStatus = '';
  container.innerHTML =
    '<div class="ast-wrap" id="astWrap">' +
      '<div class="ast-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128187;</span> Asset Management</div>' +
        '<div class="ast-spacer"></div>' +
        '<button type="button" class="ast-btn" id="astAddBtn" style="display:none">+ Add</button>' +
      '</div>' +
      '<div class="ast-tabs" id="astTabs">' +
        '<button type="button" class="ast-tab active" data-tab="inventory">Inventory</button>' +
        '<button type="button" class="ast-tab" data-tab="mine">My Assets</button>' +
        '<button type="button" class="ast-tab" data-tab="maintenance">Maintenance</button>' +
      '</div>' +
      '<div class="ast-stats" id="astStats"></div>' +
      '<div id="astFilters" class="ast-filters"></div>' +
      '<div id="astContent"></div>' +
      '<div class="ast-modal" id="astModal"><div class="ast-modal-box wide" id="astModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _syncAddButton();
  astLoadData();
}

function _syncAddButton() {
  const btn = _container && _container.querySelector('#astAddBtn');
  if (!btn) return;
  const show = _isAdmin() && _tab === 'inventory';
  btn.style.display = show ? '' : 'none';
}

function _inventoryQuery() {
  const qs = [];
  if (_filterType) qs.push('assetType=' + encodeURIComponent(_filterType));
  if (_filterStatus) qs.push('status=' + encodeURIComponent(_filterStatus));
  return qs.length ? '/api/assets?' + qs.join('&') : '/api/assets';
}

export async function astLoadData() {
  _loadError = null;
  _featureOff = false;

  const [invRes, mineRes, mntRes] = await Promise.all([
    api.get(_inventoryQuery()),
    api.get('/api/assets/mine'),
    api.get('/api/assets/maintenance-open'),
  ]);

  if (invRes && invRes._error) {
    _assets = [];
    _loadError = invRes.message || 'Could not load assets';
    if (invRes.status === 404) {
      _featureOff = true;
      _loadError = 'Asset Management is disabled for this workspace';
    }
  } else {
    const rows = (invRes && (invRes.assets || invRes)) || [];
    _assets = (Array.isArray(rows) ? rows : []).map(_normalizeAsset);
  }

  if (mineRes && !mineRes._error) {
    const rows = mineRes.assignments || [];
    _mine = (Array.isArray(rows) ? rows : []).map(_normalizeAssignment);
  } else {
    _mine = [];
  }

  if (mntRes && !mntRes._error) {
    const rows = mntRes.records || [];
    _openMaintenance = (Array.isArray(rows) ? rows : []).map(_normalizeMaintenance);
  } else {
    _openMaintenance = [];
  }

  astRenderStats();
  astRender();
}

export function astRenderStats() {
  const el = _container && _container.querySelector('#astStats');
  if (!el) return;
  const assigned = _assets.filter((a) => a.status === 'assigned').length;
  const maintenance = _assets.filter((a) => a.status === 'maintenance').length;
  el.innerHTML =
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--accent)">' +
    _assets.length +
    '</div><div class="ast-stat-label">Total Assets</div></div>' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--status-in)">' +
    assigned +
    '</div><div class="ast-stat-label">Assigned</div></div>' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--status-break)">' +
    maintenance +
    '</div><div class="ast-stat-label">In Maintenance</div></div>' +
    '<div class="ast-stat"><div class="ast-stat-num" style="color:var(--tx2)">' +
    _mine.length +
    '</div><div class="ast-stat-label">Assigned to Me</div></div>';
}

function _empty(text) {
  return (
    '<div class="ast-empty"><div class="ast-empty-icon">&#128187;</div><div class="ast-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

function _renderFilters() {
  const el = _container && _container.querySelector('#astFilters');
  if (!el) return;
  if (_tab !== 'inventory' || _featureOff) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML =
    '<div class="ast-field"><label>Type</label><select id="astFilterType">' +
    '<option value="">All types</option>' +
    ASSET_TYPES.map(
      (t) =>
        '<option value="' +
        t.value +
        '"' +
        (_filterType === t.value ? ' selected' : '') +
        '>' +
        _esc(t.label) +
        '</option>',
    ).join('') +
    '</select></div>' +
    '<div class="ast-field"><label>Status</label><select id="astFilterStatus">' +
    '<option value="">All statuses</option>' +
    Object.keys(STATUS_LABELS)
      .map(
        (s) =>
          '<option value="' +
          s +
          '"' +
          (_filterStatus === s ? ' selected' : '') +
          '>' +
          _esc(STATUS_LABELS[s]) +
          '</option>',
      )
      .join('') +
    '</select></div>';
}

export function astRender() {
  const el = _container && _container.querySelector('#astContent');
  if (!el) return;
  _syncAddButton();
  _renderFilters();

  if (_featureOff) {
    el.innerHTML = _empty(_loadError || 'Asset Management is disabled');
    return;
  }

  if (_tab === 'inventory') {
    if (_loadError && !_assets.length) {
      el.innerHTML = _empty(_loadError);
      return;
    }
    if (!_assets.length) {
      el.innerHTML = _empty(
        _isAdmin() ? 'No assets yet — add inventory' : 'No assets in inventory',
      );
      return;
    }
    el.innerHTML = '<div class="ast-grid">' + _assets.map(_renderAssetCard).join('') + '</div>';
    return;
  }

  if (_tab === 'mine') {
    if (!_mine.length) {
      el.innerHTML = _empty('No assets assigned to you');
      return;
    }
    el.innerHTML = '<div class="ast-grid">' + _mine.map(_renderMineCard).join('') + '</div>';
    return;
  }

  if (_tab === 'maintenance') {
    if (!_openMaintenance.length) {
      el.innerHTML = _empty(
        _isAdmin() ? 'No open maintenance — schedule from inventory' : 'No open maintenance',
      );
      return;
    }
    el.innerHTML =
      '<div class="ast-grid">' + _openMaintenance.map(_renderMaintenanceCard).join('') + '</div>';
  }
}

function _renderAssetCard(item, i) {
  const admin = _isAdmin();
  let actions =
    '<button type="button" data-action="detail" data-id="' + _esc(item.id) + '">Detail</button>';
  if (admin && item.status === 'available') {
    actions +=
      '<button type="button" data-action="assign" data-id="' + _esc(item.id) + '">Assign</button>';
    actions +=
      '<button type="button" data-action="schedule" data-id="' +
      _esc(item.id) +
      '">Maintenance</button>';
  }
  if (admin) {
    actions +=
      '<button type="button" data-action="edit" data-idx="' + i + '">Edit</button>' +
      '<button type="button" class="danger" data-action="delete" data-id="' +
      _esc(item.id) +
      '">Delete</button>';
  }
  return (
    '<div class="ast-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="ast-card-title">' +
    _esc(item.name) +
    '</div>' +
    '<div class="ast-card-sub">' +
    _esc(item.assetTag) +
    ' · ' +
    _esc(_labelOf(ASSET_TYPES, item.assetType)) +
    (item.location ? ' · ' + _esc(item.location) : '') +
    '</div>' +
    _statusBadge(item.status) +
    '<div class="ast-card-actions">' +
    actions +
    '</div></div>'
  );
}

function _renderMineCard(item, i) {
  return (
    '<div class="ast-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="ast-card-title">' +
    _esc(item.assetName || 'Asset') +
    '</div>' +
    '<div class="ast-card-sub">' +
    _esc(_labelOf(ASSET_TYPES, item.assetType)) +
    ' · Assigned ' +
    _esc(item.assignedDate || '—') +
    '</div>' +
    '<div class="ast-card-actions">' +
    '<button type="button" data-action="return" data-id="' +
    _esc(item.id) +
    '">Return</button>' +
    '<button type="button" data-action="detail" data-id="' +
    _esc(item.assetId) +
    '">Detail</button>' +
    '</div></div>'
  );
}

function _renderMaintenanceCard(item, i) {
  const admin = _isAdmin();
  return (
    '<div class="ast-card" style="animation-delay:' +
    i * 0.04 +
    's" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="ast-card-title">' +
    _esc(item.assetName || 'Asset') +
    '</div>' +
    '<div class="ast-card-sub">' +
    _esc(item.assetTag) +
    ' · Scheduled ' +
    _esc(item.scheduledDate) +
    (item.cost ? ' · Cost ' + _esc(String(item.cost)) : '') +
    '</div>' +
    (item.notes ? '<div class="ast-card-sub">' + _esc(item.notes) + '</div>' : '') +
    '<div class="ast-card-actions">' +
    (admin
      ? '<button type="button" data-action="complete-mnt" data-id="' +
        _esc(item.id) +
        '">Complete</button>'
      : '') +
    '<button type="button" data-action="detail" data-id="' +
    _esc(item.assetId) +
    '">Detail</button>' +
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

export function astShowForm(item) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  _editing = item || null;
  const isEdit = !!item;
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ast-modal-title">' +
    (isEdit ? 'Edit Asset' : 'Add Asset') +
    '</div>' +
    '<div class="ast-row">' +
    '<div class="ast-field" style="flex:1"><label>Name *</label><input type="text" id="astF_name" value="' +
    _esc(item ? item.name : '') +
    '"></div>' +
    (isEdit
      ? ''
      : '<div class="ast-field" style="flex:1"><label>Asset Tag *</label><input type="text" id="astF_tag" value="" placeholder="LPT-001"></div>') +
    '</div>' +
    '<div class="ast-row">' +
    '<div class="ast-field" style="flex:1"><label>Type</label><select id="astF_type">' +
    _optionsHtml(ASSET_TYPES, item ? item.assetType : 'laptop') +
    '</select></div>' +
    '<div class="ast-field" style="flex:1"><label>Serial Number</label><input type="text" id="astF_serial" value="' +
    _esc(item ? item.serialNumber : '') +
    '"></div>' +
    '</div>' +
    '<div class="ast-field"><label>Description</label><textarea id="astF_desc" rows="2">' +
    _esc(item ? item.description : '') +
    '</textarea></div>' +
    '<div class="ast-row">' +
    '<div class="ast-field" style="flex:1"><label>Purchase Date</label><input type="date" id="astF_purchaseDate" value="' +
    _esc(item ? String(item.purchaseDate).slice(0, 10) : '') +
    '"></div>' +
    '<div class="ast-field" style="flex:1"><label>Purchase Cost</label><input type="number" id="astF_cost" min="0" step="0.01" value="' +
    _esc(item ? String(item.purchaseCost || '') : '') +
    '"></div>' +
    '</div>' +
    '<div class="ast-row">' +
    '<div class="ast-field" style="flex:1"><label>Warranty Expiry</label><input type="date" id="astF_warranty" value="' +
    _esc(item ? String(item.warrantyExpiry).slice(0, 10) : '') +
    '"></div>' +
    '<div class="ast-field" style="flex:1"><label>Location</label><input type="text" id="astF_location" value="' +
    _esc(item ? item.location : '') +
    '"></div>' +
    '</div>' +
    '<div class="ast-row">' +
    '<div class="ast-field" style="flex:1"><label>Depreciation</label><select id="astF_depr">' +
    _optionsHtml(DEPRECIATION_METHODS, item ? item.depreciationMethod : 'straight_line') +
    '</select></div>' +
    '<div class="ast-field" style="flex:1"><label>Useful Life (years)</label><input type="number" id="astF_life" min="1" value="' +
    _esc(item ? String(item.usefulLifeYears || 3) : '3') +
    '"></div>' +
    '</div>' +
    '<div class="ast-field"><label>Notes</label><textarea id="astF_notes" rows="2">' +
    _esc(item ? item.notes : '') +
    '</textarea></div>' +
    '<div class="ast-form-actions">' +
    '<button type="button" class="ast-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ast-btn" id="astSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#astModal');
  if (modal) modal.classList.add('open');
  const saveBtn = box.querySelector('#astSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', astSave);
}

export async function astSave() {
  if (_saving || !_isAdmin()) return;
  const nameEl = _container.querySelector('#astF_name');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    toast('Name is required', 'error');
    return;
  }

  const body = {
    name,
    assetType: (_container.querySelector('#astF_type') || {}).value || 'other',
    serialNumber: ((_container.querySelector('#astF_serial') || {}).value || '').trim(),
    description: ((_container.querySelector('#astF_desc') || {}).value || '').trim(),
    purchaseDate: ((_container.querySelector('#astF_purchaseDate') || {}).value || '').trim(),
    purchaseCost: Number((_container.querySelector('#astF_cost') || {}).value) || 0,
    warrantyExpiry: ((_container.querySelector('#astF_warranty') || {}).value || '').trim(),
    location: ((_container.querySelector('#astF_location') || {}).value || '').trim(),
    depreciationMethod:
      (_container.querySelector('#astF_depr') || {}).value || 'straight_line',
    usefulLifeYears: Number((_container.querySelector('#astF_life') || {}).value) || 3,
    notes: ((_container.querySelector('#astF_notes') || {}).value || '').trim(),
  };

  _saving = true;
  let result;
  if (_editing && _editing.id) {
    result = await api.put('/api/assets/' + _editing.id, body);
  } else {
    const tag = ((_container.querySelector('#astF_tag') || {}).value || '').trim();
    if (!tag) {
      _saving = false;
      toast('Asset tag is required', 'error');
      return;
    }
    body.assetTag = tag;
    result = await api.post('/api/assets', body);
  }
  _saving = false;

  if (result && !result._error) {
    toast(_editing ? 'Updated' : 'Created', 'success');
    astCloseModal();
    _editing = null;
    await astLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to save', 'error');
}

export function astShowAssign(assetId) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const asset = _assets.find((a) => a.id === assetId);
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="ast-modal-title">Assign ' +
    _esc(asset ? asset.name : 'Asset') +
    '</div>' +
    '<div class="ast-field"><label>Employee Email *</label><input type="email" id="astF_email" placeholder="user@company.com"></div>' +
    '<div class="ast-field"><label>Condition</label><input type="text" id="astF_cond" value="good"></div>' +
    '<div class="ast-field"><label>Notes</label><textarea id="astF_assignNotes" rows="2"></textarea></div>' +
    '<div class="ast-form-actions">' +
    '<button type="button" class="ast-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ast-btn" id="astAssignBtn">Assign</button></div>';
  const modal = _container.querySelector('#astModal');
  if (modal) modal.classList.add('open');
  const btn = box.querySelector('#astAssignBtn');
  if (btn) {
    btn.addEventListener('click', async function () {
      const email = ((_container.querySelector('#astF_email') || {}).value || '')
        .trim()
        .toLowerCase();
      if (!email) {
        toast('Email is required', 'error');
        return;
      }
      const result = await api.post('/api/assets/' + assetId + '/assign', {
        email,
        conditionOnAssign: ((_container.querySelector('#astF_cond') || {}).value || 'good').trim(),
        notes: ((_container.querySelector('#astF_assignNotes') || {}).value || '').trim(),
      });
      if (result && !result._error) {
        toast('Assigned', 'success');
        astCloseModal();
        await astLoadData();
        return;
      }
      toast((result && result.message) || 'Failed to assign', 'error');
    });
  }
}

export function astShowSchedule(assetId) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const asset = _assets.find((a) => a.id === assetId);
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  const today = new Date().toISOString().slice(0, 10);
  box.innerHTML =
    '<div class="ast-modal-title">Schedule Maintenance — ' +
    _esc(asset ? asset.name : 'Asset') +
    '</div>' +
    '<div class="ast-field"><label>Scheduled Date *</label><input type="date" id="astF_schedDate" value="' +
    today +
    '"></div>' +
    '<div class="ast-field"><label>Cost</label><input type="number" id="astF_schedCost" min="0" step="0.01" value="0"></div>' +
    '<div class="ast-field"><label>Notes</label><textarea id="astF_schedNotes" rows="2"></textarea></div>' +
    '<div class="ast-form-actions">' +
    '<button type="button" class="ast-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ast-btn" id="astSchedBtn">Schedule</button></div>';
  const modal = _container.querySelector('#astModal');
  if (modal) modal.classList.add('open');
  const btn = box.querySelector('#astSchedBtn');
  if (btn) {
    btn.addEventListener('click', async function () {
      const scheduledDate = ((_container.querySelector('#astF_schedDate') || {}).value || '').trim();
      if (!scheduledDate) {
        toast('Scheduled date is required', 'error');
        return;
      }
      const result = await api.post('/api/assets/' + assetId + '/maintenance', {
        scheduledDate,
        cost: Number((_container.querySelector('#astF_schedCost') || {}).value) || 0,
        notes: ((_container.querySelector('#astF_schedNotes') || {}).value || '').trim(),
      });
      if (result && !result._error) {
        toast('Maintenance scheduled', 'success');
        astCloseModal();
        _tab = 'maintenance';
        _syncTabs();
        await astLoadData();
        return;
      }
      toast((result && result.message) || 'Failed to schedule', 'error');
    });
  }
}

export async function astShowDetail(assetId) {
  const box = _container && _container.querySelector('#astModalBox');
  if (!box) return;
  box.innerHTML = '<div class="ast-modal-title">Loading…</div>';
  const modal = _container.querySelector('#astModal');
  if (modal) modal.classList.add('open');

  const [detailRes, histRes, mntRes] = await Promise.all([
    api.get('/api/assets/' + assetId),
    api.get('/api/assets/' + assetId + '/history'),
    api.get('/api/assets/' + assetId + '/maintenance'),
  ]);

  if (detailRes && detailRes._error) {
    box.innerHTML =
      '<div class="ast-modal-title">Asset</div><div class="ast-empty-text">' +
      _esc(detailRes.message || 'Not found') +
      '</div>' +
      '<div class="ast-form-actions"><button type="button" class="ast-btn ghost" data-action="close-modal">Close</button></div>';
    return;
  }

  const asset = _normalizeAsset(detailRes.asset || detailRes);
  const bookValue = detailRes.bookValue;
  const history = ((histRes && histRes.history) || []).map(_normalizeAssignment);
  const records = ((mntRes && mntRes.records) || []).map(_normalizeMaintenance);

  let histHtml = '<div class="ast-history-empty">No assignment history</div>';
  if (history.length) {
    histHtml = history
      .map(
        (h) =>
          '<div class="ast-history-row">' +
          _esc(h.email) +
          ' · ' +
          _esc(h.assignedDate) +
          (h.returnedDate ? ' → ' + _esc(h.returnedDate) : ' (open)') +
          '</div>',
      )
      .join('');
  }

  let mntHtml = '<div class="ast-history-empty">No maintenance records</div>';
  if (records.length) {
    mntHtml = records
      .map(
        (r) =>
          '<div class="ast-history-row">' +
          _esc(r.scheduledDate) +
          (r.completedDate ? ' · done ' + _esc(r.completedDate) : ' · open') +
          (r.cost ? ' · ' + _esc(String(r.cost)) : '') +
          (r.notes ? ' — ' + _esc(r.notes) : '') +
          '</div>',
      )
      .join('');
  }

  box.innerHTML =
    '<div class="ast-modal-title">' +
    _esc(asset.name) +
    '</div>' +
    '<div class="ast-detail-meta">' +
    _esc(asset.assetTag) +
    ' · ' +
    _esc(_labelOf(ASSET_TYPES, asset.assetType)) +
    ' · ' +
    _statusBadge(asset.status) +
    '</div>' +
    '<div class="ast-detail-grid">' +
    '<div><span class="ast-detail-label">Serial</span> ' +
    _esc(asset.serialNumber || '—') +
    '</div>' +
    '<div><span class="ast-detail-label">Location</span> ' +
    _esc(asset.location || '—') +
    '</div>' +
    '<div><span class="ast-detail-label">Purchase</span> ' +
    _esc(asset.purchaseDate || '—') +
    ' / ' +
    _esc(String(asset.purchaseCost || 0)) +
    '</div>' +
    '<div><span class="ast-detail-label">Book value</span> ' +
    _esc(bookValue != null ? String(bookValue) : '—') +
    '</div>' +
    '<div><span class="ast-detail-label">Warranty</span> ' +
    _esc(asset.warrantyExpiry || '—') +
    '</div>' +
    '<div><span class="ast-detail-label">Depreciation</span> ' +
    _esc(_labelOf(DEPRECIATION_METHODS, asset.depreciationMethod)) +
    ' / ' +
    _esc(String(asset.usefulLifeYears)) +
    'y</div>' +
    '</div>' +
    (asset.description
      ? '<div class="ast-card-sub" style="margin:10px 0">' + _esc(asset.description) + '</div>'
      : '') +
    '<div class="ast-section-title">Assignment history</div>' +
    '<div class="ast-history">' +
    histHtml +
    '</div>' +
    '<div class="ast-section-title">Maintenance</div>' +
    '<div class="ast-history">' +
    mntHtml +
    '</div>' +
    '<div class="ast-form-actions"><button type="button" class="ast-btn ghost" data-action="close-modal">Close</button></div>';
}

export async function astDelete(id) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  if (!(await confirmDialog({ message: 'Delete this asset?', confirmLabel: 'Delete', danger: true }))) return;
  const result = await api.delete('/api/assets/' + id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await astLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function astReturn(assignmentId) {
  const condition = await promptDialog({
    title: 'Return asset',
    label: 'Condition on return',
    value: 'good',
    confirmLabel: 'Return',
  });
  if (condition === null) return;
  const result = await api.post('/api/assets/assignments/' + assignmentId + '/return', {
    conditionOnReturn: condition || 'good',
  });
  if (result && !result._error) {
    toast('Returned', 'success');
    await astLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to return', 'error');
}

export async function astCompleteMaintenance(recordId) {
  if (!_isAdmin()) {
    toast('Admin only', 'error');
    return;
  }
  const result = await api.post('/api/assets/maintenance/' + recordId + '/complete', {});
  if (result && !result._error) {
    toast('Maintenance completed', 'success');
    await astLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export function astCloseModal() {
  const modal = _container && _container.querySelector('#astModal');
  if (modal) modal.classList.remove('open');
  _editing = null;
}

function _syncTabs() {
  if (!_container) return;
  _container.querySelectorAll('.ast-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#astAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      astShowForm(null);
    });
  }

  const modal = container.querySelector('#astModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) astCloseModal();
    });
  }

  container.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-tab]');
    if (tab && tab.classList.contains('ast-tab')) {
      _tab = tab.dataset.tab || 'inventory';
      _syncTabs();
      astRender();
      return;
    }
    if (e.target.closest('[data-action="close-modal"]')) {
      astCloseModal();
      return;
    }
  });

  container.addEventListener('change', function (e) {
    if (e.target.id === 'astFilterType') {
      _filterType = e.target.value || '';
      astLoadData();
    } else if (e.target.id === 'astFilterStatus') {
      _filterStatus = e.target.value || '';
      astLoadData();
    }
  });

  const content = container.querySelector('#astContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      const idx = parseInt(btn.dataset.idx, 10);

      if (action === 'edit') astShowForm(_assets[idx]);
      else if (action === 'delete') astDelete(id);
      else if (action === 'assign') astShowAssign(id);
      else if (action === 'schedule') astShowSchedule(id);
      else if (action === 'detail') astShowDetail(id);
      else if (action === 'return') astReturn(id);
      else if (action === 'complete-mnt') astCompleteMaintenance(id);
    });
  }
}

export function _getAssets() {
  return _assets;
}
export function _getMine() {
  return _mine;
}
export function _getOpenMaintenance() {
  return _openMaintenance;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _resetState() {
  _container = null;
  _tab = 'inventory';
  _assets = [];
  _mine = [];
  _openMaintenance = [];
  _filterType = '';
  _filterStatus = '';
  _loadError = null;
  _featureOff = false;
  _saving = false;
  _editing = null;
}

registerModule('assets', renderAssetsPage);
