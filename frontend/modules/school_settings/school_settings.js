/**
 * modules/school_settings/school_settings.js
 *
 * School Settings (admin + school_vertical): Roster Hub | Academic Sessions |
 * State Pack | Consent Overview | Syllabus Packs | Attendance Policy |
 * Eligibility | Nudge.
 *
 * Pattern: renderSchoolSettingsPage() → scsLoadData() → scsRenderStats()
 *          → scsRender() → actions → scsCloseModal()
 *
 * Boundaries:
 * - Roster (Excel + manual students/teachers/periods/classes) lives here.
 * - Attendance policy / eligibility / nudge live here (ops Registers + Unexplained
 *   stay in school_attendance_admin).
 * - HR tenant settings → settings module (unchanged).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { navigateToModule, registerModule } from '../../shared/router.js';
import {
  rosterReset,
  rosterLoadLists,
  rosterRender,
  rosterGetStats,
  rosterSetSessions,
  rosterResetState,
  scsDownloadTemplate as rosterDownloadTemplate,
  scsImportFile as rosterImportFile,
} from './roster_hub.js';

const TABS = [
  'roster',
  'sessions',
  'state_pack',
  'consent',
  'syllabus',
  'attendance_policy',
  'eligibility',
  'nudge',
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const CONSENT_KINDS = ['apaar', 'dpdp_processing', 'biometric', 'photo', 'transport_gps'];
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
const UPLOAD_BOARDS = ['cbse', 'icse', 'state', 'ib', 'cambridge'];

const GRANULARITY_LABELS = {
  day: 'Day',
  session: 'Session',
  period: 'Period',
};
const GRANULARITY_HELP = {
  day: 'One mark covers the whole school day (simplest office workflow).',
  session: 'Separate AM/PM marks — use when morning and afternoon differ.',
  period: 'Mark per timetable period — required for period-level roll call.',
};
const DERIVATION_LABELS = {
  any_absent: 'Any absent',
  majority: 'Majority',
  half_day_minutes: 'Half-day minutes',
};
const DERIVATION_HELP = {
  any_absent: 'A day counts absent if any period that day is absent.',
  majority: 'A day counts present only when a majority of marked periods are present/late.',
  half_day_minutes: 'Day status derives from minutes on campus vs the half-day threshold.',
};

let _container = null;
let _tab = 'import';
let _sessions = [];
let _statePacks = [];
let _tenantPack = { packCode: null, pack: null };
let _selectedPackCode = '';
let _selectedPackDetail = null;
let _consentSummary = {};
let _studentsTotal = 0;
let _importResult = null;
let _rosterTeachers = 0;
let _rosterSchemes = 0;
let _rosterSections = 0;
let _syllabusPacks = [];
let _syllabusInstalled = [];
let _syllabusDetail = null;
let _syllabusInstallResult = null;
let _syllabusInstallPackId = '';
let _syllabusUploadResult = null;
let _attSettings = null;
let _eligibility = [];
let _eligThreshold = 75;
let _eligFrom = '';
let _eligTo = '';
let _eligClass = '';
let _eligLoading = false;
let _eligCapped = false;
let _nudgeConfig = null;
let _nudgeReport = null;

function _identity(tenantScoped) {
  return api.school('school-identity', tenantScoped !== false);
}

function _academics(tenantScoped) {
  return api.school('school-academics', tenantScoped !== false);
}

function _attendance() {
  return api.school('school-attendance');
}

function _today() {
  return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
}

function _esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function _tabLabel(t) {
  if (t === 'roster') return 'Roster';
  if (t === 'import') return 'Roster';
  if (t === 'sessions') return 'Academic Sessions';
  if (t === 'state_pack') return 'State Pack';
  if (t === 'consent') return 'Consent Overview';
  if (t === 'syllabus') return 'Syllabus Packs';
  if (t === 'attendance_policy') return 'Attendance Policy';
  if (t === 'eligibility') return 'Eligibility';
  if (t === 'nudge') return 'Nudge';
  return t;
}

function _normalizeTab(t) {
  if (t === 'import') return 'roster';
  return t;
}

/**
 * Client-side settings validation mirroring school-attendance rules.
 * @param {object} fields
 * @returns {string|null}
 */
