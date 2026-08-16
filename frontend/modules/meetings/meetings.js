/**
 * modules/meetings/meetings.js
 *
 * Personal calendar (Microsoft / Google) + BD + tracked meetings.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tracked = [];
let _bd = [];
let _myEvents = [];
let _orgEvents = [];
let _calStatus = { providers: [] };

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _fmtWhen(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function renderMeetingsPage(container) {
  _container = container;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="mtg-wrap">' +
      '<div class="mtg-toolbar">' +
        '<div class="mtg-title"><span>&#128197;</span> Meetings</div>' +
        '<div class="mtg-spacer"></div>' +
        '<button type="button" class="mtg-btn" id="mtgRefresh">Refresh</button>' +
      '</div>' +
      '<div class="mtg-hint mf">Your calendar, BD meeting requests, and tracked meetings.</div>' +
      '<div class="mtg-section-title">My calendar</div>' +
      '<div id="mtgCalActions" class="mtg-cal-actions"></div>' +
      '<div id="mtgMyCalList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>' +
      (admin
        ? '<div class="mtg-section-title">Team calendars</div>' +
          '<div id="mtgOrgCalList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>'
        : '') +
      '<div class="mtg-section-title">My BD meetings</div>' +
      '<div id="mtgBdList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>' +
      '<div class="mtg-section-title">Tracked meetings</div>' +
      '<div id="mtgTrackedList" class="mtg-list"><div class="mtg-empty">Loading…</div></div>' +
    '</div>';

  const refresh = container.querySelector('#mtgRefresh');
  if (refresh) refresh.addEventListener('click', mtgLoadData);

  const actions = container.querySelector('#mtgCalActions');
  if (actions) {
    actions.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-cal-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-cal-action');
      const provider = btn.getAttribute('data-provider');
      if (action === 'connect' && provider) mtgConnect(provider);
      if (action === 'link' && provider) mtgLink(provider);
      if (action === 'disconnect' && provider) mtgDisconnect(provider);
    });
  }

  _handleCalendarQueryToast();
  mtgLoadData();
}

function _handleCalendarQueryToast() {
  try {
    const params = new URLSearchParams(window.location.search || '');
    const cal = params.get('calendar');
    if (!cal) return;
    if (cal === 'connected') toast('Calendar connected', 'success');
    else if (cal === 'error') {
      toast(params.get('calendar_error') || 'Calendar connection failed', 'error');
    }
    params.delete('calendar');
    params.delete('calendar_error');
    const next = params.toString();
    const url = window.location.pathname + (next ? '?' + next : '') + (window.location.hash || '');
    window.history.replaceState({}, '', url);
  } catch {
    /* ignore */
  }
}

