/**
 * modules/school_settings/roster_hub.js
 *
 * Roster Hub: Excel | Manual for Students, Teachers, Periods, Classes.
 * Owned by School Settings — other modules deep-link here.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';

const ENTITIES = ['students', 'teachers', 'periods', 'classes'];
const STUDENT_STATUSES = ['enquiry', 'admitted', 'active', 'transferred', 'alumni', 'withdrawn'];
const STUDENT_GENDERS = ['male', 'female', 'other'];
const STUDENT_CATEGORIES = ['GEN', 'EWS', 'OBC', 'SC', 'ST', 'OTHER_STATE'];

/** @type {HTMLElement|null} */
let _root = null;
/** @type {'excel'|'manual'} */
let _mode = 'excel';
/** @type {string} */
let _entity = 'students';
/** @type {object|null} */
let _importResult = null;
/** @type {object[]} */
let _students = [];
/** @type {object[]} */
let _teachers = [];
/** @type {object[]} */
let _daySchemes = [];
/** @type {object[]} */
let _sections = [];
/** @type {object[]} */
let _sessions = [];
/** @type {number} */
let _studentsTotal = 0;
/** @type {(() => void)|null} */
let _onChanged = null;

function _identity() {
  return api.school('school-identity');
}

function _tt() {
  return api.school('school-timetable');
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _opts(list, selected, emptyLabel) {
  let html = emptyLabel != null ? '<option value="">' + _esc(emptyLabel) + '</option>' : '';
  list.forEach(function (v) {
    html +=
      '<option value="' +
      _esc(v) +
      '"' +
      (v === selected ? ' selected' : '') +
      '>' +
      _esc(v) +
      '</option>';
  });
  return html;
}

function _openModal(html) {
  const box = _root && _root.querySelector('#scsModalBox');
  const modal = _root && _root.querySelector('#scsModal');
  if (!box || !modal) return;
  box.innerHTML = html;
  modal.classList.add('open');
}

function _closeModal() {
  const modal = _root && _root.querySelector('#scsModal');
  if (modal) modal.classList.remove('open');
}

/**
 * @param {{ root: HTMLElement, sessions?: object[], onChanged?: () => void }} opts
 */
export function rosterReset(opts) {
  _root = opts.root || null;
  _mode = 'excel';
  _entity = 'students';
  _importResult = null;
  _students = [];
  _teachers = [];
  _daySchemes = [];
  _sections = [];
  _sessions = opts.sessions || [];
  _studentsTotal = 0;
  _onChanged = opts.onChanged || null;

  try {
    const openEntity = sessionStorage.getItem('scs_open_entity');
    if (openEntity && ENTITIES.indexOf(openEntity) >= 0) {
      sessionStorage.removeItem('scs_open_entity');
      _entity = openEntity;
      _mode = 'manual';
    }
    const openMode = sessionStorage.getItem('scs_open_mode');
    if (openMode === 'excel' || openMode === 'manual') {
      sessionStorage.removeItem('scs_open_mode');
      _mode = openMode;
    }
  } catch (_) {
    /* ignore */
  }
}

export function rosterGetStats() {
  return {
    teachers: _teachers.length,
    daySchemes: _daySchemes.length,
    sections: _sections.length,
    studentsTotal: _studentsTotal,
  };
}

export function rosterGetImportResult() {
  return _importResult;
}

/** @param {object[]} sessions */
export function rosterSetSessions(sessions) {
  _sessions = sessions || [];
}

export async function rosterLoadLists() {
  const [stu, members, schemes, sections] = await Promise.all([
    _identity().get('/students?limit=50&offset=0'),
    api.get('/api/directory/members'),
    _tt().get('/day-schemes'),
    _tt().get('/sections'),
  ]);

  if (stu && !stu._error) {
    _students = stu.items || [];
    _studentsTotal = Number(stu.total) || _students.length;
  } else {
    _students = [];
    _studentsTotal = 0;
  }

  if (members && !members._error && Array.isArray(members.members)) {
    _teachers = members.members.filter(function (m) {
      return (m.role || '') === 'teacher' && m.active !== false;
    });
  } else {
    _teachers = [];
  }

  if (schemes && !schemes._error) {
    _daySchemes = schemes.daySchemes || schemes.day_schemes || [];
  } else {
    _daySchemes = [];
  }

  if (sections && !sections._error) {
    _sections = sections.sections || [];
  } else {
    _sections = [];
  }
}

/**
 * @param {HTMLElement} content
 */
export function rosterRender(content) {
  if (!content) return;

  content.innerHTML =
    '<div class="scs-panel-note">' +
    'Populate the school app here: upload Excel or add/edit Students, Teachers, Periods, and Classes.' +
    '</div>' +
    '<div class="scs-mode-toggle" id="scsRosterMode">' +
    '<button type="button" class="scs-mode-btn' +
    (_mode === 'excel' ? ' active' : '') +
    '" data-mode="excel">Excel</button>' +
    '<button type="button" class="scs-mode-btn' +
    (_mode === 'manual' ? ' active' : '') +
    '" data-mode="manual">Manual</button>' +
    '</div>' +
    '<div class="scs-entity-tabs" id="scsRosterEntities">' +
    ENTITIES.map(function (e) {
      return (
        '<button type="button" class="scs-entity-tab' +
        (_entity === e ? ' active' : '') +
        '" data-entity="' +
        e +
        '">' +
        _esc(e) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div id="scsRosterBody"></div>';

  content.querySelector('#scsRosterMode').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    _mode = btn.dataset.mode === 'manual' ? 'manual' : 'excel';
    rosterRender(content);
  });

  content.querySelector('#scsRosterEntities').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-entity]');
    if (!btn || !btn.dataset.entity) return;
    _entity = btn.dataset.entity;
    rosterRender(content);
  });

  const body = content.querySelector('#scsRosterBody');
  if (_mode === 'excel') _renderExcel(body);
  else _renderManual(body);
}

