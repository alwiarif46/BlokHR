/**
 * modules/surveys/surveys.js
 * Employee surveys — pending responses, admin authoring, results.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const QUESTION_TYPES = [
  { value: 'scale', label: 'Scale (1-5)' },
  { value: 'nps', label: 'NPS (0-10)' },
  { value: 'rating', label: 'Rating (1-5)' },
  { value: 'choice', label: 'Single choice' },
  { value: 'multi', label: 'Multi choice' },
  { value: 'text', label: 'Free text' },
  { value: 'yesno', label: 'Yes / No' },
];

let _container = null;
let _tab = 'pending';
let _pending = [];
let _surveys = [];
let _editing = null;
let _questions = [];
let _groups = [];
let _saving = false;
let _resultsSurveyId = null;
let _resultsSummary = null;
let _resultsEnps = null;
let _actionItems = [];
let _takeSurvey = null;

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _parseQuestions(survey) {
  if (!survey) return [];
  try {
    const raw = survey.questions_json || survey.questions || '[]';
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function _parseTargetGroupIds(survey) {
  const raw = (survey && (survey.target_group_ids || survey.targetGroupIds)) || '';
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function _targetLabel(survey) {
  const ids = _parseTargetGroupIds(survey);
  if (!ids.length) return 'All employees';
  if (ids.length === 1) {
    const g = _groups.find((x) => x.id === ids[0]);
    return g ? g.name : '1 group';
  }
  return ids.length + ' groups';
}

export function renderSurveysPage(container) {
  _container = container;
  _tab = 'pending';
  _editing = null;
  _takeSurvey = null;
  _resultsSurveyId = null;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="sv-wrap" id="svWrap">' +
      '<div class="sv-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128202;</span> Surveys</div>' +
        '<div class="sv-spacer"></div>' +
        (admin ? '<button class="sv-btn" type="button" id="svAddBtn">+ Add</button>' : '') +
      '</div>' +
      '<div class="sv-tabs" id="svTabs">' +
        '<button type="button" class="sv-tab active" data-tab="pending">For me</button>' +
        (admin
          ? '<button type="button" class="sv-tab" data-tab="all">All surveys</button>' +
            '<button type="button" class="sv-tab" data-tab="results">Results</button>'
          : '') +
      '</div>' +
      '<div class="sv-stats" id="svStats"></div>' +
      '<div id="svContent"></div>' +
      '<div class="sv-modal" id="svModal"><div class="sv-modal-box wide" id="svModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  svLoadData();
}

export async function svLoadData() {
  const pendingRes = await api.get('/api/surveys/pending');
  _pending = pendingRes && !pendingRes._error ? pendingRes.surveys || [] : [];
  if (!Array.isArray(_pending)) _pending = [];

  if (_isAdmin()) {
    const [listRes, settingsRes] = await Promise.all([
      api.get('/api/surveys'),
      api.get('/api/settings'),
    ]);
    _surveys = listRes && !listRes._error ? listRes.surveys || [] : [];
    if (!Array.isArray(_surveys)) _surveys = [];
    _groups =
      settingsRes && !settingsRes._error && Array.isArray(settingsRes.groups)
        ? settingsRes.groups
        : [];
  } else {
    _surveys = [];
  }

  svRenderStats();
  svRender();
}

export function svRenderStats() {
  const el = _container && _container.querySelector('#svStats');
  if (!el) return;
  const active = _surveys.filter((s) => s.status === 'active').length;
  const responses = _surveys.length
    ? _surveys.reduce((n, s) => n + (Number(s.response_count) || 0), 0)
    : _pending.length;
  el.innerHTML =
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--accent)">' +
    (_isAdmin() ? _surveys.length : _pending.length) +
    '</div><div class="sv-stat-label">' +
    (_isAdmin() ? 'Total Surveys' : 'Pending') +
    '</div></div>' +
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--status-in)">' +
    (_isAdmin() ? active : _pending.length) +
    '</div><div class="sv-stat-label">' +
    (_isAdmin() ? 'Active' : 'For you') +
    '</div></div>' +
    '<div class="sv-stat"><div class="sv-stat-num" style="color:var(--status-break)">' +
    responses +
    '</div><div class="sv-stat-label">' +
    (_isAdmin() ? 'Listed' : 'To complete') +
    '</div></div>';
}

export function svRender() {
  const el = _container && _container.querySelector('#svContent');
  if (!el) return;

  if (_takeSurvey) {
    el.innerHTML = _renderTakeSurvey(_takeSurvey);
    return;
  }

  if (_tab === 'pending') {
    if (!_pending.length) {
      el.innerHTML =
        '<div class="sv-empty"><div class="sv-empty-icon">&#128202;</div><div class="sv-empty-text">No pending surveys</div></div>';
      return;
    }
    el.innerHTML =
      '<div class="sv-grid">' +
      _pending
        .map((item, i) => {
          return (
            '<div class="sv-card" data-id="' +
            _esc(item.id) +
            '">' +
            '<div class="sv-card-title">' +
            _esc(item.title) +
            '</div>' +
            '<div class="sv-card-sub">' +
            _esc(_targetLabel(item)) +
            (item.anonymous ? ' · Anonymous' : '') +
            '</div>' +
            '<div class="sv-card-actions">' +
            '<button type="button" data-action="take" data-idx="' +
            i +
            '">Respond</button>' +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    return;
  }

  if (_tab === 'all') {
    if (!_surveys.length) {
      el.innerHTML =
        '<div class="sv-empty"><div class="sv-empty-icon">&#128202;</div><div class="sv-empty-text">No surveys yet — create one</div></div>';
      return;
    }
    el.innerHTML =
      '<div class="sv-grid">' +
      _surveys
        .map((item, i) => {
          const qs = _parseQuestions(item);
          return (
            '<div class="sv-card" data-id="' +
            _esc(item.id) +
            '">' +
            '<div class="sv-card-title">' +
            _esc(item.title) +
            '</div>' +
            '<div class="sv-card-sub">' +
            _esc(_targetLabel(item)) +
            ' · ' +
            qs.length +
            ' questions</div>' +
            '<span class="sv-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
            _esc(item.status) +
            '</span>' +
            '<div class="sv-card-actions">' +
            (item.status === 'draft'
              ? '<button type="button" data-action="edit" data-idx="' +
                i +
                '">Edit</button>' +
                '<button type="button" data-action="publish" data-idx="' +
                i +
                '">Publish</button>' +
                '<button type="button" class="danger" data-action="delete" data-idx="' +
                i +
                '">Delete</button>'
              : '') +
            (item.status === 'active'
              ? '<button type="button" data-action="close" data-idx="' +
                i +
                '">Close</button>' +
                '<button type="button" data-action="view-results" data-id="' +
                _esc(item.id) +
                '">Results</button>'
              : '') +
            (item.status === 'closed'
              ? '<button type="button" data-action="view-results" data-id="' +
                _esc(item.id) +
                '">Results</button>'
              : '') +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    return;
  }

  if (_tab === 'results') {
    el.innerHTML = _renderResultsPanel();
  }
}

function _renderTakeSurvey(item) {
  const qs = _parseQuestions(item);
  const subjectHint =
    '<p class="sv-hint">Your responses are anonymous. Completions are tracked separately from answers.</p>';
  let fields = '';
  qs.forEach((q) => {
    fields +=
      '<div class="sv-field" data-qkey="' +
      _esc(q.key) +
      '"><label>' +
      _esc(q.label) +
      (q.required ? ' *' : '') +
      '</label>' +
      _questionInputHtml(q) +
      '</div>';
  });
  return (
    '<div class="sv-take">' +
    '<button type="button" class="sv-btn ghost" data-action="back-pending">← Back</button>' +
    '<h2 class="sv-take-title">' +
    _esc(item.title) +
    '</h2>' +
    subjectHint +
    (item.description
      ? '<p class="sv-card-sub">' + _esc(item.description) + '</p>'
      : '') +
    fields +
    '<div class="sv-form-actions">' +
    '<button type="button" class="sv-btn" data-action="submit-response">Submit</button>' +
    '</div></div>'
  );
}

function _questionInputHtml(q) {
  const key = _esc(q.key);
  if (q.type === 'text') {
    return '<textarea id="svA_' + key + '" rows="3"></textarea>';
  }
  if (q.type === 'yesno') {
    return (
      '<select id="svA_' +
      key +
      '"><option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option></select>'
    );
  }
  if (q.type === 'choice' || q.type === 'multi') {
    const opts = (q.options || []).map((o) => _esc(o));
    if (q.type === 'multi') {
      return opts
        .map(
          (o, i) =>
            '<label class="sv-check"><input type="checkbox" name="svA_' +
            key +
            '" value="' +
            o +
            '"> ' +
            o +
            '</label>',
        )
        .join('');
    }
    return (
      '<select id="svA_' +
      key +
      '"><option value="">Select…</option>' +
      opts.map((o) => '<option value="' + o + '">' + o + '</option>').join('') +
      '</select>'
    );
  }
  if (q.type === 'nps') {
    let opts = '';
    for (let i = 0; i <= 10; i++) opts += '<option value="' + i + '">' + i + '</option>';
    return '<select id="svA_' + key + '"><option value="">Select…</option>' + opts + '</select>';
  }
  // scale / rating
  let opts = '';
  for (let i = 1; i <= 5; i++) opts += '<option value="' + i + '">' + i + '</option>';
  return '<select id="svA_' + key + '"><option value="">Select…</option>' + opts + '</select>';
}

function _collectAnswers(qs) {
  const answers = {};
  for (const q of qs) {
    if (q.type === 'multi') {
      const boxes = _container.querySelectorAll('input[name="svA_' + q.key + '"]:checked');
      answers[q.key] = Array.from(boxes).map((b) => b.value);
      continue;
    }
    const el = _container.querySelector('#svA_' + q.key);
    if (!el) continue;
    const raw = el.value;
    if (q.type === 'text' || q.type === 'yesno' || q.type === 'choice') {
      answers[q.key] = raw;
    } else {
      const n = Number(raw);
      answers[q.key] = raw === '' ? '' : isNaN(n) ? raw : n;
    }
  }
  return answers;
}

function _renderResultsPanel() {
  const options = _surveys
    .filter((s) => s.status === 'active' || s.status === 'closed')
    .map(
      (s) =>
        '<option value="' +
        _esc(s.id) +
        '"' +
        (s.id === _resultsSurveyId ? ' selected' : '') +
        '>' +
        _esc(s.title) +
        ' (' +
        _esc(s.status) +
        ')</option>',
    )
    .join('');

  let body =
    '<div class="sv-results-bar">' +
    '<div class="sv-field" style="margin:0;flex:1"><label>Survey</label>' +
    '<select id="svResultsPick"><option value="">Select a survey…</option>' +
    options +
    '</select></div>' +
    '</div>';

  if (!_resultsSurveyId) {
    return (
      body +
      '<div class="sv-empty"><div class="sv-empty-text">Select a survey to view results</div></div>'
    );
  }

  if (_resultsSummary) {
    const avgRows = Object.entries(_resultsSummary.averages || {})
      .map(
        ([k, v]) =>
          '<tr><td>' + _esc(k) + '</td><td>' + _esc(String(v)) + '</td></tr>',
      )
      .join('');
    body +=
      '<div class="sv-stats" style="margin-top:12px">' +
      '<div class="sv-stat"><div class="sv-stat-num">' +
      _esc(String(_resultsSummary.responseCount || 0)) +
      '</div><div class="sv-stat-label">Responses</div></div>' +
      '<div class="sv-stat"><div class="sv-stat-num">' +
      _esc(String(_resultsSummary.completionCount || 0)) +
      '</div><div class="sv-stat-label">Completions</div></div>' +
      (_resultsEnps
        ? '<div class="sv-stat"><div class="sv-stat-num">' +
          _esc(String(_resultsEnps.enps)) +
          '</div><div class="sv-stat-label">eNPS</div></div>'
        : '') +
      '</div>' +
      (avgRows
        ? '<table class="sv-table"><thead><tr><th>Question</th><th>Average</th></tr></thead><tbody>' +
          avgRows +
          '</tbody></table>'
        : '');
  }

  body +=
    '<div class="sv-action-block"><h3>Action items</h3>' +
    '<div class="sv-field"><label>New action</label><input type="text" id="svActionTitle" placeholder="Title"></div>' +
    '<button type="button" class="sv-btn" data-action="add-action">Add</button>' +
    '<ul class="sv-action-list">' +
    _actionItems
      .map(
        (a) =>
          '<li><strong>' +
          _esc(a.title) +
          '</strong> <span class="sv-card-sub">' +
          _esc(a.status) +
          (a.assigned_to ? ' · ' + a.assigned_to : '') +
          '</span></li>',
      )
      .join('') +
    '</ul></div>';

  return body;
}

export function svShowForm(item) {
  if (!_isAdmin()) return;
  _editing = item || null;
  _questions = item ? _parseQuestions(item).map((q) => ({ ...q })) : [];
  const selectedGroups = new Set(_parseTargetGroupIds(item));
  const isEdit = !!item;
  const box = _container && _container.querySelector('#svModalBox');
  if (!box) return;
  const hasTargets = selectedGroups.size > 0;
  const groupChecks = _groups.length
    ? _groups
        .map(
          (g) =>
            '<label class="sv-check"><input type="checkbox" name="svF_group" value="' +
            _esc(g.id) +
            '"' +
            (selectedGroups.has(g.id) ? ' checked' : '') +
            '> ' +
            _esc(g.name || g.id) +
            '</label>',
        )
        .join('')
    : '<p class="sv-card-sub">No groups configured yet. Create groups in Settings.</p>';

  box.innerHTML =
    '<div class="sv-modal-title">' +
    (isEdit ? 'Edit survey' : 'New survey') +
    '</div>' +
    '<div class="sv-field"><label>Title *</label><input type="text" id="svF_title" value="' +
    _esc((item && item.title) || '') +
    '"></div>' +
    '<div class="sv-field"><label>Description</label><textarea id="svF_desc" rows="2">' +
    _esc((item && item.description) || '') +
    '</textarea></div>' +
    '<div class="sv-field"><label>Target</label><select id="svF_targetMode">' +
    '<option value="all"' +
    (!hasTargets ? ' selected' : '') +
    '>All employees</option>' +
    '<option value="groups"' +
    (hasTargets ? ' selected' : '') +
    '>Specific groups</option></select></div>' +
    '<div class="sv-field" id="svGroupsBlock" style="display:' +
    (hasTargets ? 'block' : 'none') +
    '"><label>Groups</label><div class="sv-group-list" id="svF_groups">' +
    groupChecks +
    '</div></div>' +
    '<div class="sv-field"><label class="sv-check-label"><input type="checkbox" id="svF_anonymous"' +
    (!(item && item.anonymous === 0) ? ' checked' : '') +
    '> Anonymous responses</label></div>' +
    '<div class="sv-q-head"><strong>Questions</strong> <button type="button" class="sv-btn ghost" data-action="add-question">+ Question</button></div>' +
    '<div id="svQuestions"></div>' +
    '<div class="sv-form-actions">' +
    '<button type="button" class="sv-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="sv-btn" id="svSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#svModal');
  if (modal) modal.classList.add('open');
  _renderQuestionBuilder();
  const mode = box.querySelector('#svF_targetMode');
  if (mode) {
    mode.addEventListener('change', function () {
      const block = box.querySelector('#svGroupsBlock');
      if (block) block.style.display = mode.value === 'groups' ? 'block' : 'none';
    });
  }
  box.querySelector('#svSaveBtn').addEventListener('click', svSave);
}

function _renderQuestionBuilder() {
  const el = _container && _container.querySelector('#svQuestions');
  if (!el) return;
  if (!_questions.length) {
    el.innerHTML = '<p class="sv-card-sub">No questions yet.</p>';
    return;
  }
  el.innerHTML = _questions
    .map((q, i) => {
      const typeOpts = QUESTION_TYPES.map(
        (t) =>
          '<option value="' +
          t.value +
          '"' +
          (q.type === t.value ? ' selected' : '') +
          '>' +
          t.label +
          '</option>',
      ).join('');
      const needOpts = q.type === 'choice' || q.type === 'multi';
      return (
        '<div class="sv-q-row" data-qi="' +
        i +
        '">' +
        '<input type="text" data-qf="key" placeholder="key" value="' +
        _esc(q.key || '') +
        '">' +
        '<input type="text" data-qf="label" placeholder="Label" value="' +
        _esc(q.label || '') +
        '">' +
        '<select data-qf="type">' +
        typeOpts +
        '</select>' +
        (needOpts
          ? '<input type="text" data-qf="options" placeholder="options a|b|c" value="' +
            _esc((q.options || []).join('|')) +
            '">'
          : '') +
        '<button type="button" class="danger" data-action="rm-question" data-qi="' +
        i +
        '">×</button>' +
        '<button type="button" data-action="up-question" data-qi="' +
        i +
        '">↑</button>' +
        '<button type="button" data-action="down-question" data-qi="' +
        i +
        '">↓</button>' +
        '</div>'
      );
    })
    .join('');
}

function _readQuestionsFromDom() {
  const rows = _container.querySelectorAll('.sv-q-row');
  const out = [];
  rows.forEach((row) => {
    const key = (row.querySelector('[data-qf="key"]') || {}).value || '';
    const label = (row.querySelector('[data-qf="label"]') || {}).value || '';
    const type = (row.querySelector('[data-qf="type"]') || {}).value || 'text';
    const optEl = row.querySelector('[data-qf="options"]');
    const options = optEl
      ? String(optEl.value || '')
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    out.push({ key: key.trim(), label: label.trim(), type, options, required: false });
  });
  _questions = out;
  return out;
}

export async function svSave() {
  if (_saving || !_isAdmin()) return;
  const title = (_container.querySelector('#svF_title') || {}).value || '';
  if (!title.trim()) {
    toast('Title is required', 'error');
    return;
  }
  const questions = _readQuestionsFromDom();
  const anonymous = !!(_container.querySelector('#svF_anonymous') || {}).checked;
  const description = (_container.querySelector('#svF_desc') || {}).value || '';
  const targetMode = (_container.querySelector('#svF_targetMode') || {}).value || 'all';
  let targetGroupIds = [];
  if (targetMode === 'groups') {
    targetGroupIds = Array.from(
      _container.querySelectorAll('input[name="svF_group"]:checked'),
    ).map((el) => el.value);
    if (!targetGroupIds.length) {
      toast('Select at least one group, or choose All employees', 'error');
      return;
    }
  }

  const body = {
    title: title.trim(),
    description,
    anonymous,
    questions,
    targetGroupIds,
  };

  _saving = true;
  const btn = _container.querySelector('#svSaveBtn');
  if (btn) btn.disabled = true;

  let result;
  if (_editing && _editing.id) {
    result = await api.put('/api/surveys/' + _editing.id, body);
  } else {
    result = await api.post('/api/surveys', body);
  }

  _saving = false;
  if (btn) btn.disabled = false;

  if (result && !result._error) {
    toast(_editing ? 'Updated' : 'Created', 'success');
    svCloseModal();
    await svLoadData();
    return;
  }
  toast((result && result.message) || 'Failed to save', 'error');
}

export async function svDelete(idx) {
  if (!_isAdmin()) return;
  const item = _surveys[idx];
  if (!item) return;
  if (!confirm('Delete this draft survey?')) return;
  const result = await api.delete('/api/surveys/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await svLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function svPublish(idx) {
  if (!_isAdmin()) return;
  const item = _surveys[idx];
  if (!item) return;
  const result = await api.post('/api/surveys/' + item.id + '/publish', {});
  if (result && !result._error) {
    toast('Published', 'success');
    await svLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function svClose(idx) {
  if (!_isAdmin()) return;
  const item = _surveys[idx];
  if (!item) return;
  const result = await api.post('/api/surveys/' + item.id + '/close', {});
  if (result && !result._error) {
    toast('Closed', 'success');
    await svLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export async function svLoadResults(surveyId) {
  _resultsSurveyId = surveyId;
  _tab = 'results';
  _syncTabs();
  const [sum, enps, actions] = await Promise.all([
    api.get('/api/surveys/' + surveyId + '/results'),
    api.get('/api/surveys/' + surveyId + '/enps'),
    api.get('/api/surveys/' + surveyId + '/action-items'),
  ]);
  _resultsSummary = sum && !sum._error ? sum.summary : null;
  _resultsEnps = enps && !enps._error ? enps.enps : null;
  _actionItems = actions && !actions._error ? actions.actionItems || [] : [];
  svRender();
}

export function svCloseModal() {
  const modal = _container && _container.querySelector('#svModal');
  if (modal) modal.classList.remove('open');
  _editing = null;
}

function _syncTabs() {
  const tabs = _container && _container.querySelectorAll('.sv-tab');
  if (!tabs) return;
  tabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#svAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => svShowForm(null));

  const tabs = container.querySelector('#svTabs');
  if (tabs) {
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      _tab = btn.dataset.tab;
      _takeSurvey = null;
      _syncTabs();
      svRender();
    });
  }

  const modal = container.querySelector('#svModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) svCloseModal();
    });
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);

    if (action === 'close-modal') {
      svCloseModal();
      return;
    }
    if (action === 'add-question') {
      _readQuestionsFromDom();
      _questions.push({
        key: 'q' + (_questions.length + 1),
        label: '',
        type: 'scale',
      });
      _renderQuestionBuilder();
      return;
    }
    if (action === 'rm-question') {
      _readQuestionsFromDom();
      _questions.splice(parseInt(btn.dataset.qi, 10), 1);
      _renderQuestionBuilder();
      return;
    }
    if (action === 'up-question') {
      const i = parseInt(btn.dataset.qi, 10);
      _readQuestionsFromDom();
      if (i > 0) {
        const t = _questions[i - 1];
        _questions[i - 1] = _questions[i];
        _questions[i] = t;
      }
      _renderQuestionBuilder();
      return;
    }
    if (action === 'down-question') {
      const i = parseInt(btn.dataset.qi, 10);
      _readQuestionsFromDom();
      if (i < _questions.length - 1) {
        const t = _questions[i + 1];
        _questions[i + 1] = _questions[i];
        _questions[i] = t;
      }
      _renderQuestionBuilder();
      return;
    }
    if (action === 'edit') {
      svShowForm(_surveys[idx]);
      return;
    }
    if (action === 'delete') {
      await svDelete(idx);
      return;
    }
    if (action === 'publish') {
      await svPublish(idx);
      return;
    }
    if (action === 'close') {
      await svClose(idx);
      return;
    }
    if (action === 'take') {
      _takeSurvey = _pending[idx];
      svRender();
      return;
    }
    if (action === 'back-pending') {
      _takeSurvey = null;
      svRender();
      return;
    }
    if (action === 'submit-response') {
      if (!_takeSurvey) return;
      const qs = _parseQuestions(_takeSurvey);
      const answers = _collectAnswers(qs);
      const body = { answers };
      const result = await api.post('/api/surveys/' + _takeSurvey.id + '/respond', body);
      if (result && !result._error) {
        toast('Submitted', 'success');
        _takeSurvey = null;
        await svLoadData();
        return;
      }
      toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'view-results') {
      await svLoadResults(btn.dataset.id);
      return;
    }
    if (action === 'add-action') {
      if (!_resultsSurveyId) return;
      const title = (_container.querySelector('#svActionTitle') || {}).value || '';
      if (!title.trim()) {
        toast('Title required', 'error');
        return;
      }
      const result = await api.post('/api/surveys/' + _resultsSurveyId + '/action-items', {
        title: title.trim(),
      });
      if (result && !result._error) {
        toast('Action added', 'success');
        await svLoadResults(_resultsSurveyId);
        return;
      }
      toast((result && result.message) || 'Failed', 'error');
    }
  });

  container.addEventListener('change', async (e) => {
    if (e.target && e.target.id === 'svResultsPick') {
      const id = e.target.value;
      if (id) await svLoadResults(id);
      else {
        _resultsSurveyId = null;
        _resultsSummary = null;
        svRender();
      }
      return;
    }
    if (e.target && e.target.dataset && e.target.dataset.qf === 'type') {
      _readQuestionsFromDom();
      _renderQuestionBuilder();
    }
  });
}

export function _getData() {
  return { pending: _pending, surveys: _surveys };
}
export function _setData(d) {
  if (d.pending) _pending = d.pending;
  if (d.surveys) _surveys = d.surveys;
}
export function _resetState() {
  _container = null;
  _tab = 'pending';
  _pending = [];
  _surveys = [];
  _editing = null;
  _questions = [];
  _groups = [];
  _saving = false;
  _resultsSurveyId = null;
  _takeSurvey = null;
}

registerModule('surveys', renderSurveysPage);
