/**
 * modules/school_library/school_library.js
 *
 * School library: Catalogue | Issue/Return | Holds | Fines.
 * Pattern: render… → libLoadData() → libRender().
 * HTTP only via api.school('school-library') — no browser storage, no raw HTTP.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { openModal, closeModal } from '../../shared/modal.js';
import { registerModule } from '../../shared/router.js';

const VIEWS = ['catalogue', 'circulate', 'holds', 'fines'];

let _container = null;
let _view = 'catalogue';
let _titles = [];
let _copies = [];
let _loans = [];
let _holds = [];
let _fines = [];
let _settings = null;
let _q = '';
let _selectedTitleId = '';
let _busy = false;
let _loadError = '';

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _lib() {
  return api.school('school-library');
}

function _err(res) {
  if (!res || res._error) {
    return (res && (res.error || res.message)) || 'Request failed';
  }
  return null;
}

/** @param {Partial<{view:string,titles:any[],copies:any[],loans:any[],holds:any[],fines:any[],settings:any,q:string,selectedTitleId:string}>} patch */
export function libSetState(patch) {
  if (patch.view != null) _view = patch.view;
  if (patch.titles != null) _titles = patch.titles;
  if (patch.copies != null) _copies = patch.copies;
  if (patch.loans != null) _loans = patch.loans;
  if (patch.holds != null) _holds = patch.holds;
  if (patch.fines != null) _fines = patch.fines;
  if (patch.settings != null) _settings = patch.settings;
  if (patch.q != null) _q = patch.q;
  if (patch.selectedTitleId != null) _selectedTitleId = patch.selectedTitleId;
}

export function libGetState() {
  return {
    view: _view,
    titles: _titles,
    copies: _copies,
    loans: _loans,
    holds: _holds,
    fines: _fines,
    settings: _settings,
    q: _q,
    selectedTitleId: _selectedTitleId,
    loadError: _loadError,
  };
}

/**
 * Client-side ISBN length hint only (server validates check digit).
 * @param {string} raw
 * @returns {string|null} hint message or null if ok/empty
 */
export function isbnLengthHint(raw) {
  const digits = String(raw || '').replace(/[^0-9Xx]/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 13) return null;
  return 'ISBN should be 10 or 13 digits (server validates)';
}

export async function renderSchoolLibraryPage(container) {
  _container = container;
  _view = 'catalogue';
  container.innerHTML =
    '<div class="lib-wrap" id="libWrap">' +
    '<div class="lib-title">Library</div>' +
    '<div class="lib-tabs" id="libTabs"></div>' +
    '<div id="libBody"><div class="lib-empty">Loading…</div></div>' +
    '</div>';

  _bindTabs();
  await libLoadData();
  libRender();
}

function _bindTabs() {
  const tabs = _container.querySelector('#libTabs');
  if (!tabs) return;
  tabs.innerHTML = VIEWS.map(function (v) {
    const label =
      v === 'catalogue'
        ? 'Catalogue'
        : v === 'circulate'
          ? 'Issue / Return'
          : v === 'holds'
            ? 'Holds'
            : 'Fines';
    return (
      '<button type="button" class="lib-tab' +
      (_view === v ? ' active' : '') +
      '" data-view="' +
      v +
      '">' +
      label +
      '</button>'
    );
  }).join('');

  tabs.querySelectorAll('.lib-tab').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      _view = btn.getAttribute('data-view') || 'catalogue';
      tabs.querySelectorAll('.lib-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab === btn);
      });
      await libLoadData();
      libRender();
    });
  });
}