export function validateSettingsFields(fields) {
  const g = fields.granularity;
  if (!['day', 'session', 'period'].includes(g)) {
    return 'granularity must be day, session, or period';
  }
  const edit = Number(fields.edit_window_minutes);
  if (!Number.isInteger(edit) || edit < 0 || edit > 1440) {
    return 'edit_window_minutes must be an integer between 0 and 1440';
  }
  const late = Number(fields.late_threshold_minutes);
  if (!Number.isInteger(late) || late < 5 || late > 120) {
    return 'late_threshold_minutes must be an integer between 5 and 120';
  }
  const half = Number(fields.half_day_min_minutes);
  if (!Number.isInteger(half) || half < 60 || half > 360) {
    return 'half_day_min_minutes must be an integer between 60 and 360';
  }
  if (!['any_absent', 'majority', 'half_day_minutes'].includes(fields.day_derivation)) {
    return 'day_derivation must be any_absent, majority, or half_day_minutes';
  }
  return null;
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolSettingsPage(container) {
  _container = container;
  _tab = 'roster';
  _sessions = [];
  _statePacks = [];
  _tenantPack = { packCode: null, pack: null };
  _selectedPackCode = '';
  _selectedPackDetail = null;
  _consentSummary = {};
  _studentsTotal = 0;
  _importResult = null;
  _rosterTeachers = 0;
  _rosterSchemes = 0;
  _rosterSections = 0;
  _syllabusPacks = [];
  _syllabusInstalled = [];
  _syllabusDetail = null;
  _syllabusInstallResult = null;
  _syllabusInstallPackId = '';
  _syllabusUploadResult = null;
  _attSettings = null;
  _eligibility = [];
  _eligClass = '';
  _eligLoading = false;
  _eligCapped = false;
  _nudgeConfig = null;
  _nudgeReport = null;

  const sessionYear = new Date().getFullYear();
  _eligFrom = sessionYear + '-04-01';
  _eligTo = sessionYear + 1 + '-03-31';
  _eligThreshold = 75;

  try {
    const openTab = sessionStorage.getItem('scs_open_tab');
    const normalized = openTab ? _normalizeTab(openTab) : null;
    if (normalized && TABS.indexOf(normalized) >= 0) {
      sessionStorage.removeItem('scs_open_tab');
      _tab = normalized;
    }
  } catch (_) {
    /* ignore */
  }

  rosterReset({
    root: container,
    sessions: _sessions,
    onChanged: function () {
      const stats = rosterGetStats();
      _studentsTotal = stats.studentsTotal || _studentsTotal;
      _rosterTeachers = stats.teachers || 0;
      _rosterSchemes = stats.daySchemes || 0;
      _rosterSections = stats.sections || 0;
      scsRenderStats();
    },
  });

  container.innerHTML =
    '<div class="scs-wrap" id="scsWrap">' +
    '<div class="scs-title">School Settings</div>' +
    '<div class="scs-tabs" id="scsTabs">' +
    TABS.map(function (t) {
      return (
        '<button type="button" class="scs-tab' +
        (t === _tab ? ' active' : '') +
        '" data-tab="' +
        t +
        '">' +
        _esc(_tabLabel(t)) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div class="scs-stats" id="scsStats"></div>' +
    '<div id="scsContent"></div>' +
    '<div class="scs-modal" id="scsModal"><div class="scs-modal-box" id="scsModalBox"></div></div>' +
    '</div>';

  container.querySelector('#scsTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.scs-tab');
    if (!btn || !btn.dataset.tab) return;
    scsSwitchTab(btn.dataset.tab);
  });

  const modal = container.querySelector('#scsModal');
  modal.addEventListener('click', function (e) {
    if (e.target === modal) scsCloseModal();
  });

  scsLoadData();
}

/**
 * @param {string} tab
 */
export function scsSwitchTab(tab) {
  const normalized = _normalizeTab(tab);
  if (TABS.indexOf(normalized) < 0) return;
  _tab = normalized;
  _container.querySelectorAll('.scs-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === normalized);
  });
  scsLoadData();
}

/**
 * Load shared stats + active tab data.
 */
export async function scsLoadData() {
  const id = _identity();
  const unscoped = _identity(false);
  const academics = _academics();
  const academicsOpen = _academics(false);

  const [sessionsRes, packRes, packsRes, studentsRes, consentRes, sylRes, installedRes] =
    await Promise.all([
      id.get('/sessions'),
      id.get('/state-pack'),
      unscoped.get('/state-packs'),
      id.get('/students?limit=1&offset=0'),
      id.get('/consents/summary'),
      academicsOpen.get('/packs'),
      academics.get('/packs/installed'),
    ]);

  if (sessionsRes && !sessionsRes._error) {
    _sessions = sessionsRes.sessions || [];
  } else if (sessionsRes && sessionsRes._error) {
    toast(sessionsRes.message || 'Could not load sessions', 'error');
    _sessions = [];
  }

  if (packRes && !packRes._error) {
    _tenantPack = {
      packCode: packRes.packCode || null,
      pack: packRes.pack || null,
    };
  } else {
    _tenantPack = { packCode: null, pack: null };
  }

  if (packsRes && !packsRes._error) {
    _statePacks = packsRes.packs || [];
  } else {
    _statePacks = [];
  }

  if (studentsRes && !studentsRes._error) {
    _studentsTotal = Number(studentsRes.total) || 0;
  } else {
    _studentsTotal = 0;
  }

  if (consentRes && !consentRes._error) {
    _consentSummary = consentRes.summary || {};
  } else {
    _consentSummary = {};
  }

  if (sylRes && !sylRes._error) {
    _syllabusPacks = sylRes.packs || [];
  } else {
    _syllabusPacks = [];
  }

  if (installedRes && !installedRes._error) {
    _syllabusInstalled = installedRes.installed || [];
  } else {
    _syllabusInstalled = [];
  }

  if (!_selectedPackCode) {
    _selectedPackCode = _tenantPack.packCode || (_statePacks[0] && _statePacks[0].code) || '';
  }

  if (_tab === 'state_pack' && _selectedPackCode) {
    await scsLoadPackDetail(_selectedPackCode);
  }

  if (_tab === 'roster') {
    rosterSetSessions(_sessions);
    await rosterLoadLists();
    const stats = rosterGetStats();
    if (stats.studentsTotal) _studentsTotal = stats.studentsTotal;
    _rosterTeachers = stats.teachers || 0;
    _rosterSchemes = stats.daySchemes || 0;
    _rosterSections = stats.sections || 0;
  }

  if (_tab === 'attendance_policy') {
    await _loadAttSettings();
  } else if (_tab === 'nudge') {
    await _loadNudge();
  }
  // eligibility: do not auto-fetch — empty state until Run report

  scsRenderStats();
  scsRender();
}

async function _loadAttSettings() {
  const res = await _attendance().get('/settings');
  if (res && !res._error) {
    _attSettings = res.settings || res;
  } else {
    _attSettings = null;
    if (res && res._error) toast(res.message || 'Could not load attendance settings', 'error');
  }
}

async function _loadNudge() {
  const [cfg, report] = await Promise.all([
    _attendance().get('/nudge/config'),
    _attendance().get('/nudge/report'),
  ]);
  _nudgeConfig = cfg && !cfg._error ? cfg.config || cfg : null;
  if (cfg && cfg._error) toast(cfg.message || 'Could not load nudge config', 'error');
  _nudgeReport = report && !report._error ? report : null;
  if (report && report._error) toast(report.message || 'Could not load nudge report', 'error');
}

/**
 * @param {string} code
 */
export async function scsLoadPackDetail(code) {
  const res = await _identity(false).get('/state-packs/' + encodeURIComponent(code));
  if (res && !res._error) {
    _selectedPackDetail = res;
    _selectedPackCode = code;
  } else {
    _selectedPackDetail = null;
    if (res && res._error) toast(res.message || 'Could not load pack', 'error');
  }
}

export function scsRenderStats() {
  const el = _container && _container.querySelector('#scsStats');
  if (!el) return;

  const current = _sessions.find(function (s) {
    return s.isCurrent;
  });
  const packLabel = _tenantPack.packCode || 'not set';
  const dpdp = _consentSummary.dpdp_processing || {};
  const granted = Number(dpdp.granted) || 0;
  const refused = Number(dpdp.refused) || 0;
  const withdrawn = Number(dpdp.withdrawn) || 0;
  const notSought = Number(dpdp.not_sought) || 0;
  const total = granted + refused + withdrawn + notSought;
  const pct = total ? Math.round((granted / total) * 100) : 0;

  el.innerHTML =
    '<span class="scs-pill' +
    (current ? ' current' : '') +
    '">Sessions <strong id="scsStatSessions">' +
    _esc(String(_sessions.length)) +
    '</strong>' +
    (current ? ' · current ' + _esc(current.label) : '') +
    '</span>' +
    '<span class="scs-pill">State pack <strong id="scsStatPack">' +
    _esc(packLabel) +
    '</strong></span>' +
    '<span class="scs-pill">Students <strong id="scsStatStudents">' +
    _esc(String(_studentsTotal)) +
    '</strong></span>' +
    '<span class="scs-pill">Teachers <strong id="scsStatTeachers">' +
    _esc(String(_rosterTeachers)) +
    '</strong></span>' +
    '<span class="scs-pill">Classes <strong id="scsStatClasses">' +
    _esc(String(_rosterSections)) +
    '</strong></span>' +
    '<span class="scs-pill">DPDP granted <strong id="scsStatDpdp">' +
    _esc(String(pct)) +
    '%</strong></span>';
}

export function scsRender() {
  const content = _container && _container.querySelector('#scsContent');
  if (!content) return;

  if (_tab === 'roster') rosterRender(content);
  else if (_tab === 'sessions') _renderSessions(content);
  else if (_tab === 'state_pack') _renderStatePack(content);
  else if (_tab === 'consent') _renderConsent(content);
  else if (_tab === 'syllabus') _renderSyllabus(content);
  else if (_tab === 'attendance_policy') _renderAttendancePolicy(content);
  else if (_tab === 'eligibility') _renderEligibility(content);
  else if (_tab === 'nudge') _renderNudge(content);
  else {
    const _exhaustive = _tab;
    void _exhaustive;
  }
}

function _renderSessions(content) {
  const rows = _sessions.length
    ? _sessions
        .map(function (s) {
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc(s.label) +
            '</td>' +
            '<td>' +
            _esc(s.startsOn || s.starts_on || '') +
            '</td>' +
            '<td>' +
            _esc(s.endsOn || s.ends_on || '') +
            '</td>' +
            '<td>' +
            (s.isCurrent
              ? '<span class="scs-badge current">current</span>'
              : '') +
            '</td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="4" class="scs-empty">No academic sessions yet</td></tr>';

  content.innerHTML =
    '<div class="scs-panel-note" id="scsSessionNote">' +
    'Marking a session current unmarks the previous session.' +
    '</div>' +
    '<table class="scs-table"><thead><tr>' +
    '<th>Label</th><th>Starts</th><th>Ends</th><th></th>' +
    '</tr></thead><tbody>' +
    rows +
    '</tbody></table>' +
    '<form id="scsSessionForm" style="margin-top:18px">' +
    '<div class="scs-grid">' +
    '<div class="scs-field"><label for="scsSessLabel">Label</label>' +
    '<input id="scsSessLabel" name="label" placeholder="2025-26" autocomplete="off"></div>' +
    '<div class="scs-field"><label for="scsSessCurrent">Current</label>' +
    '<label style="display:flex;align-items:center;gap:8px;margin-top:6px;text-transform:none;font-size:12px;color:var(--tx2)">' +
    '<input type="checkbox" id="scsSessCurrent" name="is_current"> Mark as current session' +
    '</label></div>' +
    '<div class="scs-field"><label for="scsSessStart">Starts on</label>' +
    '<input type="date" id="scsSessStart" name="starts_on"></div>' +
    '<div class="scs-field"><label for="scsSessEnd">Ends on</label>' +
    '<input type="date" id="scsSessEnd" name="ends_on"></div>' +
    '</div>' +
    '<p class="scs-help" id="scsSessionHelp">Marking this current unmarks the previous session.</p>' +
    '<div class="scs-form-actions">' +
    '<button type="button" class="scs-btn" id="scsSessSave">Create session</button>' +
    '</div></form>';

  content.querySelector('#scsSessSave').addEventListener('click', function () {
    scsCreateSession();
  });
}

function _renderStatePack(content) {
  const list = _statePacks
    .map(function (p) {
      const active = p.code === (_tenantPack.packCode || '');
      const selected = p.code === _selectedPackCode;
      return (
        '<div class="scs-pack-row' +
        (selected ? ' active' : '') +
        '" data-pack="' +
        _esc(p.code) +
        '">' +
        '<div class="scs-pack-meta">' +
        '<div class="scs-name">' +
        _esc(p.label || p.code) +
        '</div>' +
        '<div class="scs-help">' +
        _esc(p.code) +
        (active ? ' · tenant pack' : '') +
        '</div></div>' +
        '<div>' +
        (active
          ? '<span class="scs-badge current">active</span>'
          : '<button type="button" class="scs-btn ghost" data-set-pack="' +
            _esc(p.code) +
            '">Use pack</button>') +
        '</div></div>'
      );
    })
    .join('');

  let detail = '<div class="scs-empty">Select a pack</div>';
  if (_selectedPackDetail) {
    const d = _selectedPackDetail;
    const cats = (d.categories || [])
      .map(function (c) {
        return '<li>' + _esc(c.code) + ' — ' + _esc(c.label) + '</li>';
      })
      .join('');
    const idField = d.studentIdField
      ? _esc(d.studentIdField.label) +
        ' · pattern <code>' +
        _esc(d.studentIdField.pattern) +
        '</code>'
      : 'None';
    const grades = (d.gradeSchemes || [])
      .map(function (g) {
        return (
          '<li>' +
          _esc(g.board) +
          ': ' +
          _esc((g.labels || []).join(', ')) +
          '</li>'
        );
      })
      .join('');
    detail =
      '<div class="scs-pack-detail" id="scsPackDetail">' +
      '<h4>' +
      _esc(d.label || d.code) +
      '</h4>' +
      '<div class="scs-help">Categories</div><ul id="scsPackCats">' +
      (cats || '<li>None</li>') +
      '</ul>' +
      '<div class="scs-help">Student ID field</div><p id="scsPackId">' +
      idField +
      '</p>' +
      '<div class="scs-help">Grade schemes</div><ul id="scsPackGrades">' +
      (grades || '<li>None</li>') +
      '</ul></div>';
  }

  content.innerHTML =
    '<div class="scs-panel-note">' +
    'Changing pack only affects validation for new students. Existing records are not revalidated.' +
    '</div>' +
    '<div class="scs-pack-list" id="scsPackList">' +
    (list || '<div class="scs-empty">No state packs available</div>') +
    '</div>' +
    detail;

  content.querySelectorAll('[data-pack]').forEach(function (row) {
    row.addEventListener('click', function (e) {
      if (e.target.closest('[data-set-pack]')) return;
      const code = row.getAttribute('data-pack');
      if (!code) return;
      scsSelectPack(code);
    });
  });

  content.querySelectorAll('[data-set-pack]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      scsSetTenantPack(btn.getAttribute('data-set-pack'));
    });
  });
}