export async function mtgLoadData() {
  if (!_container) return;
  const session = getSession();
  const email = session ? session.email : '';
  const admin = _isAdmin();

  const [tracked, bd, status, myCal, orgCal] = await Promise.all([
    api.get('/api/meetings'),
    email
      ? api.get('/api/bd-meetings?email=' + encodeURIComponent(email))
      : Promise.resolve(null),
    email ? api.get('/api/meetings/calendar/status') : Promise.resolve(null),
    email ? api.get('/api/meetings/my-calendar') : Promise.resolve(null),
    admin ? api.get('/api/meetings/calendar/org') : Promise.resolve(null),
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

  if (status && !status._error) {
    _calStatus = status;
  } else {
    _calStatus = { providers: [] };
  }

  if (myCal && !myCal._error) {
    _myEvents = myCal.events || [];
    if (!Array.isArray(_myEvents)) _myEvents = [];
  } else {
    _myEvents = [];
  }

  if (orgCal && !orgCal._error) {
    _orgEvents = orgCal.events || [];
    if (!Array.isArray(_orgEvents)) _orgEvents = [];
  } else {
    _orgEvents = [];
  }

  mtgRender();
}

async function mtgConnect(provider) {
  const res = await api.get('/api/meetings/calendar/connect/' + encodeURIComponent(provider));
  if (res && !res._error && res.authorizeUrl) {
    window.location.href = res.authorizeUrl;
    return;
  }
  toast((res && (res.message || res.error)) || 'Calendar connect is not configured', 'error');
}

async function mtgLink(provider) {
  const labels = {
    zoom: 'Zoom user ID or email',
    webex: 'Webex host email',
    gotomeeting: 'GoTo organizer key',
    bluejeans: 'BlueJeans user ID',
  };
  const hint = labels[provider] || 'Platform user ID';
  const session = getSession();
  const def = session && session.email ? session.email : '';
  const externalUserId = window.prompt(hint + ' (leave blank to use your login email)', def);
  if (externalUserId === null) return;
  const res = await api.post('/api/meetings/calendar/link/' + encodeURIComponent(provider), {
    externalUserId: (externalUserId || '').trim() || undefined,
  });
  if (res && !res._error && res.success) {
    toast((provider || 'Platform') + ' linked', 'success');
    mtgLoadData();
    return;
  }
  toast((res && (res.message || res.error)) || 'Link failed', 'error');
}

async function mtgDisconnect(provider) {
  if (!confirm('Disconnect ' + provider + ' calendar?')) return;
  const res = await api.delete('/api/meetings/calendar/connect/' + encodeURIComponent(provider));
  if (res && !res._error) {
    toast('Disconnected', 'success');
    mtgLoadData();
    return;
  }
  toast((res && (res.message || res.error)) || 'Failed to disconnect', 'error');
}

function _providerLabel(provider) {
  const map = {
    microsoft: 'Microsoft',
    google: 'Google',
    zoom: 'Zoom',
    webex: 'Webex',
    gotomeeting: 'GoTo',
    bluejeans: 'BlueJeans',
  };
  return map[provider] || provider;
}

function mtgRenderCalActions() {
  const el = _container && _container.querySelector('#mtgCalActions');
  if (!el) return;
  const providers = (_calStatus && _calStatus.providers) || [];
  if (!providers.length) {
    el.innerHTML =
      '<div class="mtg-empty">Sign in to connect Microsoft, Google, or link Zoom/Webex/etc.</div>';
    return;
  }
  el.innerHTML = providers
    .map(function (p) {
      const label = _providerLabel(p.provider);
      if (!p.configured) {
        return (
          '<span class="mtg-cal-chip muted">' +
          _esc(label) +
          ' — not configured</span>'
        );
      }
      if (p.connected) {
        const idHint = p.externalUserId || p.accountEmail || '';
        return (
          '<span class="mtg-cal-chip">' +
          _esc(label) +
          (idHint ? ' · ' + _esc(idHint) : '') +
          '</span>' +
          '<button type="button" class="mtg-btn ghost" data-cal-action="disconnect" data-provider="' +
          _esc(p.provider) +
          '">Disconnect ' +
          _esc(label) +
          '</button>'
        );
      }
      if (p.authMode === 'link') {
        return (
          '<button type="button" class="mtg-btn ghost" data-cal-action="link" data-provider="' +
          _esc(p.provider) +
          '">Link ' +
          _esc(label) +
          '</button>'
        );
      }
      return (
        '<button type="button" class="mtg-btn ghost" data-cal-action="connect" data-provider="' +
        _esc(p.provider) +
        '">Connect ' +
        _esc(label) +
        '</button>'
      );
    })
    .join('');
}

function _eventCard(m, showOwner) {
  return (
    '<div class="mtg-card">' +
      '<div class="mtg-card-title">' +
        _esc(m.subject || 'Meeting') +
      '</div>' +
      '<div class="mtg-card-sub">' +
        _esc(_fmtWhen(m.start)) +
        (m.end ? ' – ' + _esc(_fmtWhen(m.end)) : '') +
        (m.provider ? ' · ' + _esc(m.provider) : '') +
        (showOwner && m.ownerEmail ? ' · ' + _esc(m.ownerEmail) : '') +
        (m.location ? ' · ' + _esc(m.location) : '') +
      '</div>' +
      (m.joinUrl
        ? '<div class="mtg-card-sub"><a class="mtg-link" href="' +
          _esc(m.joinUrl) +
          '" target="_blank" rel="noopener">Join</a></div>'
        : '') +
    '</div>'
  );
}

function mtgRender() {
  mtgRenderCalActions();

  const myEl = _container && _container.querySelector('#mtgMyCalList');
  if (myEl) {
    const connected = ((_calStatus && _calStatus.providers) || []).some(function (p) {
      return p.connected;
    });
    if (!_myEvents.length) {
      myEl.innerHTML =
        '<div class="mtg-empty">' +
        (connected
          ? 'No upcoming events in the next 14 days'
          : 'Connect Microsoft/Google or link Zoom/Webex/GoTo/BlueJeans') +
        '</div>';
    } else {
      myEl.innerHTML = _myEvents.map(function (m) { return _eventCard(m, false); }).join('');
    }
  }

  const orgEl = _container && _container.querySelector('#mtgOrgCalList');
  if (orgEl) {
    if (!_orgEvents.length) {
      orgEl.innerHTML =
        '<div class="mtg-empty">No team calendar events (users must connect their calendars)</div>';
    } else {
      orgEl.innerHTML = _orgEvents.map(function (m) { return _eventCard(m, true); }).join('');
    }
  }

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
