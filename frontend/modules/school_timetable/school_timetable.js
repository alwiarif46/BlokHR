/**
 * modules/school_timetable/school_timetable.js
 * Office console: Classes | Grid | Cover — school-timetable service.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

const TABS = ['classes', 'grid', 'cover'];
const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

let _container = null;
let _tab = 'classes';
let _sections = [];
let _subjects = [];
let _allocations = [];
let _daySchemes = [];
let _terms = [];
let _slots = [];
let _covers = [];
let _fairness = [];
let _sectionId = '';
let _coverDate = '';
let _genFrom = '';
let _genTo = '';
let _loadError = '';
let _panel = 'sections';

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _today() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

function _tt() {
  return api.school('school-timetable');
}

function _err(res, fallback) {
  if (!res || res._error) return (res && (res.error || res.message)) || fallback;
  if (res.error) return typeof res.error === 'string' ? res.error : fallback;
  return null;
}

export function renderSchoolTimetablePage(container) {
  _container = container;
  _tab = 'classes';
  _panel = 'sections';
  _coverDate = _today();
  _genFrom = _today();
  _genTo = _today();
  _loadError = '';

  container.innerHTML =
    '<div class="stt-wrap" id="sttWrap">' +
    '<div class="stt-title">Timetable</div>' +
    '<div class="stt-tabs" id="sttTabs">' +
    TABS.map(function (t) {
      return (
        '<button type="button" class="stt-tab' +
        (t === _tab ? ' active' : '') +
        '" data-tab="' +
        t +
        '">' +
        _esc(t) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div class="stt-stats" id="sttStats"></div>' +
    '<div id="sttContent"></div>' +
    '</div>';

  container.querySelector('#sttTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.stt-tab');
    if (!btn || !btn.dataset.tab) return;
    sttSwitchTab(btn.dataset.tab);
  });

  container.addEventListener('click', _onClick);
  container.addEventListener('change', _onChange);
  container.addEventListener('submit', _onSubmit);

  sttLoadData();
}

export function sttSwitchTab(tab) {
  if (TABS.indexOf(tab) < 0) return;
  _tab = tab;
  _container.querySelectorAll('.stt-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  sttLoadData();
}

export async function sttLoadData() {
  _loadError = '';
  if (_tab === 'classes') await _loadClasses();
  else if (_tab === 'grid') await _loadGrid();
  else if (_tab === 'cover') await _loadCover();
  sttRenderStats();
  sttRender();
}

export function sttRenderStats() {
  const el = _container && _container.querySelector('#sttStats');
  if (!el) return;
  el.innerHTML =
    '<div class="stt-pill"><strong>' +
    _sections.length +
    '</strong> sections</div>' +
    '<div class="stt-pill"><strong>' +
    _subjects.length +
    '</strong> subjects</div>' +
    '<div class="stt-pill"><strong>' +
    _allocations.length +
    '</strong> allocations</div>' +
    (_tab === 'cover'
      ? '<div class="stt-pill"><strong>' + _covers.length + '</strong> cover rows</div>'
      : '');
}

export function sttRender() {
  const el = _container && _container.querySelector('#sttContent');
  if (!el) return;
  if (_loadError) {
    el.innerHTML = '<div class="stt-empty">' + _esc(_loadError) + '</div>';
    return;
  }
  if (_tab === 'classes') _renderClasses(el);
  else if (_tab === 'grid') _renderGrid(el);
  else if (_tab === 'cover') _renderCover(el);
}

async function _loadClasses() {
  const [sec, sub, alloc, schemes, terms] = await Promise.all([
    _tt().get('/sections'),
    _tt().get('/subjects'),
    _tt().get('/allocations'),
    _tt().get('/day-schemes'),
    _tt().get('/terms'),
  ]);
  const e =
    _err(sec, 'sections failed') ||
    _err(sub, 'subjects failed') ||
    _err(alloc, 'allocations failed');
  if (e) {
    _loadError = e;
    _sections = [];
    _subjects = [];
    _allocations = [];
    return;
  }
  _sections = sec.sections || [];
  _subjects = sub.subjects || [];
  _allocations = alloc.allocations || [];
  _daySchemes = (schemes && schemes.daySchemes) || schemes.day_schemes || [];
  _terms = (terms && terms.terms) || [];
  if (!_sectionId && _sections[0]) _sectionId = _sections[0].id;
}

async function _loadGrid() {
  await _loadClasses();
  if (_loadError) return;
  if (!_sectionId) {
    _slots = [];
    return;
  }
  const res = await _tt().get('/sections/' + encodeURIComponent(_sectionId) + '/slots');
  const e = _err(res, 'slots failed');
  if (e) {
    _loadError = e;
    _slots = [];
    return;
  }
  _slots = res.slots || [];
}

async function _loadCover() {
  const from = _coverDate;
  const to = _coverDate;
  const [cov, fair] = await Promise.all([
    _tt().get('/cover?date=' + encodeURIComponent(_coverDate)),
    _tt().get('/cover/fairness?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to)),
  ]);
  const e = _err(cov, 'cover failed');
  if (e) {
    _loadError = e;
    _covers = [];
    _fairness = [];
    return;
  }
  _covers = cov.covers || [];
  _fairness = (fair && fair.fairness) || [];
}

function _renderClasses(el) {
  const panels =
    '<div class="stt-subtabs">' +
    ['sections', 'subjects', 'allocations']
      .map(function (p) {
        return (
          '<button type="button" class="stt-subtab' +
          (_panel === p ? ' active' : '') +
          '" data-action="panel" data-panel="' +
          p +
          '">' +
          _esc(p) +
          '</button>'
        );
      })
      .join('') +
    '</div>';

  let body = '';
  if (_panel === 'sections') body = _sectionsPanel();
  else if (_panel === 'subjects') body = _subjectsPanel();
  else body = _allocationsPanel();

  el.innerHTML = panels + body;
}

function _sectionsPanel() {
  const schemeOpts = _daySchemes
    .map(function (s) {
      return '<option value="' + _esc(s.id) + '">' + _esc(s.label) + '</option>';
    })
    .join('');
  const rows = _sections
    .map(function (s) {
      return (
        '<tr><td>' +
        _esc(s.classLabel || s.class_label) +
        '</td><td>' +
        _esc(s.section) +
        '</td><td class="stt-mono">' +
        _esc(s.id) +
        '</td><td><button type="button" class="stt-btn ghost" data-action="del-section" data-id="' +
        _esc(s.id) +
        '">Delete</button></td></tr>'
      );
    })
    .join('');

  return (
    '<div class="stt-card">' +
    '<form class="stt-form" data-form="section">' +
    '<div class="stt-form-title">New section</div>' +
    '<input class="stt-input" name="class_label" placeholder="Class label (e.g. 8)" required />' +
    '<input class="stt-input" name="section" placeholder="Section (e.g. A)" required />' +
    '<input class="stt-input" name="academic_session_id" placeholder="Academic session id" required />' +
    '<select class="stt-input" name="day_scheme_id" required><option value="">Day scheme…</option>' +
    schemeOpts +
    '</select>' +
    '<input class="stt-input" name="class_teacher_member_id" placeholder="Class teacher member id (optional)" />' +
    '<button type="submit" class="stt-btn">Create section</button>' +
    '</form>' +
    (_daySchemes.length
      ? ''
      : '<div class="stt-hint">No day schemes yet — create one under Grid helpers or import from School Settings.</div>') +
    '<table class="stt-table"><thead><tr><th>Class</th><th>Section</th><th>Id</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4">No sections</td></tr>') +
    '</tbody></table></div>'
  );
}

function _subjectsPanel() {
  const rows = _subjects
    .map(function (s) {
      return (
        '<tr><td>' +
        _esc(s.code) +
        '</td><td>' +
        _esc(s.label) +
        '</td><td><button type="button" class="stt-btn ghost" data-action="del-subject" data-id="' +
        _esc(s.id) +
        '">Delete</button></td></tr>'
      );
    })
    .join('');
  return (
    '<div class="stt-card">' +
    '<form class="stt-form" data-form="subject">' +
    '<div class="stt-form-title">New subject</div>' +
    '<input class="stt-input" name="code" placeholder="Code" required />' +
    '<input class="stt-input" name="label" placeholder="Label" required />' +
    '<label class="stt-check"><input type="checkbox" name="is_elective" /> Elective</label>' +
    '<button type="submit" class="stt-btn">Create subject</button>' +
    '</form>' +
    '<table class="stt-table"><thead><tr><th>Code</th><th>Label</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="3">No subjects</td></tr>') +
    '</tbody></table></div>'
  );
}

function _allocationsPanel() {
  const secOpts = _sections
    .map(function (s) {
      return (
        '<option value="' +
        _esc(s.id) +
        '">' +
        _esc((s.classLabel || s.class_label) + '-' + s.section) +
        '</option>'
      );
    })
    .join('');
  const subOpts = _subjects
    .map(function (s) {
      return '<option value="' + _esc(s.id) + '">' + _esc(s.code + ' — ' + s.label) + '</option>';
    })
    .join('');
  const rows = _allocations
    .map(function (a) {
      const sec = _sections.find(function (s) {
        return s.id === a.sectionId || s.id === a.section_id;
      });
      const sub = _subjects.find(function (s) {
        return s.id === a.subjectId || s.id === a.subject_id;
      });
      return (
        '<tr><td>' +
        _esc(sec ? (sec.classLabel || sec.class_label) + '-' + sec.section : a.sectionId) +
        '</td><td>' +
        _esc(sub ? sub.code : a.subjectId) +
        '</td><td class="stt-mono">' +
        _esc(a.teacherMemberId || a.teacher_member_id) +
        '</td><td>' +
        _esc(String(a.periodsPerWeek ?? a.periods_per_week ?? '')) +
        '</td><td><button type="button" class="stt-btn ghost" data-action="del-alloc" data-id="' +
        _esc(a.id) +
        '">Delete</button></td></tr>'
      );
    })
    .join('');
  return (
    '<div class="stt-card">' +
    '<form class="stt-form" data-form="allocation">' +
    '<div class="stt-form-title">New allocation</div>' +
    '<select class="stt-input" name="section_id" required><option value="">Section…</option>' +
    secOpts +
    '</select>' +
    '<select class="stt-input" name="subject_id" required><option value="">Subject…</option>' +
    subOpts +
    '</select>' +
    '<input class="stt-input" name="teacher_member_id" placeholder="Teacher member id" required />' +
    '<input class="stt-input" name="periods_per_week" type="number" min="1" value="5" required />' +
    '<input class="stt-input" name="room" placeholder="Room (optional)" />' +
    '<button type="submit" class="stt-btn">Create allocation</button>' +
    '</form>' +
    '<table class="stt-table"><thead><tr><th>Section</th><th>Subject</th><th>Teacher</th><th>PPW</th><th></th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="5">No allocations</td></tr>') +
    '</tbody></table></div>'
  );
}

function _sectionScheme() {
  const sec = _sections.find(function (s) {
    return s.id === _sectionId;
  });
  if (!sec) return null;
  const sid = sec.daySchemeId || sec.day_scheme_id;
  return _daySchemes.find(function (d) {
    return d.id === sid;
  });
}

function _renderGrid(el) {
  const secOpts = _sections
    .map(function (s) {
      return (
        '<option value="' +
        _esc(s.id) +
        '"' +
        (s.id === _sectionId ? ' selected' : '') +
        '>' +
        _esc((s.classLabel || s.class_label) + '-' + s.section) +
        '</option>'
      );
    })
    .join('');

  const scheme = _sectionScheme();
  const periods = (scheme && scheme.periods) || [];
  const teaching = periods.filter(function (p) {
    return p.isTeaching !== false && p.is_teaching !== false;
  });
  const days =
    scheme && scheme.kind === 'cyclic'
      ? Array.from({ length: scheme.cycleLength || scheme.cycle_length || 1 }, function (_, i) {
          return 'd' + (i + 1);
        })
      : WEEK_DAYS;

  const allocForSection = _allocations.filter(function (a) {
    return (a.sectionId || a.section_id) === _sectionId;
  });
  const allocOpts =
    '<option value="">—</option>' +
    allocForSection
      .map(function (a) {
        const sub = _subjects.find(function (s) {
          return s.id === (a.subjectId || a.subject_id);
        });
        return (
          '<option value="' +
          _esc(a.id) +
          '">' +
          _esc(sub ? sub.code : a.id.slice(0, 8)) +
          '</option>'
        );
      })
      .join('');

  let gridHtml = '';
  if (!_sectionId) {
    gridHtml = '<div class="stt-empty">Create a section first.</div>';
  } else if (!teaching.length) {
    gridHtml =
      '<div class="stt-empty">Section has no day scheme periods. Create a day scheme below.</div>';
  } else {
    gridHtml = '<div class="stt-grid-wrap"><table class="stt-grid"><thead><tr><th>Period</th>';
    days.forEach(function (d) {
      gridHtml += '<th>' + _esc(d) + '</th>';
    });
    gridHtml += '</tr></thead><tbody>';
    teaching.forEach(function (p) {
      const idx = p.index;
      gridHtml += '<tr><td>' + _esc(p.label || String(idx)) + '</td>';
      days.forEach(function (d) {
        const slot = _slots.find(function (s) {
          return (s.dayRef || s.day_ref) === d && Number(s.periodIndex ?? s.period_index) === idx;
        });
        const val = slot ? slot.allocationId || slot.allocation_id : '';
        gridHtml +=
          '<td><select class="stt-cell" data-day="' +
          _esc(d) +
          '" data-period="' +
          idx +
          '">' +
          allocOpts.replace(
            'value="' + _esc(val) + '"',
            'value="' + _esc(val) + '" selected',
          ) +
          '</select></td>';
      });
      gridHtml += '</tr>';
    });
    gridHtml += '</tbody></table></div>';
  }

  const schemeForm =
    '<form class="stt-form inline" data-form="day-scheme">' +
    '<div class="stt-form-title">Quick day scheme (Mon–Fri, 4 periods)</div>' +
    '<input class="stt-input" name="label" placeholder="Label" value="Mon-Fri" required />' +
    '<button type="submit" class="stt-btn ghost">Create default scheme</button>' +
    '</form>';

  el.innerHTML =
    '<div class="stt-toolbar">' +
    '<label>Section <select class="stt-input" id="sttSectionPick">' +
    '<option value="">Select…</option>' +
    secOpts +
    '</select></label>' +
    '<button type="button" class="stt-btn" data-action="save-slots">Save grid</button>' +
    '<input class="stt-input" type="date" id="sttGenFrom" value="' +
    _esc(_genFrom) +
    '" />' +
    '<input class="stt-input" type="date" id="sttGenTo" value="' +
    _esc(_genTo) +
    '" />' +
    '<button type="button" class="stt-btn ghost" data-action="gen-instances">Generate instances</button>' +
    '</div>' +
    gridHtml +
    schemeForm;
}

function _renderCover(el) {
  const fair =
    '<div class="stt-fair">' +
    (_fairness.length
      ? _fairness
          .map(function (f) {
            return (
              '<span class="stt-pill">' +
              _esc(f.teacherMemberId || f.teacher_member_id) +
              ': <strong>' +
              _esc(String(f.acceptedCount ?? f.accepted_count ?? 0)) +
              '</strong></span>'
            );
          })
          .join('')
      : '<span class="stt-hint">No fairness data for this date</span>') +
    '</div>';

  const rows = _covers
    .map(function (c) {
      return (
        '<tr data-cover-id="' +
        _esc(c.id) +
        '"><td class="stt-mono">' +
        _esc(c.id.slice(0, 8)) +
        '</td><td>' +
        _esc(c.state) +
        '</td><td class="stt-mono">' +
        _esc(c.coverTeacherMemberId || c.cover_teacher_member_id || '—') +
        '</td><td class="stt-actions">' +
        '<input class="stt-input tiny" data-offer-for="' +
        _esc(c.id) +
        '" placeholder="Teacher member id" />' +
        '<button type="button" class="stt-btn ghost" data-action="offer-cover" data-id="' +
        _esc(c.id) +
        '">Offer</button>' +
        '<button type="button" class="stt-btn ghost" data-action="accept-cover" data-id="' +
        _esc(c.id) +
        '">Accept</button>' +
        '<button type="button" class="stt-btn ghost" data-action="decline-cover" data-id="' +
        _esc(c.id) +
        '">Decline</button>' +
        '<button type="button" class="stt-btn ghost" data-action="uncover" data-id="' +
        _esc(c.id) +
        '">Uncovered</button>' +
        '</td></tr>'
      );
    })
    .join('');

  el.innerHTML =
    '<div class="stt-toolbar">' +
    '<label>Date <input class="stt-input" type="date" id="sttCoverDate" value="' +
    _esc(_coverDate) +
    '" /></label>' +
    '</div>' +
    fair +
    '<form class="stt-form" data-form="absence">' +
    '<div class="stt-form-title">Record teacher absence</div>' +
    '<input class="stt-input" name="teacher_member_id" placeholder="Teacher member id" required />' +
    '<input class="stt-input" name="date" type="date" value="' +
    _esc(_coverDate) +
    '" required />' +
    '<input class="stt-input" name="reason" placeholder="Reason" required />' +
    '<button type="submit" class="stt-btn">Create absence</button>' +
    '</form>' +
    '<table class="stt-table"><thead><tr><th>Cover</th><th>State</th><th>Offered to</th><th>Actions</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4">No cover rows</td></tr>') +
    '</tbody></table>';
}

async function _onClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'panel') {
    _panel = btn.dataset.panel;
    sttRender();
    return;
  }
  if (action === 'del-section') {
    const res = await _tt().del('/sections/' + encodeURIComponent(id));
    if (_err(res, 'delete failed')) toast(_err(res), 'error');
    else {
      toast('Section deleted', 'success');
      sttLoadData();
    }
    return;
  }
  if (action === 'del-subject') {
    const res = await _tt().del('/subjects/' + encodeURIComponent(id));
    if (_err(res, 'delete failed')) toast(_err(res), 'error');
    else {
      toast('Subject deleted', 'success');
      sttLoadData();
    }
    return;
  }
  if (action === 'del-alloc') {
    const res = await _tt().del('/allocations/' + encodeURIComponent(id));
    if (_err(res, 'delete failed')) toast(_err(res), 'error');
    else {
      toast('Allocation deleted', 'success');
      sttLoadData();
    }
    return;
  }
  if (action === 'save-slots') {
    await _saveSlots();
    return;
  }
  if (action === 'gen-instances') {
    const fromEl = _container.querySelector('#sttGenFrom');
    const toEl = _container.querySelector('#sttGenTo');
    _genFrom = fromEl ? fromEl.value : _genFrom;
    _genTo = toEl ? toEl.value : _genTo;
    if (!_sectionId) {
      toast('Select a section', 'warn');
      return;
    }
    const res = await _tt().post(
      '/sections/' + encodeURIComponent(_sectionId) + '/instances/generate',
      { from: _genFrom, to: _genTo },
    );
    if (_err(res, 'generate failed')) toast(_err(res), 'error');
    else
      toast(
        'Generated: ' +
          (res.created || 0) +
          ' created, ' +
          (res.lost || 0) +
          ' lost, ' +
          (res.skipped || 0) +
          ' skipped',
        'success',
      );
    return;
  }
  if (action === 'offer-cover') {
    const input = _container.querySelector('[data-offer-for="' + id + '"]');
    const teacher = input ? input.value.trim() : '';
    if (!teacher) {
      toast('Enter cover teacher member id', 'warn');
      return;
    }
    const res = await _tt().post('/cover/' + encodeURIComponent(id) + '/offer', {
      cover_teacher_member_id: teacher,
    });
    if (_err(res, 'offer failed')) toast(_err(res), 'error');
    else {
      toast('Cover offered', 'success');
      sttLoadData();
    }
    return;
  }
  if (action === 'accept-cover' || action === 'decline-cover') {
    const res = await _tt().post('/cover/' + encodeURIComponent(id) + '/respond', {
      accept: action === 'accept-cover',
    });
    if (_err(res, 'respond failed')) toast(_err(res), 'error');
    else {
      toast(action === 'accept-cover' ? 'Accepted' : 'Declined', 'success');
      sttLoadData();
    }
    return;
  }
  if (action === 'uncover') {
    const res = await _tt().post('/cover/' + encodeURIComponent(id) + '/mark-uncovered', {});
    if (_err(res, 'uncover failed')) toast(_err(res), 'error');
    else {
      toast('Marked uncovered', 'success');
      sttLoadData();
    }
  }
}

function _onChange(e) {
  if (e.target.id === 'sttSectionPick') {
    _sectionId = e.target.value;
    sttLoadData();
    return;
  }
  if (e.target.id === 'sttCoverDate') {
    _coverDate = e.target.value;
    sttLoadData();
  }
}

async function _onSubmit(e) {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const fd = new FormData(form);
  const kind = form.dataset.form;

  if (kind === 'section') {
    const res = await _tt().post('/sections', {
      class_label: String(fd.get('class_label') || ''),
      section: String(fd.get('section') || ''),
      academic_session_id: String(fd.get('academic_session_id') || ''),
      day_scheme_id: String(fd.get('day_scheme_id') || ''),
      class_teacher_member_id: String(fd.get('class_teacher_member_id') || '') || null,
    });
    if (_err(res, 'create failed')) toast(_err(res), 'error');
    else {
      toast('Section created', 'success');
      sttLoadData();
    }
    return;
  }
  if (kind === 'subject') {
    const res = await _tt().post('/subjects', {
      code: String(fd.get('code') || ''),
      label: String(fd.get('label') || ''),
      is_elective: form.querySelector('[name="is_elective"]').checked,
    });
    if (_err(res, 'create failed')) toast(_err(res), 'error');
    else {
      toast('Subject created', 'success');
      sttLoadData();
    }
    return;
  }
  if (kind === 'allocation') {
    const res = await _tt().post('/allocations', {
      section_id: String(fd.get('section_id') || ''),
      subject_id: String(fd.get('subject_id') || ''),
      teacher_member_id: String(fd.get('teacher_member_id') || ''),
      periods_per_week: Number(fd.get('periods_per_week') || 0),
      room: String(fd.get('room') || '') || null,
    });
    if (_err(res, 'create failed')) toast(_err(res), 'error');
    else {
      toast('Allocation created', 'success');
      sttLoadData();
    }
    return;
  }
  if (kind === 'day-scheme') {
    const periods = [0, 1, 2, 3].map(function (i) {
      return {
        index: i,
        label: 'P' + (i + 1),
        start_time: String(8 + i).padStart(2, '0') + ':00',
        end_time: String(8 + i).padStart(2, '0') + ':45',
        is_teaching: true,
      };
    });
    const res = await _tt().post('/day-schemes', {
      label: String(fd.get('label') || 'Mon-Fri'),
      kind: 'weekly',
      periods: periods,
    });
    if (_err(res, 'scheme failed')) toast(_err(res), 'error');
    else {
      toast('Day scheme created', 'success');
      sttLoadData();
    }
    return;
  }
  if (kind === 'absence') {
    const res = await _tt().post('/absences', {
      teacher_member_id: String(fd.get('teacher_member_id') || ''),
      date: String(fd.get('date') || ''),
      reason: String(fd.get('reason') || ''),
    });
    if (_err(res, 'absence failed')) toast(_err(res), 'error');
    else {
      toast('Absence recorded (' + ((res.covers && res.covers.length) || 0) + ' covers)', 'success');
      _coverDate = String(fd.get('date') || _coverDate);
      sttLoadData();
    }
  }
}

async function _saveSlots() {
  if (!_sectionId) {
    toast('Select a section', 'warn');
    return;
  }
  const cells = _container.querySelectorAll('.stt-cell');
  const inputs = [];
  cells.forEach(function (sel) {
    if (!sel.value) return;
    inputs.push({
      day_ref: sel.dataset.day,
      period_index: Number(sel.dataset.period),
      allocation_id: sel.value,
    });
  });
  const res = await _tt().put(
    '/sections/' + encodeURIComponent(_sectionId) + '/slots',
    inputs,
  );
  if (_err(res, 'save failed')) {
    const msg = _err(res);
    toast(res.clashes ? msg + ' (clashes)' : msg, 'error');
  } else {
    toast('Grid saved', 'success');
    sttLoadData();
  }
}

export function _getState() {
  return {
    tab: _tab,
    sections: _sections,
    subjects: _subjects,
    allocations: _allocations,
    slots: _slots,
    covers: _covers,
  };
}

export function _resetState() {
  _container = null;
  _tab = 'classes';
  _sections = [];
  _subjects = [];
  _allocations = [];
  _slots = [];
  _covers = [];
  _sectionId = '';
}

registerModule('school_timetable', renderSchoolTimetablePage);
