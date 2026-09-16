/**
 * modules/school_surveys/school_surveys.js
 * Parents & Guardians staff console (module id kept as school_surveys).
 * Tabs: Overview | Directory | Invitations | Communications | Forms |
 *       Conferences | Insights | Settings.
 * HTTP only via api.school — no raw fetch.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { navigateToModule, registerModule } from '../../shared/router.js';

const TABS = [
  'overview',
  'directory',
  'invitations',
  'communications',
  'forms',
  'conferences',
  'insights',
  'settings',
];

const TAB_LABELS = {
  overview: 'Overview',
  directory: 'Directory',
  invitations: 'Invitations',
  communications: 'Communications',
  forms: 'Forms',
  conferences: 'Conferences',
  insights: 'Insights',
  settings: 'Settings',
};

const Q_TYPES = [
  { value: 'scale', label: 'Scale' },
  { value: 'nps', label: 'NPS' },
  { value: 'rating', label: 'Rating' },
  { value: 'yesno', label: 'Yes/No' },
  { value: 'text', label: 'Text' },
];

let _container = null;
let _tab = 'overview';
let _surveys = [];
let _guardians = [];
let _guardianChildCounts = {};
let _invitations = [];
let _questions = [];
let _saving = false;
let _dirError = '';
let _invError = '';
let _formsError = '';
let _dirQ = '';

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _surveysApi() {
  return api.school('school-surveys');
}

function _identityApi() {
  return api.school('school-identity');
}

function _err(res) {
  if (!res || res._error) {
    return (res && (res.error || res.message)) || 'Request failed';
  }
  return null;
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'admin';
}

function _parseQuestions(survey) {
  try {
    const raw = survey.questionsJson || survey.questions_json || '[]';
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _guardianName(g) {
  const first = g.firstName || g.first_name || '';
  const last = g.lastName || g.last_name || '';
  return (first + ' ' + last).trim() || g.id || 'Guardian';
}

export function renderSchoolSurveysPage(container) {
  _container = container;
  _tab = 'overview';
  container.innerHTML =
    '<div class="ssv-wrap" id="ssvWrap">' +
    '<div class="ssv-toolbar">' +
    '<div class="ssv-title">Parents &amp; Guardians</div>' +
    '<div class="ssv-spacer"></div>' +
    '<button type="button" class="ssv-btn" id="ssvAddBtn" hidden>+ New form</button>' +
    '</div>' +
    '<div class="ssv-tabs" id="ssvTabs"></div>' +
    '<div id="ssvContent"><div class="ssv-empty">Loading…</div></div>' +
    '<div class="ssv-modal" id="ssvModal"><div class="ssv-modal-box" id="ssvModalBox"></div></div>' +
    '</div>';
  _bindTabs();
  _bind(container);
  ssvLoad();
}

function _bindTabs() {
  const tabs = _container.querySelector('#ssvTabs');
  if (!tabs) return;
  tabs.innerHTML = TABS.map(function (t) {
    return (
      '<button type="button" class="ssv-tab' +
      (_tab === t ? ' active' : '') +
      '" data-tab="' +
      t +
      '">' +
      TAB_LABELS[t] +
      '</button>'
    );
  }).join('');
  tabs.querySelectorAll('.ssv-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _tab = btn.getAttribute('data-tab') || 'overview';
      tabs.querySelectorAll('.ssv-tab').forEach(function (tab) {
        tab.classList.toggle('active', tab === btn);
      });
      ssvLoad();
    });
  });
}

function _syncAddBtn() {
  const btn = _container && _container.querySelector('#ssvAddBtn');
  if (!btn) return;
  btn.hidden = _tab !== 'forms';
}

export async function ssvLoad() {
  _syncAddBtn();
  if (_tab === 'overview') {
    await Promise.all([_loadSurveys(), _loadInvitations()]);
  } else if (_tab === 'directory') {
    await _loadDirectory();
  } else if (_tab === 'invitations') {
    await _loadInvitations();
  } else if (_tab === 'forms') {
    await _loadSurveys();
  }
  ssvRender();
}

async function _loadSurveys() {
  _formsError = '';
  const res = await _surveysApi().get('');
  if (_err(res)) {
    _formsError = _err(res);
    _surveys = [];
    return;
  }
  _surveys = (res && res.surveys) || [];
}

async function _loadInvitations() {
  _invError = '';
  try {
    const res = await _identityApi().get('/invitations');
    if (_err(res)) {
      _invError = _err(res);
      _invitations = [];
      return;
    }
    _invitations = (res && res.invitations) || [];
  } catch (e) {
    _invError = (e && e.message) || 'Invitations unavailable';
    _invitations = [];
  }
}

async function _loadDirectory() {
  _dirError = '';
  _guardianChildCounts = {};
  try {
    const res = await _identityApi().get('/guardians');
    if (_err(res)) {
      _dirError = _err(res);
      _guardians = [];
      return;
    }
    _guardians = (res && res.guardians) || [];
    await _loadChildCounts(_guardians);
  } catch (e) {
    _dirError = (e && e.message) || 'Directory unavailable';
    _guardians = [];
  }
}

async function _loadChildCounts(guardians) {
  const batch = guardians.slice(0, 40);
  await Promise.all(
    batch.map(async function (g) {
      const id = g.id;
      if (!id) return;
      try {
        const res = await _identityApi().get('/guardians/' + encodeURIComponent(id) + '/students');
        if (!_err(res)) {
          const students = (res && res.students) || [];
          _guardianChildCounts[id] = students.length;
        }
      } catch {
        /* count optional */
      }
    }),
  );
}