function _renderExcel(el) {
  el.innerHTML =
    '<div class="scs-panel-note">' +
    'One workbook: sheets <strong>Students</strong>, <strong>Teachers</strong>, <strong>Periods</strong>, <strong>Classes</strong>. CSV uploads still work for Students (first sheet).' +
    '</div>' +
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn ghost" id="scsTemplateBtn">Download template</button>' +
    '<div class="scs-spacer"></div>' +
    '<button type="button" class="scs-btn ghost" id="scsPickBtn">Choose file</button>' +
    '<input type="file" id="scsImportFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>' +
    '</div>' +
    '<div class="scs-drop" id="scsDrop" tabindex="0">' +
    '<strong>Drop Excel / CSV here</strong>' +
    'or click to browse · .xlsx · .xls · .csv' +
    '</div>' +
    '<div id="scsImportResult"></div>';

  el.querySelector('#scsTemplateBtn').addEventListener('click', function () {
    scsDownloadTemplate();
  });

  const fileInput = el.querySelector('#scsImportFile');
  const pick = el.querySelector('#scsPickBtn');
  const drop = el.querySelector('#scsDrop');

  function openPicker() {
    fileInput.click();
  }

  pick.addEventListener('click', openPicker);
  drop.addEventListener('click', openPicker);
  drop.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  });

  fileInput.addEventListener('change', function () {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) scsImportFile(file);
  });

  drop.addEventListener('dragover', function (e) {
    e.preventDefault();
    drop.classList.add('drag');
  });
  drop.addEventListener('dragleave', function () {
    drop.classList.remove('drag');
  });
  drop.addEventListener('drop', function (e) {
    e.preventDefault();
    drop.classList.remove('drag');
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) scsImportFile(file);
  });

  _renderImportResultPanel(el.querySelector('#scsImportResult'));
}

