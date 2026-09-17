/**
 * modules/school_students/school_students.js
 *
 * School student roster: searchable paginated list, create/edit, enrolment,
 * guardian link panel (max 4), consent transitions.
 *
 * Pattern: renderSchoolStudentsPage() → ssLoadData() → ssRenderStats()
 *          → ssRender() → CRUD / panels → ssCloseModal()
 */

import { api, getSchoolTenantId } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { navigateToModule, registerModule } from '../../shared/router.js';

const PAGE_SIZE = 25;
const STATUSES = ['enquiry', 'admitted', 'active', 'transferred', 'alumni', 'withdrawn'];
const GENDERS = ['male', 'female', 'other'];
const CATEGORIES = ['GEN', 'EWS', 'OBC', 'SC', 'ST', 'OTHER_STATE'];
const CONSENT_KINDS = ['apaar', 'dpdp_processing', 'biometric', 'photo', 'transport_gps'];
const STRICT_GRANT_KINDS = new Set(['apaar', 'biometric', 'dpdp_processing']);
const VERIFICATION_METHODS = ['existing_records', 'id_details', 'virtual_token', 'digilocker'];
const ALLOWED_TRANSITIONS = {
  not_sought: ['granted', 'refused'],
  granted: ['withdrawn'],
  refused: ['granted'],
  withdrawn: [],
};
const CLASS_PROBE = [
  'Nursery',
  'LKG',
  'UKG',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AADHAAR_LAST4 = /^\d{4}$/;

let _container = null;
let _items = [];
let _total = 0;
let _activeCount = 0;
let _classCounts = [];
let _consentSummary = null;
let _offset = 0;
let _q = '';
let _status = '';
let _classLabel = '';
let _section = '';
let _sessions = [];
let _allGuardians = [];
let _detailStudent = null;
let _detailGuardians = [];
let _detailConsents = [];
let _modalMode = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _identity() {
  return api.school('school-identity');
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'staff';
}

function _opts(list, selected, blank) {
  let html = blank != null ? '<option value="">' + _esc(blank) + '</option>' : '';
  list.forEach(function (v) {
    html +=
      '<option value="' +
      _esc(v) +
      '"' +
      (selected === v ? ' selected' : '') +
      '>' +
      _esc(v) +
      '</option>';
  });
  return html;
}

/**
 * Client-side student field validation mirroring school-identity rules.
 * @param {Record<string, string>} fields
 * @param {{ requireAdmission?: boolean }} [opts]
 * @returns {string|null} error message or null
 */
export function validateStudentFields(fields, opts) {
  const requireAdmission = !opts || opts.requireAdmission !== false;
  const firstName = (fields.first_name || '').trim();
  const lastName = (fields.last_name || '').trim();
  if (!firstName || !lastName) return 'first_name and last_name are required';

  const admissionNumber = (fields.admission_number || '').trim();
  if (requireAdmission && !admissionNumber) return 'admission_number is required';

  const dob = (fields.dob || '').trim();
  const admissionDate = (fields.admission_date || '').trim();
  if (!ISO_DATE.test(dob) || !ISO_DATE.test(admissionDate)) {
    return 'dob and admission_date must be ISO dates (YYYY-MM-DD)';
  }

  const age = _ageYearsAt(dob, admissionDate);
  if (age === null || age < 2 || age > 25) {
    return 'age at admission must be between 2 and 25';
  }

  if (!GENDERS.includes(fields.gender)) return 'invalid gender';
  if (!STATUSES.includes(fields.status)) return 'invalid status';
  if (!CATEGORIES.includes(fields.category)) return 'invalid category';

  if (
    !(fields.mother_name || '').trim() ||
    !(fields.father_name || '').trim() ||
    !(fields.guardian_contact || '').trim()
  ) {
    return 'mother_name, father_name, and guardian_contact are required';
  }

  const last4 = (fields.aadhaar_last4 || '').trim();
  if (last4 && !AADHAAR_LAST4.test(last4)) {
    return 'aadhaar_last4 must be exactly 4 digits';
  }
  if (/\d{12}/.test(String(fields.aadhaar_last4 || '').replace(/\s+/g, ''))) {
    return 'full Aadhaar is never stored — use last 4 digits only';
  }

  return null;
}

/**
 * Allowed consent transitions from a state.
 * @param {string} from
 * @returns {string[]}
 */
export function allowedConsentTransitions(from) {
  return (ALLOWED_TRANSITIONS[from] || []).slice();
}

function _ageYearsAt(dob, onDate) {
  const d = dob.split('-').map(Number);
  const o = onDate.split('-').map(Number);
  if (d.length !== 3 || o.length !== 3) return null;
  let age = o[0] - d[0];
  if (o[1] < d[1] || (o[1] === d[1] && o[2] < d[2])) age -= 1;
  return age;
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolStudentsPage(container) {
  _container = container;
  _offset = 0;
  _q = '';
  _status = '';
  _classLabel = '';
  _section = '';
  _detailStudent = null;

  container.innerHTML =
    '<div class="ss-wrap" id="ssWrap">' +
    '<div class="ss-toolbar" id="ssToolbar">' +
    '<div class="ss-title">Students</div>' +
    '<input class="ss-search" id="ssSearch" placeholder="Search name or admission…" autocomplete="off">' +
    '<select class="ss-select" id="ssStatusFilter">' +
    _opts(STATUSES, '', 'All statuses') +
    '</select>' +
    '<select class="ss-select" id="ssClassFilter">' +
    _opts(CLASS_PROBE, '', 'All classes') +
    '</select>' +
    '<input class="ss-search" id="ssSectionFilter" placeholder="Section" style="min-width:90px">' +
    '<div class="ss-spacer"></div>' +
    '<button type="button" class="ss-btn ghost" id="ssImportGoBtn" title="Open School Settings → Roster">Import…</button>' +
    '<button type="button" class="ss-btn ghost" id="ssNewBtn" title="Open School Settings → Roster">+ Student</button>' +
    '</div>' +
    '<div class="ss-stats" id="ssStats"></div>' +
    '<div class="ss-list" id="ssList"></div>' +
    '<div class="ss-pager" id="ssPager"></div>' +
    '<div class="ss-modal" id="ssModal"><div class="ss-modal-box" id="ssModalBox"></div></div>' +
    '</div>';

  _bindEvents(container);
  ssLoadData();
}

function _bindEvents(container) {
  const search = container.querySelector('#ssSearch');
  let t = null;
  if (search) {
    search.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        _q = (search.value || '').trim();
        _offset = 0;
        ssLoadData();
      }, 280);
    });
  }

  const statusEl = container.querySelector('#ssStatusFilter');
  if (statusEl) {
    statusEl.addEventListener('change', function () {
      _status = statusEl.value || '';
      _offset = 0;
      ssLoadData();
    });
  }

  const classEl = container.querySelector('#ssClassFilter');
  if (classEl) {
    classEl.addEventListener('change', function () {
      _classLabel = classEl.value || '';
      _offset = 0;
      ssLoadData();
    });
  }

  const sectionEl = container.querySelector('#ssSectionFilter');
  if (sectionEl) {
    sectionEl.addEventListener('change', function () {
      _section = (sectionEl.value || '').trim();
      _offset = 0;
      ssLoadData();
    });
    sectionEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        _section = (sectionEl.value || '').trim();
        _offset = 0;
        ssLoadData();
      }
    });
  }

  const newBtn = container.querySelector('#ssNewBtn');
  if (newBtn) {
    newBtn.addEventListener('click', function () {
      try {
        sessionStorage.setItem('scs_open_tab', 'roster');
        sessionStorage.setItem('scs_open_entity', 'students');
        sessionStorage.setItem('scs_open_mode', 'manual');
      } catch (_) {
        /* ignore */
      }
      navigateToModule('school_settings');
    });
  }

  const importGo = container.querySelector('#ssImportGoBtn');
  if (importGo) {
    importGo.addEventListener('click', function () {
      try {
        sessionStorage.setItem('scs_open_tab', 'roster');
        sessionStorage.setItem('scs_open_mode', 'excel');
      } catch (_) {
        /* ignore */
      }
      navigateToModule('school_settings');
    });
  }

  const modal = container.querySelector('#ssModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) ssCloseModal();
    });
  }
}

