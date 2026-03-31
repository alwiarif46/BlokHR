/**
 * modules/feature_flags/feature_flags.js
 * Feature flag management: 18 toggleable features, admin-only.
 * Pattern: renderFeatureFlagsPage() → ffLoadData() → ffRenderStats()
 *          → ffRender() → ffToggle → (no modal)
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _flags = [];
let _search = '';
let _filterStatus = '';

const _categories = {
  'attendance':       'Core',
  'leaves':           'Core',
  'regularizations':  'Core',
  'timesheets':       'Core',
  'overtime':         'Time',
  'time_tracking':    'Time',
  'leave_policies':   'Time',
  'expenses':         'Finance',
  'assets':           'Operations',
  'documents':        'Operations',
  'training':         'Operations',
  'workflows':        'Operations',
  'surveys':          'Engagement',
  'visitors':         'Engagement',
  'org_chart':        'People',
  'analytics':        'Insights',
  'geo_fencing':      'Security',
  'face_recognition': 'Security',
  'iris_scan':        'Security',
  'ai_chatbot':       'AI',
  'webhooks':         'Integrations',
};

const _mock = [
  { key: 'overtime',         label: 'Overtime',              enabled: true,  description: 'Overtime request submission and approval' },
  { key: 'time_tracking',    label: 'Time Tracking',         enabled: true,  description: 'Granular project-level time tracking' },
  { key: 'expenses',         label: 'Expenses',              enabled: true,  description: 'Expense submission and reimbursement' },
  { key: 'assets',           label: 'Asset Management',      enabled: true,  description: 'Company asset assignment and tracking' },
  { key: 'documents',        label: 'Documents',             enabled: true,  description: 'Document upload, templates, generation' },
  { key: 'training',         label: 'Training & LMS',        enabled: true,  description: 'Course management and enrolment' },
  { key: 'workflows',        label: 'Workflows',             enabled: true,  description: 'Custom workflow builder and instances' },
  { key: 'surveys',          label: 'Surveys',               enabled: true,  description: 'Employee pulse and satisfaction surveys' },
  { key: 'visitors',         label: 'Visitor Management',    enabled: true,  description: 'Visitor pre-registration and check-in' },
  { key: 'org_chart',        label: 'Org Chart',             enabled: true,  description: 'Company hierarchy and reporting structure' },
  { key: 'analytics',        label: 'Analytics',             enabled: true,  description: 'Attendance and HR analytics dashboards' },
  { key: 'geo_fencing',      label: 'Geo Fencing',           enabled: false, description: 'Location-based clock-in enforcement' },
  { key: 'face_recognition', label: 'Face Recognition',      enabled: false, description: 'Face-ID clock-in and verification' },
  { key: 'iris_scan',        label: 'Iris Scan',             enabled: false, description: 'Iris-based biometric authentication' },
  { key: 'ai_chatbot',       label: 'AI Chatbot',            enabled: true,  description: '87-tool AI assistant for employees and admins' },
  { key: 'webhooks',         label: 'Webhooks',              enabled: true,  description: 'Outbound event-driven webhook integrations' },
  { key: 'leave_policies',   label: 'Leave Policy Config',   enabled: true,  description: 'Admin leave type and accrual configuration' },
  { key: 'timesheets',       label: 'Timesheets',            enabled: true,  description: 'Weekly timesheet submission and approval' },
];

export function renderFeatureFlagsPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  if (!isAdmin) {
    container.innerHTML = '<div class="ff-no-access"><div style="font-size:3rem">&#128274;</div><div>Admin access required to manage feature flags.</div></div>';
    return;
  }
  container.innerHTML =
    '<div class="ff-wrap">' +
      '<div class="ff-toolbar">' +
        '<div class="ff-title">&#127988; Feature Flags</div>' +
        '<input class="ff-search" id="ffSearch" placeholder="Search features…" autocomplete="off">' +
        '<select class="ff-select" id="ffStatusFilter">' +
          '<option value="">All</option>' +
          '<option value="enabled">Enabled</option>' +
          '<option value="disabled">Disabled</option>' +
        '</select>' +
      '</div>' +
      '<div id="ffStats" class="ff-stats"></div>' +
      '<div id="ffContent"></div>' +
    '</div>';
  _bindEvents(container);
  ffLoadData();
}

export async function ffLoadData() {
  const d = await api.get('/api/features');
  _flags = (d && !d._error) ? (d.flags || d || []) : _mock;
  if (!Array.isArray(_flags)) _flags = _mock;
  ffRenderStats();
  ffRender();
}

export function ffRenderStats() {
  const el = _container && _container.querySelector('#ffStats');
  if (!el) return;
  const enabled  = _flags.filter(f => f.enabled).length;
  const disabled = _flags.filter(f => !f.enabled).length;
  el.innerHTML =
    _sc(_flags.length, 'Total',    'var(--accent)') +
    _sc(enabled,       'Enabled',  'var(--status-in)') +
    _sc(disabled,      'Disabled', 'var(--tx3)');
}

function _sc(n, l, c) {
  return '<div class="ff-stat"><div class="ff-stat-n" style="color:' + c + '">' + n + '</div><div class="ff-stat-l">' + l + '</div></div>';
}

export function ffRender() {
  const el = _container && _container.querySelector('#ffContent');
  if (!el) return;
  let items = _flags;
  if (_filterStatus === 'enabled')  items = items.filter(f => f.enabled);
  if (_filterStatus === 'disabled') items = items.filter(f => !f.enabled);
  if (_search) items = items.filter(f => (f.label + ' ' + f.key + ' ' + (f.description || '')).toLowerCase().includes(_search));

  if (!items.length) {
    el.innerHTML = '<div class="ff-empty"><div style="font-size:2rem">&#127988;</div><div>No flags found</div></div>';
    return;
  }

  // Group by category
  const groups = {};
  items.forEach(f => {
    const cat = _categories[f.key] || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  });

  let html = '<div class="ff-groups">';
  Object.keys(groups).sort().forEach(cat => {
    html += '<div class="ff-group"><div class="ff-group-title">' + _esc(cat) + '</div><div class="ff-group-items">';
    groups[cat].forEach(function (f) {
      html +=
        '<div class="ff-row' + (f.enabled ? '' : ' ff-off') + '">' +
          '<div class="ff-row-info">' +
            '<div class="ff-row-label">' + _esc(f.label) + '</div>' +
            '<div class="ff-row-desc">' + _esc(f.description || '') + '</div>' +
            '<div class="ff-row-key"><code>' + _esc(f.key) + '</code></div>' +
          '</div>' +
          '<label class="ff-toggle">' +
            '<input type="checkbox" data-action="toggle" data-key="' + _esc(f.key) + '"' + (f.enabled ? ' checked' : '') + '>' +
            '<span class="ff-slider"></span>' +
          '</label>' +
        '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export async function ffToggle(key) {
  const flag = _flags.find(f => f.key === key);
  if (!flag) return;
  const newEnabled = !flag.enabled;
  const result = await api.put('/api/features/' + key, { enabled: newEnabled });
  if (result && !result._error) {
    toast((newEnabled ? 'Enabled' : 'Disabled') + ': ' + (flag.label || key), 'success');
    ffLoadData();
    return;
  }
  flag.enabled = newEnabled;
  toast((newEnabled ? 'Enabled' : 'Disabled') + ': ' + (flag.label || key) + ' (demo)', 'success');
  ffRenderStats();
  ffRender();
}

function _bindEvents(container) {
  const s = container.querySelector('#ffSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); ffRender(); });
  const sf = container.querySelector('#ffStatusFilter');
  if (sf) sf.addEventListener('change', function () { _filterStatus = this.value; ffRender(); });
  container.addEventListener('change', function (e) {
    const cb = e.target.closest('input[data-action="toggle"]');
    if (!cb) return;
    ffToggle(cb.dataset.key);
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getFlags() { return _flags; }
export function _setFlags(list) { _flags = list; }
export function _resetState() { _container = null; _flags = []; _search = ''; _filterStatus = ''; }

registerModule('feature_flags', renderFeatureFlagsPage);