function _renderImportResultPanel(el) {
  if (!el) return;
  if (!_importResult) {
    el.innerHTML = '';
    return;
  }

  const r = _importResult;
  const counts = [];
  counts.push(
    '<span class="scs-pill">Students created <strong id="scsImpCreated">' +
      _esc(String(r.created || 0)) +
      '</strong></span>',
  );
  counts.push(
    '<span class="scs-pill">Enrolled <strong id="scsImpEnrolled">' +
      _esc(String(r.enrolled || 0)) +
      '</strong></span>',
  );
  counts.push(
    '<span class="scs-pill">Skipped <strong id="scsImpSkipped">' +
      _esc(String(r.skipped || 0)) +
      '</strong></span>',
  );
  counts.push(
    '<span class="scs-pill">Teachers <strong id="scsImpTeachers">' +
      _esc(String(r.teachersCreated || 0)) +
      '</strong></span>',
  );
  counts.push(
    '<span class="scs-pill">Day schemes <strong id="scsImpSchemes">' +
      _esc(String(r.daySchemesCreated || 0)) +
      '</strong></span>',
  );
  counts.push(
    '<span class="scs-pill">Classes <strong id="scsImpClasses">' +
      _esc(String(r.sectionsCreated || 0)) +
      '</strong></span>',
  );

  let errHtml = '';
  if (r.errors && r.errors.length) {
    errHtml =
      '<table class="scs-table" id="scsImportErrors"><thead><tr>' +
      '<th>Row</th><th>Field</th><th>Message</th></tr></thead><tbody>' +
      r.errors
        .map(function (e) {
          return (
            '<tr><td>' +
            _esc(String(e.row ?? '')) +
            '</td><td>' +
            _esc(e.field || '') +
            '</td><td>' +
            _esc(e.message || '') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
  }

  el.innerHTML =
    '<div class="scs-result">' +
    '<div class="scs-result-title">Last import</div>' +
    '<div class="scs-result-counts">' +
    counts.join('') +
    '</div>' +
    errHtml +
    '</div>';
}

function _renderManual(el) {
  if (_entity === 'students') _renderManualStudents(el);
  else if (_entity === 'teachers') _renderManualTeachers(el);
  else if (_entity === 'periods') _renderManualPeriods(el);
  else _renderManualClasses(el);
}

function _renderManualStudents(el) {
  const rows = _students.length
    ? _students
        .map(function (s) {
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc((s.firstName || '') + ' ' + (s.lastName || '')) +
            '</td>' +
            '<td>' +
            _esc(s.admissionNumber || '') +
            '</td>' +
            '<td>' +
            _esc(s.status || '') +
            '</td>' +
            '<td><button type="button" class="scs-link" data-edit-student="' +
            _esc(s.id) +
            '">Edit</button></td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="4" class="scs-empty">No students yet</td></tr>';

  el.innerHTML =
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn" id="scsAddStudent">+ Student</button>' +
    '</div>' +
    '<table class="scs-table"><thead><tr><th>Name</th><th>Admission</th><th>Status</th><th></th></tr></thead><tbody>' +
    rows +
    '</tbody></table>';

  el.querySelector('#scsAddStudent').addEventListener('click', function () {
    _openStudentForm(null);
  });
  el.querySelectorAll('[data-edit-student]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-edit-student');
      const s = _students.find(function (x) {
        return x.id === id;
      });
      _openStudentForm(s || null);
    });
  });
}

function _renderManualTeachers(el) {
  const rows = _teachers.length
    ? _teachers
        .map(function (t) {
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc(t.name || '') +
            '</td>' +
            '<td>' +
            _esc(t.email || '') +
            '</td>' +
            '<td><button type="button" class="scs-link" data-edit-teacher="' +
            _esc(t.id) +
            '">Edit</button></td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="3" class="scs-empty">No teachers yet</td></tr>';

  el.innerHTML =
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn" id="scsAddTeacher">+ Teacher</button>' +
    '</div>' +
    '<table class="scs-table"><thead><tr><th>Name</th><th>Email</th><th></th></tr></thead><tbody>' +
    rows +
    '</tbody></table>';

  el.querySelector('#scsAddTeacher').addEventListener('click', function () {
    _openTeacherForm(null);
  });
  el.querySelectorAll('[data-edit-teacher]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-edit-teacher');
      const t = _teachers.find(function (x) {
        return x.id === id;
      });
      _openTeacherForm(t || null);
    });
  });
}

function _renderManualPeriods(el) {
  const rows = _daySchemes.length
    ? _daySchemes
        .map(function (s) {
          const periods = s.periods || [];
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc(s.label || '') +
            '</td>' +
            '<td>' +
            _esc(String(periods.length)) +
            ' periods</td>' +
            '<td><button type="button" class="scs-link" data-edit-scheme="' +
            _esc(s.id) +
            '">Edit</button></td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="3" class="scs-empty">No day schemes yet</td></tr>';

  el.innerHTML =
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn" id="scsAddScheme">+ Day scheme</button>' +
    '</div>' +
    '<table class="scs-table"><thead><tr><th>Label</th><th>Periods</th><th></th></tr></thead><tbody>' +
    rows +
    '</tbody></table>';

  el.querySelector('#scsAddScheme').addEventListener('click', function () {
    _openSchemeForm(null);
  });
  el.querySelectorAll('[data-edit-scheme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-edit-scheme');
      const s = _daySchemes.find(function (x) {
        return x.id === id;
      });
      _openSchemeForm(s || null);
    });
  });
}

