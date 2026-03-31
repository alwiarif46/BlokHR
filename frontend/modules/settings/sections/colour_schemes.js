/**
 * sections/colour_schemes.js
 * Colour Schemes — up to 3 presets, 6 colour pickers each, set-default, delete.
 * API: GET/POST/PUT/DELETE /api/colour-schemes, PUT /api/colour-schemes/:id/set-default
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _schemes = [];
let _container = null;

const COLOUR_FIELDS = [
  { id: 'accent', label: 'Accent' },
  { id: 'status_in', label: 'Status In' },
  { id: 'status_break', label: 'Status Break' },
  { id: 'status_absent', label: 'Status Absent' },
  { id: 'bg0', label: 'Background' },
  { id: 'tx', label: 'Text' },
];

export async function render(container, _cache) {
  _container = container;
  container.innerHTML = '<div class="cs-loading">Loading colour schemes\u2026</div>';

  const data = await api.get('/api/colour-schemes');
  if (!data || data._error) {
    container.innerHTML = '<div class="cs-error">Failed to load colour schemes</div>';
    return;
  }

  _schemes = data.schemes || [];
  _renderUI();
}

export function destroy() {
  _container = null;
  _schemes = [];
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="cs-wrap">';

  _schemes.forEach(function (s) {
    html +=
      '<div class="cs-card' +
      (s.is_default ? ' cs-default' : '') +
      '" data-cs-id="' +
      _esc(s.id) +
      '">';
    html += '<div class="cs-card-hdr">';
    html +=
      '<input type="text" class="cs-name-input" value="' +
      _esc(s.name) +
      '" placeholder="Scheme name">';
    if (s.is_default) {
      html += '<span class="cs-badge-default">Default</span>';
    } else {
      html +=
        '<button class="cs-btn-sm cs-set-default" data-cs-id="' +
        _esc(s.id) +
        '">Set Default</button>';
      html +=
        '<button class="cs-btn-sm danger cs-delete" data-cs-id="' +
        _esc(s.id) +
        '">\u2715</button>';
    }
    html += '</div>';

    /* Colour pickers */
    html += '<div class="cs-pickers">';
    COLOUR_FIELDS.forEach(function (cf) {
      const val = s[cf.id] || '#000000';
      html += '<div class="cs-picker-row">';
      html += '<label>' + cf.label + '</label>';
      html +=
        '<input type="color" class="cs-color-input" data-cf="' +
        cf.id +
        '" value="' +
        _esc(val) +
        '">';
      html += '<span class="cs-hex-val">' + _esc(val) + '</span>';
      html += '</div>';
    });
    html += '</div>';

    /* Preview swatch */
    html +=
      '<div class="cs-swatch" style="background:' +
      _esc(s.bg0 || '#111') +
      ';color:' +
      _esc(s.tx || '#eee') +
      ';border:2px solid ' +
      _esc(s.accent || '#0f0') +
      '">';
    html +=
      '<span style="background:' + _esc(s.status_in || '#3b82f6') + '" class="cs-sw-dot"></span>';
    html +=
      '<span style="background:' +
      _esc(s.status_break || '#fbbf24') +
      '" class="cs-sw-dot"></span>';
    html +=
      '<span style="background:' +
      _esc(s.status_absent || '#ef4444') +
      '" class="cs-sw-dot"></span>';
    html += '<span>' + _esc(s.name) + '</span>';
    html += '</div>';

    html +=
      '<button class="cs-btn cs-save-scheme" data-cs-id="' + _esc(s.id) + '">Save Scheme</button>';
    html += '</div>';
  });

  if (_schemes.length < 3) {
    html += '<div class="cs-add-wrap">';
    html += '<div class="cs-add-title">Add New Scheme</div>';
    html += '<input type="text" id="csNewName" class="cs-name-input" placeholder="Scheme name">';
    COLOUR_FIELDS.forEach(function (cf) {
      html += '<div class="cs-picker-row">';
      html += '<label>' + cf.label + '</label>';
      html += '<input type="color" class="cs-new-color" data-cf="' + cf.id + '" value="#000000">';
      html += '</div>';
    });
    html += '<button class="cs-btn" id="csAddBtn">+ Add Scheme</button>';
    html += '</div>';
  } else {
    html += '<div class="cs-limit-note">Maximum 3 colour schemes. Delete one to add another.</div>';
  }

  html += '</div>';
  _container.innerHTML = html;

  /* Live hex preview on colour input change */
  _container.querySelectorAll('.cs-color-input').forEach(function (inp) {
    inp.addEventListener('input', function () {
      const hex = /** @type {HTMLInputElement} */ (inp).value;
      const hexSpan = inp.nextElementSibling;
      if (hexSpan) {
        hexSpan.textContent = hex;
      }
    });
  });

  _bindEvents();
}

function _bindEvents() {
  if (!_container) {
    return;
  }

  /* Save scheme */
  _container.querySelectorAll('.cs-save-scheme').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.csId;
      const card = _container.querySelector('[data-cs-id="' + id + '"]');
      if (!card) {
        return;
      }
      const body = {
        name: /** @type {HTMLInputElement} */ (card.querySelector('.cs-name-input')).value.trim(),
      };
      card.querySelectorAll('.cs-color-input').forEach(function (inp) {
        body[/** @type {HTMLElement} */ (inp).dataset.cf] = /** @type {HTMLInputElement} */ (
          inp
        ).value;
      });
      const res = await api.put('/api/colour-schemes/' + id, body);
      if (res && !res._error) {
        toast('Colour scheme saved', 'success');
        const s = _schemes.find(function (x) {
          return x.id === id;
        });
        if (s) {
          Object.assign(s, body);
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed to save', 'error');
      }
    });
  });

  /* Set default */
  _container.querySelectorAll('.cs-set-default').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.csId;
      const res = await api.put('/api/colour-schemes/' + id + '/set-default', {});
      if (res && !res._error) {
        toast('Default colour scheme updated', 'success');
        _schemes.forEach(function (s) {
          s.is_default = s.id === id;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Delete */
  _container.querySelectorAll('.cs-delete').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const id = /** @type {HTMLElement} */ (btn).dataset.csId;
      if (!confirm('Delete this colour scheme?')) {
        return;
      }
      const res = await api.delete('/api/colour-schemes/' + id);
      if (res && !res._error) {
        toast('Colour scheme deleted', 'success');
        _schemes = _schemes.filter(function (s) {
          return s.id !== id;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Add new */
  const addBtn = _container.querySelector('#csAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', async function () {
      const name = /** @type {HTMLInputElement} */ (
        _container.querySelector('#csNewName')
      ).value.trim();
      if (!name) {
        toast('Name is required', 'error');
        return;
      }
      const body = { name: name };
      _container.querySelectorAll('.cs-new-color').forEach(function (inp) {
        body[/** @type {HTMLElement} */ (inp).dataset.cf] = /** @type {HTMLInputElement} */ (
          inp
        ).value;
      });
      const res = await api.post('/api/colour-schemes', body);
      if (res && !res._error) {
        toast('Colour scheme added', 'success');
        const data = await api.get('/api/colour-schemes');
        if (data && !data._error) {
          _schemes = data.schemes || [];
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  }
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