/**
 * Load roster + stats from school-identity.
 */
export async function ssLoadData() {
  const listEl = _container && _container.querySelector('#ssList');
  if (listEl && !_items.length) {
    listEl.innerHTML = '<div class="ss-loading">Loading students…</div>';
  }

  const id = _identity();
  const qs = new URLSearchParams();
  qs.set('limit', String(PAGE_SIZE));
  qs.set('offset', String(_offset));
  if (_q) qs.set('q', _q);
  if (_status) qs.set('status', _status);
  if (_classLabel) qs.set('class', _classLabel);
  if (_section) qs.set('section', _section);

  const [listRes, activeRes, consentRes, sessionsRes] = await Promise.all([
    id.get('/students?' + qs.toString()),
    id.get('/students?status=active&limit=1&offset=0'),
    id.get('/consents/summary'),
    id.get('/sessions'),
  ]);

  if (listRes && listRes._error) {
    toast(listRes.message || 'Could not load students', 'error');
    _items = [];
    _total = 0;
  } else {
    _items = (listRes && listRes.items) || [];
    _total = (listRes && listRes.total) || 0;
    if (!Array.isArray(_items)) _items = [];
  }

  _activeCount =
    activeRes && !activeRes._error ? Number(activeRes.total) || 0 : 0;

  _consentSummary =
    consentRes && !consentRes._error
      ? consentRes.summary || consentRes
      : null;

  _sessions =
    sessionsRes && !sessionsRes._error
      ? sessionsRes.sessions || []
      : [];

  await _refreshClassCounts(id);

  ssRenderStats();
  ssRender();
}