function _renderManualClasses(el) {
  const rows = _sections.length
    ? _sections
        .map(function (s) {
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc(s.classLabel || s.class_label || '') +
            '</td>' +
            '<td>' +
            _esc(s.section || '') +
            '</td>' +
            '<td><button type="button" class="scs-link" data-edit-section="' +
            _esc(s.id) +
            '">Edit</button></td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="3" class="scs-empty">No classes yet</td></tr>';

  el.innerHTML =
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn" id="scsAddSection">+ Class</button>' +
    '</div>' +
    '<table class="scs-table"><thead><tr><th>Class</th><th>Section</th><th></th></tr></thead><tbody>' +
    rows +
    '</tbody></table>';

  el.querySelector('#scsAddSection').addEventListener('click', function () {
    _openSectionForm(null);
  });
  el.querySelectorAll('[data-edit-section]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const id = btn.getAttribute('data-edit-section');
      const s = _sections.find(function (x) {
        return x.id === id;
      });
      _openSectionForm(s || null);
    });
  });
}

function _openStudentForm(student) {
  const isEdit = !!student;
  const s = student || {};
  _openModal(
    '<div class="scs-modal-title">' +
      (isEdit ? 'Edit student' : 'New student') +
      '</div>' +
      '<div class="scs-err" id="scsFormErr" hidden></div>' +
      '<div class="scs-grid">' +
      (isEdit
        ? '<div class="scs-field"><label>Admission</label><input disabled value="' +
          _esc(s.admissionNumber || '') +
          '"></div>'
        : '<div class="scs-field"><label>Admission number *</label><input id="scsAdm"></div>') +
      '<div class="scs-field"><label>Status *</label><select id="scsStatus">' +
      _opts(STUDENT_STATUSES, s.status || 'enquiry') +
      '</select></div>' +
      '<div class="scs-field"><label>First name *</label><input id="scsFirst" value="' +
      _esc(s.firstName || '') +
      '"></div>' +
      '<div class="scs-field"><label>Last name *</label><input id="scsLast" value="' +
      _esc(s.lastName || '') +
      '"></div>' +
      '<div class="scs-field"><label>DOB *</label><input type="date" id="scsDob" value="' +
      _esc(s.dob || '') +
      '"></div>' +
      '<div class="scs-field"><label>Admission date *</label><input type="date" id="scsAdmDate" value="' +
      _esc(s.admissionDate || '') +
      '"></div>' +
      '<div class="scs-field"><label>Gender *</label><select id="scsGender">' +
      _opts(STUDENT_GENDERS, s.gender || '') +
      '</select></div>' +
      '<div class="scs-field"><label>Category *</label><select id="scsCategory">' +
      _opts(STUDENT_CATEGORIES, s.category || 'GEN') +
      '</select></div>' +
      '<div class="scs-field"><label>Mother name *</label><input id="scsMother" value="' +
      _esc(s.motherName || '') +
      '"></div>' +
      '<div class="scs-field"><label>Father name *</label><input id="scsFather" value="' +
      _esc(s.fatherName || '') +
      '"></div>' +
      '<div class="scs-field full"><label>Guardian contact *</label><input id="scsContact" value="' +
      _esc(s.guardianContact || '') +
      '"></div>' +
      '</div>' +
      '<div class="scs-form-actions">' +
      '<button type="button" class="scs-btn ghost" id="scsFormCancel">Cancel</button>' +
      '<button type="button" class="scs-btn" id="scsFormSave">' +
      (isEdit ? 'Save' : 'Create') +
      '</button></div>',
  );

  const box = _root.querySelector('#scsModalBox');
  box.querySelector('#scsFormCancel').addEventListener('click', _closeModal);
  box.querySelector('#scsFormSave').addEventListener('click', async function () {
    const fields = {
      admission_number: isEdit ? undefined : (box.querySelector('#scsAdm').value || '').trim(),
      first_name: (box.querySelector('#scsFirst').value || '').trim(),
      last_name: (box.querySelector('#scsLast').value || '').trim(),
      dob: box.querySelector('#scsDob').value || '',
      gender: box.querySelector('#scsGender').value || '',
      admission_date: box.querySelector('#scsAdmDate').value || '',
      status: box.querySelector('#scsStatus').value || '',
      category: box.querySelector('#scsCategory').value || '',
      mother_name: (box.querySelector('#scsMother').value || '').trim(),
      father_name: (box.querySelector('#scsFather').value || '').trim(),
      guardian_contact: (box.querySelector('#scsContact').value || '').trim(),
    };
    if (!isEdit && !fields.admission_number) {
      toast('Admission number is required', 'error');
      return;
    }
    if (!fields.first_name || !fields.last_name) {
      toast('Name is required', 'error');
      return;
    }

    let res;
    if (isEdit) {
      const body = { ...fields };
      delete body.admission_number;
      res = await _identity().patch('/students/' + encodeURIComponent(s.id), body);
    } else {
      res = await _identity().post('/students', fields);
    }
    if (res && !res._error) {
      toast(isEdit ? 'Student updated' : 'Student created', 'success');
      _closeModal();
      await _reloadAndNotify();
      return;
    }
    toast((res && res.message) || 'Save failed', 'error');
  });
}

