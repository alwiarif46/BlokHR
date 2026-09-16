/**
 * Diary feed + Seen ✓ ack (shared by Home).
 */

import { guardianApi } from '../../../shared/api.js';
import { toast } from '../../../shared/toast.js';
import { state, isStale, currentRequestGen } from '../state.js';
import {
  daysAgoIso,
  escapeHtml,
  errorBlock,
  friendlyError,
  isUnavailable,
  emptyState,
} from '../utils.js';

const DIARY_KIND_LABELS = {
  homework: 'Homework',
  note: 'Note',
  remark: 'Remark',
  reminder: 'Reminder',
};

function diaryKindLabel(kind) {
  return DIARY_KIND_LABELS[kind] || kind || 'Note';
}

function groupDiaryByDate(entries) {
  const map = new Map();
  for (const e of entries) {
    const day = e.entryDate || e.entry_date || '';
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(e);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function attachmentHtml(refs) {
  if (!Array.isArray(refs) || !refs.length) return '';
  const links = refs
    .map((ref) => {
      const s = String(ref);
      const label = escapeHtml(s.length > 48 ? s.slice(0, 45) + '…' : s);
      if (/^https?:\/\//i.test(s)) {
        return `<a class="gp-diary-att" href="${escapeHtml(s)}" target="_blank" rel="noopener">${label}</a>`;
      }
      return `<span class="gp-diary-att">${label}</span>`;
    })
    .join('');
  return `<div class="gp-diary-atts">${links}</div>`;
}

function diaryHost() {
  return document.getElementById('gpDiaryHost');
}

/**
 * @param {HTMLElement} el
 * @param {{ compact?: boolean }} [opts]
 */
export function paintDiaryPane(el, opts = {}) {
  const groups = groupDiaryByDate(state.diaryEntries);
  const limit = opts.compact ? 3 : Infinity;
  let shown = 0;
  const blocks = [];
  for (const [day, items] of groups) {
    if (shown >= limit) break;
    const rows = [];
    for (const e of items) {
      if (shown >= limit) break;
      shown += 1;
      const id = e.id;
      const seen = state.diarySeenIds.has(id);
      const pending = state.diaryAckPending.has(id);
      const kind = e.kind || 'note';
      const body = e.body || '';
      const refs = e.attachmentRefs || e.attachment_refs || null;
      const unread = seen ? '' : ' unread';
      const seenBtn = seen
        ? `<span class="gp-diary-seen">Seen ✓</span>`
        : `<button type="button" class="gp-btn secondary gp-diary-ack" data-ack-id="${escapeHtml(id)}" ${pending ? 'disabled' : ''}>${pending ? '…' : 'Seen ✓'}</button>`;
      rows.push(`<article class="gp-diary-entry${unread}" data-entry-id="${escapeHtml(id)}">
        <div class="gp-diary-entry-head">
          <span class="gp-diary-dot" aria-hidden="true"></span>
          <span class="gp-chip gp-diary-kind">${escapeHtml(diaryKindLabel(kind))}</span>
          ${seenBtn}
        </div>
        <p class="gp-diary-body">${escapeHtml(body)}</p>
        ${attachmentHtml(refs)}
      </article>`);
    }
    blocks.push(`<div class="gp-diary-day" data-date="${escapeHtml(day)}">
      <h3 class="gp-diary-day-label">${escapeHtml(day)}</h3>
      ${rows.join('')}
    </div>`);
  }
  const earlier = opts.compact
    ? ''
    : `<button type="button" class="gp-btn ghost" id="gpDiaryEarlier">Load earlier</button>`;
  el.innerHTML = `
    <div id="gpDiary" class="gp-diary">
      <h2>${opts.compact ? 'Latest diary' : 'Diary'}</h2>
      <p class="gp-sib-meta">${escapeHtml(state.diaryFrom)} → ${escapeHtml(state.diaryTo)}</p>
      <div id="gpDiaryFeed">${blocks.join('') || '<p>No diary entries in this range.</p>'}</div>
      ${earlier}
    </div>
  `;
  el.querySelectorAll('[data-ack-id]').forEach((btn) => {
    btn.addEventListener('click', () => onDiaryAck(btn.getAttribute('data-ack-id')));
  });
  const earlierBtn = el.querySelector('#gpDiaryEarlier');
  if (earlierBtn) earlierBtn.addEventListener('click', onDiaryLoadEarlier);
}

/**
 * @param {number} gen
 * @param {{ compact?: boolean }} [opts]
 */
export async function loadDiary(gen, opts = {}) {
  const host = diaryHost();
  if (!host) return null;
  if (!state.selectedStudentId) {
    host.innerHTML = '<h2>Diary</h2><p>Select a child.</p>';
    return null;
  }
  host.innerHTML = '<h2>Diary</h2><p>Loading…</p>';
  const qs = new URLSearchParams({
    student_ref: state.selectedStudentId,
    from: state.diaryFrom,
    to: state.diaryTo,
  });
  const res = await guardianApi.get(`/guardian/diary?${qs.toString()}`);
  if (isStale(gen)) return null;
  if (res && res._error) {
    host.innerHTML = isUnavailable(res)
      ? emptyState('Diary unavailable', 'Diary will appear here when the school enables it.')
      : `<h2>Diary</h2>${errorBlock(friendlyError(res))}`;
    return res;
  }
  state.diaryEntries = res.entries || [];
  paintDiaryPane(host, opts);
  return res;
}

/**
 * Optimistic ack — marks Seen immediately; re-tap is idempotent.
 * @param {string} entryId
 */
export async function onDiaryAck(entryId) {
  if (!state.selectedStudentId || !entryId) return;
  if (state.diarySeenIds.has(entryId)) return;
  state.diarySeenIds.add(entryId);
  state.diaryAckPending.add(entryId);
  const host = diaryHost();
  if (host) paintDiaryPane(host);

  const res = await guardianApi.post(
    `/guardian/diary/${encodeURIComponent(entryId)}/ack`,
    { student_ref: state.selectedStudentId },
  );
  state.diaryAckPending.delete(entryId);
  if (res && res._error) {
    state.diarySeenIds.delete(entryId);
    toast(res.message || 'Could not mark seen', 'error');
  }
  const again = diaryHost();
  if (again) paintDiaryPane(again);
}

async function onDiaryLoadEarlier() {
  const gen = currentRequestGen();
  const prevFrom = state.diaryFrom;
  state.diaryFrom = daysAgoIso(14, new Date(state.diaryFrom + 'T00:00:00.000Z'));
  const qs = new URLSearchParams({
    student_ref: state.selectedStudentId,
    from: state.diaryFrom,
    to: prevFrom,
  });
  const res = await guardianApi.get(`/guardian/diary?${qs.toString()}`);
  if (isStale(gen)) return;
  if (res && res._error) {
    state.diaryFrom = prevFrom;
    toast(res.message || 'Could not load earlier entries', 'error');
    return;
  }
  const older = res.entries || [];
  const seen = new Set(state.diaryEntries.map((e) => e.id));
  for (const e of older) {
    if (!seen.has(e.id)) state.diaryEntries.push(e);
  }
  const host = diaryHost();
  if (host) paintDiaryPane(host);
}
