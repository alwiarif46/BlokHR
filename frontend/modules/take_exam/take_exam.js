/**
 * modules/take_exam/take_exam.js
 *
 * Standalone student take-exam mini page (not in school sidebar).
 * Start attempt → load paper questions → MCQ answers → save / submit.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _sittingId = '';
let _studentId = '';
let _examId = '';
/** @type {object|null} */
let _attempt = null;
/** @type {object[]} */
let _questions = [];
/** @type {Record<string, string>} */
let _answers = {};
let _busy = false;
let _error = '';
let _submitted = false;
/** @type {number|null} */
let _draftMarks = null;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _as() {
  return api.school('school-assessment');
}

function _err(res) {
  if (!res || res._error) {
    return (res && (res.error || res.message)) || 'Request failed';
  }
  return null;
}

function _readPrefill() {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const sid = sessionStorage.getItem('take_exam_sitting_id');
    const eid = sessionStorage.getItem('take_exam_exam_id');
    if (sid) _sittingId = sid;
    if (eid) _examId = eid;
  } catch (_e) {
    /* ignore */
  }
}

/**
 * @param {HTMLElement} container
 */
export async function renderTakeExamPage(container) {
  _container = container;
  _attempt = null;
  _questions = [];
  _answers = {};
  _busy = false;
  _error = '';
  _submitted = false;
  _draftMarks = null;
  _readPrefill();

  container.innerHTML =
    '<div class="tex-wrap" id="texWrap">' +
    '<div class="tex-title">Take exam</div>' +
    '<p class="tex-hint">Enter sitting and student IDs to start. Answers are saved to the assessment service.</p>' +
    '<div id="texBody"></div>' +
    '</div>';

  _render();
}

function _render() {
  const body = _container && _container.querySelector('#texBody');
  if (!body) return;

  if (_submitted) {
    body.innerHTML =
      '<div class="tex-done">' +
      '<div>Attempt submitted.</div>' +
      (_draftMarks != null
        ? '<div class="tex-hint">Auto-scored draft marks: ' + _esc(String(_draftMarks)) + '</div>'
        : '<div class="tex-hint">Subjective answers will be marked separately.</div>') +
      '</div>';
    return;
  }

  if (!_attempt) {
    body.innerHTML =
      '<div class="tex-form">' +
      '<label>Sitting ID<input class="tex-input" id="texSitting" value="' +
      _esc(_sittingId) +
      '" /></label>' +
      '<label>Student ID<input class="tex-input" id="texStudent" value="' +
      _esc(_studentId) +
      '" /></label>' +
      '<label>Exam ID <span class="tex-hint">(for paper)</span><input class="tex-input" id="texExam" value="' +
      _esc(_examId) +
      '" placeholder="optional if resolvable" /></label>' +
      '<label>&nbsp;<button type="button" class="tex-btn primary" id="texStart"' +
      (_busy ? ' disabled' : '') +
      '>Start</button></label>' +
      '</div>' +
      (_error ? '<div class="tex-error" role="alert">' + _esc(_error) + '</div>' : '');
    _bindStart();
    return;
  }

  const qHtml = _questions
    .map(function (q, idx) {
      const stem =
        (q.body && (q.body.stem || q.body.prompt || q.body.text)) ||
        q.stem ||
        'Question ' + (idx + 1);
      const kind = q.kind || 'mcq';
      const options = _mcqOptions(q);
      if (kind === 'mcq') {
        return (
          '<div class="tex-q" data-qid="' +
          _esc(q.id) +
          '">' +
          '<div class="tex-q-meta">Q' +
          (idx + 1) +
          ' · MCQ · ' +
          _esc(String(q.marks != null ? q.marks : '')) +
          ' marks</div>' +
          '<div class="tex-q-stem">' +
          _esc(String(stem)) +
          '</div>' +
          options
            .map(function (opt) {
              const checked = _answers[q.id] === opt ? ' checked' : '';
              return (
                '<label class="tex-option"><input type="radio" name="tex_' +
                _esc(q.id) +
                '" value="' +
                _esc(opt) +
                '"' +
                checked +
                ' />' +
                _esc(opt) +
                '</label>'
              );
            })
            .join('') +
          '</div>'
        );
      }
      return (
        '<div class="tex-q" data-qid="' +
        _esc(q.id) +
        '">' +
        '<div class="tex-q-meta">Q' +
        (idx + 1) +
        ' · ' +
        _esc(kind) +
        ' · ' +
        _esc(String(q.marks != null ? q.marks : '')) +
        ' marks</div>' +
        '<div class="tex-q-stem">' +
        _esc(String(stem)) +
        '</div>' +
        '<textarea class="tex-input tex-sa" data-qid="' +
        _esc(q.id) +
        '" rows="3">' +
        _esc(_answers[q.id] || '') +
        '</textarea>' +
        '</div>'
      );
    })
    .join('');

  body.innerHTML =
    '<div class="tex-status">Attempt ' +
    _esc(_attempt.id) +
    ' · in progress</div>' +
    (_error ? '<div class="tex-error" role="alert">' + _esc(_error) + '</div>' : '') +
    (qHtml || '<div class="tex-hint">No questions on this paper.</div>') +
    '<div class="tex-actions">' +
    '<button type="button" class="tex-btn" id="texSave"' +
    (_busy ? ' disabled' : '') +
    '>Save answers</button>' +
    '<button type="button" class="tex-btn primary" id="texSubmit"' +
    (_busy ? ' disabled' : '') +
    '>Submit</button>' +
    '</div>';

  _bindAttempt();
}