export function ssvRender() {
  const el = _container && _container.querySelector('#ssvContent');
  if (!el) return;
  _syncAddBtn();
  switch (_tab) {
    case 'overview':
      el.innerHTML = _renderOverview();
      break;
    case 'directory':
      el.innerHTML = _renderDirectory();
      break;
    case 'invitations':
      el.innerHTML = _renderInvitations();
      break;
    case 'communications':
      el.innerHTML = _renderPlaceholder(
        'Communications',
        'Outbound messaging, digests, and threads are managed in Engagement. Use School Settings → Nudge for attendance nudges — this console does not duplicate message data.',
      );
      break;
    case 'forms':
      el.innerHTML = _renderForms();
      break;
    case 'conferences':
      el.innerHTML = _renderPlaceholder(
        'Conferences',
        'Parent–teacher conference scheduling queue will appear here. Coming soon.',
      );
      break;
    case 'insights':
      el.innerHTML = _renderPlaceholder(
        'Insights',
        'Response trends and participation insights will appear here. Coming soon.',
      );
      break;
    case 'settings':
      el.innerHTML = _renderPlaceholder(
        'Settings',
        'Family hub preferences and portal defaults will appear here. Coming soon.',
      );
      break;
    default: {
      const _exhaustive = _tab;
      el.innerHTML = '<div class="ssv-empty">Unknown tab: ' + _esc(_exhaustive) + '</div>';
      break;
    }
  }
}

function _renderOverview() {
  const draft = _surveys.filter((s) => s.status === 'draft').length;
  const active = _surveys.filter((s) => s.status === 'active').length;
  const closed = _surveys.filter((s) => s.status === 'closed').length;
  const pending = _invitations.filter(
    (i) => (i.status || '').toLowerCase() === 'pending',
  ).length;

  return (
    '<div class="ssv-overview">' +
    '<div class="ssv-stat-grid">' +
    _statCard('Forms (draft)', String(draft), 'forms') +
    _statCard('Forms (active)', String(active), 'forms') +
    _statCard('Forms (closed)', String(closed), 'forms') +
    _statCard('Invites pending', String(pending), 'invitations') +
    '</div>' +
    '<div class="ssv-note-grid">' +
    '<button type="button" class="ssv-note" data-goto="school_attendance_admin">' +
    '<div class="ssv-note-title">Attendance</div>' +
    '<div class="ssv-note-sub">Review unexplained absences and office registers — open Attendance Admin.</div>' +
    '</button>' +
    '<button type="button" class="ssv-note" data-goto="school_students">' +
    '<div class="ssv-note-title">Fees &amp; students</div>' +
    '<div class="ssv-note-sub">Fee ledgers stay in Fees; link guardians and enrolments from Students. This console does not copy fee balances.</div>' +
    '</button>' +
    '<button type="button" class="ssv-note" data-goto-tab="directory">' +
    '<div class="ssv-note-title">Guardian directory</div>' +
    '<div class="ssv-note-sub">Browse linked guardians and invite them to the parent portal.</div>' +
    '</button>' +
    '<button type="button" class="ssv-note" data-goto-tab="forms">' +
    '<div class="ssv-note-title">Parent forms</div>' +
    '<div class="ssv-note-sub">Create, publish, and review survey / feedback forms.</div>' +
    '</button>' +
    '</div></div>'
  );
}

