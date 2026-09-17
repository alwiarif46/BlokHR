/**
 * modules/role_access/role_access.js
 * Roles & Access — per-role module visibility matrix (admin).
 */
import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _bundle = null;
let _saving = false;

export function renderRoleAccessPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ra-wrap" id="raWrap">' +
      '<div class="ra-toolbar">' +
        '<div class="ra-title"><span>&#128275;</span> Roles &amp; Access</div>' +
        '<div class="ra-spacer"></div>' +
        '<button type="button" class="ra-btn ghost" data-action="refresh">Refresh</button>' +
      '</div>' +
      '<p class="ra-hint mf">' +
        'Hide modules per role. Defaults are all visible. Toggles only restrict further — ' +
        'they cannot grant access the backend already denies. ' +
        'Modules marked <strong>UI only</strong> hide the sidebar item; the school service still enforces its own role policy.' +
      '</p>' +
      '<div id="raContent" class="ra-content">Loading…</div>' +
    '</div>';
  container.querySelector('[data-action="refresh"]').addEventListener('click', raLoad);
  raLoad();
}

async function raLoad() {
  const el = _container && _container.querySelector('#raContent');
  if (!el) return;
  el.textContent = 'Loading…';
  const data = await api.get('/api/settings/role-access');
  if (!data || data._error) {
    el.textContent = (data && data.message) || 'Failed to load';
    return;
  }
  _bundle = data;
  raRender();
}

function raRender() {
  const el = _container && _container.querySelector('#raContent');
  if (!el || !_bundle) return;
  const roles = _bundle.roles || [];
  const modules = _bundle.modules || [];
  const matrix = _bundle.matrix || {};

  const bySection = {};
  modules.forEach(function (m) {
    if (!bySection[m.section]) bySection[m.section] = [];
    bySection[m.section].push(m);
  });

  let html = '<div class="ra-scroll"><table class="ra-table"><thead><tr><th>Module</th>';
  roles.forEach(function (r) {
    html += '<th>' + esc(r) + '</th>';
  });
  html += '</tr></thead><tbody>';

  Object.keys(bySection).forEach(function (section) {
    html +=
      '<tr class="ra-section"><td colspan="' +
      (roles.length + 1) +
      '">' +
      esc(section) +
      '</td></tr>';
    bySection[section].forEach(function (mod) {
      html += '<tr><td class="ra-mod">';
      html += '<span class="ra-mod-label">' + esc(mod.label) + '</span>';
      if (mod.enforcement === 'ui_only') {
        html += ' <span class="ra-badge" title="Sidebar only — service enforces its own ceiling">UI only</span>';
      }
      html += '</td>';
      roles.forEach(function (role) {
        const ceilings = mod.ceilings || [];
        const available = ceilings.indexOf(role) >= 0;
        const visible = matrix[role] && matrix[role][mod.key] !== false;
        if (!available) {
          html +=
            '<td class="ra-cell ra-na" title="Not available for this role">—</td>';
        } else {
          html +=
            '<td class="ra-cell">' +
            '<label class="ra-toggle">' +
            '<input type="checkbox" data-role="' +
            esc(role) +
            '" data-module="' +
            esc(mod.key) +
            '"' +
            (visible ? ' checked' : '') +
            ' />' +
            '</label></td>';
        }
      });
      html += '</tr>';
    });
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
  el.querySelectorAll('input[type=checkbox]').forEach(function (input) {
    input.addEventListener('change', onToggle);
  });
}

async function onToggle(ev) {
  if (_saving) {
    ev.target.checked = !ev.target.checked;
    return;
  }
  const role = ev.target.getAttribute('data-role');
  const moduleKey = ev.target.getAttribute('data-module');
  const visible = !!ev.target.checked;
  _saving = true;
  const result = await api.put('/api/settings/role-access', {
    overrides: [{ role: role, moduleKey: moduleKey, visible: visible }],
  });
  _saving = false;
  if (!result || result._error) {
    ev.target.checked = !visible;
    toast((result && (result.message || result.error)) || 'Save failed', 'error');
    return;
  }
  _bundle = result;
  toast('Saved', 'success');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

registerModule('role_access', renderRoleAccessPage);
