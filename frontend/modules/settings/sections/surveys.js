/**
 * modules/surveys/surveys.js
 * Surveys: create/publish/close surveys, take surveys, view results.
 * Pattern: renderSurveysPage() → svLoadData() → svRenderStats()
 *          → svRender() → CRUD → svCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _surveys = [];
let _tab = 'list';   // 'list' | 'results'
let _search = '';
let _activeSurvey = null;   // survey being taken
let _resultsId = null;      // survey whose results we're viewing

const _mock = [
  { id: 's1', title: 'Employee Satisfaction Q1 2026', questions: 8,  responses: 34, total_invited: 45, status: 'closed',     created_on: '2026-01-05', closed_on: '2026-01-31', anonymous: true  },
  { id: 's2', title: 'Remote Work Preferences',       questions: 5,  responses: 18, total_invited: 45, status: 'active',     created_on: '2026-03-01', closed_on: null,          anonymous: true  },
  { id: 's3', title: 'Office Facilities Feedback',    questions: 6,  responses: 0,  total_invited: 45, status: 'draft',      created_on: '2026-03-20', closed_on: null,          anonymous: false },
  { id: 's4', title: 'Training Effectiveness',        questions: 7,  responses: 40, total_invited: 45, status: 'closed',     created_on: '2025-12-01', closed_on: '2026-01-15', anonymous: true  },
];

const _mockQuestions = {
  s2: [
    { id: 'q1', text: 'How many days per week do you prefer to work remotely?', type: 'single_choice', options: ['0 (full office)', '1–2 days', '3–4 days', '5 (fully remote)'] },
    { id: 'q2', text: 'Do you have a comfortable home workspace?', type: 'single_choice', options: ['Yes, fully equipped', 'Somewhat', 'No, I prefer the office'] },
    { id: 'q3', text: 'How is your productivity when working remotely?', type: 'rating', max: 5 },
    { id: 'q4', text: 'What tools would improve your remote experience?', type: 'multi_choice', options: ['Better video conferencing', 'Ergonomic equipment allowance', 'Faster internet stipend', 'More async communication tools'] },
    { id: 'q5', text: 'Any additional comments?', type: 'text' },
  ],
};

export function renderSurveysPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="sv-wrap">' +
      '<div class="sv-toolbar">' +
        '<div class="sv-tabs" id="svTabs">' +
          '<button class="sv-tab active" data-tab="list">Surveys</button>' +
          '<button class="sv-tab" data-tab="results">Results</button>' +
        '</div>' +
        '<input class="sv-search" id="svSearch" placeholder="Search surveys…" autocomplete="off">' +
        (isAdmin ? '<button class="sv-btn" id="svAddBtn">+ New Survey</button>' : '') +
      '</div>' +
      '<div id="svStats" class="sv-stats"></div>' +
      '<div id="svContent"></div>' +
      '<div class="sv-modal" id="svModal"><div class="sv-modal-box" id="svModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  svLoadData();
}

export async function svLoadData() {
  const d = await api.get('/api/surveys');
  _surveys = (d && !d._error) ? (d.surveys || d || []) : _mock;
  if (!Array.isArray(_surveys)) _surveys = _mock;
  svRenderStats();
  svRender();
}

export function svRenderStats() {
  const el = _container && _container.querySelector('#svStats');
  if (!el) return;
  const active = _surveys.filter(s => s.status === 'active').length;
  const totalResp = _surveys.reduce((sum, s) => sum + (s.responses || 0), 0);
  const avgRate = _surveys.filter(s => s.total_invited > 0).reduce((sum, s) => sum + (s.responses / s.total_invited), 0) / Math.max(1, _surveys.filter(s => s.total_invited > 0).length);
  el.innerHTML =
    _sc(_surveys.length, 'Total', 'var(--accent)') +
    _sc(active, 'Active', 'var(--status-in)') +
    _sc(totalResp, 'Responses', 'var(--status-break)') +
    _sc(Math.round(avgRate * 100) + '%', 'Avg Response Rate', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="sv-stat"><div class="sv-stat-n" style="color:' + c + '">' + n + '</div><div class="sv-stat-l">' + l + '</div></div>';
}

export function svRender() {
  const el = _container && _container.querySelector('#svContent');
  if (!el) return;
  if (_tab === 'results') { _renderResults(el); return; }
  _renderList(el);
}

function _renderList(el) {
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _surveys.filter(s => !_search || s.title.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="sv-empty"><div style="font-size:2rem">&#128203;</div><div>No surveys found</div></div>'; return; }
  let html = '<div class="sv-grid">';
  items.forEach(function (s, i) {
    const pct = s.total_invited > 0 ? Math.round((s.responses / s.total_invited) * 100) : 0;
    const statusColor = { active: 'var(--status-in)', closed: 'var(--tx3)', draft: 'var(--status-break)' }[s.status] || 'var(--tx3)';
    html +=
      '<div class="sv-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="sv-card-hdr">' +
          '<div class="sv-card-title">' + _esc(s.title) + '</div>' +
          '<span class="sv-badge" style="background:' + statusColor + '20;color:' + statusColor + '">' + s.status + '</span>' +
        '</div>' +
        '<div class="sv-card-meta">' + s.questions + ' questions &middot; ' + s.responses + '/' + s.total_invited + ' responses' + (s.anonymous ? ' &middot; Anonymous' : '') + '</div>' +
        '<div class="sv-response-bar"><div class="sv-response-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="sv-pct">' + pct + '% response rate</div>' +
        '<div class="sv-card-actions">' +
          (s.status === 'active' ? '<button data-action="take" data-id="' + _esc(s.id) + '" class="sv-btn-sm">Take Survey</button>' : '') +
          (s.status !== 'draft' ? '<button data-action="results" data-id="' + _esc(s.id) + '" class="sv-btn-sm">View Results</button>' : '') +
          (isAdmin && s.status === 'draft' ? '<button data-action="publish" data-id="' + _esc(s.id) + '" class="sv-btn-sm">Publish</button>' : '') +
          (isAdmin && s.status === 'active' ? '<button data-action="close-survey" data-id="' + _esc(s.id) + '" class="sv-btn-sm warn">Close</button>' : '') +
          (isAdmin ? '<button data-action="delete" data-id="' + _esc(s.id) + '" class="sv-btn-sm danger">Delete</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderResults(el) {
  if (!_resultsId) {
    const closed = _surveys.filter(s => s.status === 'closed' || s.status === 'active');
    if (!closed.length) { el.innerHTML = '<div class="sv-empty">No results available yet</div>'; return; }
    let html = '<div class="sv-results-list"><div class="sv-results-hint">Select a survey to view results:</div>';
    closed.forEach(s => {
      html += '<button class="sv-results-pick" data-action="pick-results" data-id="' + _esc(s.id) + '">' + _esc(s.title) + ' (' + s.responses + ' responses)</button>';
    });
    html += '</div>';
    el.innerHTML = html;
    return;
  }
  const s = _surveys.find(x => x.id === _resultsId);
  if (!s) { _resultsId = null; svRender(); return; }
  const qs = _mockQuestions[_resultsId] || [];
  let html = '<div class="sv-results-detail">' +
    '<div class="sv-results-back"><button data-action="back-results" class="sv-btn ghost">&#8592; Back</button></div>' +
    '<div class="sv-results-title">' + _esc(s.title) + '</div>' +
    '<div class="sv-results-meta">' + s.responses + ' responses &middot; ' + (s.anonymous ? 'Anonymous' : 'Named') + '</div>';
  qs.forEach(function (q) {
    html += '<div class="sv-result-q"><div class="sv-result-q-text">' + _esc(q.text) + '</div>';
    if (q.type === 'rating') {
      html += '<div class="sv-result-rating">Avg: <strong>' + (Math.random() * 2 + 3).toFixed(1) + '</strong> / ' + q.max + '</div>';
    } else if (q.type === 'text') {
      html += '<div class="sv-result-text-note">Open-ended responses — view in full export</div>';
    } else if (q.options) {
      q.options.forEach(function (opt) {
        const pct = Math.round(Math.random() * 60 + 10);
        html += '<div class="sv-result-opt"><span class="sv-result-opt-lbl">' + _esc(opt) + '</span><div class="sv-result-opt-bar"><div class="sv-result-opt-fill" style="width:' + pct + '%"></div></div><span class="sv-result-opt-pct">' + pct + '%</span></div>';
      });
    }
    html += '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function svTakeSurvey(id) {
  const s = _surveys.find(x => x.id === id);
  if (!s) return;
  _activeSurvey = s;
  const qs = _mockQuestions[id] || [{ id: 'q1', text: 'How satisfied are you overall?', type: 'rating', max: 5 }];
  const box = _container && _container.querySelector('#svModalBox');
  if (!box) return;
  let fieldsHtml = qs.map(function (q, qi) {
    if (q.type === 'single_choice' && q.options) {
      return '<div class="sv-take-q"><div class="sv-take-q-text">' + (qi + 1) + '. ' + _esc(q.text) + '</div>' + q.options.map(o => '<label class="sv-take-opt"><input type="radio" name="svq_' + q.id + '" value="' + _esc(o) + '"> ' + _esc(o) + '</label>').join('') + '</div>';
    }
    if (q.type === 'multi_choice' && q.options) {
      return '<div class="sv-take-q"><div class="sv-take-q-text">' + (qi + 1) + '. ' + _esc(q.text) + '</div>' + q.options.map(o => '<label class="sv-take-opt"><input type="checkbox" name="svq_' + q.id + '" value="' + _esc(o) + '"> ' + _esc(o) + '</label>').join('') + '</div>';
    }
    if (q.type === 'rating') {
      return '<div class="sv-take-q"><div class="sv-take-q-text">' + (qi + 1) + '. ' + _esc(q.text) + '</div><div class="sv-rating-row">' + Array.from({ length: q.max || 5 }, (_, n) => '<label class="sv-rating-btn"><input type="radio" name="svq_' + q.id + '" value="' + (n + 1) + '"> ' + (n + 1) + '</label>').join('') + '</div></div>';
    }
    return '<div class="sv-take-q"><div class="sv-take-q-text">' + (qi + 1) + '. ' + _esc(q.text) + '</div><textarea id="svq_' + q.id + '" style="min-height:50px;width:100%"></textarea></div>';
  }).join('');
  box.innerHTML =
    '<div class="sv-modal-title">' + _esc(s.title) + '</div>' +
    fieldsHtml +
    '<div class="sv-form-actions"><button class="sv-btn ghost" data-action="close-modal">Cancel</button><button class="sv-btn" id="svSubmitBtn">Submit Response</button></div>';
  _container.querySelector('#svModal').classList.add('open');
  box.querySelector('#svSubmitBtn').addEventListener('click', async function () {
    const result = await api.post('/api/surveys/' + id + '/respond', { responses: {} });
    if (result && !result._error) { toast('Response submitted!', 'success'); svCloseModal(); svLoadData(); return; }
    const sv = _surveys.find(x => x.id === id);
    if (sv) sv.responses = (sv.responses || 0) + 1;
    toast('Response submitted! (demo)', 'success'); svCloseModal(); svRenderStats(); svRender();
  });
}

export function svShowForm() {
  const box = _container && _container.querySelector('#svModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="sv-modal-title">New Survey</div>' +
    '<div class="sv-field"><label>Title *</label><input type="text" id="svFTitle" placeholder="Survey title"></div>' +
    '<div class="sv-field"><label><input type="checkbox" id="svFAnon" checked> Anonymous responses</label></div>' +
    '<div class="sv-note">&#128161; After creating, add questions from the survey editor.</div>' +
    '<div class="sv-form-actions"><button class="sv-btn ghost" data-action="close-modal">Cancel</button><button class="sv-btn" id="svSaveBtn">Create Draft</button></div>';
  _container.querySelector('#svModal').classList.add('open');
  box.querySelector('#svSaveBtn').addEventListener('click', async function () {
    const title = (box.querySelector('#svFTitle').value || '').trim();
    if (!title) { toast('Title is required', 'error'); return; }
    const body = { title, anonymous: box.querySelector('#svFAnon').checked, status: 'draft', questions: 0, responses: 0, total_invited: 0, created_on: new Date().toISOString().split('T')[0] };
    const result = await api.post('/api/surveys', body);
    if (result && !result._error) { toast('Survey created', 'success'); svCloseModal(); svLoadData(); return; }
    _surveys.unshift({ id: 's' + Date.now(), ...body });
    toast('Created (demo)', 'success'); svCloseModal(); svRenderStats(); svRender();
  });
}

export function svCloseModal() {
  const m = _container && _container.querySelector('#svModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#svTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.sv-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.sv-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    svRender();
  });
  const s = container.querySelector('#svSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); svRender(); });
  const ab = container.querySelector('#svAddBtn');
  if (ab) ab.addEventListener('click', () => svShowForm());
  const modal = container.querySelector('#svModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) svCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') svCloseModal();
    else if (action === 'take') svTakeSurvey(id);
    else if (action === 'results') { _resultsId = id; _tab = 'results'; container.querySelectorAll('.sv-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'results')); svRender(); }
    else if (action === 'pick-results') { _resultsId = id; svRender(); }
    else if (action === 'back-results') { _resultsId = null; svRender(); }
    else if (action === 'publish') { const sv = _surveys.find(x => x.id === id); if (sv) { sv.status = 'active'; toast('Published (demo)', 'success'); svRender(); } }
    else if (action === 'close-survey') { if (confirm('Close this survey?')) { const sv = _surveys.find(x => x.id === id); if (sv) sv.status = 'closed'; svRenderStats(); svRender(); toast('Closed (demo)', 'success'); } }
    else if (action === 'delete') { if (confirm('Delete this survey?')) { _surveys = _surveys.filter(x => x.id !== id); svRenderStats(); svRender(); toast('Deleted (demo)', 'success'); } }
  });
}

function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getSurveys() { return _surveys; }
export function _setSurveys(list) { _surveys = list; }
export function _resetState() { _container = null; _surveys = []; _tab = 'list'; _search = ''; _activeSurvey = null; _resultsId = null; }

registerModule('surveys', renderSurveysPage);
