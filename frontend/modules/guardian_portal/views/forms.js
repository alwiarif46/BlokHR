/**
 * Forms — surveys.
 */

import { guardianApi } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';
import { state, isStale } from '../state.js';
import { escapeHtml, errorBlock, friendlyError, isUnavailable, emptyState } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderForms(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="surveys" id="gpSurveys">
      <h2>Surveys</h2>
      <p>Loading…</p>
    </section>
  `;
  const el = document.getElementById('gpSurveys');
  if (!el) return;
  const list = await guardianApi.get('/guardian/surveys');
  if (isStale(gen)) return;
  if (list && list._error) {
    el.innerHTML = `<h2>Surveys</h2>${
      isUnavailable(list)
        ? emptyState('Surveys unavailable', 'No forms right now.')
        : errorBlock(friendlyError(list))
    }`;
    return;
  }
  state.pendingSurveys = list.surveys || [];
  if (!state.pendingSurveys.length) {
    el.innerHTML = '<h2>Surveys</h2><p>No pending surveys.</p>';
    return;
  }
  const items = state.pendingSurveys
    .map(
      (s) =>
        `<li class="gp-thread" data-survey-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.title)}</strong>
          <span class="gp-sib-meta">${escapeHtml(s.status || 'active')}</span>
        </li>`,
    )
    .join('');
  el.innerHTML = `
    <h2>Surveys</h2>
    <ul class="gp-threads" id="gpSurveyList">${items}</ul>
    <div id="gpSurveyDetail"></div>
  `;
  el.querySelectorAll('[data-survey-id]').forEach((node) => {
    node.addEventListener('click', () => openSurvey(node.getAttribute('data-survey-id'), gen));
  });
  if (state.activeSurveyId) await openSurvey(state.activeSurveyId, gen);
}

async function openSurvey(id, gen) {
  state.activeSurveyId = id;
  const detail = document.getElementById('gpSurveyDetail');
  if (!detail) return;
  const res = await guardianApi.get(`/guardian/surveys/${encodeURIComponent(id)}`);
  if (isStale(gen)) return;
  if (res && res._error) {
    detail.innerHTML = errorBlock(friendlyError(res));
    return;
  }
  const survey = res.survey || {};
  let questions = [];
  try {
    questions = JSON.parse(survey.questionsJson || survey.questions_json || '[]');
  } catch {
    questions = [];
  }
  const fields = questions
    .map((q, idx) => {
      const key = escapeHtml(q.key);
      const fieldId = `gpQ_${escapeHtml(String(q.key || idx))}`;
      if (q.type === 'text') {
        return `<div class="gp-field"><label for="${fieldId}">${escapeHtml(q.label)}</label><textarea id="${fieldId}" data-q="${key}" rows="2"></textarea></div>`;
      }
      if (q.type === 'yesno') {
        return `<div class="gp-field"><label for="${fieldId}">${escapeHtml(q.label)}</label>
          <select id="${fieldId}" data-q="${key}"><option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option></select></div>`;
      }
      const max = q.type === 'nps' ? 10 : 5;
      const start = q.type === 'nps' ? 0 : 1;
      let opts = '';
      for (let i = start; i <= max; i++) opts += `<option value="${i}">${i}</option>`;
      return `<div class="gp-field"><label for="${fieldId}">${escapeHtml(q.label)}</label>
        <select id="${fieldId}" data-q="${key}"><option value="">Select…</option>${opts}</select></div>`;
    })
    .join('');
  detail.innerHTML = `
    <h3>${escapeHtml(survey.title || 'Survey')}</h3>
    <p class="gp-sib-meta">Responses are anonymous. Completions are tracked separately.</p>
    <form id="gpSurveyForm">
      ${fields || '<p>No questions.</p>'}
      <button class="gp-btn" type="submit">Submit</button>
    </form>
  `;
  const form = detail.querySelector('#gpSurveyForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const answers = {};
    detail.querySelectorAll('[data-q]').forEach((node) => {
      const k = node.getAttribute('data-q');
      const raw = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (node)
        .value;
      const n = Number(raw);
      answers[k] = raw === '' || isNaN(n) ? raw : n;
    });
    const body = /** @type {Record<string, unknown>} */ ({ answers });
    if (state.selectedStudentId) body.student_ref = state.selectedStudentId;
    const result = await guardianApi.post(
      `/guardian/surveys/${encodeURIComponent(id)}/respond`,
      body,
    );
    if (result && result._error) {
      toast(result.message || 'Failed to submit', 'error');
      return;
    }
    toast('Survey submitted', 'success');
    state.activeSurveyId = null;
    const main = document.getElementById('gpMain');
    if (main) await renderForms(main, gen);
  });
}
