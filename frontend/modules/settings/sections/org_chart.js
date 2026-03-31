/**
 * modules/org_chart/org_chart.js
 * Org chart: department tree, positions, reporting structure.
 * Pattern: renderOrgChartPage() → ocLoadData() → ocRenderStats()
 *          → ocRender() → CRUD → ocCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _departments = [];
let _positions = [];
let _members = [];
let _tab = 'chart';   // 'chart' | 'departments' | 'positions'
let _search = '';

const _mockDepts = [
  { id: 'd1', name: 'Engineering',  parent_id: null,  head_email: 'arif@co.com',  head_name: 'Arif Alwi',    headcount: 18, color: '#4a9eff' },
  { id: 'd2', name: 'Product',      parent_id: null,  head_email: 'sarah@co.com', head_name: 'Sarah Chen',   headcount: 6,  color: '#f5a623' },
  { id: 'd3', name: 'Design',       parent_id: 'd2',  head_email: 'bob@co.com',   head_name: 'Bob Builder',  headcount: 5,  color: '#22c55e' },
  { id: 'd4', name: 'Operations',   parent_id: null,  head_email: 'admin@co.com', head_name: 'Admin',        headcount: 8,  color: '#a855f7' },
  { id: 'd5', name: 'Sales',        parent_id: null,  head_email: 'omar@co.com',  head_name: 'Omar Hassan',  headcount: 10, color: '#ef4444' },
  { id: 'd6', name: 'Frontend',     parent_id: 'd1',  head_email: 'arif@co.com',  head_name: 'Arif Alwi',   headcount: 8,  color: '#4a9eff' },
  { id: 'd7', name: 'Backend',      parent_id: 'd1',  head_email: null,            head_name: null,           headcount: 10, color: '#4a9eff' },
];

const _mockPositions = [
  { id: 'p1', title: 'Software Engineer',          dept_id: 'd1', dept_name: 'Engineering', level: 'L3', count: 8 },
  { id: 'p2', title: 'Senior Software Engineer',   dept_id: 'd1', dept_name: 'Engineering', level: 'L4', count: 5 },
  { id: 'p3', title: 'Engineering Manager',        dept_id: 'd1', dept_name: 'Engineering', level: 'L6', count: 1 },
  { id: 'p4', title: 'Product Manager',            dept_id: 'd2', dept_name: 'Product',     level: 'L5', count: 3 },
  { id: 'p5', title: 'UX Designer',                dept_id: 'd3', dept_name: 'Design',      level: 'L3', count: 3 },
  { id: 'p6', title: 'Sales Executive',            dept_id: 'd5', dept_name: 'Sales',       level: 'L2', count: 7 },
];

export function renderOrgChartPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="oc-wrap">' +
      '<div class="oc-toolbar">' +
        '<div class="oc-tabs" id="ocTabs">' +
          '<button class="oc-tab active" data-tab="chart">Chart</button>' +
          '<button class="oc-tab" data-tab="departments">Departments</button>' +
          '<button class="oc-tab" data-tab="positions">Positions</button>' +
        '</div>' +
        '<input class="oc-search" id="ocSearch" placeholder="Search…" autocomplete="off">' +
        (isAdmin
          ? '<button class="oc-btn" id="ocAddDeptBtn">+ Department</button>' +
            '<button class="oc-btn" id="ocAddPosBtn">+ Position</button>'
          : '') +
      '</div>' +
      '<div id="ocStats" class="oc-stats"></div>' +
      '<div id="ocContent"></div>' +
      '<div class="oc-modal" id="ocModal"><div class="oc-modal-box" id="ocModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  ocLoadData();
}

export async function ocLoadData() {
  const [deptData, posData] = await Promise.all([
    api.get('/api/org/departments'),
    api.get('/api/org/positions'),
  ]);
  _departments = (deptData && !deptData._error) ? (deptData.departments || deptData || []) : _mockDepts;
  if (!Array.isArray(_departments)) _departments = _mockDepts;
  _positions = (posData && !posData._error) ? (posData.positions || posData || []) : _mockPositions;
  if (!Array.isArray(_positions)) _positions = _mockPositions;
  ocRenderStats();
  ocRender();
}

export function ocRenderStats() {
  const el = _container && _container.querySelector('#ocStats');
  if (!el) return;
  const totalHeadcount = _departments.reduce((s, d) => s + (d.headcount || 0), 0);
  const rootDepts = _departments.filter(d => !d.parent_id).length;
  el.innerHTML =
    _sc(_departments.length, 'Departments', 'var(--accent)') +
    _sc(_positions.length,   'Positions',   'var(--status-in)') +
    _sc(rootDepts,           'Top-level',   'var(--status-break)') +
    _sc(totalHeadcount,      'Headcount',   'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="oc-stat"><div class="oc-stat-n" style="color:' + c + '">' + n + '</div><div class="oc-stat-l">' + l + '</div></div>';
}

export function ocRender() {
  if (_tab === 'departments') _renderDepts();
  else if (_tab === 'positions') _renderPositions();
  else _renderChart();
}

function _renderChart() {
  const el = _container && _container.querySelector('#ocContent');
  if (!el) return;
  const roots = _departments.filter(d => !d.parent_id && (!_search || d.name.toLowerCase().includes(_search)));
  if (!roots.length) { el.innerHTML = '<div class="oc-empty"><div style="font-size:2rem">&#129489;</div><div>No departments found</div></div>'; return; }

  function buildTree(depts, parentId, depth) {
    const children = depts.filter(d => d.parent_id === parentId);
    if (!children.length) return '';
    let html = '<div class="oc-tree-level" style="margin-left:' + (depth * 24) + 'px">';
    children.forEach(d => {
      const color = d.color || 'var(--accent)';
      html +=
        '<div class="oc-tree-node">' +
          '<div class="oc-tree-card" style="border-left:3px solid ' + color + '">' +
            '<div class="oc-tree-dept">' + _esc(d.name) + '</div>' +
            (d.head_name ? '<div class="oc-tree-head">' + _esc(d.head_name) + '</div>' : '<div class="oc-tree-head empty">No head</div>') +
            '<div class="oc-tree-hc">' + (d.headcount || 0) + ' members</div>' +
          '</div>' +
          buildTree(depts, d.id, depth + 1) +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  let html = '<div class="oc-chart">';
  roots.forEach(d => {
    const color = d.color || 'var(--accent)';
    html +=
      '<div class="oc-root-node">' +
        '<div class="oc-root-card" style="border-top:3px solid ' + color + '">' +
          '<div class="oc-root-name">' + _esc(d.name) + '</div>' +
          (d.head_name ? '<div class="oc-root-head">' + _esc(d.head_name) + '</div>' : '') +
          '<div class="oc-root-hc">' + (d.headcount || 0) + ' members</div>' +
        '</div>' +
        buildTree(_departments, d.id, 1) +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderDepts() {
  const el = _container && _container.querySelector('#ocContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _departments.filter(d => !_search || d.name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="oc-empty">No departments found</div>'; return; }
  let html = '<div class="oc-dept-list">';
  items.forEach(function (d, i) {
    const parent = d.parent_id ? _departments.find(x => x.id === d.parent_id) : null;
    html +=
      '<div class="oc-dept-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="oc-dept-dot" style="background:' + (d.color || 'var(--accent)') + '"></div>' +
        '<div class="oc-dept-info">' +
          '<div class="oc-dept-name">' + _esc(d.name) + (parent ? ' <span class="oc-parent">↑ ' + _esc(parent.name) + '</span>' : '') + '</div>' +
          '<div class="oc-dept-meta">' + (d.headcount || 0) + ' members' + (d.head_name ? ' &middot; Head: ' + _esc(d.head_name) : '') + '</div>' +
        '</div>' +
        (isAdmin
          ? '<div class="oc-dept-actions">' +
              '<button data-action="edit-dept" data-id="' + _esc(d.id) + '" class="oc-btn-sm">Edit</button>' +
              '<button data-action="delete-dept" data-id="' + _esc(d.id) + '" class="oc-btn-sm danger">Delete</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderPositions() {
  const el = _container && _container.querySelector('#ocContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _positions.filter(p => !_search || (p.title + ' ' + p.dept_name).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="oc-empty">No positions found</div>'; return; }
  let html = '<div class="oc-pos-list">';
  items.forEach(function (p, i) {
    html +=
      '<div class="oc-pos-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="oc-pos-info">' +
          '<div class="oc-pos-title">' + _esc(p.title) + '</div>' +
          '<div class="oc-pos-meta">' + _esc(p.dept_name || '') + ' &middot; Level: ' + _esc(p.level || '—') + ' &middot; ' + (p.count || 0) + ' people</div>' +
        '</div>' +
        (isAdmin
          ? '<div class="oc-pos-actions">' +
              '<button data-action="edit-pos" data-id="' + _esc(p.id) + '" class="oc-btn-sm">Edit</button>' +
              '<button data-action="delete-pos" data-id="' + _esc(p.id) + '" class="oc-btn-sm danger">Delete</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function ocShowDeptForm(dept) {
  const isEdit = !!dept;
  const d = dept || {};
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  const parentOpts = _departments.filter(x => x.id !== d.id).map(x =>
    '<option value="' + _esc(x.id) + '"' + (d.parent_id === x.id ? ' selected' : '') + '>' + _esc(x.name) + '</option>'
  ).join('');
  box.innerHTML =
    '<div class="oc-modal-title">' + (isEdit ? 'Edit' : 'New') + ' Department</div>' +
    '<div class="oc-field"><label>Name *</label><input type="text" id="ocFDName" value="' + _esc(d.name || '') + '"></div>' +
    '<div class="oc-field"><label>Parent Department</label><select id="ocFDParent"><option value="">None (top-level)</option>' + parentOpts + '</select></div>' +
    '<div class="oc-field"><label>Head (email)</label><input type="text" id="ocFDHead" value="' + _esc(d.head_email || '') + '" placeholder="head@company.com"></div>' +
    '<div class="oc-field"><label>Color</label><input type="color" id="ocFDColor" value="' + (d.color || '#4a9eff') + '"></div>' +
    '<div class="oc-form-actions"><button class="oc-btn ghost" data-action="close-modal">Cancel</button><button class="oc-btn" id="ocSaveDeptBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  _container.querySelector('#ocModal').classList.add('open');
  box.querySelector('#ocSaveDeptBtn').addEventListener('click', () => _saveDept(dept, isEdit));
}

async function _saveDept(dept, isEdit) {
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  const name = (box.querySelector('#ocFDName').value || '').trim();
  if (!name) { toast('Department name is required', 'error'); return; }
  const body = { name, parent_id: box.querySelector('#ocFDParent').value || null, head_email: (box.querySelector('#ocFDHead').value || '').trim() || null, color: box.querySelector('#ocFDColor').value };
  const result = isEdit ? await api.put('/api/org/departments/' + dept.id, body) : await api.post('/api/org/departments', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); ocCloseModal(); ocLoadData(); return; }
  if (isEdit) { const i = _departments.findIndex(x => x.id === dept.id); if (i >= 0) Object.assign(_departments[i], body); }
  else _departments.push({ id: 'd' + Date.now(), headcount: 0, ...body });
  toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
  ocCloseModal(); ocRenderStats(); ocRender();
}

export function ocShowPositionForm(pos) {
  const isEdit = !!pos;
  const p = pos || {};
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  const deptOpts = _departments.map(d => '<option value="' + _esc(d.id) + '"' + (p.dept_id === d.id ? ' selected' : '') + '>' + _esc(d.name) + '</option>').join('');
  box.innerHTML =
    '<div class="oc-modal-title">' + (isEdit ? 'Edit' : 'New') + ' Position</div>' +
    '<div class="oc-field"><label>Title *</label><input type="text" id="ocFPTitle" value="' + _esc(p.title || '') + '" placeholder="e.g. Senior Software Engineer"></div>' +
    '<div class="oc-field"><label>Department</label><select id="ocFPDept"><option value="">—</option>' + deptOpts + '</select></div>' +
    '<div class="oc-field"><label>Level</label><input type="text" id="ocFPLevel" value="' + _esc(p.level || '') + '" placeholder="e.g. L4"></div>' +
    '<div class="oc-form-actions"><button class="oc-btn ghost" data-action="close-modal">Cancel</button><button class="oc-btn" id="ocSavePosBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  _container.querySelector('#ocModal').classList.add('open');
  box.querySelector('#ocSavePosBtn').addEventListener('click', () => _savePos(pos, isEdit));
}

async function _savePos(pos, isEdit) {
  const box = _container && _container.querySelector('#ocModalBox');
  if (!box) return;
  const title = (box.querySelector('#ocFPTitle').value || '').trim();
  if (!title) { toast('Position title is required', 'error'); return; }
  const deptId = box.querySelector('#ocFPDept').value;
  const dept = _departments.find(d => d.id === deptId);
  const body = { title, dept_id: deptId || null, dept_name: dept ? dept.name : '', level: (box.querySelector('#ocFPLevel').value || '').trim() };
  const result = isEdit ? await api.put('/api/org/positions/' + pos.id, body) : await api.post('/api/org/positions', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); ocCloseModal(); ocLoadData(); return; }
  if (isEdit) { const i = _positions.findIndex(x => x.id === pos.id); if (i >= 0) Object.assign(_positions[i], body); }
  else _positions.push({ id: 'p' + Date.now(), count: 0, ...body });
  toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success');
  ocCloseModal(); ocRenderStats(); ocRender();
}

export async function ocDeleteDept(id) {
  if (!confirm('Delete this department?')) return;
  const result = await api.delete('/api/org/departments/' + id);
  if (result && !result._error) { toast('Deleted', 'success'); ocLoadData(); return; }
  _departments = _departments.filter(d => d.id !== id);
  toast('Deleted (demo)', 'success'); ocRenderStats(); ocRender();
}

export async function ocDeletePosition(id) {
  if (!confirm('Delete this position?')) return;
  const result = await api.delete('/api/org/positions/' + id);
  if (result && !result._error) { toast('Deleted', 'success'); ocLoadData(); return; }
  _positions = _positions.filter(p => p.id !== id);
  toast('Deleted (demo)', 'success'); ocRenderStats(); ocRender();
}

export function ocCloseModal() {
  const m = _container && _container.querySelector('#ocModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#ocTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.oc-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.oc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    ocRender();
  });
  const s = container.querySelector('#ocSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); ocRender(); });
  const addDept = container.querySelector('#ocAddDeptBtn');
  if (addDept) addDept.addEventListener('click', () => ocShowDeptForm(null));
  const addPos = container.querySelector('#ocAddPosBtn');
  if (addPos) addPos.addEventListener('click', () => ocShowPositionForm(null));
  const modal = container.querySelector('#ocModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) ocCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal')  ocCloseModal();
    else if (action === 'edit-dept')   { const d = _departments.find(x => x.id === id); if (d) ocShowDeptForm(d); }
    else if (action === 'delete-dept') ocDeleteDept(id);
    else if (action === 'edit-pos')    { const p = _positions.find(x => x.id === id); if (p) ocShowPositionForm(p); }
    else if (action === 'delete-pos')  ocDeletePosition(id);
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getDepartments() { return _departments; }
export function _setDepartments(list) { _departments = list; }
export function _getPositions() { return _positions; }
export function _setPositions(list) { _positions = list; }
export function _resetState() { _container = null; _departments = []; _positions = []; _tab = 'chart'; _search = ''; }

registerModule('org_chart', renderOrgChartPage);