function _openTeacherForm(teacher) {
  const isEdit = !!teacher;
  const t = teacher || {};
  _openModal(
    '<div class="scs-modal-title">' +
      (isEdit ? 'Edit teacher' : 'New teacher') +
      '</div>' +
      '<div class="scs-grid">' +
      '<div class="scs-field full"><label>Full name *</label><input id="scsTName" value="' +
      _esc(t.name || '') +
      '"></div>' +
      '<div class="scs-field full"><label>Work email *</label><input type="email" id="scsTEmail" ' +
      (isEdit ? 'disabled ' : '') +
      'value="' +
      _esc(t.email || '') +
      '"></div>' +
      (isEdit
        ? ''
        : '<div class="scs-field full"><label>Temporary password *</label><input type="password" id="scsTPass" autocomplete="new-password"></div>') +
      '</div>' +
      '<div class="scs-form-actions">' +
      '<button type="button" class="scs-btn ghost" id="scsFormCancel">Cancel</button>' +
      '<button type="button" class="scs-btn" id="scsFormSave">' +
      (isEdit ? 'Save' : 'Create') +
      '</button></div>',
  );

  const box = _root.querySelector('#scsModalBox');
  box.querySelector('#scsFormCancel').addEventListener('click', _closeModal);
  box.querySelector('#scsFormSave').addEventListener('click', async function () {
    const name = (box.querySelector('#scsTName').value || '').trim();
    if (!name) {
      toast('Name is required', 'error');
      return;
    }
    let res;
    if (isEdit) {
      res = await api.patch('/api/directory/members/' + encodeURIComponent(t.id), {
        name: name,
        role: 'teacher',
      });
    } else {
      const email = (box.querySelector('#scsTEmail').value || '').trim().toLowerCase();
      const temporaryPassword = (box.querySelector('#scsTPass').value || '').trim();
      if (!email || email.indexOf('@') < 0) {
        toast('Valid email is required', 'error');
        return;
      }
      if (temporaryPassword.length < 8) {
        toast('Temporary password must be at least 8 characters', 'error');
        return;
      }
      res = await api.post('/api/directory/members', {
        name: name,
        email: email,
        temporaryPassword: temporaryPassword,
        role: 'teacher',
      });
    }
    if (res && !res._error) {
      toast(isEdit ? 'Teacher updated' : 'Teacher created', 'success');
      _closeModal();
      await _reloadAndNotify();
      return;
    }
    toast((res && res.message) || 'Save failed', 'error');
  });
}