function _renderConsent(content) {
  const rows = CONSENT_KINDS.map(function (kind) {
    const s = _consentSummary[kind] || {};
    return (
      '<tr data-consent-kind="' +
      _esc(kind) +
      '">' +
      '<td class="scs-name">' +
      _esc(kind) +
      '</td>' +
      '<td>' +
      _esc(String(s.granted || 0)) +
      '</td>' +
      '<td>' +
      _esc(String(s.refused || 0)) +
      '</td>' +
      '<td>' +
      _esc(String(s.withdrawn || 0)) +
      '</td>' +
      '<td>' +
      _esc(String(s.not_sought || 0)) +
      '</td>' +
      '<td><button type="button" class="scs-link" data-go-students>View in Students</button></td>' +
      '</tr>'
    );
  }).join('');

  content.innerHTML =
    '<div class="scs-panel-note" id="scsConsentNote">' +
    'Refusal does not block any service.' +
    '</div>' +
    '<table class="scs-table" id="scsConsentTable"><thead><tr>' +
    '<th>Kind</th><th>Granted</th><th>Refused</th><th>Withdrawn</th><th>Not sought</th><th></th>' +
    '</tr></thead><tbody>' +
    rows +
    '</tbody></table>';

  content.querySelectorAll('[data-go-students]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('school_students');
    });
  });
}