async function _refreshClassCounts(id) {
  const labels = CLASS_PROBE.slice();
  if (_classLabel && labels.indexOf(_classLabel) < 0) labels.push(_classLabel);

  const results = await Promise.all(
    labels.map(function (label) {
      return id
        .get('/students?class=' + encodeURIComponent(label) + '&limit=1&offset=0')
        .then(function (res) {
          if (!res || res._error) return null;
          const n = Number(res.total) || 0;
          return n > 0 ? { classLabel: label, count: n } : null;
        });
    }),
  );
  _classCounts = results.filter(Boolean);
}

/**
 * Stats bar: total, active, by-class, consent summary.
 */
export function ssRenderStats() {
  const el = _container && _container.querySelector('#ssStats');
  if (!el) return;

  let html =
    '<div class="ss-pill">Total <strong id="ssStatTotal">' +
    _esc(String(_total)) +
    '</strong></div>' +
    '<div class="ss-pill">Active <strong id="ssStatActive">' +
    _esc(String(_activeCount)) +
    '</strong></div>';

  _classCounts.forEach(function (c) {
    html +=
      '<div class="ss-pill ss-pill-class" data-class="' +
      _esc(c.classLabel) +
      '">Class ' +
      _esc(c.classLabel) +
      ' <strong>' +
      _esc(String(c.count)) +
      '</strong></div>';
  });

  html += '<div class="ss-pill ss-consent-sum" id="ssConsentSummary">';
  if (_consentSummary) {
    CONSENT_KINDS.forEach(function (kind) {
      const row = _consentSummary[kind] || {};
      const g = row.granted || 0;
      const r = row.refused || 0;
      const ns = row.not_sought || 0;
      html +=
        '<span class="ss-chip" title="' +
        _esc(kind) +
        '">' +
        _esc(kind) +
        ': ' +
        g +
        'g/' +
        r +
        'r/' +
        ns +
        'ns</span>';
    });
  } else {
    html += '<span class="ss-chip">Consent summary unavailable</span>';
  }
  html += '</div>';

  el.innerHTML = html;
}

/**
 * Render student table + pager.
 */
export function ssRender() {
  const list = _container && _container.querySelector('#ssList');
  const pager = _container && _container.querySelector('#ssPager');
  if (!list) return;

  if (!_items.length) {
    list.innerHTML = '<div class="ss-empty">No students match these filters.</div>';
  } else {
    let rows = '';
    _items.forEach(function (s) {
      rows +=
        '<tr data-student-id="' +
        _esc(s.id) +
        '">' +
        '<td class="ss-name">' +
        _esc(s.firstName + ' ' + s.lastName) +
        '</td>' +
        '<td>' +
        _esc(s.admissionNumber) +
        '</td>' +
        '<td><span class="ss-badge ' +
        _esc(s.status) +
        '">' +
        _esc(s.status) +
        '</span></td>' +
        '<td>' +
        _esc(s.dob) +
        '</td>' +
        '<td>' +
        _esc(s.category) +
        '</td>' +
        '</tr>';
    });
    list.innerHTML =
      '<table class="ss-table"><thead><tr>' +
      '<th>Name</th><th>Admission</th><th>Status</th><th>DOB</th><th>Category</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table>';

    list.querySelectorAll('tr[data-student-id]').forEach(function (tr) {
      tr.addEventListener('click', function () {
        ssOpenDetail(tr.getAttribute('data-student-id'));
      });
    });
  }

  if (pager) {
    const from = _total === 0 ? 0 : _offset + 1;
    const to = Math.min(_offset + PAGE_SIZE, _total);
    pager.innerHTML =
      '<button type="button" class="ss-btn ghost" id="ssPrev"' +
      (_offset <= 0 ? ' disabled' : '') +
      '>Prev</button>' +
      '<span id="ssPageLabel">' +
      from +
      '\u2013' +
      to +
      ' of ' +
      _total +
      '</span>' +
      '<button type="button" class="ss-btn ghost" id="ssNext"' +
      (_offset + PAGE_SIZE >= _total ? ' disabled' : '') +
      '>Next</button>';

    const prev = pager.querySelector('#ssPrev');
    const next = pager.querySelector('#ssNext');
    if (prev) {
      prev.addEventListener('click', function () {
        _offset = Math.max(0, _offset - PAGE_SIZE);
        ssLoadData();
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        _offset = _offset + PAGE_SIZE;
        ssLoadData();
      });
    }
  }
}

/**
 * Close module modal.
 */