function _statCard(label, value, gotoTab) {
  return (
    '<button type="button" class="ssv-stat" data-goto-tab="' +
    _esc(gotoTab) +
    '">' +
    '<div class="ssv-stat-value">' +
    _esc(value) +
    '</div>' +
    '<div class="ssv-stat-label">' +
    _esc(label) +
    '</div></button>'
  );
}

function _renderPlaceholder(title, body) {
  return (
    '<div class="ssv-placeholder">' +
    '<div class="ssv-placeholder-title">' +
    _esc(title) +
    '</div>' +
    '<p class="ssv-placeholder-body">' +
    _esc(body) +
    '</p></div>'
  );
}

function _renderDirectory() {
  if (_dirError) {
    return (
      '<div class="ssv-empty ssv-error">Could not load guardians: ' +
      _esc(_dirError) +
      '</div>'
    );
  }
  const q = (_dirQ || '').trim().toLowerCase();
  const list = q
    ? _guardians.filter(function (g) {
        const hay =
          _guardianName(g) +
          ' ' +
          (g.phone || '') +
          ' ' +
          (g.email || '') +
          ' ' +
          (g.relation || '');
        return hay.toLowerCase().indexOf(q) !== -1;
      })
    : _guardians;

  let body;
  if (!_guardians.length) {
    body = '<div class="ssv-empty">No guardians in the directory yet.</div>';
  } else if (!list.length) {
    body = '<div class="ssv-empty">No guardians match your search.</div>';
  } else {
    body =
      '<div class="ssv-table-wrap"><table class="ssv-table"><thead><tr>' +
      '<th>Name</th><th>Relation</th><th>Phone</th><th>Email</th><th>Children</th><th></th>' +
      '</tr></thead><tbody>' +
      list
        .map(function (g) {
          const id = g.id;
          const count =
            id && _guardianChildCounts[id] != null
              ? String(_guardianChildCounts[id])
              : '—';
          return (
            '<tr>' +
            '<td>' +
            _esc(_guardianName(g)) +
            '</td>' +
            '<td>' +
            _esc(g.relation || '—') +
            '</td>' +
            '<td>' +
            _esc(g.phone || '—') +
            '</td>' +
            '<td>' +
            _esc(g.email || '—') +
            '</td>' +
            '<td>' +
            _esc(count) +
            '</td>' +
            '<td><button type="button" class="ssv-link-btn" data-action="invite-guardian" data-gid="' +
            _esc(id) +
            '">Invite</button></td>' +
            '</tr>'
          );
        })
        .join('') +
      '</tbody></table></div>';
  }

  return (
    '<div class="ssv-toolbar-inline">' +
    '<input type="search" class="ssv-input" id="ssvDirQ" placeholder="Search name, phone, email…" value="' +
    _esc(_dirQ) +
    '">' +
    '</div>' +
    body
  );
}