function _renderSyllabus(content) {
  const sessionOpts = _sessions
    .map(function (s) {
      return (
        '<option value="' +
        _esc(s.id) +
        '">' +
        _esc(s.label) +
        (s.isCurrent ? ' (current)' : '') +
        '</option>'
      );
    })
    .join('');

  const boardOpts = UPLOAD_BOARDS.map(function (b) {
    return '<option value="' + b + '">' + b.toUpperCase() + '</option>';
  }).join('');

  const classChecks = CLASS_PROBE.map(function (c) {
    return (
      '<label class="scs-check"><input type="checkbox" name="syl_upload_class" value="' +
      _esc(c) +
      '"> ' +
      _esc(c) +
      '</label>'
    );
  }).join('');

  const registryRows = _syllabusPacks.length
    ? _syllabusPacks
        .map(function (p) {
          const sampleBadge =
            p.status === 'sample'
              ? '<span class="scs-badge sample" title="Placeholder structure — not official board content" id="scsSample-' +
                _esc(p.id) +
                '">SAMPLE</span>'
              : '';
          return (
            '<tr data-syl-pack="' +
            _esc(p.id) +
            '">' +
            '<td class="scs-name">' +
            _esc(p.label || p.id) +
            '</td>' +
            '<td><span class="scs-badge">' +
            _esc(p.family || p.board || '') +
            '</span></td>' +
            '<td>' +
            _esc(p.academic_year || '') +
            '</td>' +
            '<td>' +
            _esc((p.classes || []).join(', ')) +
            '</td>' +
            '<td>' +
            _esc((p.subjects || []).join(', ')) +
            '</td>' +
            '<td>' +
            sampleBadge +
            '</td>' +
            '<td><button type="button" class="scs-btn ghost" data-install-pack="' +
            _esc(p.id) +
            '">Install</button></td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="7" class="scs-empty">No syllabus packs in registry</td></tr>';

  const installedRows = _syllabusInstalled.length
    ? _syllabusInstalled
        .map(function (row) {
          const update = row.update_available
            ? '<button type="button" class="scs-badge update" data-update-pack="' +
              _esc(row.update_available) +
              '">Update available → ' +
              _esc(row.update_available) +
              '</button>'
            : '';
          return (
            '<tr>' +
            '<td class="scs-name">' +
            _esc(row.pack_id) +
            '</td>' +
            '<td>' +
            _esc(row.academic_session_id) +
            '</td>' +
            '<td>' +
            _esc(String(row.course_count != null ? row.course_count : (row.course_ids || []).length)) +
            '</td>' +
            '<td>' +
            update +
            '</td>' +
            '</tr>'
          );
        })
        .join('')
    : '<tr><td colspan="4" class="scs-empty">No packs installed yet</td></tr>';

  content.innerHTML =
    '<div id="scsSylUploadSection">' +
    '<h4 class="scs-subhead">Upload school syllabus</h4>' +
    '<div class="scs-panel-note">' +
    'Upload your own curriculum as Excel/CSV. Use board packs below only for CBSE/ICSE/state samples. ' +
    'IB and Cambridge schools should upload their own material here.' +
    '</div>' +
    '<div class="scs-toolbar">' +
    '<button type="button" class="scs-btn ghost" id="scsSylTemplateBtn">Download template</button>' +
    '</div>' +
    '<div class="scs-grid">' +
    '<div class="scs-field"><label for="scsSylUploadSession">Academic session</label>' +
    '<select id="scsSylUploadSession">' +
    (sessionOpts || '<option value="">No sessions — create one first</option>') +
    '</select></div>' +
    '<div class="scs-field"><label for="scsSylUploadBoard">Board tag</label>' +
    '<select id="scsSylUploadBoard">' +
    boardOpts +
    '</select></div>' +
    '</div>' +
    '<div class="scs-field full"><label>Classes</label>' +
    '<div class="scs-check-grid" id="scsSylScope">' +
    '<label class="scs-check"><input type="radio" name="syl_scope" value="all" id="scsSylScopeAll" checked> All classes in file</label>' +
    '<label class="scs-check"><input type="radio" name="syl_scope" value="selected" id="scsSylScopeSelected"> Selected classes only</label>' +
    '</div>' +
    '<div class="scs-check-grid" id="scsSylClassChecks" hidden>' +
    classChecks +
    '</div></div>' +
    '<div class="scs-field full">' +
    '<label class="scs-check"><input type="checkbox" id="scsSylImportLessons" checked> ' +
    'Import daily lesson plans sheet if present</label>' +
    '<p class="scs-help" id="scsSylLessonHint">All lesson-plan fields are optional; incomplete rows are skipped.</p>' +
    '</div>' +
    '<div class="scs-drop" id="scsSylDrop" tabindex="0">' +
    '<strong>Drop Excel / CSV syllabus here</strong>' +
    'or click to browse · .xlsx · .xls · .csv' +
    '</div>' +
    '<input type="file" id="scsSylUploadFile" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" hidden>' +
    '<div id="scsSylUploadResult"></div>' +
    '</div>' +
    '<h4 class="scs-subhead">Board pack registry</h4>' +
    '<div class="scs-panel-note">Install curated board packs into an academic session. Existing courses with the same board/subject/class are skipped.</div>' +
    '<table class="scs-table" id="scsSylRegistry"><thead><tr>' +
    '<th>Pack</th><th>Board</th><th>Year</th><th>Classes</th><th>Subjects</th><th></th><th></th>' +
    '</tr></thead><tbody>' +
    registryRows +
    '</tbody></table>' +
    '<h4 class="scs-subhead">Installed packs</h4>' +
    '<table class="scs-table" id="scsSylInstalled"><thead><tr>' +
    '<th>Pack</th><th>Session</th><th>Courses</th><th></th>' +
    '</tr></thead><tbody>' +
    installedRows +
    '</tbody></table>' +
    '<div id="scsSylInstallResult"></div>' +
    '<div class="scs-panel-note" id="scsSylIbNote" style="margin-top:16px">' +
    'IB and Cambridge programmes: upload your school\'s own units above (or via Academics → course import). Board packs are not available for licensed curricula.' +
    '</div>';

  content.querySelector('#scsSylTemplateBtn').addEventListener('click', function () {
    scsDownloadSyllabusTemplate();
  });

  function syncClassScope() {
    const selected = content.querySelector('#scsSylScopeSelected').checked;
    const box = content.querySelector('#scsSylClassChecks');
    if (box) box.hidden = !selected;
  }
  content.querySelectorAll('input[name="syl_scope"]').forEach(function (el) {
    el.addEventListener('change', syncClassScope);
  });
  syncClassScope();

  const fileInput = content.querySelector('#scsSylUploadFile');
  const drop = content.querySelector('#scsSylDrop');
  function openPicker() {
    fileInput.click();
  }
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
    if (file) scsUploadSyllabus(file);
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
    if (file) scsUploadSyllabus(file);
  });

  content.querySelectorAll('[data-install-pack]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      scsOpenSyllabusInstall(btn.getAttribute('data-install-pack'));
    });
  });
  content.querySelectorAll('[data-update-pack]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      scsOpenSyllabusInstall(btn.getAttribute('data-update-pack'));
    });
  });

  _renderSyllabusUploadResult(content.querySelector('#scsSylUploadResult'));
  _renderSyllabusInstallResult(content.querySelector('#scsSylInstallResult'));
}