export function ssCloseModal() {
  const modal = _container && _container.querySelector('#ssModal');
  if (modal) modal.classList.remove('open');
  _modalMode = null;
}

function _openModal(html, mode) {
  const box = _container && _container.querySelector('#ssModalBox');
  const modal = _container && _container.querySelector('#ssModal');
  if (!box || !modal) return;
  _modalMode = mode || null;
  box.innerHTML = html;
  modal.classList.add('open');
}

function _readStudentForm(box, isEdit) {
  return {
    admission_number: isEdit
      ? undefined
      : (box.querySelector('#ssAdm') && box.querySelector('#ssAdm').value) || '',
    first_name: (box.querySelector('#ssFirst') && box.querySelector('#ssFirst').value) || '',
    last_name: (box.querySelector('#ssLast') && box.querySelector('#ssLast').value) || '',
    dob: (box.querySelector('#ssDob') && box.querySelector('#ssDob').value) || '',
    gender: (box.querySelector('#ssGender') && box.querySelector('#ssGender').value) || '',
    admission_date:
      (box.querySelector('#ssAdmDate') && box.querySelector('#ssAdmDate').value) || '',
    status: (box.querySelector('#ssStatus') && box.querySelector('#ssStatus').value) || '',
    category: (box.querySelector('#ssCategory') && box.querySelector('#ssCategory').value) || '',
    mother_name: (box.querySelector('#ssMother') && box.querySelector('#ssMother').value) || '',
    father_name: (box.querySelector('#ssFather') && box.querySelector('#ssFather').value) || '',
    guardian_contact:
      (box.querySelector('#ssContact') && box.querySelector('#ssContact').value) || '',
    aadhaar_last4:
      (box.querySelector('#ssAadhaar4') && box.querySelector('#ssAadhaar4').value) || '',
  };
}

/**
 * Create / edit student modal.
 * @param {object|null} student
 */
export function ssOpenStudentForm(student) {
  const isEdit = !!student;
  const s = student || {};
  _openModal(
    '<div class="ss-modal-title">' +
      (isEdit ? 'Edit student' : 'New student') +
      '</div>' +
      '<div class="ss-err" id="ssFormErr" hidden></div>' +
      '<div class="ss-grid">' +
      (isEdit
        ? '<div class="ss-field"><label>Admission</label><input disabled value="' +
          _esc(s.admissionNumber || '') +
          '"></div>'
        : '<div class="ss-field"><label>Admission number *</label><input id="ssAdm" value=""></div>') +
      '<div class="ss-field"><label>Status *</label><select id="ssStatus">' +
      _opts(STATUSES, s.status || 'enquiry') +
      '</select></div>' +
      '<div class="ss-field"><label>First name *</label><input id="ssFirst" value="' +
      _esc(s.firstName || '') +
      '"></div>' +
      '<div class="ss-field"><label>Last name *</label><input id="ssLast" value="' +
      _esc(s.lastName || '') +
      '"></div>' +
      '<div class="ss-field"><label>Date of birth *</label><input type="date" id="ssDob" value="' +
      _esc(s.dob || '') +
      '"></div>' +
      '<div class="ss-field"><label>Admission date *</label><input type="date" id="ssAdmDate" value="' +
      _esc(s.admissionDate || '') +
      '"></div>' +
      '<div class="ss-field"><label>Gender *</label><select id="ssGender">' +
      _opts(GENDERS, s.gender || '') +
      '</select></div>' +
      '<div class="ss-field"><label>Category *</label><select id="ssCategory">' +
      _opts(CATEGORIES, s.category || 'GEN') +
      '</select></div>' +
      '<div class="ss-field"><label>Mother name *</label><input id="ssMother" value="' +
      _esc(s.motherName || '') +
      '"></div>' +
      '<div class="ss-field"><label>Father name *</label><input id="ssFather" value="' +
      _esc(s.fatherName || '') +
      '"></div>' +
      '<div class="ss-field full"><label>Guardian contact *</label><input id="ssContact" value="' +
      _esc(s.guardianContact || '') +
      '"></div>' +
      '<div class="ss-field full"><label>Aadhaar last 4</label><input id="ssAadhaar4" maxlength="4" inputmode="numeric" pattern="\\d{4}" value="' +
      _esc(s.aadhaarLast4 || '') +
      '"><div class="ss-help">Full Aadhaar is never stored — enter last 4 digits only.</div></div>' +
      '</div>' +
      '<div class="ss-form-actions">' +
      '<button type="button" class="ss-btn ghost" id="ssCancel">Cancel</button>' +
      '<button type="button" class="ss-btn" id="ssSave">' +
      (isEdit ? 'Save' : 'Create') +
      '</button>' +
      '</div>',
    isEdit ? 'edit' : 'create',
  );

  const box = _container.querySelector('#ssModalBox');
  box.querySelector('#ssCancel').addEventListener('click', ssCloseModal);
  box.querySelector('#ssSave').addEventListener('click', async function () {
    const fields = _readStudentForm(box, isEdit);
    const err = validateStudentFields(fields, { requireAdmission: !isEdit });
    const errEl = box.querySelector('#ssFormErr');
    if (err) {
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = err;
      }
      toast(err, 'error');
      return;
    }
    if (errEl) errEl.hidden = true;

    const id = _identity();
    let res;
    if (isEdit) {
      const body = { ...fields };
      delete body.admission_number;
      res = await id.patch('/students/' + encodeURIComponent(s.id), body);
    } else {
      res = await id.post('/students', fields);
    }

    if (res && !res._error) {
      toast(isEdit ? 'Student updated' : 'Student created', 'success');
      ssCloseModal();
      ssLoadData();
      return;
    }
    toast((res && res.message) || 'Save failed', 'error');
  });
}