function _renderInvitations() {
  if (_invError) {
    return (
      '<div class="ssv-empty ssv-error">Could not load invitations: ' +
      _esc(_invError) +
      '</div>'
    );
  }

  const createBlock =
    '<div class="ssv-invite-create">' +
    '<div class="ssv-field"><label>Guardian ID</label>' +
    '<input type="text" id="ssvInviteGid" class="ssv-input" placeholder="Guardian UUID"></div>' +
    '<button type="button" class="ssv-btn" data-action="create-invite">Send invitation</button>' +
    '</div>';

  if (!_invitations.length) {
    return createBlock + '<div class="ssv-empty">No invitations yet.</div>';
  }

  return (
    createBlock +
    '<div class="ssv-table-wrap"><table class="ssv-table"><thead><tr>' +
    '<th>Guardian</th><th>Phone</th><th>Status</th><th>Expires</th><th></th>' +
    '</tr></thead><tbody>' +
    _invitations
      .map(function (inv) {
        const status = inv.status || '';
        const pending = status.toLowerCase() === 'pending';
        return (
          '<tr>' +
          '<td><code>' +
          _esc(inv.guardianId || inv.guardian_id || '—') +
          '</code></td>' +
          '<td>' +
          _esc(inv.phone || '—') +
          '</td>' +
          '<td><span class="ssv-badge">' +
          _esc(status) +
          '</span></td>' +
          '<td>' +
          _esc(_shortDate(inv.expiresAt || inv.expires_at)) +
          '</td>' +
          '<td>' +
          (pending
            ? '<button type="button" class="ssv-link-btn danger" data-action="revoke-invite" data-id="' +
              _esc(inv.id) +
              '">Revoke</button>'
            : '') +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table></div>'
  );
}

function _shortDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function _renderForms() {
  if (_formsError) {
    return (
      '<div class="ssv-empty ssv-error">Could not load forms: ' +
      _esc(_formsError) +
      '</div>'
    );
  }
  if (!_surveys.length) {
    return '<div class="ssv-empty">No parent forms yet. Create one with + New form.</div>';
  }
  return (
    '<div class="ssv-grid">' +
    _surveys
      .map(function (s, i) {
        const qs = _parseQuestions(s);
        return (
          '<div class="ssv-card">' +
          '<div class="ssv-card-title">' +
          _esc(s.title) +
          '</div>' +
          '<div class="ssv-card-sub">' +
          _esc(s.targetKind || s.target_kind || 'all') +
          ' · ' +
          qs.length +
          ' questions · ' +
          _esc(s.status) +
          '</div>' +
          '<div class="ssv-actions">' +
          (s.status === 'draft'
            ? '<button type="button" data-action="publish" data-idx="' +
              i +
              '">Publish</button>' +
              '<button type="button" class="danger" data-action="delete" data-idx="' +
              i +
              '">Delete</button>'
            : '') +
          (s.status === 'active'
            ? '<button type="button" data-action="close" data-idx="' +
              i +
              '">Close</button>' +
              '<button type="button" data-action="results" data-idx="' +
              i +
              '">Results</button>'
            : '') +
          (s.status === 'closed'
            ? '<button type="button" data-action="results" data-idx="' +
              i +
              '">Results</button>'
            : '') +
          '</div></div>'
        );
      })
      .join('') +
    '</div>'
  );
}

function ssvShowForm() {
  _questions = [{ key: 'q1', label: '', type: 'scale' }];
  const box = _container.querySelector('#ssvModalBox');
  box.innerHTML =
    '<div class="ssv-modal-title">New parent form</div>' +
    '<div class="ssv-field"><label>Title *</label><input id="ssvTitle" type="text"></div>' +
    '<div class="ssv-field"><label>Description</label><textarea id="ssvDesc" rows="2"></textarea></div>' +
    '<div class="ssv-field"><label>Audience</label><select id="ssvTarget">' +
    '<option value="all">All guardians</option>' +
    '<option value="students">Specific students</option></select>' +
    '<p class="ssv-hint">Audience search by class/section is not wired yet — paste student IDs below when targeting specific students. Prefer student UUIDs from the Students module.</p></div>' +
    '<div class="ssv-field" id="ssvStudentsBlock" style="display:none">' +
    '<label>Student IDs (comma-separated)</label>' +
    '<input id="ssvStudents" type="text" placeholder="uuid1, uuid2"></div>' +
    '<div class="ssv-field"><label>Questions</label>' +
    '<div id="ssvQList" class="ssv-qlist"></div>' +
    '<button type="button" class="ssv-btn ghost" id="ssvAddQ">+ Add question</button></div>' +
    '<div class="ssv-form-actions">' +
    '<button type="button" class="ssv-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ssv-btn" id="ssvSaveBtn">Create</button></div>';
  _container.querySelector('#ssvModal').classList.add('open');
  _renderQuestionBuilder();
  const target = box.querySelector('#ssvTarget');
  target.addEventListener('change', function () {
    box.querySelector('#ssvStudentsBlock').style.display =
      target.value === 'students' ? '' : 'none';
  });
  box.querySelector('#ssvAddQ').addEventListener('click', function () {
    _questions.push({
      key: 'q' + (_questions.length + 1),
      label: '',
      type: 'scale',
    });
    _renderQuestionBuilder();
  });
  box.querySelector('#ssvSaveBtn').addEventListener('click', ssvSave);
}

function _renderQuestionBuilder() {
  const list = _container.querySelector('#ssvQList');
  if (!list) return;
  list.innerHTML = _questions
    .map(function (q, i) {
      const typeOpts = Q_TYPES.map(function (t) {
        return (
          '<option value="' +
          t.value +
          '"' +
          (q.type === t.value ? ' selected' : '') +
          '>' +
          t.label +
          '</option>'
        );
      }).join('');
      return (
        '<div class="ssv-qrow" data-qi="' +
        i +
        '">' +
        '<div class="ssv-qrow-head">Question ' +
        (i + 1) +
        ( _questions.length > 1
          ? ' <button type="button" class="ssv-link-btn danger" data-action="remove-q" data-qi="' +
            i +
            '">Remove</button>'
          : '') +
        '</div>' +
        '<input type="text" class="ssv-input ssv-q-label" data-qi="' +
        i +
        '" placeholder="Question label" value="' +
        _esc(q.label) +
        '">' +
        '<select class="ssv-input ssv-q-type" data-qi="' +
        i +
        '">' +
        typeOpts +
        '</select></div>'
      );
    })
    .join('');

  list.querySelectorAll('.ssv-q-label').forEach(function (inp) {
    inp.addEventListener('input', function () {
      const i = parseInt(inp.getAttribute('data-qi'), 10);
      if (_questions[i]) _questions[i].label = inp.value;
    });
  });
  list.querySelectorAll('.ssv-q-type').forEach(function (sel) {
    sel.addEventListener('change', function () {
      const i = parseInt(sel.getAttribute('data-qi'), 10);
      if (_questions[i]) _questions[i].type = sel.value;
    });
  });
  list.querySelectorAll('[data-action="remove-q"]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const i = parseInt(btn.getAttribute('data-qi'), 10);
      if (_questions.length <= 1) return;
      _questions.splice(i, 1);
      _questions.forEach(function (q, idx) {
        q.key = 'q' + (idx + 1);
      });
      _renderQuestionBuilder();
    });
  });
}

