/**
 * modules/school_surveys/school_surveys.js
 * Staff UI for parent/guardian surveys via api.school('school-surveys').
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _surveys = [];
let _questions = [];
let _saving = false;

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _svc() {
  return api.school('school-surveys');
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

export function renderSchoolSurveysPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="ssv-wrap" id="ssvWrap">' +
      '<div class="ssv-toolbar">' +
        '<div class="ssv-title">Parent Surveys</div>' +
        '<div class="ssv-spacer"></div>' +
        '<button type="button" class="ssv-btn" id="ssvAddBtn">+ Add</button>' +
      '</div>' +
      '<div id="ssvContent"></div>' +
      '<div class="ssv-modal" id="ssvModal"><div class="ssv-modal-box" id="ssvModalBox"></div></div>' +
    '</div>';
  _bind(container);
  ssvLoad();
}

export async function ssvLoad() {
  const res = await _svc().get('');
  _surveys = res && !res._error ? res.surveys || [] : [];
  ssvRender();
}

export function ssvRender() {
  const el = _container && _container.querySelector('#ssvContent');
  if (!el) return;
  if (!_surveys.length) {
    el.innerHTML = '<div class="ssv-empty">No parent surveys yet.</div>';
    return;
  }
  el.innerHTML =
    '<div class="ssv-grid">' +
    _surveys
      .map((s, i) => {
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
            ? '<button type="button" data-action="results" data-idx="' + i + '">Results</button>'
            : '') +
          '</div></div>'
        );
      })
      .join('') +
    '</div>';
}

function ssvShowForm() {
  _questions = [{ key: 'q1', label: '', type: 'scale' }];
  const box = _container.querySelector('#ssvModalBox');
  box.innerHTML =
    '<div class="ssv-modal-title">New parent survey</div>' +
    '<div class="ssv-field"><label>Title *</label><input id="ssvTitle" type="text"></div>' +
    '<div class="ssv-field"><label>Description</label><textarea id="ssvDesc" rows="2"></textarea></div>' +
    '<div class="ssv-field"><label>Target</label><select id="ssvTarget">' +
    '<option value="all">All guardians</option>' +
    '<option value="students">Specific students</option></select></div>' +
    '<div class="ssv-field" id="ssvStudentsBlock" style="display:none">' +
    '<label>Student IDs (comma-separated)</label><input id="ssvStudents" type="text" placeholder="uuid1, uuid2"></div>' +
    '<div class="ssv-field"><label>Question 1 label</label><input id="ssvQLabel" type="text"></div>' +
    '<div class="ssv-field"><label>Question 1 type</label><select id="ssvQType">' +
    '<option value="scale">Scale</option><option value="nps">NPS</option>' +
    '<option value="rating">Rating</option><option value="yesno">Yes/No</option>' +
    '<option value="text">Text</option></select></div>' +
    '<div class="ssv-form-actions">' +
    '<button type="button" class="ssv-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="ssv-btn" id="ssvSaveBtn">Create</button></div>';
  _container.querySelector('#ssvModal').classList.add('open');
  const target = box.querySelector('#ssvTarget');
  target.addEventListener('change', () => {
    box.querySelector('#ssvStudentsBlock').style.display =
      target.value === 'students' ? '' : 'none';
  });
  box.querySelector('#ssvSaveBtn').addEventListener('click', ssvSave);
}

async function ssvSave() {
  if (_saving) return;
  const title = (_container.querySelector('#ssvTitle') || {}).value || '';
  if (!title.trim()) {
    toast('Title required', 'error');
    return;
  }
  const targetKind = (_container.querySelector('#ssvTarget') || {}).value || 'all';
  const label = (_container.querySelector('#ssvQLabel') || {}).value || 'Overall';
  const type = (_container.querySelector('#ssvQType') || {}).value || 'scale';
  const studentsRaw = (_container.querySelector('#ssvStudents') || {}).value || '';
  const studentRefs = studentsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const body = {
    title: title.trim(),
    description: (_container.querySelector('#ssvDesc') || {}).value || '',
    target_kind: targetKind,
    student_refs: studentRefs,
    questions: [{ key: 'q1', label: label.trim() || 'Overall', type }],
  };
  _saving = true;
  const res = await _svc().post('', body);
  _saving = false;
  if (res && !res._error) {
    toast('Created', 'success');
    _container.querySelector('#ssvModal').classList.remove('open');
    await ssvLoad();
    return;
  }
  toast((res && (res.error || res.message)) || 'Failed', 'error');
}

function _bind(container) {
  container.querySelector('#ssvAddBtn').addEventListener('click', ssvShowForm);
  const modal = container.querySelector('#ssvModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = parseInt(btn.dataset.idx, 10);
    if (action === 'close-modal') {
      modal.classList.remove('open');
      return;
    }
    const item = _surveys[idx];
    if (!item) return;
    if (action === 'publish') {
      const res = await _svc().post('/' + item.id + '/publish', {});
      if (res && !res._error) {
        toast('Published', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'close') {
      const res = await _svc().post('/' + item.id + '/close', {});
      if (res && !res._error) {
        toast('Closed', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'delete') {
      if (!confirm('Delete draft?')) return;
      const res = await _svc().del('/' + item.id);
      if (res && !res._error) {
        toast('Deleted', 'success');
        await ssvLoad();
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    } else if (action === 'results') {
      const res = await _svc().get('/' + item.id + '/results');
      if (res && !res._error) {
        const s = res.summary || {};
        toast(
          'Responses: ' + (s.responseCount || 0) + ' · Completions: ' + (s.completionCount || 0),
          'success',
        );
      } else toast((res && (res.error || res.message)) || 'Failed', 'error');
    }
  });
}

export function _resetState() {
  _container = null;
  _surveys = [];
  _questions = [];
  _saving = false;
}

registerModule('school_surveys', renderSchoolSurveysPage);