/**
 * Student detail with enrol / guardians / consents actions.
 * @param {string} studentId
 */
export async function ssOpenDetail(studentId) {
  const id = _identity();
  const [student, guardiansRes, consentsRes, allG] = await Promise.all([
    id.get('/students/' + encodeURIComponent(studentId)),
    id.get('/students/' + encodeURIComponent(studentId) + '/guardians'),
    id.get('/students/' + encodeURIComponent(studentId) + '/consents'),
    id.get('/guardians'),
  ]);

  if (!student || student._error) {
    toast((student && student.message) || 'Student not found', 'error');
    return;
  }

  _detailStudent = student;
  _detailGuardians =
    guardiansRes && !guardiansRes._error ? guardiansRes.guardians || [] : [];
  _detailConsents =
    consentsRes && !consentsRes._error ? consentsRes.consents || [] : [];
  _allGuardians = allG && !allG._error ? allG.guardians || [] : [];

  _renderDetailModal();
}

function _renderDetailModal() {
  const s = _detailStudent;
  if (!s) return;

  let gHtml = '';
  if (!_detailGuardians.length) {
    gHtml = '<div class="ss-empty" style="padding:8px 0">No guardians linked.</div>';
  } else {
    _detailGuardians.forEach(function (g) {
      gHtml +=
        '<div class="ss-guardian-row" data-guardian-id="' +
        _esc(g.id) +
        '">' +
        '<div class="ss-guardian-meta"><strong>' +
        _esc(g.firstName + ' ' + g.lastName) +
        '</strong> · ' +
        _esc(g.relation) +
        '<div class="ss-help">' +
        _esc(g.phone || '') +
        (g.isPrimary ? ' · primary' : '') +
        '</div></div>' +
        '<div class="ss-guardian-actions">' +
        (g.isPrimary
          ? ''
          : '<button type="button" class="ss-btn ghost" data-ss-primary="' +
            _esc(g.id) +
            '">Make primary</button>') +
        '<button type="button" class="ss-btn ghost" data-ss-unlink="' +
        _esc(g.id) +
        '">Unlink</button>' +
        '</div></div>';
    });
  }

  const linkedIds = new Set(_detailGuardians.map(function (g) {
    return g.id;
  }));
  const linkable = _allGuardians.filter(function (g) {
    return !linkedIds.has(g.id);
  });
  const atMax = _detailGuardians.length >= 4;

  let cHtml = '';
  _detailConsents.forEach(function (c) {
    const state = c.state || 'not_sought';
    const next = allowedConsentTransitions(state);
    let btns = '';
    next.forEach(function (st) {
      btns +=
        '<button type="button" class="ss-btn ghost" data-ss-consent-kind="' +
        _esc(c.kind) +
        '" data-ss-consent-to="' +
        _esc(st) +
        '">' +
        _esc(st) +
        '</button>';
    });
    if (!next.length) {
      btns = '<span class="ss-help">No further transitions</span>';
    }
    cHtml +=
      '<div class="ss-consent-row" data-consent-kind="' +
      _esc(c.kind) +
      '">' +
      '<div class="ss-consent-meta"><strong>' +
      _esc(c.kind) +
      '</strong> ' +
      '<span class="ss-chip ' +
      _esc(state) +
      '">' +
      _esc(state) +
      '</span></div>' +
      '<div class="ss-consent-actions">' +
      btns +
      '</div></div>';
  });

  _openModal(
    '<div class="ss-modal-title">' +
      _esc(s.firstName + ' ' + s.lastName) +
      '</div>' +
      '<div class="ss-modal-sub">' +
      _esc(s.admissionNumber) +
      ' · ' +
      _esc(s.status) +
      ' · tenant ' +
      _esc(getSchoolTenantId()) +
      '</div>' +
      '<div class="ss-form-actions" style="justify-content:flex-start;margin-top:0">' +
      '<button type="button" class="ss-btn ghost" id="ssEditBtn">Edit in Roster</button>' +
      '<button type="button" class="ss-btn ghost" id="ssEnrolBtn">Enrol</button>' +
      '<button type="button" class="ss-btn ghost" id="ssCloseDetail">Close</button>' +
      '</div>' +
      '<h4 class="ss-modal-title" style="font-size:13px;margin-top:18px">Guardians</h4>' +
      (atMax
        ? '<div class="ss-panel-note" id="ssGuardianMaxNote">Maximum 4 guardians per student.</div>'
        : '') +
      '<div id="ssGuardianList">' +
      gHtml +
      '</div>' +
      '<div class="ss-link-box" id="ssLinkBox">' +
      (atMax
        ? ''
        : '<div class="ss-field"><label>Link existing guardian</label><select id="ssLinkGuardian"></select></div>' +
          '<label class="ss-help"><input type="checkbox" id="ssLinkPrimary"> Set as primary</label>' +
          '<div class="ss-form-actions"><button type="button" class="ss-btn" id="ssLinkBtn">Link</button>' +
          '<button type="button" class="ss-btn ghost" id="ssCreateGuardianBtn">+ New guardian</button></div>') +
      '</div>' +
      '<h4 class="ss-modal-title" style="font-size:13px;margin-top:18px">Consents</h4>' +
      '<div class="ss-panel-note" id="ssConsentRefusalNote">Refusal does not block any service</div>' +
      '<div id="ssConsentList">' +
      cHtml +
      '</div>' +
      '<div id="ssConsentTransition" hidden></div>',
    'detail',
  );

  _fillLinkSelect(linkable, atMax);

  const box = _container.querySelector('#ssModalBox');
  box.querySelector('#ssCloseDetail').addEventListener('click', ssCloseModal);
  box.querySelector('#ssEditBtn').addEventListener('click', function () {
    try {
      sessionStorage.setItem('scs_open_tab', 'roster');
      sessionStorage.setItem('scs_open_entity', 'students');
      sessionStorage.setItem('scs_open_mode', 'manual');
    } catch (_) {
      /* ignore */
    }
    ssCloseModal();
    navigateToModule('school_settings');
  });
  box.querySelector('#ssEnrolBtn').addEventListener('click', function () {
    ssOpenEnrolForm(s);
  });

  box.querySelectorAll('[data-ss-unlink]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _unlinkGuardian(btn.getAttribute('data-ss-unlink'));
    });
  });
  box.querySelectorAll('[data-ss-primary]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _setPrimary(btn.getAttribute('data-ss-primary'));
    });
  });

  const linkBtn = box.querySelector('#ssLinkBtn');
  if (linkBtn) {
    linkBtn.addEventListener('click', function () {
      _linkGuardian();
    });
  }
  const createG = box.querySelector('#ssCreateGuardianBtn');
  if (createG) {
    createG.addEventListener('click', function () {
      ssOpenGuardianForm(s.id);
    });
  }

  box.querySelectorAll('[data-ss-consent-kind]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ssShowConsentTransition(
        btn.getAttribute('data-ss-consent-kind'),
        btn.getAttribute('data-ss-consent-to'),
      );
    });
  });
}

