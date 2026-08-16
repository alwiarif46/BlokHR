/**
 * modules/org_chart/org_chart.js
 * Org Chart — positions CRUD against /api/org/positions (+ tree for display).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _data = [];
let _saving = false;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function renderOrgChartPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="oc-wrap" id="ocWrap">' +
      '<div class="oc-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#127963;</span> Org Chart</div>' +
        '<div class="oc-spacer"></div>' +
        '<button type="button" class="oc-btn" id="ocAddBtn">+ Add</button>' +
      '</div>' +
      '<div class="oc-hint">Positions in your org hierarchy. Title is required; head/notes are stored on the position description.</div>' +
      '<div class="oc-stats" id="ocStats"></div>' +
      '<div id="ocContent"></div>' +
      '<div class="oc-modal" id="ocModal"><div class="oc-modal-box" id="ocModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ocLoadData();
}

export async function ocLoadData() {
  const d = await api.get('/api/org/tree');
  if (d && !d._error && Array.isArray(d.tree)) {
    _data = d.tree;
  } else {
    const p = await api.get('/api/org/positions');
    _data = p && !p._error ? p.positions || [] : [];
    if (!Array.isArray(_data)) _data = [];
  }
  ocRenderStats();
  ocRender();
}

export function ocRenderStats() {
  const el = _container && _container.querySelector('#ocStats');
  if (!el) return;
  const positions = _data.length;
  const filled = _data.reduce(function (n, item) {
    return n + (item.holder_count || 0);
  }, 0);
  const vacant = _data.filter(function (item) {
    return (item.holder_count || 0) < (item.max_headcount || 1);
  }).length;
  el.innerHTML =
    '<div class="oc-stats">' +
      '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--accent)">' +
      positions +
      '</div><div class="oc-stat-label">Positions</div></div>' +
      '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--status-in)">' +
      filled +
      '</div><div class="oc-stat-label">Filled seats</div></div>' +
      '<div class="oc-stat"><div class="oc-stat-num" style="color:var(--status-break)">' +
      vacant +
      '</div><div class="oc-stat-label">Open slots</div></div>' +
    '</div>';
}

function _parentTitle(parentId) {
  if (!parentId) return '';
  const p = _data.find(function (x) {
    return x.id === parentId;
  });
  return p ? p.title || p.name || '' : '';
}

export function ocRender() {
  const el = _container && _container.querySelector('#ocContent');
  if (!el) return;
  if (!_data.length) {
    el.innerHTML =
      '<div class="oc-empty"><div class="oc-empty-icon">&#127963;</div><div class="oc-empty-text">No positions yet — add one to start the org chart</div></div>';
    return;
  }
  let html = '<div class="oc-grid">';
  _data.forEach(function (item, i) {
    const title = item.title || item.name || 'Position';
    const head = item.description || item.head || '';
    const holders = item.holder_names || '';
    const parent = _parentTitle(item.parent_position_id);
    html +=
      '<div class="oc-card" style="animation-delay:' +
      i * 0.04 +
      's" data-id="' +
      _esc(item.id || i) +
      '">';
    html += '<div class="oc-card-title">' + _esc(title) + '</div>';
    html +=
      '<div class="oc-card-sub">' +
      (parent ? 'Reports under: ' + _esc(parent) + ' · ' : '') +
      (head ? _esc(head) : 'No notes') +
      (holders ? ' · ' + _esc(holders) : '') +
      '</div>';
    if (item.holder_count != null) {
      html +=
        '<span class="oc-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
        _esc(String(item.holder_count) + '/' + String(item.max_headcount || 1)) +
        '</span>';
    }
    html += '<div class="oc-card-actions">';
    html += '<button type="button" data-action="edit" data-idx="' + i + '">Edit</button>';
    html +=
      '<button type="button" class="danger" data-action="delete" data-idx="' + i + '">Delete</button>';
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _parentOptions(excludeId) {
  let html = '<option value="">— None (top level) —</option>';
  _data.forEach(function (p) {
    if (excludeId && p.id === excludeId) return;
    html +=
      '<option value="' +
      _esc(p.id) +
      '">' +
      _esc(p.title || p.name || p.id) +
      '</option>';
  });
  return html;
}

export function ocShowForm(item) {
  const isEdit = !!item;
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="oc-modal-title">' +
    (isEdit ? 'Edit position' : 'Add position') +
    '</div>' +
    '<div class="oc-field"><label>Position / department title *</label>' +
    '<input type="text" id="ocF_name" value="' +
    _esc((item && (item.title || item.name)) || '') +
    '"></div>' +
    '<div class="oc-field"><label>Head / notes</label>' +
    '<input type="text" id="ocF_head" value="' +
    _esc((item && item.description) || (item && item.head) || '') +
    '" placeholder="e.g. Head of HR"></div>' +
    '<div class="oc-field"><label>Parent position</label>' +
    '<select id="ocF_parent">' +
    _parentOptions(item && item.id) +
    '</select></div>' +
    '<div class="oc-form-actions">' +
    '<button type="button" class="oc-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="oc-btn" id="ocSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#ocModal');
  if (modal) modal.classList.add('open');

  const parentSel = box.querySelector('#ocF_parent');
  if (parentSel && item && item.parent_position_id) {
    parentSel.value = item.parent_position_id;
  }

  box.querySelector('#ocSaveBtn').addEventListener('click', function () {
    ocSave(item);
  });
}

export async function ocSave(item) {
  if (_saving) return;
  const nameEl = _container.querySelector('#ocF_name');
  const headEl = _container.querySelector('#ocF_head');
  const parentEl = _container.querySelector('#ocF_parent');
  const title = nameEl ? nameEl.value.trim() : '';
  const description = headEl ? headEl.value.trim() : '';
  const parentPositionId = parentEl && parentEl.value ? parentEl.value : null;

  if (!title) {
    toast('Title is required', 'error');
    return;
  }

  _saving = true;
  const btn = _container.querySelector('#ocSaveBtn');
  if (btn) btn.disabled = true;

  try {
    let result;
    if (item && item.id) {
      result = await api.put('/api/org/positions/' + item.id, {
        title: title,
        description: description,
        parentPositionId: parentPositionId,
      });
    } else {
      result = await api.post('/api/org/positions', {
        title: title,
        description: description,
        parentPositionId: parentPositionId,
        level: parentPositionId ? 1 : 0,
      });
    }

    if (result && !result._error) {
      toast(item ? 'Updated' : 'Created', 'success');
      ocCloseModal();
      await ocLoadData();
      return;
    }
    toast((result && (result.message || result.error)) || 'Failed to save', 'error');
  } finally {
    _saving = false;
    if (btn) btn.disabled = false;
  }
}

export async function ocDelete(idx) {
  if (!confirm('Delete this position?')) return;
  const item = _data[idx];
  if (!item || !item.id) return;
  const result = await api.delete('/api/org/positions/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    ocLoadData();
    return;
  }
  toast((result && (result.message || result.error)) || 'Failed', 'error');
}

export function ocCloseModal() {
  const modal = _container && _container.querySelector('#ocModal');
  if (modal) modal.classList.remove('open');
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#ocAddBtn');
  if (addBtn) addBtn.addEventListener('click', function () { ocShowForm(null); });
  const modal = container.querySelector('#ocModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) ocCloseModal();
    });
  }
  const content = container.querySelector('#ocContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.idx, 10);
      if (action === 'edit') ocShowForm(_data[idx]);
      else if (action === 'delete') ocDelete(idx);
    });
  }
  container.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="close-modal"]')) ocCloseModal();
  });
}

export function _getData() { return _data; }
export function _setData(d) { _data = d; }
export function _resetState() { _container = null; _data = []; _saving = false; }

registerModule('org_chart', renderOrgChartPage);