async function ssvSave() {
  if (_saving) return;
  const title = (_container.querySelector('#ssvTitle') || {}).value || '';
  if (!title.trim()) {
    toast('Title required', 'error');
    return;
  }
  const targetKind = (_container.querySelector('#ssvTarget') || {}).value || 'all';
  const studentsRaw = (_container.querySelector('#ssvStudents') || {}).value || '';
  const studentRefs = studentsRaw
    .split(',')
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean);

  const questions = _questions.map(function (q, i) {
    return {
      key: q.key || 'q' + (i + 1),
      label: (q.label || '').trim() || 'Question ' + (i + 1),
      type: q.type || 'scale',
    };
  });
  if (!questions.length) {
    toast('Add at least one question', 'error');
    return;
  }

  const body = {
    title: title.trim(),
    description: (_container.querySelector('#ssvDesc') || {}).value || '',
    target_kind: targetKind,
    student_refs: studentRefs,
    questions: questions,
  };
  _saving = true;
  const res = await _surveysApi().post('', body);
  _saving = false;
  if (res && !res._error) {
    toast('Created', 'success');
    _container.querySelector('#ssvModal').classList.remove('open');
    await ssvLoad();
    return;
  }
  toast((res && (res.error || res.message)) || 'Failed', 'error');
}