function _fillLinkSelect(linkable, atMax) {
  if (atMax) return;
  const sel = _container.querySelector('#ssLinkGuardian');
  if (!sel) return;
  let html =
    '<option value="">' +
    (linkable.length ? 'Select guardian…' : 'No unlinked guardians') +
    '</option>';
  linkable.forEach(function (g) {
    html +=
      '<option value="' +
      _esc(g.id) +
      '">' +
      _esc(g.firstName + ' ' + g.lastName + ' (' + g.relation + ')') +
      '</option>';
  });
  sel.innerHTML = html;
}

async function _linkGuardian() {
  if (_detailGuardians.length >= 4) {
    toast('Maximum 4 guardians per student', 'error');
    return;
  }
  const sel = _container.querySelector('#ssLinkGuardian');
  const primary = _container.querySelector('#ssLinkPrimary');
  const guardianId = sel && sel.value;
  if (!guardianId) {
    toast('Select a guardian', 'error');
    return;
  }
  const res = await _identity().post(
    '/students/' + encodeURIComponent(_detailStudent.id) + '/guardians',
    {
      guardian_id: guardianId,
      is_primary: !!(primary && primary.checked),
    },
  );
  if (res && !res._error) {
    toast('Guardian linked', 'success');
    ssOpenDetail(_detailStudent.id);
    return;
  }
  toast((res && res.message) || 'Link failed', 'error');
}

async function _unlinkGuardian(guardianId) {
  const res = await _identity().del(
    '/students/' +
      encodeURIComponent(_detailStudent.id) +
      '/guardians/' +
      encodeURIComponent(guardianId),
  );
  if (res && res._error) {
    toast(res.message || 'Unlink failed', 'error');
    return;
  }
  toast('Guardian unlinked', 'success');
  ssOpenDetail(_detailStudent.id);
}

