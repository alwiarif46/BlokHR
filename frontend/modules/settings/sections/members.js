/**
 * sections/members.js
 * Member Management — full CRUD table, promote/demote admin.
 * API: GET /api/settings (members array), POST/PUT/DELETE /api/members
 */

import { api } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';

let _members = [];
let _admins = [];
let _groups = [];
let _search = '';
let _container = null;
let _showForm = false;
let _editMember = null;

export async function render(container, cache) {
  _container = container;
  container.innerHTML = '<div class="mb-loading">Loading members\u2026</div>';

  /* Members come from the settings bundle */
  const data = cache.settings || {};
  _members = data.members || [];
  _admins = data.admins || [];
  _groups = data.groups || [];

  if (_members.length === 0) {
    /* Fall back to a fresh fetch */
    const fresh = await api.get('/api/settings');
    if (fresh && !fresh._error) {
      _members = fresh.members || [];
      _admins = fresh.admins || [];
      _groups = fresh.groups || [];
    }
  }

  _showForm = false;
  _editMember = null;
  _renderUI();
}

export function destroy() {
  _container = null;
  _members = [];
  _admins = [];
  _groups = [];
  _search = '';
  _showForm = false;
  _editMember = null;
}

function _renderUI() {
  if (!_container) {
    return;
  }

  let html = '<div class="mb-wrap">';

  /* Toolbar */
  html += '<div class="mb-toolbar">';
  html +=
    '<input type="text" class="mb-search" id="mbSearch" placeholder="Search members\u2026" value="' +
    _esc(_search) +
    '">';
  html += '<button class="mb-btn" id="mbAddBtn">+ Add Member</button>';
  html += '</div>';

  /* Form */
  if (_showForm) {
    const m = _editMember || {};
    const groupOpts = _groups
      .map(function (g) {
        return (
          '<option value="' +
          _esc(g.id) +
          '"' +
          (m.group === g.id ? ' selected' : '') +
          '>' +
          _esc(g.name) +
          '</option>'
        );
      })
      .join('');
    html += '<div class="mb-form">';
    html += '<div class="mb-form-title">' + (_editMember ? 'Edit Member' : 'Add Member') + '</div>';
    if (!_editMember) {
      html +=
        '<div class="mb-field"><label>Email *</label><input type="email" id="mbFEmail" class="mb-input" placeholder="email@company.com"></div>';
    }
    html +=
      '<div class="mb-field"><label>Name *</label><input type="text" id="mbFName" class="mb-input" value="' +
      _esc(m.name || '') +
      '"></div>';
    html +=
      '<div class="mb-field"><label>Department</label><select id="mbFGroup" class="mb-select"><option value="">— None —</option>' +
      groupOpts +
      '</select></div>';
    html +=
      '<div class="mb-field"><label>Designation</label><input type="text" id="mbFDesg" class="mb-input" value="' +
      _esc(m.designation || '') +
      '"></div>';
    html +=
      '<div class="mb-field"><label>Phone</label><input type="text" id="mbFPhone" class="mb-input" value="' +
      _esc(m.phone || '') +
      '"></div>';
    html +=
      '<div class="mb-field"><label>Joining Date</label><input type="date" id="mbFJoin" class="mb-input" value="' +
      _esc(m.joiningDate || '') +
      '"></div>';
    html += '<div class="mb-form-actions">';
    html += '<button class="mb-btn ghost" id="mbCancelForm">Cancel</button>';
    html +=
      '<button class="mb-btn" id="mbSaveForm">' +
      (_editMember ? 'Save Changes' : 'Create Member') +
      '</button>';
    html += '</div></div>';
  }

  /* Table */
  const filtered = _members.filter(function (m) {
    if (!_search) {
      return true;
    }
    const q = _search.toLowerCase();
    return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q);
  });

  html += '<div class="mb-table-wrap"><table class="mb-table">';
  html +=
    '<thead><tr><th>Name</th><th>Email</th><th>Dept</th><th>Role</th><th>Actions</th></tr></thead><tbody>';

  filtered.forEach(function (m) {
    const isAdmin =
      _admins.includes(m.email) ||
      _admins.some(function (a) {
        return (typeof a === 'object' ? a.email : a) === m.email;
      });
    const group = _groups.find(function (g) {
      return g.id === m.group;
    });
    html += '<tr data-mb-email="' + _esc(m.email) + '">';
    html += '<td>' + _esc(m.name) + '</td>';
    html += '<td>' + _esc(m.email) + '</td>';
    html += '<td>' + _esc(group ? group.name : '') + '</td>';
    html +=
      '<td>' +
      (isAdmin
        ? '<span class="mb-badge-admin">Admin</span>'
        : '<span class="mb-badge-emp">Employee</span>') +
      '</td>';
    html += '<td>';
    html +=
      '<button class="mb-act-btn mb-edit-btn" data-mb-email="' +
      _esc(m.email) +
      '">\u270E Edit</button>';
    if (!isAdmin) {
      html +=
        '<button class="mb-act-btn mb-promote-btn" data-mb-email="' +
        _esc(m.email) +
        '">Promote Admin</button>';
    } else {
      html +=
        '<button class="mb-act-btn mb-demote-btn" data-mb-email="' +
        _esc(m.email) +
        '">Remove Admin</button>';
    }
    html +=
      '<button class="mb-act-btn danger mb-del-btn" data-mb-email="' +
      _esc(m.email) +
      '">\u2715 Remove</button>';
    html += '</td></tr>';
  });

  if (filtered.length === 0) {
    html += '<tr><td colspan="5" class="mb-empty">No members found</td></tr>';
  }

  html += '</tbody></table></div>';
  html += '<div class="mb-count">' + filtered.length + ' of ' + _members.length + ' members</div>';
  html += '</div>';

  _container.innerHTML = html;
  _bindEvents();
}

