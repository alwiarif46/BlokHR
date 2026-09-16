/**
 * modules/school_circulars/school_circulars.js
 * Office circulars — fan-out via school-engagement POST /circulars.
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _recent = [];
let _lastCount = null;
let _loadError = '';

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _eng() {
  return api.school('school-engagement');
}

export function renderSchoolCircularsPage(container) {
  _container = container;
  _recent = [];
  _lastCount = null;
  _loadError = '';
  container.innerHTML =
    '<div class="scirc-wrap" id="scircWrap">' +
    '<div class="scirc-title">Circulars</div>' +
    '<div id="scircContent"></div></div>';
  scircLoad();
}

export async function scircLoad() {
  _loadError = '';
  const res = await _eng().get('/messages');
  if (res && !res._error) {
    _recent = (res.messages || []).slice(0, 20);
  } else if (res && res._error) {
    _loadError = res.message || res.error || 'Could not load messages';
  }
  scircRender();
}

export function scircRender() {
  if (!_container) return;
  const content = _container.querySelector('#scircContent');
  if (!content) return;

  const rows = _recent
    .map(function (m) {
      return (
        '<tr><td>' +
        _esc(m.createdAt || m.created_at || '') +
        '</td><td class="scirc-mono">' +
        _esc(m.guardianRef || m.guardian_ref || '') +
        '</td><td>' +
        _esc(m.templateKey || m.template_key || '') +
        '</td><td>' +
        _esc((m.renderedBody || m.rendered_body || '').slice(0, 80)) +
        '</td></tr>'
      );
    })
    .join('');

  content.innerHTML =
    '<form class="scirc-form" id="scircForm">' +
    '<label>Section ref <input class="scirc-input" name="section_ref" placeholder="8|A" required /></label>' +
    '<label>Title <input class="scirc-input" name="title" placeholder="Optional title" /></label>' +
    '<label>Body <textarea class="scirc-input" name="body" rows="4" required placeholder="Circular text for guardians"></textarea></label>' +
    '<button type="submit" class="scirc-btn">Send circular</button>' +
    '</form>' +
    (_lastCount != null
      ? '<div class="scirc-ok">Sent to ' + _esc(String(_lastCount)) + ' guardian(s).</div>'
      : '') +
    (_loadError ? '<div class="scirc-err">' + _esc(_loadError) + '</div>' : '') +
    '<h4 class="scirc-sub">Recent outbound</h4>' +
    '<table class="scirc-table"><thead><tr><th>When</th><th>Guardian</th><th>Template</th><th>Preview</th></tr></thead><tbody>' +
    (rows || '<tr><td colspan="4">No messages yet</td></tr>') +
    '</tbody></table>';

  content.querySelector('#scircForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const res = await _eng().post('/circulars', {
      section_ref: String(fd.get('section_ref') || '').trim(),
      title: String(fd.get('title') || '').trim() || null,
      body: String(fd.get('body') || '').trim(),
    });
    if (res && !res._error) {
      _lastCount = res.count != null ? res.count : (res.messages || []).length;
      toast('Circular sent to ' + _lastCount + ' guardian(s)', 'success');
      await scircLoad();
    } else {
      toast((res && (res.message || res.error)) || 'Send failed', 'error');
    }
  });
}

export function _resetState() {
  _container = null;
  _recent = [];
  _lastCount = null;
  _loadError = '';
}

registerModule('school_circulars', renderSchoolCircularsPage);