async function _setPrimary(guardianId) {
  const res = await _identity().post(
    '/students/' + encodeURIComponent(_detailStudent.id) + '/guardians',
    { guardian_id: guardianId, is_primary: true },
  );
  if (res && !res._error) {
    toast('Primary guardian updated', 'success');
    ssOpenDetail(_detailStudent.id);
    return;
  }
  toast((res && res.message) || 'Update failed', 'error');
}

/**
 * Enrolment modal for a student.
 * @param {object} student
 */
export function ssOpenEnrolForm(student) {
  const sessionOpts = _sessions
    .map(function (sess) {
      return (
        '<option value="' +
        _esc(sess.id) +
        '"' +
        (sess.isCurrent ? ' selected' : '') +
        '>' +
        _esc(sess.label) +
        '</option>'
      );
    })
    .join('');

  _openModal(
    '<div class="ss-modal-title">Enrol ' +
      _esc(student.firstName + ' ' + student.lastName) +
      '</div>' +
      '<div class="ss-field"><label>Academic session *</label><select id="ssSession">' +
      (sessionOpts || '<option value="">No sessions</option>') +
      '</select></div>' +
      '<div class="ss-grid">' +
      '<div class="ss-field"><label>Class *</label><select id="ssEnrolClass">' +
      _opts(CLASS_PROBE, _classLabel || '1') +
      '</select></div>' +
      '<div class="ss-field"><label>Section *</label><input id="ssEnrolSection" value="A"></div>' +
      '<div class="ss-field"><label>Roll number *</label><input id="ssEnrolRoll" value=""></div>' +
      '<div class="ss-field"><label>House</label><input id="ssEnrolHouse" value=""></div>' +
      '</div>' +
      '<div class="ss-form-actions">' +
      '<button type="button" class="ss-btn ghost" id="ssEnrolCancel">Cancel</button>' +
      '<button type="button" class="ss-btn" id="ssEnrolSave">Enrol</button>' +
      '</div>',
    'enrol',
  );

  const box = _container.querySelector('#ssModalBox');
  box.querySelector('#ssEnrolCancel').addEventListener('click', function () {
    ssOpenDetail(student.id);
  });
  box.querySelector('#ssEnrolSave').addEventListener('click', async function () {
    const body = {
      academic_session_id: box.querySelector('#ssSession').value,
      class_label: box.querySelector('#ssEnrolClass').value,
      section: (box.querySelector('#ssEnrolSection').value || '').trim(),
      roll_number: (box.querySelector('#ssEnrolRoll').value || '').trim(),
      house: (box.querySelector('#ssEnrolHouse').value || '').trim() || null,
    };
    if (!body.academic_session_id || !body.class_label || !body.section || !body.roll_number) {
      toast('Session, class, section, and roll number are required', 'error');
      return;
    }
    const res = await _identity().post(
      '/students/' + encodeURIComponent(student.id) + '/enrol',
      body,
    );
    if (res && !res._error) {
      toast('Student enrolled', 'success');
      ssCloseModal();
      ssLoadData();
      return;
    }
    toast((res && res.message) || 'Enrolment failed', 'error');
  });
}

/**
 * Create guardian then link to student.
 * @param {string} studentId
 */
export function ssOpenGuardianForm(studentId) {
  _openModal(
    '<div class="ss-modal-title">New guardian</div>' +
      '<div class="ss-grid">' +
      '<div class="ss-field"><label>First name *</label><input id="ssGFirst"></div>' +
      '<div class="ss-field"><label>Last name *</label><input id="ssGLast"></div>' +
      '<div class="ss-field"><label>Relation *</label><select id="ssGRel">' +
      _opts(['father', 'mother', 'guardian', 'other'], 'guardian') +
      '</select></div>' +
      '<div class="ss-field"><label>Phone *</label><input id="ssGPhone" placeholder="10-digit mobile"></div>' +
      '<div class="ss-field full"><label>Email</label><input id="ssGEmail" type="email"></div>' +
      '</div>' +
      '<label class="ss-help"><input type="checkbox" id="ssGPrimary" checked> Link as primary</label>' +
      '<div class="ss-form-actions">' +
      '<button type="button" class="ss-btn ghost" id="ssGCancel">Cancel</button>' +
      '<button type="button" class="ss-btn" id="ssGSave">Create &amp; link</button>' +
      '</div>',
    'guardian',
  );

  const box = _container.querySelector('#ssModalBox');
  box.querySelector('#ssGCancel').addEventListener('click', function () {
    ssOpenDetail(studentId);
  });
  box.querySelector('#ssGSave').addEventListener('click', async function () {
    if (_detailGuardians.length >= 4) {
      toast('Maximum 4 guardians per student', 'error');
      return;
    }
    const payload = {
      first_name: (box.querySelector('#ssGFirst').value || '').trim(),
      last_name: (box.querySelector('#ssGLast').value || '').trim(),
      relation: box.querySelector('#ssGRel').value,
      phone: (box.querySelector('#ssGPhone').value || '').trim(),
      email: (box.querySelector('#ssGEmail').value || '').trim() || null,
    };
    if (!payload.first_name || !payload.last_name || !payload.phone) {
      toast('Name and phone are required', 'error');
      return;
    }
    const id = _identity();
    const created = await id.post('/guardians', payload);
    if (!created || created._error) {
      toast((created && created.message) || 'Could not create guardian', 'error');
      return;
    }
    const link = await id.post('/students/' + encodeURIComponent(studentId) + '/guardians', {
      guardian_id: created.id,
      is_primary: !!(box.querySelector('#ssGPrimary') && box.querySelector('#ssGPrimary').checked),
    });
    if (link && !link._error) {
      toast('Guardian created and linked', 'success');
      ssOpenDetail(studentId);
      return;
    }
    toast((link && link.message) || 'Created but link failed', 'error');
    ssOpenDetail(studentId);
  });
}

