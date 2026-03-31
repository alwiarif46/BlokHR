/**
 * sections/custom_tabs.js
 * Custom Tabs — CRUD list, label/URL/icon/enabled/visibility, reorder.
 * API: GET/POST/PUT/DELETE /api/custom-tabs, PUT /api/custom-tabs/reorder
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _tabs = [];
let _container = null;

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="ct-loading">Loading tabs\u2026</div>';

  const data = await api.get('/api/custom-tabs');
  if (!data || data._error) {
    container.innerHTML = '<div class="ct-error">Failed to load tabs</div>';
    return;
  }

  _tabs = data.tabs || [];
  _renderUI();
}

export function destroy() {
  _container = null;
  _tabs = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="ct-wrap">';

  if (_tabs.length === 0) {
    html += '<div class="ct-empty">No custom tabs. Add one below.</div>';
  } else {
    html += '<div class="ct-list" id="ctList">';
    _tabs.forEach(function (t, i) {
      html += '<div class="ct-row" data-ct-id="' + _esc(t.id) + '">';
      html += '<div class="ct-drag-handle" title="Drag to reorder">\u2630</div>';
      html +=
        '<input type="text" class="ct-input ct-label" value="' +
        _esc(t.label) +
        '" placeholder="Label" maxlength="30">';
      html +=
        '<input type="text" class="ct-input ct-src" value="' +
        _esc(t.src || '') +
        '" placeholder="URL">';
      html +=
        '<input type="text" class="ct-input ct-icon" value="' +
        _esc(t.icon || '') +
        '" placeholder="Icon" style="width:60px">';
      html +=
        '<label class="ct-toggle"><input type="checkbox" class="ct-enabled"' +
        (t.enabled ? ' checked' : '') +
        '><span>On</span></label>';
      html += '<button class="ct-btn ct-save" data-ct-id="' + _esc(t.id) + '">Save</button>';
      html +=
        '<button class="ct-btn danger ct-del" data-ct-id="' + _esc(t.id) + '">\u2715</button>';
      if (i > 0) {
        html += '<button class="ct-btn ct-up" data-ct-id="' + _esc(t.id) + '">\u2191</button>';
      }
      if (i < _tabs.length - 1) {
        html += '<button class="ct-btn ct-dn" data-ct-id="' + _esc(t.id) + '">\u2193</button>';
      }
      html += '</div>';
    });
    html += '</div>';
  }

  html += '<div class="ct-add">';
  html += '<div class="ct-add-title">New Tab</div>';
  html +=
    '<input type="text" id="ctNewLabel" class="ct-input" placeholder="Label (max 30)" maxlength="30">';
  html += '<input type="text" id="ctNewSrc" class="ct-input" placeholder="URL or path">';
  html +=
    '<input type="text" id="ctNewIcon" class="ct-input" placeholder="Icon" style="width:80px">';
  html += '<button class="ct-btn" id="ctAddBtn">+ Add Tab</button>';
  html += '</div>';

  html += '</div>';
  _container.innerHTML = html;
  _bindEvents();
}

function _bindEvents() {
  if (!_container) {
    return;
  }

  /* Save */
  _container.querySelectorAll('.ct-save').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.ctId;
      const row = _container.querySelector('[data-ct-id="' + id + '"]');
      if (!row) {
        return;
      }
      const body = {
        label: /** @type {HTMLInputElement} */ (row.querySelector('.ct-label')).value.trim(),
        src: /** @type {HTMLInputElement} */ (row.querySelector('.ct-src')).value.trim(),
        icon: /** @type {HTMLInputElement} */ (row.querySelector('.ct-icon')).value.trim(),
        enabled: /** @type {HTMLInputElement} */ (row.querySelector('.ct-enabled')).checked,
      };
      const res = await api.put('/api/custom-tabs/' + id, body);
      if (res && !res._error) {
        toast('Tab saved', 'success');
        const t = _tabs.find(function (x) {
          return x.id === id;
        });
        if (t) {
          Object.assign(t, body);
        }
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Delete */
  _container.querySelectorAll('.ct-del').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.ctId;
      if (!confirm('Delete this tab?')) {
        return;
      }
      const res = await api.delete('/api/custom-tabs/' + id);
      if (res && !res._error) {
        toast('Tab deleted', 'success');
        _tabs = _tabs.filter(function (t) {
          return t.id !== id;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Reorder up */
  _container.querySelectorAll('.ct-up').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.ctId;
      const idx = _tabs.findIndex(function (t) {
        return t.id === id;
      });
      if (idx <= 0) {
        return;
      }
      const newOrder = _tabs.map(function (t) {
        return t.id;
      });
      const tmp = newOrder[idx - 1];
      newOrder[idx - 1] = newOrder[idx];
      newOrder[idx] = tmp;
      await _reorder(newOrder);
    });
  });

  /* Reorder down */
  _container.querySelectorAll('.ct-dn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.ctId;
      const idx = _tabs.findIndex(function (t) {
        return t.id === id;
      });
      if (idx < 0 || idx >= _tabs.length - 1) {
        return;
      }
      const newOrder = _tabs.map(function (t) {
        return t.id;
      });
      const tmp = newOrder[idx + 1];
      newOrder[idx + 1] = newOrder[idx];
      newOrder[idx] = tmp;
      await _reorder(newOrder);
    });
  });

  /* Add */
  const addBtn = _container.querySelector('#ctAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', async function () {
      const label = /** @type {HTMLInputElement} */ (
        _container.querySelector('#ctNewLabel')
      ).value.trim();
      if (!label) {
        toast('Label is required', 'error');
        return;
      }
      const body = {
        label: label,
        src: /** @type {HTMLInputElement} */ (_container.querySelector('#ctNewSrc')).value.trim(),
        icon: /** @type {HTMLInputElement} */ (_container.querySelector('#ctNewIcon')).value.trim(),
        enabled: true,
      };
      const res = await api.post('/api/custom-tabs', body);
      if (res && !res._error) {
        toast('Tab added', 'success');
        const data = await api.get('/api/custom-tabs');
        if (data && !data._error) {
          _tabs = data.tabs || [];
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  }
}

async function _reorder(tabIds) {
  const res = await api.put('/api/custom-tabs/reorder', { tabIds: tabIds });
  if (res && !res._error) {
    _tabs = tabIds
      .map(function (id) {
        return _tabs.find(function (t) {
          return t.id === id;
        });
      })
      .filter(Boolean);
    _renderUI();
  } else {
    toast((res && res.message) || 'Reorder failed', 'error');
  }
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
