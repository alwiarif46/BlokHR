/**
 * Inbox — message threads.
 */

import { guardianApi } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';
import { state, isStale } from '../state.js';
import { escapeHtml, errorBlock, friendlyError, isUnavailable, emptyState } from '../utils.js';

/**
 * @param {HTMLElement} main
 * @param {number} gen
 */
export async function renderInbox(main, gen) {
  main.innerHTML = `
    <section class="gp-pane" data-pane="messages" id="gpMessages">
      <h2>Messages</h2>
      <p>Loading…</p>
    </section>
  `;
  const el = document.getElementById('gpMessages');
  if (!el) return;
  if (!state.selectedStudentId) {
    el.innerHTML = `<h2>Messages</h2>${emptyState('Select a child', 'Choose a child to view school messages.')}`;
    return;
  }
  const list = await guardianApi.get('/guardian/threads');
  if (isStale(gen)) return;
  if (list && list._error) {
    el.innerHTML = `<h2>Messages</h2>${
      isUnavailable(list)
        ? emptyState('Messages unavailable', 'School messaging is not enabled yet.')
        : errorBlock(friendlyError(list))
    }`;
    return;
  }
  state.threads = (list.threads || []).filter((t) => {
    return (t.studentRef || t.student_ref) === state.selectedStudentId;
  });
  const items = state.threads
    .map((t) => {
      const active = t.id === state.activeThreadId ? ' active' : '';
      return `<li class="gp-thread${active}" data-thread-id="${escapeHtml(t.id)}">
        <strong>${escapeHtml(t.subject || 'Thread')}</strong>
        <span class="gp-sib-meta">${escapeHtml(t.state || '')}</span>
      </li>`;
    })
    .join('');
  el.innerHTML = `
    <h2>Messages</h2>
    <ul class="gp-threads" id="gpThreadList">${items || '<li>No threads yet.</li>'}</ul>
    <div id="gpThreadDetail"></div>
    <form id="gpNewThread" class="gp-new-thread">
      <h3>New message</h3>
      <div class="gp-field"><label for="gpThreadSubject">Subject</label><input id="gpThreadSubject" required /></div>
      <div class="gp-field"><label for="gpThreadBody">Message</label><textarea id="gpThreadBody" rows="2" required></textarea></div>
      <button class="gp-btn" type="submit">Send</button>
    </form>
  `;
  el.querySelectorAll('[data-thread-id]').forEach((node) => {
    node.addEventListener('click', () => openThread(node.getAttribute('data-thread-id'), gen));
  });
  el.querySelector('#gpNewThread')?.addEventListener('submit', (ev) => onCreateThread(ev, gen));
  if (state.activeThreadId) await openThread(state.activeThreadId, gen);
}

async function openThread(id, gen) {
  state.activeThreadId = id;
  const detail = document.getElementById('gpThreadDetail');
  if (!detail) return;
  const res = await guardianApi.get(`/guardian/threads/${encodeURIComponent(id)}`);
  if (isStale(gen)) return;
  if (res && res._error) {
    detail.innerHTML = errorBlock(friendlyError(res));
    return;
  }
  state.messages = res.messages || [];
  detail.innerHTML = `
    <div class="gp-messages" id="gpMsgList" data-thread="${escapeHtml(id)}">
      ${state.messages
        .map(
          (m) =>
            `<div class="gp-msg ${escapeHtml(m.direction || '')}">${escapeHtml(m.body || '')}</div>`,
        )
        .join('')}
    </div>
    <form id="gpReplyForm" class="gp-row">
      <label class="visually-hidden" for="gpReplyBody">Reply</label>
      <textarea id="gpReplyBody" rows="2" required placeholder="Reply…"></textarea>
      <button class="gp-btn" type="submit">Reply</button>
    </form>
  `;
  document.getElementById('gpReplyForm')?.addEventListener('submit', (ev) => onReply(ev, gen));
  document.querySelectorAll('#gpThreadList .gp-thread').forEach((n) => {
    n.classList.toggle('active', n.getAttribute('data-thread-id') === id);
  });
}

async function onReply(ev, gen) {
  ev.preventDefault();
  if (!state.activeThreadId) return;
  const body = /** @type {HTMLTextAreaElement} */ (document.getElementById('gpReplyBody')).value.trim();
  const res = await guardianApi.post(
    `/guardian/threads/${encodeURIComponent(state.activeThreadId)}/reply`,
    { body, author: 'guardian', direction: 'guardian' },
  );
  if (res && res._error) {
    toast(res.message || 'Reply failed', 'error');
    return;
  }
  toast('Reply sent', 'success');
  await openThread(state.activeThreadId, gen);
}

async function onCreateThread(ev, gen) {
  ev.preventDefault();
  if (!state.selectedStudentId) {
    toast('Select a child first', 'error');
    return;
  }
  const subject = /** @type {HTMLInputElement} */ (document.getElementById('gpThreadSubject'))
    .value.trim();
  const body = /** @type {HTMLTextAreaElement} */ (document.getElementById('gpThreadBody')).value.trim();
  const res = await guardianApi.post('/guardian/threads', {
    student_ref: state.selectedStudentId,
    subject,
    body,
    author: 'guardian',
  });
  if (res && res._error) {
    toast(res.message || 'Could not create thread', 'error');
    return;
  }
  toast('Message sent', 'success');
  state.activeThreadId = res.thread && res.thread.id;
  const main = document.getElementById('gpMain');
  if (main) await renderInbox(main, gen);
}