function _openSchemeForm(scheme) {
  const isEdit = !!scheme;
  const s = scheme || {};
  const periods =
    s.periods && s.periods.length
      ? s.periods.slice()
      : [
          { index: 0, label: 'P1', startTime: '08:00', endTime: '08:45', isTeaching: true },
          { index: 1, label: 'P2', startTime: '08:45', endTime: '09:30', isTeaching: true },
        ];

  function periodRow(p, i) {
    return (
      '<tr data-period-row="' +
      i +
      '">' +
      '<td><input class="scs-input tiny" data-f="index" type="number" min="0" value="' +
      _esc(String(p.index != null ? p.index : i)) +
      '"></td>' +
      '<td><input class="scs-input" data-f="label" value="' +
      _esc(p.label || '') +
      '"></td>' +
      '<td><input class="scs-input tiny" data-f="start" value="' +
      _esc(p.startTime || p.start_time || '') +
      '"></td>' +
      '<td><input class="scs-input tiny" data-f="end" value="' +
      _esc(p.endTime || p.end_time || '') +
      '"></td>' +
      '<td><input type="checkbox" data-f="teach"' +
      (p.isTeaching !== false && p.is_teaching !== false ? ' checked' : '') +
      '></td>' +
      '</tr>'
    );
  }

  _openModal(
    '<div class="scs-modal-title">' +
      (isEdit ? 'Edit day scheme' : 'New day scheme') +
      '</div>' +
      '<div class="scs-field"><label>Label *</label><input id="scsSchemeLabel" value="' +
      _esc(s.label || '') +
      '"></div>' +
      '<table class="scs-table" id="scsPeriodRows"><thead><tr>' +
      '<th>#</th><th>Label</th><th>Start</th><th>End</th><th>Teach</th></tr></thead><tbody>' +
      periods.map(periodRow).join('') +
      '</tbody></table>' +
      '<div class="scs-form-actions" style="justify-content:flex-start">' +
      '<button type="button" class="scs-btn ghost" id="scsAddPeriodRow">+ Period</button></div>' +
      '<div class="scs-form-actions">' +
      '<button type="button" class="scs-btn ghost" id="scsFormCancel">Cancel</button>' +
      '<button type="button" class="scs-btn" id="scsFormSave">' +
      (isEdit ? 'Save' : 'Create') +
      '</button></div>',
  );

  const box = _root.querySelector('#scsModalBox');
  box.querySelector('#scsFormCancel').addEventListener('click', _closeModal);
  box.querySelector('#scsAddPeriodRow').addEventListener('click', function () {
    const tbody = box.querySelector('#scsPeriodRows tbody');
    const i = tbody.querySelectorAll('tr').length;
    tbody.insertAdjacentHTML(
      'beforeend',
      periodRow(
        {
          index: i,
          label: 'P' + (i + 1),
          startTime: '00:00',
          endTime: '00:45',
          isTeaching: true,
        },
        i,
      ),
    );
  });
  box.querySelector('#scsFormSave').addEventListener('click', async function () {
    const label = (box.querySelector('#scsSchemeLabel').value || '').trim();
    if (!label) {
      toast('Label is required', 'error');
      return;
    }
    const periodRows = [];
    box.querySelectorAll('#scsPeriodRows tbody tr').forEach(function (tr) {
      periodRows.push({
        index: Number(tr.querySelector('[data-f="index"]').value),
        label: (tr.querySelector('[data-f="label"]').value || '').trim(),
        start_time: (tr.querySelector('[data-f="start"]').value || '').trim(),
        end_time: (tr.querySelector('[data-f="end"]').value || '').trim(),
        is_teaching: tr.querySelector('[data-f="teach"]').checked,
      });
    });
    if (!periodRows.length) {
      toast('Add at least one period', 'error');
      return;
    }

    let res;
    if (isEdit) {
      res = await _tt().patch('/day-schemes/' + encodeURIComponent(s.id), {
        label: label,
        periods: periodRows,
      });
    } else {
      res = await _tt().post('/day-schemes', { label: label, periods: periodRows });
    }
    if (res && !res._error) {
      toast(isEdit ? 'Day scheme updated' : 'Day scheme created', 'success');
      _closeModal();
      await _reloadAndNotify();
      return;
    }
    toast((res && (res.message || res.error)) || 'Save failed', 'error');
  });
}