function _renderSyllabusUploadResult(el) {
  if (!el) return;
  if (!_syllabusUploadResult) {
    el.innerHTML = '';
    return;
  }
  const r = _syllabusUploadResult;
  if (r.error) {
    let errRows = '';
    if (r.errors && r.errors.length) {
      errRows =
        '<table class="scs-table" id="scsSylUploadErrTable"><thead><tr><th>Class</th><th>Subject</th><th>Message</th></tr></thead><tbody>' +
        r.errors
          .map(function (e) {
            return (
              '<tr><td>' +
              _esc(e.class_label || '') +
              '</td><td>' +
              _esc(e.subject_code || '') +
              '</td><td>' +
              _esc(e.message || e.error || '') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    }
    el.innerHTML =
      '<div class="scs-result" id="scsSylUploadResultPanel">' +
      '<div class="scs-result-title">Upload failed</div>' +
      '<p class="scs-help">' +
      _esc(r.error) +
      '</p>' +
      errRows +
      '</div>';
    return;
  }

  const skipped = r.courses_skipped || [];
  const warnings = r.lesson_warnings || [];
  const skipTable = skipped.length
    ? '<table class="scs-table" id="scsSylUploadSkipTable"><thead><tr><th>Class</th><th>Subject</th><th></th></tr></thead><tbody>' +
      skipped
        .map(function (s) {
          return (
            '<tr><td>' +
            _esc(s.class_label) +
            '</td><td>' +
            _esc(s.subject_code) +
            '</td><td><button type="button" class="scs-link" data-go-academics>already exists</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    : '';

  const warnTable = warnings.length
    ? '<table class="scs-table" id="scsSylLessonWarnTable"><thead><tr><th>Row</th><th>Message</th></tr></thead><tbody>' +
      warnings
        .map(function (w) {
          return (
            '<tr><td>' +
            _esc(String(w.row != null ? w.row : '')) +
            '</td><td>' +
            _esc(w.message || '') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    : '';

  el.innerHTML =
    '<div class="scs-result" id="scsSylUploadResultPanel">' +
    '<div class="scs-result-title">Upload result</div>' +
    '<div class="scs-result-counts">' +
    '<span class="scs-pill">Courses created <strong id="scsSylUpCreated">' +
    _esc(String(r.courses_created || 0)) +
    '</strong></span>' +
    '<span class="scs-pill">Courses skipped <strong>' +
    _esc(String(skipped.length)) +
    '</strong></span>' +
    '<span class="scs-pill">Lessons created <strong id="scsSylUpLessons">' +
    _esc(String(r.lessons_created || 0)) +
    '</strong></span>' +
    '<span class="scs-pill">Lessons skipped <strong>' +
    _esc(String(r.lessons_skipped || 0)) +
    '</strong></span>' +
    '</div>' +
    skipTable +
    warnTable +
    '</div>';

  el.querySelectorAll('[data-go-academics]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('school_academics');
    });
  });
}

/**
 * Download CSV template for Syllabus + Lesson Plans columns.
 */
export function scsDownloadSyllabusTemplate() {
  const sylHeaders = [
    'Class',
    'Subject',
    'Course Label',
    'Unit',
    'Planned Weeks',
    'Topic',
    'Estimated Periods',
  ];
  const sylSample = ['8', 'Science', 'Science 8', 'Sample Unit 1', '2', 'Sample Topic 1.1', '2'];
  const lessonHeaders = [
    'Class',
    'Subject',
    'Unit',
    'Topic',
    'Date',
    'Title',
    'Teacher',
    'Objectives',
    'Activities',
    'Materials',
    'Assessment',
  ];
  const lessonSample = [
    '8',
    'Science',
    'Sample Unit 1',
    'Sample Topic 1.1',
    '2026-04-07',
    '',
    '',
    '',
    '',
    '',
    '',
  ];
  const csv =
    'Syllabus sheet (save as .xlsx and add a second sheet named Lesson Plans for daily plans):\n' +
    sylHeaders.join(',') +
    '\n' +
    sylSample.map(_csvEscape).join(',') +
    '\n\n' +
    'Lesson Plans sheet (all fields optional except Class, Subject, Unit, Date to attach a draft):\n' +
    lessonHeaders.join(',') +
    '\n' +
    lessonSample.map(_csvEscape).join(',') +
    '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blokschool-syllabus-template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast(
    'Template downloaded. For Excel: use sheets named Syllabus and Lesson Plans.',
    'success',
  );
}

/**
 * @param {File} file
 */
export async function scsUploadSyllabus(file) {
  if (!file) return;
  const name = (file.name || '').toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(name)) {
    toast('Use an .xlsx, .xls, or .csv file', 'error');
    return;
  }

  const sessionId = (_container.querySelector('#scsSylUploadSession') || {}).value || '';
  const board = (_container.querySelector('#scsSylUploadBoard') || {}).value || '';
  if (!sessionId) {
    toast('Select an academic session', 'error');
    return;
  }
  if (!board) {
    toast('Select a board tag', 'error');
    return;
  }

  const scopeSelected = !!(_container.querySelector('#scsSylScopeSelected') || {}).checked;
  let classes = [];
  if (scopeSelected) {
    classes = [..._container.querySelectorAll('input[name="syl_upload_class"]:checked')].map(
      function (el) {
        return el.value;
      },
    );
    if (!classes.length) {
      toast('Select at least one class, or choose All classes in file', 'error');
      return;
    }
  }

  const importLessons = !!(_container.querySelector('#scsSylImportLessons') || {}).checked;
  const session = getSession() || {};
  const installedBy = session.email || session.name || 'admin';

  try {
    const contentBase64 = await _readFileAsBase64(file);
    const body = {
      filename: file.name,
      contentBase64: contentBase64,
      academic_session_id: sessionId,
      installed_by: installedBy,
      board: board,
      import_lesson_plans: importLessons,
    };
    if (classes.length) body.classes = classes;

    const res = await _academics().post('/syllabus/upload', body);
    if (!res || res._error) {
      _syllabusUploadResult = {
        error: (res && (res.error || res.message)) || 'Upload failed',
        errors: (res && res.errors) || [],
      };
      _renderSyllabusUploadResult(_container.querySelector('#scsSylUploadResult'));
      toast(_syllabusUploadResult.error, 'error');
      return;
    }

    _syllabusUploadResult = res;
    toast(
      'Syllabus: ' +
        (res.courses_created || 0) +
        ' courses, ' +
        (res.lessons_created || 0) +
        ' lessons',
      'success',
    );
    await scsLoadData();
    if (_tab === 'syllabus') {
      _renderSyllabusUploadResult(_container.querySelector('#scsSylUploadResult'));
    }
  } catch (err) {
    toast((err && err.message) || 'Upload failed', 'error');
  }
}

function _renderSyllabusInstallResult(el) {
  if (!el) return;
  if (!_syllabusInstallResult) {
    el.innerHTML = '';
    return;
  }
  const r = _syllabusInstallResult;
  if (r.error) {
    let errRows = '';
    if (r.errors && r.errors.length) {
      errRows =
        '<table class="scs-table" id="scsSylErrTable"><thead><tr><th>Class</th><th>Subject</th><th>Message</th></tr></thead><tbody>' +
        r.errors
          .map(function (e) {
            return (
              '<tr><td>' +
              _esc(e.class_label || '') +
              '</td><td>' +
              _esc(e.subject_code || '') +
              '</td><td>' +
              _esc(e.message || e.error || '') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
    }
    el.innerHTML =
      '<div class="scs-result" id="scsSylResultPanel">' +
      '<div class="scs-result-title">Install failed</div>' +
      '<p class="scs-help">' +
      _esc(r.error) +
      '</p>' +
      errRows +
      '</div>';
    return;
  }

  const skipped = r.courses_skipped || [];
  const skipTable = skipped.length
    ? '<table class="scs-table" id="scsSylSkipTable"><thead><tr><th>Class</th><th>Subject</th><th></th></tr></thead><tbody>' +
      skipped
        .map(function (s) {
          return (
            '<tr><td>' +
            _esc(s.class_label) +
            '</td><td>' +
            _esc(s.subject_code) +
            '</td><td><button type="button" class="scs-link" data-go-academics>already exists</button></td></tr>'
          );
        })
        .join('') +
      '</tbody></table>'
    : '<div class="scs-empty">No skips</div>';

  el.innerHTML =
    '<div class="scs-result" id="scsSylResultPanel">' +
    '<div class="scs-result-title">Install result</div>' +
    '<div class="scs-result-counts">' +
    '<span class="scs-pill">Created <strong id="scsSylCreated">' +
    _esc(String(r.courses_created || 0)) +
    '</strong></span>' +
    '<span class="scs-pill">Skipped <strong>' +
    _esc(String(skipped.length)) +
    '</strong></span>' +
    '</div>' +
    skipTable +
    '</div>';

  el.querySelectorAll('[data-go-academics]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('school_academics');
    });
  });
}

/**
 * @param {string} packId
 */
export async function scsOpenSyllabusInstall(packId) {
  _syllabusInstallPackId = packId || '';
  const detail = await _academics(false).get('/packs/' + encodeURIComponent(packId));
  if (!detail || detail._error) {
    toast((detail && detail.message) || 'Could not load pack', 'error');
    return;
  }
  _syllabusDetail = detail;

  const classes = [...new Set((detail.courses || []).map(function (c) {
    return c.class_label;
  }))].sort();
  const subjects = [...new Set((detail.courses || []).map(function (c) {
    return c.subject_code;
  }))].sort();

  const sessionOpts = _sessions
    .map(function (s) {
      return (
        '<option value="' +
        _esc(s.id) +
        '">' +
        _esc(s.label) +
        (s.isCurrent ? ' (current)' : '') +
        '</option>'
      );
    })
    .join('');

  const classChecks = classes
    .map(function (c) {
      return (
        '<label class="scs-check"><input type="checkbox" name="syl_class" value="' +
        _esc(c) +
        '" checked> ' +
        _esc(c) +
        '</label>'
      );
    })
    .join('');

  const subjectChecks = subjects
    .map(function (s) {
      return (
        '<label class="scs-check"><input type="checkbox" name="syl_subject" value="' +
        _esc(s) +
        '" checked> ' +
        _esc(s) +
        '</label>'
      );
    })
    .join('');

  const box = _container.querySelector('#scsModalBox');
  const modal = _container.querySelector('#scsModal');
  box.innerHTML =
    '<div class="scs-modal-title">Install ' +
    _esc(detail.label || detail.id) +
    '</div>' +
    '<div class="scs-field"><label for="scsSylSession">Academic session</label>' +
    '<select id="scsSylSession">' +
    (sessionOpts || '<option value="">No sessions — create one first</option>') +
    '</select></div>' +
    '<div class="scs-field full"><label>Classes (optional filter)</label>' +
    '<div class="scs-check-grid" id="scsSylClasses">' +
    classChecks +
    '</div></div>' +
    '<div class="scs-field full"><label>Subjects (optional filter)</label>' +
    '<div class="scs-check-grid" id="scsSylSubjects">' +
    subjectChecks +
    '</div></div>' +
    '<div class="scs-form-actions">' +
    '<button type="button" class="scs-btn ghost" id="scsSylCancel">Cancel</button>' +
    '<button type="button" class="scs-btn" id="scsSylConfirm">Install</button>' +
    '</div>';

  modal.classList.add('open');
  box.querySelector('#scsSylCancel').addEventListener('click', scsCloseModal);
  box.querySelector('#scsSylConfirm').addEventListener('click', function () {
    scsConfirmSyllabusInstall();
  });
}

export async function scsConfirmSyllabusInstall() {
  const sessionId = (_container.querySelector('#scsSylSession') || {}).value || '';
  if (!sessionId) {
    toast('Select an academic session', 'error');
    return;
  }
  const classes = [..._container.querySelectorAll('input[name="syl_class"]:checked')].map(
    function (el) {
      return el.value;
    },
  );
  const subjects = [..._container.querySelectorAll('input[name="syl_subject"]:checked')].map(
    function (el) {
      return el.value;
    },
  );

  const session = getSession() || {};
  const installedBy = session.email || session.name || 'admin';

  const body = {
    academic_session_id: sessionId,
    installed_by: installedBy,
  };
  if (classes.length) body.classes = classes;
  if (subjects.length) body.subjects = subjects;

  const res = await _academics().post(
    '/packs/' + encodeURIComponent(_syllabusInstallPackId) + '/install',
    body,
  );

  scsCloseModal();

  if (!res || res._error) {
    _syllabusInstallResult = {
      error: (res && (res.error || res.message)) || 'Install failed',
      errors: (res && res.errors) || [],
    };
    if (_tab === 'syllabus') {
      _renderSyllabusInstallResult(_container.querySelector('#scsSylInstallResult'));
    }
    toast(_syllabusInstallResult.error, 'error');
    return;
  }

  _syllabusInstallResult = res;
  toast(
    'Installed: ' + (res.courses_created || 0) + ' courses created, ' +
      ((res.courses_skipped && res.courses_skipped.length) || 0) +
      ' skipped',
    'success',
  );
  await scsLoadData();
  if (_tab === 'syllabus') {
    _renderSyllabusInstallResult(_container.querySelector('#scsSylInstallResult'));
  }
}

/**
 * @param {string} code
 */
export async function scsSelectPack(code) {
  await scsLoadPackDetail(code);
  scsRender();
}

/**
 * @param {string} code
 */
export async function scsSetTenantPack(code) {
  const pack = _statePacks.find(function (p) {
    return p.code === code;
  });
  const label = (pack && pack.label) || code;
  const ok = await confirmDialog({
    title: 'Change state pack',
    message:
      'New students will be validated against ' +
      label +
      ' categories and ID format. Existing records are not revalidated.',
    confirmLabel: 'Change pack',
  });
  if (!ok) return;

  const res = await _identity().put('/state-pack', { pack_code: code });
  if (!res || res._error) {
    toast((res && (res.message || res.error)) || 'Could not set state pack', 'error');
    return;
  }
  toast('State pack set to ' + (res.packCode || code), 'success');
  _selectedPackCode = res.packCode || code;
  await scsLoadData();
}

/**
 * @param {{ label?: string, starts_on?: string, ends_on?: string, is_current?: boolean }} fields
 * @returns {string|null}
 */
export function validateSessionFields(fields) {
  const label = String((fields && fields.label) || '').trim();
  const starts = String((fields && fields.starts_on) || '').trim();
  const ends = String((fields && fields.ends_on) || '').trim();
  if (!label) return 'label is required';
  if (!ISO_DATE.test(starts)) return 'starts_on must be YYYY-MM-DD';
  if (!ISO_DATE.test(ends)) return 'ends_on must be YYYY-MM-DD';
  if (ends < starts) return 'ends_on must be on or after starts_on';
  return null;
}

export async function scsCreateSession() {
  const fields = {
    label: (_container.querySelector('#scsSessLabel') || {}).value || '',
    starts_on: (_container.querySelector('#scsSessStart') || {}).value || '',
    ends_on: (_container.querySelector('#scsSessEnd') || {}).value || '',
    is_current: !!(_container.querySelector('#scsSessCurrent') || {}).checked,
  };
  const err = validateSessionFields(fields);
  if (err) {
    toast(err, 'error');
    return;
  }

  const res = await _identity().post('/sessions', {
    label: fields.label.trim(),
    starts_on: fields.starts_on,
    ends_on: fields.ends_on,
    is_current: fields.is_current,
  });
  if (!res || res._error) {
    toast((res && (res.message || res.error)) || 'Could not create session', 'error');
    return;
  }
  toast('Session created', 'success');
  await scsLoadData();
}

/**
 * Roster template + import (delegated to roster_hub).
 */
export async function scsDownloadTemplate() {
  return rosterDownloadTemplate();
}

/**
 * @param {File} file
 */
export async function scsImportFile(file) {
  return rosterImportFile(file);
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

export function scsCloseModal() {
  const modal = _container && _container.querySelector('#scsModal');
  if (modal) modal.classList.remove('open');
}

function _renderAttendancePolicy(content) {
  const s = _attSettings || {
    granularity: 'day',
    editWindowMinutes: 120,
    lateThresholdMinutes: 15,
    halfDayMinMinutes: 180,
    dayDerivation: 'majority',
  };
  content.innerHTML =
    '<div class="scs-panel-note">' +
    'Thresholds and mark granularity for school attendance. Day-to-day registers stay in Attendance Admin.' +
    '</div>' +
    '<form id="scsAttSettingsForm">' +
    '<div class="scs-field"><label>Granularity</label><select id="scsGranularity">' +
    ['day', 'session', 'period']
      .map(function (g) {
        return (
          '<option value="' +
          g +
          '"' +
          (s.granularity === g ? ' selected' : '') +
          '>' +
          _esc(GRANULARITY_LABELS[g] || g) +
          '</option>'
        );
      })
      .join('') +
    '</select><div class="scs-help" id="scsGranHelp">' +
    _esc(GRANULARITY_HELP[s.granularity] || '') +
    '</div></div>' +
    '<div class="scs-field"><label>Day derivation</label><select id="scsDerivation">' +
    ['any_absent', 'majority', 'half_day_minutes']
      .map(function (d) {
        return (
          '<option value="' +
          d +
          '"' +
          (s.dayDerivation === d ? ' selected' : '') +
          '>' +
          _esc(DERIVATION_LABELS[d] || d) +
          '</option>'
        );
      })
      .join('') +
    '</select><div class="scs-help" id="scsDerHelp">' +
    _esc(DERIVATION_HELP[s.dayDerivation] || '') +
    '</div></div>' +
    '<div class="scs-field"><label>Edit window (minutes)</label><input type="number" id="scsEditWindow" value="' +
    _esc(String(s.editWindowMinutes)) +
    '"></div>' +
    '<div class="scs-field"><label>Late threshold (minutes)</label><input type="number" id="scsLateThr" value="' +
    _esc(String(s.lateThresholdMinutes)) +
    '"><div class="scs-help">Minutes after which a late arrival is still recorded as late (status does not flip).</div></div>' +
    '<div class="scs-field"><label>Half-day minimum (minutes)</label><input type="number" id="scsHalfDay" value="' +
    _esc(String(s.halfDayMinMinutes)) +
    '"></div>' +
    '<button type="button" class="scs-btn" id="scsAttSettingsSave">Save settings</button>' +
    '</form>';

  const gran = content.querySelector('#scsGranularity');
  const der = content.querySelector('#scsDerivation');
  gran.addEventListener('change', function () {
    content.querySelector('#scsGranHelp').textContent = GRANULARITY_HELP[gran.value] || '';
  });
  der.addEventListener('change', function () {
    content.querySelector('#scsDerHelp').textContent = DERIVATION_HELP[der.value] || '';
  });
  content.querySelector('#scsAttSettingsSave').addEventListener('click', function () {
    scsSaveAttendanceSettings();
  });
}

/**
 * Validate + PUT attendance settings.
 * @returns {Promise<boolean>}
 */
export async function scsSaveAttendanceSettings() {
  const content = _container.querySelector('#scsContent');
  const fields = {
    granularity: content.querySelector('#scsGranularity').value,
    day_derivation: content.querySelector('#scsDerivation').value,
    edit_window_minutes: Number(content.querySelector('#scsEditWindow').value),
    late_threshold_minutes: Number(content.querySelector('#scsLateThr').value),
    half_day_min_minutes: Number(content.querySelector('#scsHalfDay').value),
  };
  const err = validateSettingsFields(fields);
  if (err) {
    toast(err, 'error');
    return false;
  }
  const res = await _attendance().put('/settings', fields);
  if (res && !res._error) {
    _attSettings = res.settings || res;
    toast('Settings saved', 'success');
    scsRenderStats();
    return true;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return false;
}

function _renderEligibility(content) {
  const empty =
    !_eligibility.length &&
    !_eligLoading
      ? '<div class="scs-empty" id="scsElEmpty">Set the date range and threshold, then run the report. Optional class filter narrows the student list (max 100).</div>'
      : '';
  const loading = _eligLoading
    ? '<div class="scs-empty" id="scsElLoading">Running eligibility report…</div>'
    : '';
  const capNote = _eligCapped
    ? '<div class="scs-panel-note" id="scsElCap">Showing the first 100 matching students. Narrow by class for a fuller check.</div>'
    : '';
  const table =
    _eligibility.length && !_eligLoading
      ? '<table class="scs-table" id="scsElTable"><thead><tr><th>Student</th><th>Pct</th><th>Projected</th><th>Eligible</th></tr></thead><tbody>' +
        _eligibility
          .map(function (r) {
            if (r.error) {
              return (
                '<tr><td>' +
                _esc(r.name) +
                '</td><td colspan="3">' +
                _esc(r.error) +
                '</td></tr>'
              );
            }
            return (
              '<tr data-student-id="' +
              _esc(r.studentId) +
              '"><td>' +
              _esc(r.name) +
              '</td><td>' +
              _esc(String(r.pct)) +
              '%</td><td>' +
              _esc(String(r.projected)) +
              '%</td><td><span class="scs-badge ' +
              (r.eligible ? 'eligible' : 'ineligible') +
              '">' +
              (r.eligible ? 'yes' : 'no') +
              '</span></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      : '';

  content.innerHTML =
    '<div class="scs-toolbar">' +
    '<input class="scs-input" type="date" id="scsElFrom" value="' +
    _esc(_eligFrom) +
    '">' +
    '<input class="scs-input" type="date" id="scsElTo" value="' +
    _esc(_eligTo) +
    '">' +
    '<input class="scs-input" type="number" id="scsElThr" min="0" max="100" value="' +
    _esc(String(_eligThreshold)) +
    '" title="Threshold %">' +
    '<input class="scs-input" id="scsElClass" placeholder="Class (optional)" value="' +
    _esc(_eligClass) +
    '">' +
    '<button type="button" class="scs-btn" id="scsElLoad"' +
    (_eligLoading ? ' disabled' : '') +
    '>Run report</button>' +
    '</div>' +
    capNote +
    loading +
    empty +
    table;

  content.querySelector('#scsElLoad').addEventListener('click', function () {
    _eligFrom = content.querySelector('#scsElFrom').value;
    _eligTo = content.querySelector('#scsElTo').value;
    _eligThreshold = Number(content.querySelector('#scsElThr').value);
    _eligClass = (content.querySelector('#scsElClass').value || '').trim();
    scsRunEligibility();
  });
}

/**
 * Fetch eligibility for up to 100 active students (optional class filter).
 * @returns {Promise<object[]>}
 */
export async function scsRunEligibility() {
  _eligLoading = true;
  scsRender();

  const qs =
    '/students?status=active&limit=100&offset=0' +
    (_eligClass ? '&class=' + encodeURIComponent(_eligClass) : '');
  const list = await _identity().get(qs);
  const students = list && !list._error ? list.items || [] : [];
  if (list && list._error) toast(list.message || 'Could not load students', 'error');
  _eligCapped = students.length >= 100;

  const rows = await Promise.all(
    students.map(async function (s) {
      const path =
        '/students/' +
        encodeURIComponent(s.id) +
        '/eligibility?session_from=' +
        encodeURIComponent(_eligFrom) +
        '&session_to=' +
        encodeURIComponent(_eligTo) +
        '&threshold=' +
        encodeURIComponent(String(_eligThreshold));
      const elig = await _attendance().get(path);
      const name = ((s.firstName || '') + ' ' + (s.lastName || '')).trim() || s.id;
      if (!elig || elig._error) {
        return {
          studentId: s.id,
          name: name,
          error: (elig && elig.message) || 'unavailable',
        };
      }
      return {
        studentId: s.id,
        name: name,
        pct: elig.pct,
        threshold: elig.threshold,
        eligible: elig.eligible,
        projected: elig.projected_pct_if_no_more_absences,
      };
    }),
  );
  _eligibility = rows;
  _eligLoading = false;
  scsRenderStats();
  scsRender();
  return rows;
}

function _renderNudge(content) {
  const c = _nudgeConfig || {
    enabled: false,
    atRiskPct: 10,
    chronicDays: 18,
    holdoutPct: 10,
    maxMessagesPerTerm: 6,
  };
  const t = (_nudgeReport && _nudgeReport.treatment) || {
    mean_absence_pct: 0,
    message_count: 0,
    student_count: 0,
  };
  const h = (_nudgeReport && _nudgeReport.holdout) || {
    mean_absence_pct: 0,
    message_count: 0,
    student_count: 0,
  };

  content.innerHTML =
    '<div class="scs-panel-note">' +
    'Configure at-risk nudges and review treatment vs holdout. Run evaluates and may send messages for the as-of date.' +
    '</div>' +
    '<div class="scs-field"><label><input type="checkbox" id="scsNudgeEnabled"' +
    (c.enabled ? ' checked' : '') +
    '> Enabled</label></div>' +
    '<div class="scs-field"><label>At-risk % band</label><input type="number" id="scsAtRisk" value="' +
    _esc(String(c.atRiskPct != null ? c.atRiskPct : c.at_risk_pct)) +
    '"></div>' +
    '<div class="scs-field"><label>Chronic days</label><input type="number" id="scsChronic" value="' +
    _esc(String(c.chronicDays != null ? c.chronicDays : c.chronic_days)) +
    '"></div>' +
    '<div class="scs-field"><label>Holdout %</label><input type="number" id="scsHoldout" value="' +
    _esc(String(c.holdoutPct != null ? c.holdoutPct : c.holdout_pct)) +
    '"><div class="scs-help">Share of eligible students kept out of treatment for comparison (no nudge messages).</div></div>' +
    '<div class="scs-field"><label>Max messages / term</label><input type="number" id="scsMaxMsg" value="' +
    _esc(String(c.maxMessagesPerTerm != null ? c.maxMessagesPerTerm : c.max_messages_per_term)) +
    '"><div class="scs-help">Caps how many nudge messages a student can receive in one term.</div></div>' +
    '<div class="scs-form-actions" style="justify-content:flex-start">' +
    '<button type="button" class="scs-btn" id="scsNudgeSave">Save config</button>' +
    '<button type="button" class="scs-btn ghost" id="scsNudgeRun">Run nudge</button>' +
    '</div>' +
    '<div class="scs-report-grid" id="scsNudgeReport">' +
    '<div class="scs-report-card"><h4>Treatment</h4>' +
    '<div class="scs-metric" id="scsTreatMean">' +
    _esc(Number(t.mean_absence_pct).toFixed(1)) +
    '%</div><div class="scs-metric-label">mean absence %</div>' +
    '<div>Messages: <strong id="scsTreatMsg">' +
    _esc(String(t.message_count)) +
    '</strong></div>' +
    '<div>Students: <strong id="scsTreatN">' +
    _esc(String(t.student_count)) +
    '</strong></div></div>' +
    '<div class="scs-report-card"><h4>Holdout</h4>' +
    '<div class="scs-metric" id="scsHoldMean">' +
    _esc(Number(h.mean_absence_pct).toFixed(1)) +
    '%</div><div class="scs-metric-label">mean absence %</div>' +
    '<div>Messages: <strong id="scsHoldMsg">' +
    _esc(String(h.message_count)) +
    '</strong></div>' +
    '<div>Students: <strong id="scsHoldN">' +
    _esc(String(h.student_count)) +
    '</strong></div></div>' +
    '</div>';

  content.querySelector('#scsNudgeSave').addEventListener('click', function () {
    scsSaveNudge();
  });
  content.querySelector('#scsNudgeRun').addEventListener('click', function () {
    scsRunNudge();
  });
}

/**
 * PUT nudge config.
 * @returns {Promise<boolean>}
 */
export async function scsSaveNudge() {
  const content = _container.querySelector('#scsContent');
  const body = {
    enabled: content.querySelector('#scsNudgeEnabled').checked,
    at_risk_pct: Number(content.querySelector('#scsAtRisk').value),
    chronic_days: Number(content.querySelector('#scsChronic').value),
    holdout_pct: Number(content.querySelector('#scsHoldout').value),
    max_messages_per_term: Number(content.querySelector('#scsMaxMsg').value),
  };
  const res = await _attendance().put('/nudge/config', body);
  if (res && !res._error) {
    _nudgeConfig = res.config || res;
    toast('Nudge config saved', 'success');
    return true;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return false;
}

/**
 * Confirm then POST /nudge/run and refresh report.
 * @returns {Promise<object|null>}
 */
export async function scsRunNudge() {
  const ok = await confirmDialog({
    message: 'Send/evaluate nudges for this as-of date?',
    confirmLabel: 'Run',
    cancelLabel: 'Cancel',
  });
  if (!ok) return null;

  const classMap = {};
  _eligibility.forEach(function (r) {
    if (r.studentId) classMap[r.studentId] = 'default';
  });
  if (!Object.keys(classMap).length) {
    const list = await _identity().get('/students?status=active&limit=100&offset=0');
    const items = list && !list._error ? list.items || [] : [];
    items.forEach(function (s) {
      classMap[s.id] = (s.classLabel || 'default') + (s.section || '');
    });
  }
  const res = await _attendance().post('/nudge/run', {
    as_of: _today(),
    class_map: classMap,
  });
  if (res && !res._error) {
    toast(
      'Nudge run: sent ' + (res.sent || 0) + ', skipped ' + (res.skipped || 0),
      'success',
    );
    const report = await _attendance().get('/nudge/report');
    if (report && !report._error) _nudgeReport = report;
    scsRenderStats();
    scsRender();
    return res;
  }
  toast((res && res.message) || 'Nudge run failed', 'error');
  return null;
}

/** Test helper: reset module state between cases. */
export function _resetState() {
  _container = null;
  _tab = 'roster';
  _sessions = [];
  _statePacks = [];
  _tenantPack = { packCode: null, pack: null };
  _selectedPackCode = '';
  _selectedPackDetail = null;
  _consentSummary = {};
  _studentsTotal = 0;
  _importResult = null;
  _rosterTeachers = 0;
  _rosterSchemes = 0;
  _rosterSections = 0;
  _syllabusPacks = [];
  _syllabusInstalled = [];
  _syllabusDetail = null;
  _syllabusInstallResult = null;
  _syllabusInstallPackId = '';
  _syllabusUploadResult = null;
  _attSettings = null;
  _eligibility = [];
  _eligThreshold = 75;
  _eligFrom = '';
  _eligTo = '';
  _eligClass = '';
  _eligLoading = false;
  _eligCapped = false;
  _nudgeConfig = null;
  _nudgeReport = null;
  rosterResetState();
}

registerModule('school_settings', renderSchoolSettingsPage);