async function _createInvite(guardianId) {
  const gid = (guardianId || '').trim();
  if (!gid) {
    toast('Guardian ID required', 'error');
    return;
  }
  const res = await _identityApi().post(
    '/guardians/' + encodeURIComponent(gid) + '/invitations',
    { invited_by: _actor() },
  );
  if (res && !res._error) {
    const token = res.claim_token || res.claimToken;
    toast(
      token ? 'Invitation created (claim token ready)' : 'Invitation created',
      'success',
    );
    _tab = 'invitations';
    _bindTabs();
    await ssvLoad();
    return;
  }
  toast((res && (res.error || res.message)) || 'Invite failed', 'error');
}

function _gotoTab(tab) {
  if (TABS.indexOf(tab) === -1) return;
  _tab = tab;
  _bindTabs();
  ssvLoad();
}

function _bind(container) {
  const addBtn = container.querySelector('#ssvAddBtn');
  if (addBtn) addBtn.addEventListener('click', ssvShowForm);

  const modal = container.querySelector('#ssvModal');
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.classList.remove('open');
  });

  container.addEventListener('input', function (e) {
    const t = e.target;
    if (t && t.id === 'ssvDirQ') {
      _dirQ = t.value || '';
      if (_tab === 'directory') ssvRender();
    }
  });

  container.addEventListener('click', async function (e) {
    const gotoMod = e.target.closest('[data-goto]');
    if (gotoMod) {
      navigateToModule(gotoMod.getAttribute('data-goto'));
      return;
    }
    const gotoTab = e.target.closest('[data-goto-tab]');
    if (gotoTab) {
      _gotoTab(gotoTab.getAttribute('data-goto-tab'));
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'close-modal') {
      modal.classList.remove('open');
      return;
    }
    if (action === 'create-invite') {
      const input = container.querySelector('#ssvInviteGid');
      await _createInvite(input && input.value);
      return;
    }
    if (action === 'invite-guardian') {
      await _createInvite(btn.dataset.gid);
      return;
    }
    if (action === 'revoke-invite') {
      const id = btn.dataset.id;
      if (
        !(await confirmDialog({
          message: 'Revoke this pending invitation?',
          confirmLabel: 'Revoke',
          danger: true,
        }))
      ) {
        return;
      }
      const res = await _identityApi().post(
        '/invitations/' + encodeURIComponent(id) + '/revoke',
        {},
      );
      if (res && !res._error) {
        toast('Revoked', 'success');
        await ssvLoad();
      } else {
        toast((res && (res.error || res.message)) || 'Failed', 'error');
      }
      return;
    }

    const idx = parseInt(btn.dataset.idx, 10);
    const item = _surveys[idx];
    if (!item) return;
    if (action === 'publish') {
      const res = await _surveysApi().post('/' + item.id + '/publish', {});
      if (res && !res._error) {
        toast('Published', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'close') {
      const res = await _surveysApi().post('/' + item.id + '/close', {});
      if (res && !res._error) {
        toast('Closed', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'delete') {
      if (
        !(await confirmDialog({
          message: 'Delete draft?',
          confirmLabel: 'Delete',
          danger: true,
        }))
      ) {
        return;
      }
      const res = await _surveysApi().del('/' + item.id);
      if (res && !res._error) {
        toast('Deleted', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'results') {
      const res = await _surveysApi().get('/' + item.id + '/results');
      if (res && !res._error) {
        const s = res.summary || {};
        toast(
          'Responses: ' +
            (s.responseCount || 0) +
            ' · Completions: ' +
            (s.completionCount || 0),
          'success',
        );
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    }
  });
}

export function _resetState() {
  _container = null;
  _tab = 'overview';
  _surveys = [];
  _guardians = [];
  _guardianChildCounts = {};
  _invitations = [];
  _questions = [];
  _saving = false;
  _dirError = '';
  _invError = '';
  _formsError = '';
  _dirQ = '';
}

registerModule('school_surveys', renderSchoolSurveysPage);