export async function libLoadData() {
  const client = _lib();
  _loadError = '';
  if (_view === 'catalogue') {
    const [titlesRes, settingsRes] = await Promise.all([
      client.get('/titles' + (_q ? '?q=' + encodeURIComponent(_q) : '')),
      client.get('/settings'),
    ]);
    if (_err(titlesRes)) _loadError = _err(titlesRes);
    else _titles = (titlesRes && titlesRes.titles) || [];
    if (!_err(settingsRes)) _settings = settingsRes;
    if (_selectedTitleId) {
      const copiesRes = await client.get(
        '/copies?title_id=' + encodeURIComponent(_selectedTitleId),
      );
      if (!_err(copiesRes)) _copies = (copiesRes && copiesRes.copies) || [];
      else _copies = [];
    } else {
      _copies = [];
    }
  } else if (_view === 'circulate') {
    const [loansRes, settingsRes] = await Promise.all([
      client.get('/loans?status=open'),
      client.get('/settings'),
    ]);
    if (_err(loansRes)) _loadError = _err(loansRes);
    else _loans = (loansRes && loansRes.loans) || [];
    if (!_err(settingsRes)) _settings = settingsRes;
  } else if (_view === 'holds') {
    const holdsRes = await client.get('/holds');
    if (_err(holdsRes)) _loadError = _err(holdsRes);
    else _holds = (holdsRes && holdsRes.holds) || [];
  } else {
    const [finesRes, settingsRes] = await Promise.all([
      client.get('/fines?status=open'),
      client.get('/settings'),
    ]);
    if (_err(finesRes)) _loadError = _err(finesRes);
    else _fines = (finesRes && finesRes.fines) || [];
    if (!_err(settingsRes)) _settings = settingsRes;
  }
}

export function libRender() {
  if (!_container) return;
  const body = _container.querySelector('#libBody');
  if (!body) return;
  if (_loadError) {
    body.innerHTML =
      '<div class="lib-service-error" role="alert">' +
      '<div class="lib-service-error-title">Library service unavailable</div>' +
      '<p>We could not load library data. Your current entries have not been changed.</p>' +
      '<button type="button" class="lib-btn primary" id="libRetry">Retry</button>' +
      '</div>';
  } else if (_view === 'catalogue') body.innerHTML = _htmlCatalogue();
  else if (_view === 'circulate') body.innerHTML = _htmlCirculate();
  else if (_view === 'holds') body.innerHTML = _htmlHolds();
  else body.innerHTML = _htmlFines();
  _bindBody();
}