function _openSectionForm(section) {
  const isEdit = !!section;
  const s = section || {};
  const currentSession = _sessions.find(function (x) {
    return x.isCurrent;
  });
  const schemeOpts = _daySchemes
    .map(function (d) {
      const sid = s.daySchemeId || s.day_scheme_id;
      return (
        '<option value="' +
        _esc(d.id) +
        '"' +
        (d.id === sid ? ' selected' : '') +
        '>' +
        _esc(d.label) +
        '</option>'
      );
    })
    .join('');

  _openModal(
    '<div class="scs-modal-title">' +
      (isEdit ? 'Edit class' : 'New class') +
      '</div>' +
      '<div class="scs-grid">' +
      '<div class="scs-field"><label>Class *</label><input id="scsClassLabel" value="' +
      _esc(s.classLabel || s.class_label || '') +
      '"></div>' +
      '<div class="scs-field"><label>Section *</label><input id="scsSection" value="' +
      _esc(s.section || '') +
      '"></div>' +
      '<div class="scs-field full"><label>Day scheme *</label><select id="scsDayScheme"><option value="">Select…</option>' +
      schemeOpts +
      '</select></div>' +
      (isEdit
        ? ''
        : '<div class="scs-field full"><label>Academic session id *</label><input id="scsSessId" value="' +
          _esc((currentSession && currentSession.id) || '') +
          '"></div>') +
      '</div>' +
      '<div class="scs-form-actions">' +
      '<button type="button" class="scs-btn ghost" id="scsFormCancel">Cancel</button>' +
      '<button type="button" class="scs-btn" id="scsFormSave">' +
      (isEdit ? 'Save' : 'Create') +
      '</button></div>',
  );

  const box = _root.querySelector('#scsModalBox');
  box.querySelector('#scsFormCancel').addEventListener('click', _closeModal);
  box.querySelector('#scsFormSave').addEventListener('click', async function () {
    const class_label = (box.querySelector('#scsClassLabel').value || '').trim();
    const sectionVal = (box.querySelector('#scsSection').value || '').trim();
    const day_scheme_id = box.querySelector('#scsDayScheme').value || '';
    if (!class_label || !sectionVal || !day_scheme_id) {
      toast('Class, section, and day scheme are required', 'error');
      return;
    }
    let res;
    if (isEdit) {
      res = await _tt().patch('/sections/' + encodeURIComponent(s.id), {
        class_label: class_label,
        section: sectionVal,
        day_scheme_id: day_scheme_id,
      });
    } else {
      const academic_session_id = (box.querySelector('#scsSessId').value || '').trim();
      if (!academic_session_id) {
        toast('Academic session id is required', 'error');
        return;
      }
      res = await _tt().post('/sections', {
        class_label: class_label,
        section: sectionVal,
        academic_session_id: academic_session_id,
        day_scheme_id: day_scheme_id,
      });
    }
    if (res && !res._error) {
      toast(isEdit ? 'Class updated' : 'Class created', 'success');
      _closeModal();
      await _reloadAndNotify();
      return;
    }
    toast((res && (res.message || res.error)) || 'Save failed', 'error');
  });
}

async function _reloadAndNotify() {
  await rosterLoadLists();
  const content = _root && _root.querySelector('#scsContent');
  if (content) rosterRender(content);
  if (_onChanged) _onChanged();
}

