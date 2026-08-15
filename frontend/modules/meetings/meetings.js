/**
 * modules/meetings/meetings.js
 *
 * Personal + tracked meetings view used by the dashboard Meetings tab
 * (and available as a sidebar module).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tracked = [];
let _bd = [];

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export function renderMeetingsPage(container) {
  _container = container;
  container.innerHTML =
    '<div class="mtg-wrap">' +
      '<div class="mtg-toolbar">' +
        '<div class="mtg-title"><span>&#128197;</span> Meetings</div>' +
        '<div class="mtg-spacer"></div>' +
        '<button type="button" class="mtg-btn" id="mtgRefresh">Refresh</button>' +
      '</div>' +
      '<div class="mtg-hint mf">Your BD meeting requests and tracked meetings.</div>' +
      '<div class="mtg-section-title">My BD meetings</div>' +
      '<div id="mtgBdList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>' +
      '<div class="mtg-section-title">Tracked meetings</div>' +
      '<div id="mtgTrackedList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>' +
    '</div>';

  const refresh = container.querySelector('#mtgRefresh');
  if (refresh) refresh.addEventListener('click', mtgLoadData);
  mtgLoadData();
}

export async function mtgLoadData() {
  if (!_container) return;
  const session = getSession();
  const email = session ? session.email : '';

  const [tracked, bd] = await Promise.all([
    api.get('/api/meetings'),
    email
      ? api.get('/api/bd-meetings?email=' + encodeURIComponent(email))
      : Promise.resolve(null),
  ]);

  if (tracked && !tracked._error) {
    _tracked = tracked.meetings || tracked || [];
    if (!Array.isArray(_tracked)) _tracked = [];
  } else {
    _tracked = [];
  }

  if (bd && !bd._error) {
    _bd = bd.meetings || bd || [];
    if (!Array.isArray(_bd)) _bd = [];
  } else {
    _bd = [];
  }

  mtgRender();
}

function mtgRender() {
  const bdEl = _container && _container.querySelector('#mtgBdList');
  const trackedEl = _container && _container.querySelector('#mtgTrackedList');
  if (!bdEl || !trackedEl) return;

  if (!_bd.length) {
    bdEl.innerHTML = '<div class="mtg-empty">No BD meeting requests yet</div>';
  } else {
    bdEl.innerHTML = _bd
      .map(function (m) {
        return (
          '<div class="mtg-card">' +
            '<div class="mtg-card-title">' +
              _esc(m.client || m.clientName || m.title || m.name || 'Meeting') +
            '</div>' +
            '<div class="mtg-card-sub">' +
              _esc(m.date || m.meetingDate || '') +
              (m.status ? ' · ' + _esc(m.status) : '') +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  if (!_tracked.length) {
    trackedEl.innerHTML = '<div class="mtg-empty">No tracked meetings configured</div>';
  } else {
    trackedEl.innerHTML = _tracked
      .map(function (m) {
        return (
          '<div class="mtg-card">' +
            '<div class="mtg-card-title">' +
              _esc(m.name || m.title || m.platform || 'Meeting') +
            '</div>' +
            '<div class="mtg-card-sub">' +
              _esc(m.platform || '') +
              (m.client ? ' · ' + _esc(m.client) : '') +
              (m.purpose ? ' · ' + _esc(m.purpose) : '') +
            '</div>' +
          '</div>'
        );
      })
      .join('');
  }
}

registerModule('meetings', renderMeetingsPage);