function _htmlCatalogue() {
  const rows = _titles
    .map(function (t) {
      const sel = t.id === _selectedTitleId ? ' style="background:var(--bg2)"' : '';
      return (
        '<tr data-title-id="' +
        _esc(t.id) +
        '"' +
        sel +
        '>' +
        '<td>' +
        _esc(t.title) +
        '</td>' +
        '<td>' +
        _esc((t.authors || []).join(', ')) +
        '</td>' +
        '<td class="lib-sub">' +
        _esc(t.isbn13 || '—') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  const copyRows = _copies
    .map(function (c) {
      return (
        '<tr>' +
        '<td>' +
        _esc(c.barcode) +
        '</td>' +
        '<td><span class="lib-chip ' +
        _esc(c.status) +
        '">' +
        _esc(c.status) +
        '</span></td>' +
        '<td>' +
        _esc(c.condition) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="lib-toolbar">' +
    '<input class="lib-input" id="libSearch" placeholder="Search titles / ISBN" value="' +
    _esc(_q) +
    '" />' +
    '<button type="button" class="lib-btn" id="libSearchBtn">Search</button>' +
    '<button type="button" class="lib-btn primary" id="libNewTitle">New title</button>' +
    '</div>' +
    '<p class="lib-hint">ISBN field accepts 10 or 13 digits; check digit is validated by the server.</p>' +
    (_titles.length
      ? '<table class="lib-table"><thead><tr><th>Title</th><th>Authors</th><th>ISBN-13</th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<div class="lib-empty">No titles yet</div>') +
    (_selectedTitleId
      ? '<div class="lib-panel" style="margin-top:14px">' +
        '<h3>Copies</h3>' +
        '<div class="lib-toolbar">' +
        '<input class="lib-input" id="libBarcode" placeholder="Barcode" />' +
        '<button type="button" class="lib-btn primary" id="libAddCopy">Add copy</button>' +
        '</div>' +
        (_copies.length
          ? '<table class="lib-table"><thead><tr><th>Barcode</th><th>Status</th><th>Condition</th></tr></thead><tbody>' +
            copyRows +
            '</tbody></table>'
          : '<div class="lib-empty">No copies</div>') +
        '</div>'
      : '')
  );
}

function _htmlCirculate() {
  const dueHint = _settings
    ? 'Loan period: ' + _settings.loanDays + ' days (due date set on issue).'
    : '';
  const rows = _loans
    .map(function (l) {
      return (
        '<tr>' +
        '<td class="lib-sub">' +
        _esc(l.studentRef) +
        '</td>' +
        '<td class="lib-sub">' +
        _esc(l.copyId) +
        '</td>' +
        '<td>' +
        _esc(l.dueOn) +
        '</td>' +
        '<td class="lib-row-actions">' +
        '<button type="button" class="lib-btn" data-return="' +
        _esc(l.id) +
        '">Return</button>' +
        '<button type="button" class="lib-btn" data-renew="' +
        _esc(l.id) +
        '">Renew</button>' +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="lib-panel">' +
    '<h3>Issue</h3>' +
    '<p class="lib-hint">' +
    _esc(dueHint) +
    '</p>' +
    '<div class="lib-grid">' +
    '<div class="lib-field"><label>Barcode</label><input class="lib-input" id="libIssueBarcode" /></div>' +
    '<div class="lib-field"><label>Student ref</label><input class="lib-input" id="libIssueStudent" placeholder="Paste student id" /></div>' +
    '</div>' +
    '<button type="button" class="lib-btn primary" id="libIssueBtn">Issue</button>' +
    '</div>' +
    '<h3 style="font-size:12px;color:var(--tx);margin:0 0 8px">Open loans</h3>' +
    (_loans.length
      ? '<table class="lib-table"><thead><tr><th>Student</th><th>Copy</th><th>Due</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<div class="lib-empty">No open loans</div>')
  );
}

function _htmlHolds() {
  const rows = _holds
    .map(function (h) {
      return (
        '<tr>' +
        '<td class="lib-sub">' +
        _esc(h.titleId) +
        '</td>' +
        '<td class="lib-sub">' +
        _esc(h.studentRef) +
        '</td>' +
        '<td>' +
        h.position +
        '</td>' +
        '<td><span class="lib-chip">' +
        _esc(h.status) +
        '</span></td>' +
        '<td class="lib-row-actions">' +
        (h.status === 'queued' || h.status === 'ready'
          ? '<button type="button" class="lib-btn" data-cancel-hold="' +
            _esc(h.id) +
            '">Cancel</button>'
          : '') +
        (h.status === 'ready'
          ? '<button type="button" class="lib-btn primary" data-fulfill-hold="' +
            _esc(h.id) +
            '" data-copy="' +
            _esc(h.readyCopyId || '') +
            '">Fulfill</button>'
          : '') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="lib-panel">' +
    '<h3>Place hold</h3>' +
    '<div class="lib-grid">' +
    '<div class="lib-field"><label>Title id</label><input class="lib-input" id="libHoldTitle" /></div>' +
    '<div class="lib-field"><label>Student ref</label><input class="lib-input" id="libHoldStudent" /></div>' +
    '</div>' +
    '<button type="button" class="lib-btn primary" id="libHoldBtn">Place hold</button>' +
    '</div>' +
    (_holds.length
      ? '<table class="lib-table"><thead><tr><th>Title</th><th>Student</th><th>#</th><th>Status</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<div class="lib-empty">No holds</div>')
  );
}

function _htmlFines() {
  const s = _settings || {};
  const rows = _fines
    .map(function (f) {
      return (
        '<tr>' +
        '<td class="lib-sub">' +
        _esc(f.studentRef) +
        '</td>' +
        '<td>' +
        f.daysOverdue +
        'd</td>' +
        '<td>' +
        f.amountPaise +
        ' paise</td>' +
        '<td class="lib-row-actions">' +
        '<button type="button" class="lib-btn primary" data-pay-fine="' +
        _esc(f.id) +
        '">Pay</button>' +
        '<button type="button" class="lib-btn" data-waive-fine="' +
        _esc(f.id) +
        '">Waive</button>' +
        '</td>' +
        '</tr>'
      );
    })
    .join('');

  return (
    '<div class="lib-panel">' +
    '<h3>Settings</h3>' +
    '<div class="lib-grid">' +
    '<div class="lib-field"><label>Loan days</label><input class="lib-input" id="libLoanDays" type="number" value="' +
    _esc(s.loanDays != null ? s.loanDays : 14) +
    '" /></div>' +
    '<div class="lib-field"><label>Renew limit</label><input class="lib-input" id="libRenewLimit" type="number" value="' +
    _esc(s.renewLimit != null ? s.renewLimit : 1) +
    '" /></div>' +
    '<div class="lib-field"><label>Max open loans</label><input class="lib-input" id="libMaxLoans" type="number" value="' +
    _esc(s.maxOpenLoans != null ? s.maxOpenLoans : 3) +
    '" /></div>' +
    '<div class="lib-field"><label>Fine / day (paise)</label><input class="lib-input" id="libFineDay" type="number" value="' +
    _esc(s.finePaisePerDay != null ? s.finePaisePerDay : 500) +
    '" /></div>' +
    '<div class="lib-field"><label>Fine cap (paise)</label><input class="lib-input" id="libFineCap" type="number" value="' +
    _esc(s.fineCapPaise != null ? s.fineCapPaise : 20000) +
    '" /></div>' +
    '<div class="lib-field"><label>Grace days</label><input class="lib-input" id="libGrace" type="number" value="' +
    _esc(s.graceDays != null ? s.graceDays : 0) +
    '" /></div>' +
    '</div>' +
    '<button type="button" class="lib-btn primary" id="libSaveSettings">Save settings</button>' +
    '</div>' +
    '<div class="lib-toolbar">' +
    '<button type="button" class="lib-btn" id="libAssess">Assess overdue fines</button>' +
    '</div>' +
    (_fines.length
      ? '<table class="lib-table"><thead><tr><th>Student</th><th>Days</th><th>Amount</th><th></th></tr></thead><tbody>' +
        rows +
        '</tbody></table>'
      : '<div class="lib-empty">No open fines</div>')
  );
}

function _bindBody() {
  const root = _container.querySelector('#libBody');
  if (!root) return;

  const retry = root.querySelector('#libRetry');
  if (retry) {
    retry.addEventListener('click', async function () {
      retry.disabled = true;
      retry.textContent = 'Retrying…';
      await libLoadData();
      libRender();
    });
    return;
  }

  const searchBtn = root.querySelector('#libSearchBtn');
  if (searchBtn) {
    searchBtn.addEventListener('click', async function () {
      const inp = root.querySelector('#libSearch');
      _q = (inp && inp.value) || '';
      await libLoadData();
      libRender();
    });
  }

  root.querySelectorAll('[data-title-id]').forEach(function (tr) {
    tr.addEventListener('click', async function () {
      _selectedTitleId = tr.getAttribute('data-title-id') || '';
      await libLoadData();
      libRender();
    });
  });

  const newTitle = root.querySelector('#libNewTitle');
  if (newTitle) newTitle.addEventListener('click', _openTitleModal);

  const addCopy = root.querySelector('#libAddCopy');
  if (addCopy) {
    addCopy.addEventListener('click', async function () {
      if (_busy || !_selectedTitleId) return;
      const barcode = ((root.querySelector('#libBarcode') || {}).value || '').trim();
      if (!barcode) {
        toast('Barcode required', 'error');
        return;
      }
      _busy = true;
      const res = await _lib().post('/copies', {
        title_id: _selectedTitleId,
        barcode: barcode,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Copy added', 'success');
        await libLoadData();
        libRender();
      }
    });
  }

  const issueBtn = root.querySelector('#libIssueBtn');
  if (issueBtn) {
    issueBtn.addEventListener('click', async function () {
      if (_busy) return;
      const barcode = ((root.querySelector('#libIssueBarcode') || {}).value || '').trim();
      const student = ((root.querySelector('#libIssueStudent') || {}).value || '').trim();
      if (!barcode || !student) {
        toast('Barcode and student ref required', 'error');
        return;
      }
      _busy = true;
      const res = await _lib().post('/loans', {
        barcode: barcode,
        student_ref: student,
      });
      _busy = false;
      if (_err(res)) {
        if (res && res.error === 'fines_outstanding') {
          toast(
            'Fines outstanding (' +
              (res.open_fines_paise || 0) +
              ' paise) — pay or waive first',
            'error',
          );
        } else if (res && res.error === 'hold_pending') {
          toast('Hold pending on this title', 'error');
        } else {
          toast(_err(res), 'error');
        }
        return;
      }
      toast('Issued — due ' + (res.dueOn || ''), 'success');
      await libLoadData();
      libRender();
    });
  }

  root.querySelectorAll('[data-return]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const res = await _lib().post('/loans/' + btn.getAttribute('data-return') + '/return', {});
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Returned', 'success');
        await libLoadData();
        libRender();
      }
    });
  });

  root.querySelectorAll('[data-renew]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const res = await _lib().post('/loans/' + btn.getAttribute('data-renew') + '/renew', {});
      _busy = false;
      if (_err(res)) {
        if (res && res.error === 'hold_pending') toast('Hold pending', 'error');
        else if (res && res.error === 'overdue_cannot_renew')
          toast('Overdue — cannot renew', 'error');
        else toast(_err(res), 'error');
        return;
      }
      toast('Renewed — due ' + (res.dueOn || ''), 'success');
      await libLoadData();
      libRender();
    });
  });

  const holdBtn = root.querySelector('#libHoldBtn');
  if (holdBtn) {
    holdBtn.addEventListener('click', async function () {
      if (_busy) return;
      const titleId = ((root.querySelector('#libHoldTitle') || {}).value || '').trim();
      const student = ((root.querySelector('#libHoldStudent') || {}).value || '').trim();
      _busy = true;
      const res = await _lib().post('/holds', {
        title_id: titleId,
        student_ref: student,
      });
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Hold placed', 'success');
        await libLoadData();
        libRender();
      }
    });
  }

  root.querySelectorAll('[data-cancel-hold]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const res = await _lib().post(
        '/holds/' + btn.getAttribute('data-cancel-hold') + '/cancel',
        {},
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Hold cancelled', 'success');
        await libLoadData();
        libRender();
      }
    });
  });

  root.querySelectorAll('[data-fulfill-hold]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const copyId = btn.getAttribute('data-copy') || '';
      const res = await _lib().post(
        '/holds/' + btn.getAttribute('data-fulfill-hold') + '/fulfill',
        copyId ? { copy_id: copyId } : {},
      );
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Hold fulfilled', 'success');
        await libLoadData();
        libRender();
      }
    });
  });

  const saveSettings = root.querySelector('#libSaveSettings');
  if (saveSettings) {
    saveSettings.addEventListener('click', async function () {
      if (_busy) return;
      const body = {
        loan_days: Number((root.querySelector('#libLoanDays') || {}).value),
        renew_limit: Number((root.querySelector('#libRenewLimit') || {}).value),
        max_open_loans: Number((root.querySelector('#libMaxLoans') || {}).value),
        hold_days: (_settings && _settings.holdDays) || 3,
        fine_paise_per_day: Number((root.querySelector('#libFineDay') || {}).value),
        fine_cap_paise: Number((root.querySelector('#libFineCap') || {}).value),
        grace_days: Number((root.querySelector('#libGrace') || {}).value),
      };
      _busy = true;
      const res = await _lib().put('/settings', body);
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        _settings = res;
        toast('Settings saved', 'success');
        libRender();
      }
    });
  }

  const assess = root.querySelector('#libAssess');
  if (assess) {
    assess.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const res = await _lib().post('/fines/assess', {});
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Assessed ' + (res.assessed || 0) + ' fine(s)', 'success');
        await libLoadData();
        libRender();
      }
    });
  }

  root.querySelectorAll('[data-pay-fine]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (_busy) return;
      _busy = true;
      const res = await _lib().post('/fines/' + btn.getAttribute('data-pay-fine') + '/pay', {});
      _busy = false;
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Fine paid', 'success');
        await libLoadData();
        libRender();
      }
    });
  });

  root.querySelectorAll('[data-waive-fine]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _promptWaive(btn.getAttribute('data-waive-fine'));
    });
  });
}