/**
 * Consent transition UI (granted requires guardian + method + artefact).
 * @param {string} kind
 * @param {string} toState
 */
export function ssShowConsentTransition(kind, toState) {
  const host = _container && _container.querySelector('#ssConsentTransition');
  if (!host || !_detailStudent) return;

  const needsGrantMeta = toState === 'granted';
  const strict = STRICT_GRANT_KINDS.has(kind);

  let gOpts = '<option value="">Select guardian…</option>';
  _detailGuardians.forEach(function (g) {
    gOpts +=
      '<option value="' +
      _esc(g.id) +
      '">' +
      _esc(g.firstName + ' ' + g.lastName) +
      '</option>';
  });

  host.hidden = false;
  host.innerHTML =
    '<div class="ss-link-box">' +
    '<div class="ss-modal-title" style="font-size:13px">Set ' +
    _esc(kind) +
    ' → ' +
    _esc(toState) +
    '</div>' +
    (needsGrantMeta
      ? '<div class="ss-field"><label>Guardian' +
        (strict ? ' *' : '') +
        '</label><select id="ssCGuardian">' +
        gOpts +
        '</select></div>' +
        '<div class="ss-field"><label>Verification method' +
        (strict ? ' *' : '') +
        '</label><select id="ssCMethod">' +
        _opts(VERIFICATION_METHODS, '', 'Select…') +
        '</select></div>' +
        '<div class="ss-field"><label>Artefact upload ref' +
        (strict ? ' *' : '') +
        '</label><input id="ssCArtefact" placeholder="storage ref"></div>'
      : '') +
    '<div class="ss-form-actions">' +
    '<button type="button" class="ss-btn ghost" id="ssCCancel">Cancel</button>' +
    '<button type="button" class="ss-btn" id="ssCSave">Confirm</button>' +
    '</div></div>';

  host.querySelector('#ssCCancel').addEventListener('click', function () {
    host.hidden = true;
    host.innerHTML = '';
  });
  host.querySelector('#ssCSave').addEventListener('click', async function () {
    const body = {
      kind: kind,
      state: toState,
      noted_by: _actor(),
    };
    if (needsGrantMeta) {
      body.granted_by_guardian_id =
        (host.querySelector('#ssCGuardian') && host.querySelector('#ssCGuardian').value) || null;
      body.verification_method =
        (host.querySelector('#ssCMethod') && host.querySelector('#ssCMethod').value) || null;
      body.artefact_ref =
        (host.querySelector('#ssCArtefact') &&
          (host.querySelector('#ssCArtefact').value || '').trim()) ||
        null;
      if (strict && (!body.granted_by_guardian_id || !body.verification_method || !body.artefact_ref)) {
        toast('Guardian, verification method, and artefact ref are required', 'error');
        return;
      }
    }
    const res = await _identity().post(
      '/students/' + encodeURIComponent(_detailStudent.id) + '/consents',
      body,
    );
    if (res && !res._error) {
      toast('Consent updated', 'success');
      ssOpenDetail(_detailStudent.id);
      return;
    }
    toast((res && res.message) || 'Consent update failed', 'error');
  });
}

/** @returns {{ items: any[], total: number, activeCount: number, classCounts: any[], consentSummary: any }} */
export function ssGetState() {
  return {
    items: _items.slice(),
    total: _total,
    activeCount: _activeCount,
    classCounts: _classCounts.slice(),
    consentSummary: _consentSummary,
    detailGuardians: _detailGuardians.slice(),
    detailConsents: _detailConsents.slice(),
    modalMode: _modalMode,
  };
}

registerModule('school_students', renderSchoolStudentsPage);