function _csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function _readFileAsBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = function () {
      reject(reader.error || new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}

function _authHeaders() {
  const session = getSession() || {};
  const headers = {};
  if (session.email) headers['X-User-Email'] = session.email;
  if (session.name) headers['X-User-Name'] = session.name;
  if (session.sessionToken) headers.Authorization = 'Bearer ' + session.sessionToken;
  return headers;
}

function _apiBase() {
  if (typeof location === 'undefined') return '';
  if (
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1') &&
    location.port === '3000'
  ) {
    return location.protocol + '//' + location.hostname + ':8080';
  }
  return location.origin || '';
}

/**
 * Download multi-sheet xlsx template from directory; CSV fallback for Students.
 */
export async function scsDownloadTemplate() {
  try {
    const res = await fetch(_apiBase() + '/api/directory/members/import-template', {
      method: 'GET',
      headers: _authHeaders(),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'blokschool-roster-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('Roster template downloaded (Students, Teachers, Periods, Classes)', 'success');
      return;
    }
  } catch (_) {
    /* fall through to CSV */
  }

  const headers = [
    'Admission Number',
    'First Name',
    'Last Name',
    'DOB',
    'Gender',
    'Admission Date',
    'Status',
    'Category',
    'Mother Name',
    'Father Name',
    'Guardian Contact',
    'Class',
    'Section',
    'Roll Number',
    'House',
  ];
  const sample = [
    'ADM-001',
    'Asha',
    'Rao',
    '2015-06-15',
    'female',
    '2025-04-01',
    'active',
    'GEN',
    'Meera',
    'Ravi',
    '9876543210',
    '5',
    'A',
    '12',
    'Blue',
  ];
  const csv = headers.join(',') + '\n' + sample.map(_csvEscape).join(',') + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blokschool-roster-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(
    'CSV template downloaded. Prefer the Excel template for Teachers, Periods, and Classes sheets.',
    'success',
  );
}

/**
 * Import roster: students → teachers → periods/classes.
 * @param {File} file
 */
export async function scsImportFile(file) {
  if (!file) return;
  const name = (file.name || '').toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(name)) {
    toast('Use an .xlsx, .xls, or .csv file', 'error');
    return;
  }

  try {
    const contentBase64 = await _readFileAsBase64(file);
    const payload = { filename: file.name, contentBase64: contentBase64 };

    const idRes = await _identity().post('/students/import', payload);
    if (!idRes || idRes._error || !idRes.success) {
      toast((idRes && (idRes.message || idRes.error)) || 'Student import failed', 'error');
      return;
    }

    const parts = [];
    if (idRes.created) parts.push(idRes.created + ' students');
    if (idRes.enrolled) parts.push(idRes.enrolled + ' enrolled');
    if (idRes.skipped) parts.push(idRes.skipped + ' skipped');
    if (idRes.errors && idRes.errors.length) {
      parts.push(idRes.errors.length + ' student errors');
    }

    const errors = [];
    (idRes.errors || []).forEach(function (e) {
      errors.push({
        row: e.row,
        field: e.field || 'Students',
        message: e.message,
      });
    });

    let teachersCreated = 0;
    let teachersSkipped = 0;
    const teachRes = await api.post('/api/directory/members/import', payload);
    if (teachRes && !teachRes._error && teachRes.success) {
      teachersCreated = teachRes.created || 0;
      teachersSkipped = teachRes.skipped || 0;
      if (teachersCreated) parts.push(teachersCreated + ' teachers');
      if (teachersSkipped) parts.push(teachersSkipped + ' teachers skipped');
      (teachRes.errors || []).forEach(function (e) {
        errors.push({
          row: e.row,
          field: e.field || 'Teachers',
          message: e.message,
        });
      });
    } else if (teachRes && teachRes._error) {
      parts.push('teacher import unavailable');
    }

    let daySchemesCreated = 0;
    let sectionsCreated = 0;
    let sectionsSkipped = 0;
    const ttParts = [];

    if (idRes.sessionId) {
      const ttRes = await _tt().post('/import', {
        filename: file.name,
        contentBase64: contentBase64,
        academic_session_id: idRes.sessionId,
      });
      if (ttRes && !ttRes._error && ttRes.success) {
        daySchemesCreated = ttRes.daySchemesCreated || 0;
        sectionsCreated = ttRes.sectionsCreated || 0;
        sectionsSkipped = ttRes.sectionsSkipped || 0;
        if (ttRes.daySchemesCreated) {
          ttParts.push(ttRes.daySchemesCreated + ' day schemes');
        }
        if (ttRes.sectionsCreated) ttParts.push(ttRes.sectionsCreated + ' classes');
        if (ttRes.sectionsSkipped) ttParts.push(ttRes.sectionsSkipped + ' classes skipped');
        if (ttRes.errors && ttRes.errors.length) {
          ttParts.push(ttRes.errors.length + ' timetable errors');
        }
        (ttRes.errors || []).forEach(function (e) {
          errors.push({
            row: e.row,
            field: e.field || e.sheet || 'Timetable',
            message: e.message,
          });
        });
      } else if (ttRes && ttRes._error) {
        ttParts.push('timetable import unavailable');
      }
    }

    _importResult = {
      created: idRes.created || 0,
      enrolled: idRes.enrolled || 0,
      skipped: idRes.skipped || 0,
      teachersCreated: teachersCreated,
      teachersSkipped: teachersSkipped,
      daySchemesCreated: daySchemesCreated,
      sectionsCreated: sectionsCreated,
      sectionsSkipped: sectionsSkipped,
      errors: errors,
    };

    const msg =
      'Import: ' +
      (parts.length ? parts.join(', ') : 'no student changes') +
      (ttParts.length ? ' · ' + ttParts.join(', ') : '');
    toast(msg, 'success');

    await _reloadAndNotify();
  } catch (err) {
    toast((err && err.message) || 'Import failed', 'error');
  }
}

/** Test helper */
export function rosterResetState() {
  _root = null;
  _mode = 'excel';
  _entity = 'students';
  _importResult = null;
  _students = [];
  _teachers = [];
  _daySchemes = [];
  _sections = [];
  _sessions = [];
  _studentsTotal = 0;
  _onChanged = null;
}