function _bindEvents() {
  if (!_container) {
    return;
  }

  /* Search */
  const searchEl = _container.querySelector('#mbSearch');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      _search = /** @type {HTMLInputElement} */ (this).value;
      _renderUI();
    });
  }

  /* Add */
  const addBtn = _container.querySelector('#mbAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      _showForm = true;
      _editMember = null;
      _renderUI();
    });
  }

  /* Cancel form */
  const cancelBtn = _container.querySelector('#mbCancelForm');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      _showForm = false;
      _editMember = null;
      _renderUI();
    });
  }

  /* Save form */
  const saveBtn = _container.querySelector('#mbSaveForm');
  if (saveBtn) {
    saveBtn.addEventListener('click', async function () {
      const name = /** @type {HTMLInputElement} */ (
        _container.querySelector('#mbFName')
      ).value.trim();
      if (!name) {
        toast('Name is required', 'error');
        return;
      }

      if (_editMember) {
        const body = {
          name: name,
          groupId:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFGroup')).value ||
            undefined,
          designation:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFDesg')).value.trim() ||
            undefined,
          phone:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFPhone')).value.trim() ||
            undefined,
          joiningDate:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFJoin')).value ||
            undefined,
        };
        const res = await api.put('/api/members/' + _editMember.id, body);
        if (res && !res._error) {
          toast('Member updated', 'success');
          Object.assign(_editMember, body);
          _showForm = false;
          _editMember = null;
          _renderUI();
        } else {
          toast((res && res.message) || 'Failed', 'error');
        }
      } else {
        const email = /** @type {HTMLInputElement} */ (_container.querySelector('#mbFEmail')).value
          .trim()
          .toLowerCase();
        if (!email) {
          toast('Email is required', 'error');
          return;
        }
        const body = {
          email: email,
          name: name,
          groupId:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFGroup')).value ||
            undefined,
          designation:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFDesg')).value.trim() ||
            undefined,
          phone:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFPhone')).value.trim() ||
            undefined,
          joiningDate:
            /** @type {HTMLInputElement} */ (_container.querySelector('#mbFJoin')).value ||
            undefined,
        };
        const res = await api.post('/api/members', body);
        if (res && !res._error) {
          toast('Member created', 'success');
          if (res.member) {
            _members.push(res.member);
          }
          _showForm = false;
          _editMember = null;
          _renderUI();
        } else {
          toast((res && res.message) || 'Failed', 'error');
        }
      }
    });
  }

  /* Edit */
  _container.querySelectorAll('.mb-edit-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const email = /** @type {HTMLElement} */ (btn).dataset.mbEmail;
      _editMember =
        _members.find(function (m) {
          return m.email === email;
        }) || null;
      _showForm = true;
      _renderUI();
    });
  });

  /* Delete */
  _container.querySelectorAll('.mb-del-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const email = /** @type {HTMLElement} */ (btn).dataset.mbEmail;
      const m = _members.find(function (x) {
        return x.email === email;
      });
      if (!m) {
        return;
      }
      if (!confirm('Remove member ' + m.name + '? This is a soft-delete.')) {
        return;
      }
      const res = await api.delete('/api/members/' + m.id);
      if (res && !res._error) {
        toast('Member removed', 'success');
        _members = _members.filter(function (x) {
          return x.email !== email;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Promote */
  _container.querySelectorAll('.mb-promote-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const email = /** @type {HTMLElement} */ (btn).dataset.mbEmail;
      const res = await api.post('/api/settings/admins', { email: email });
      if (res && !res._error) {
        toast(email + ' promoted to admin', 'success');
        if (!_admins.includes(email)) {
          _admins.push(email);
        }
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });

  /* Demote */
  _container.querySelectorAll('.mb-demote-btn').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const email = /** @type {HTMLElement} */ (btn).dataset.mbEmail;
      if (!confirm('Remove admin access for ' + email + '?')) {
        return;
      }
      const res = await api.delete('/api/settings/admins/' + encodeURIComponent(email));
      if (res && !res._error) {
        toast(email + ' admin access removed', 'success');
        _admins = _admins.filter(function (a) {
          return (typeof a === 'object' ? a.email : a) !== email;
        });
        _renderUI();
      } else {
        toast((res && res.message) || 'Failed', 'error');
      }
    });
  });
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