/**
 * @param {object} q
 * @returns {string[]}
 */
function _mcqOptions(q) {
  const body = q.body || {};
  const raw = body.options || body.choices || body.choices_list;
  if (Array.isArray(raw) && raw.length) {
    return raw.map(function (o) {
      if (typeof o === 'string') return o;
      return String(o.label || o.value || o.key || o);
    });
  }
  return ['A', 'B', 'C', 'D'];
}

function _bindStart() {
  const btn = _container.querySelector('#texStart');
  if (!btn) return;
  btn.addEventListener('click', async function () {
    if (_busy) return;
    _sittingId = ((_container.querySelector('#texSitting') || {}).value || '').trim();
    _studentId = ((_container.querySelector('#texStudent') || {}).value || '').trim();
    _examId = ((_container.querySelector('#texExam') || {}).value || '').trim();
    if (!_sittingId || !_studentId) {
      toast('Sitting ID and student ID required', 'error');
      return;
    }
    _busy = true;
    _error = '';
    _render();
    const res = await _as().post(
      '/sittings/' + encodeURIComponent(_sittingId) + '/attempts/start',
      { student_id: _studentId },
    );
    if (_err(res)) {
      _busy = false;
      _error = _err(res);
      toast(_error, 'error');
      _render();
      return;
    }
    _attempt = res;
    if (_attempt.answers && typeof _attempt.answers === 'object') {
      Object.keys(_attempt.answers).forEach(function (k) {
        const v = _attempt.answers[k];
        _answers[k] = v == null ? '' : String(typeof v === 'object' ? v.choice || v.value || '' : v);
      });
    }
    await _loadQuestions();
    _busy = false;
    _render();
  });
}

async function _loadQuestions() {
  _questions = [];
  let examId = _examId;
  if (!examId) {
    examId = await _resolveExamId(_sittingId);
    if (examId) _examId = examId;
  }
  if (!examId) {
    _error = 'Could not resolve exam for this sitting. Enter Exam ID and retry.';
    return;
  }
  const paperRes = await _as().get('/exams/' + encodeURIComponent(examId) + '/paper');
  if (_err(paperRes)) {
    _error = _err(paperRes);
    return;
  }
  const paper = paperRes.paper || paperRes;
  const ids = paper.questionIds || paper.question_ids || [];
  const loaded = [];
  for (let i = 0; i < ids.length; i++) {
    const qRes = await _as().get('/questions/' + encodeURIComponent(ids[i]));
    if (!_err(qRes) && qRes) {
      const q = qRes.question || qRes;
      loaded.push({
        id: q.id,
        kind: q.kind,
        marks: q.marks,
        body: q.body || {},
      });
    }
  }
  _questions = loaded;
}

/**
 * @param {string} sittingId
 */
async function _resolveExamId(sittingId) {
  const examsRes = await _as().get('/exams');
  if (_err(examsRes)) return '';
  const exams = (examsRes && examsRes.exams) || [];
  for (let i = 0; i < exams.length; i++) {
    const sitsRes = await _as().get(
      '/exams/' + encodeURIComponent(exams[i].id) + '/sittings',
    );
    if (_err(sitsRes)) continue;
    const sits = (sitsRes && sitsRes.sittings) || [];
    if (
      sits.some(function (s) {
        return s.id === sittingId;
      })
    ) {
      return exams[i].id;
    }
  }
  return '';
}

function _collectAnswers() {
  _container.querySelectorAll('.tex-q').forEach(function (el) {
    const qid = el.getAttribute('data-qid');
    if (!qid) return;
    const checked = el.querySelector('input[type="radio"]:checked');
    if (checked) {
      _answers[qid] = checked.value;
      return;
    }
    const ta = el.querySelector('.tex-sa');
    if (ta) _answers[qid] = ta.value || '';
  });
}

function _bindAttempt() {
  const save = _container.querySelector('#texSave');
  if (save) {
    save.addEventListener('click', async function () {
      if (_busy || !_attempt) return;
      _collectAnswers();
      _busy = true;
      _error = '';
      const res = await _as().put('/attempts/' + encodeURIComponent(_attempt.id) + '/answers', {
        answers: _answers,
      });
      _busy = false;
      if (_err(res)) {
        _error = _err(res);
        toast(_error, 'error');
        _render();
      } else {
        _attempt = res;
        toast('Answers saved', 'success');
      }
    });
  }

  const submit = _container.querySelector('#texSubmit');
  if (submit) {
    submit.addEventListener('click', async function () {
      if (_busy || !_attempt) return;
      _collectAnswers();
      _busy = true;
      await _as().put('/attempts/' + encodeURIComponent(_attempt.id) + '/answers', {
        answers: _answers,
      });
      const res = await _as().post(
        '/attempts/' + encodeURIComponent(_attempt.id) + '/submit',
        {},
      );
      _busy = false;
      if (_err(res)) {
        _error = _err(res);
        toast(_error, 'error');
        _render();
      } else {
        _submitted = true;
        _draftMarks =
          res.draft_marks != null
            ? res.draft_marks
            : res.draftMarks != null
              ? res.draftMarks
              : null;
        toast('Submitted', 'success');
        _render();
      }
    });
  }
}

registerModule('take_exam', renderTakeExamPage);