function _openTitleModal() {
  openModal(
    '<div class="lib-grid">' +
      '<div class="lib-field"><label>Title</label><input class="lib-input" id="libModalTitle" style="width:100%" /></div>' +
      '<div class="lib-field"><label>Authors (comma-separated)</label><input class="lib-input" id="libModalAuthors" style="width:100%" /></div>' +
      '<div class="lib-field"><label>ISBN</label><input class="lib-input" id="libModalIsbn" style="width:100%" /><p class="lib-hint" id="libIsbnHint"></p></div>' +
      '</div>' +
      '<button type="button" class="lib-btn primary" id="libModalSave">Create</button>',
    { title: 'New title', width: '420px' },
  );
  const isbn = document.getElementById('libModalIsbn');
  const hint = document.getElementById('libIsbnHint');
  if (isbn && hint) {
    isbn.addEventListener('input', function () {
      const msg = isbnLengthHint(isbn.value);
      hint.textContent = msg || '';
    });
  }
  const save = document.getElementById('libModalSave');
  if (save) {
    save.addEventListener('click', async function () {
      const title = ((document.getElementById('libModalTitle') || {}).value || '').trim();
      const authorsRaw = ((document.getElementById('libModalAuthors') || {}).value || '').trim();
      const isbnVal = ((document.getElementById('libModalIsbn') || {}).value || '').trim();
      if (!title) {
        toast('Title required', 'error');
        return;
      }
      const body = {
        title: title,
        authors: authorsRaw
          ? authorsRaw.split(',').map(function (a) {
              return a.trim();
            }).filter(Boolean)
          : [],
      };
      if (isbnVal) body.isbn13 = isbnVal;
      const res = await _lib().post('/titles', body);
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Title created', 'success');
        closeModal();
        await libLoadData();
        libRender();
      }
    });
  }
}

function _promptWaive(fineId) {
  openModal(
    '<div class="lib-field"><label>Reason (min 3 chars)</label>' +
      '<input class="lib-input" id="libWaiveReason" style="width:100%" /></div>' +
      '<button type="button" class="lib-btn primary" id="libWaiveConfirm">Waive</button>',
    { title: 'Waive fine', width: '360px' },
  );
  const btn = document.getElementById('libWaiveConfirm');
  if (btn) {
    btn.addEventListener('click', async function () {
      const reason = ((document.getElementById('libWaiveReason') || {}).value || '').trim();
      if (reason.length < 3) {
        toast('Reason required', 'error');
        return;
      }
      const res = await _lib().post('/fines/' + fineId + '/waive', { reason: reason });
      if (_err(res)) toast(_err(res), 'error');
      else {
        toast('Fine waived', 'success');
        closeModal();
        await libLoadData();
        libRender();
      }
    });
  }
}

registerModule('school_library', renderSchoolLibraryPage);
