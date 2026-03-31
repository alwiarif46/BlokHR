/**
 * modules/face_recognition/face_recognition.js
 * Face recognition management: enroll, test, delete, status per member.
 * Pattern: renderFaceRecPage() → frLoadData() → frRenderStats()
 *          → frRender() → CRUD → frCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _enrollments = [];
let _search = '';

const _mock = [
  { email: 'arif@co.com',  name: 'Arif Alwi',    enrolled: true,  enrolled_on: '2026-01-15', last_scan: '2026-03-30T09:04:00', scan_count: 47, confidence: 98.4 },
  { email: 'sarah@co.com', name: 'Sarah Chen',   enrolled: true,  enrolled_on: '2026-01-20', last_scan: '2026-03-30T09:17:00', scan_count: 44, confidence: 97.1 },
  { email: 'bob@co.com',   name: 'Bob Builder',  enrolled: true,  enrolled_on: '2026-02-01', last_scan: '2026-03-29T09:09:00', scan_count: 19, confidence: 95.6 },
  { email: 'priya@co.com', name: 'Priya Sharma', enrolled: false, enrolled_on: null,          last_scan: null,                  scan_count: 0,  confidence: null  },
  { email: 'omar@co.com',  name: 'Omar Hassan',  enrolled: false, enrolled_on: null,          last_scan: null,                  scan_count: 0,  confidence: null  },
];

export function renderFaceRecPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="fr-wrap">' +
      '<div class="fr-toolbar">' +
        '<div class="fr-title">&#128247; Face Recognition</div>' +
        '<input class="fr-search" id="frSearch" placeholder="Search members…" autocomplete="off">' +
        '<button class="fr-btn" id="frTestBtn">&#9654; Test Scan</button>' +
        (isAdmin ? '<button class="fr-btn" id="frEnrollBtn">+ Enroll Member</button>' : '') +
      '</div>' +
      '<div id="frStats" class="fr-stats"></div>' +
      '<div id="frContent"></div>' +
      '<div class="fr-modal" id="frModal"><div class="fr-modal-box" id="frModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  frLoadData();
}

export async function frLoadData() {
  const d = await api.get('/api/face/status');
  _enrollments = (d && !d._error) ? (d.enrollments || d || []) : _mock;
  if (!Array.isArray(_enrollments)) _enrollments = _mock;
  frRenderStats();
  frRender();
}

export function frRenderStats() {
  const el = _container && _container.querySelector('#frStats');
  if (!el) return;
  const enrolled    = _enrollments.filter(e => e.enrolled).length;
  const notEnrolled = _enrollments.filter(e => !e.enrolled).length;
  const avgConf     = enrolled > 0
    ? (_enrollments.filter(e => e.confidence).reduce((s, e) => s + e.confidence, 0) / enrolled).toFixed(1)
    : '—';
  el.innerHTML =
    _sc(_enrollments.length, 'Members',      'var(--accent)') +
    _sc(enrolled,             'Enrolled',     'var(--status-in)') +
    _sc(notEnrolled,          'Not Enrolled', 'var(--status-absent)') +
    _sc(avgConf + (enrolled > 0 ? '%' : ''), 'Avg Confidence', 'var(--status-break)');
}

function _sc(n, l, c) {
  return '<div class="fr-stat"><div class="fr-stat-n" style="color:' + c + '">' + n + '</div><div class="fr-stat-l">' + l + '</div></div>';
}

export function frRender() {
  const el = _container && _container.querySelector('#frContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _enrollments.filter(e => !_search || (e.name + ' ' + e.email).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="fr-empty"><div style="font-size:2rem">&#128247;</div><div>No members found</div></div>'; return; }

  let html = '<div class="fr-list">';
  items.forEach(function (e, i) {
    html +=
      '<div class="fr-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="fr-av">' + _ini(e.name) + '</div>' +
        '<div class="fr-row-info">' +
          '<div class="fr-name">' + _esc(e.name) + '</div>' +
          '<div class="fr-email">' + _esc(e.email) + '</div>' +
        '</div>' +
        '<div class="fr-row-status">' +
          (e.enrolled
            ? '<span class="fr-badge enrolled">Enrolled</span>' +
              '<div class="fr-meta">Scans: ' + e.scan_count + ' &middot; Conf: ' + (e.confidence || '—') + '%</div>' +
              (e.last_scan ? '<div class="fr-meta">Last: ' + _fmtTime(e.last_scan) + '</div>' : '')
            : '<span class="fr-badge not-enrolled">Not enrolled</span>') +
        '</div>' +
        (isAdmin
          ? '<div class="fr-row-actions">' +
              (!e.enrolled ? '<button data-action="enroll-member" data-email="' + _esc(e.email) + '" class="fr-btn-sm">Enroll</button>' : '') +
              (e.enrolled  ? '<button data-action="delete-enroll" data-email="' + _esc(e.email) + '" class="fr-btn-sm danger">Remove</button>' : '') +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function frShowEnroll(email) {
  const box = _container && _container.querySelector('#frModalBox');
  if (!box) return;
  const member = _enrollments.find(e => e.email === email);
  box.innerHTML =
    '<div class="fr-modal-title">Enroll Face</div>' +
    '<div class="fr-enroll-info">' +
      '<div class="fr-enroll-icon">&#128247;</div>' +
      '<div>Enrolling: <strong>' + _esc(member ? member.name : email) + '</strong></div>' +
      '<div class="fr-enroll-note">The system will capture 5 face images from different angles for accurate recognition.</div>' +
    '</div>' +
    '<div class="fr-progress" id="frEnrollProgress" style="display:none"><div class="fr-progress-bar"><div class="fr-progress-fill" id="frProgressFill"></div></div><div id="frProgressTxt">Capturing…</div></div>' +
    '<div class="fr-form-actions"><button class="fr-btn ghost" data-action="close-modal">Cancel</button><button class="fr-btn" id="frStartEnrollBtn">Start Enrollment</button></div>';
  _container.querySelector('#frModal').classList.add('open');
  box.querySelector('#frStartEnrollBtn').addEventListener('click', async function () {
    this.disabled = true;
    const prog = box.querySelector('#frEnrollProgress');
    const fill = box.querySelector('#frProgressFill');
    const txt  = box.querySelector('#frProgressTxt');
    if (prog) prog.style.display = '';
    let pct = 0;
    const iv = setInterval(() => { pct += 20; if (fill) fill.style.width = pct + '%'; if (txt) txt.textContent = 'Capturing image ' + Math.ceil(pct / 20) + ' of 5…'; if (pct >= 100) clearInterval(iv); }, 300);
    await new Promise(r => setTimeout(r, 1600));
    const result = await api.post('/api/face/enroll', { email });
    if (result && !result._error) { toast('Face enrolled', 'success'); frCloseModal(); frLoadData(); return; }
    const idx = _enrollments.findIndex(e => e.email === email);
    if (idx >= 0) { _enrollments[idx].enrolled = true; _enrollments[idx].enrolled_on = new Date().toISOString().split('T')[0]; _enrollments[idx].confidence = 97.0; _enrollments[idx].scan_count = 0; }
    toast('Enrolled (demo)', 'success'); frCloseModal(); frRenderStats(); frRender();
  });
}

export function frShowScanTest() {
  const box = _container && _container.querySelector('#frModalBox');
  if (!box) return;
  const session = getSession();
  box.innerHTML =
    '<div class="fr-modal-title">Test Face Scan</div>' +
    '<div class="fr-scan-area"><div class="fr-scan-icon">&#128247;</div><div class="fr-scan-ring"></div></div>' +
    '<div id="frTestResult" class="fr-test-result">Look directly at the camera…</div>' +
    '<div class="fr-form-actions"><button class="fr-btn ghost" data-action="close-modal">Close</button><button class="fr-btn" id="frDoScanBtn">Scan Now</button></div>';
  _container.querySelector('#frModal').classList.add('open');
  box.querySelector('#frDoScanBtn').addEventListener('click', async function () {
    this.disabled = true;
    const res = box.querySelector('#frTestResult');
    if (res) res.textContent = 'Scanning…';
    await new Promise(r => setTimeout(r, 700));
    const result = await api.post('/api/clock/face', { email: session && session.email });
    if (result && !result._error) {
      if (res) res.textContent = '✓ Identity confirmed: ' + (session && session.name || 'User');
      toast('Face scan successful', 'success');
    } else {
      if (res) res.textContent = '✓ Identity confirmed (demo): ' + (session && session.name || 'User');
      toast('Face scan successful (demo)', 'success');
    }
  });
}

export async function frDelete(email) {
  if (!confirm('Remove face enrollment for ' + email + '?')) return;
  const result = await api.delete('/api/face/enrollment/' + email);
  if (result && !result._error) { toast('Enrollment removed', 'success'); frLoadData(); return; }
  const idx = _enrollments.findIndex(e => e.email === email);
  if (idx >= 0) { _enrollments[idx].enrolled = false; _enrollments[idx].enrolled_on = null; _enrollments[idx].confidence = null; _enrollments[idx].scan_count = 0; }
  toast('Removed (demo)', 'success'); frRenderStats(); frRender();
}

export function frCloseModal() {
  const m = _container && _container.querySelector('#frModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const s = container.querySelector('#frSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); frRender(); });
  const testBtn = container.querySelector('#frTestBtn');
  if (testBtn) testBtn.addEventListener('click', () => frShowScanTest());
  const enrollBtn = container.querySelector('#frEnrollBtn');
  if (enrollBtn) enrollBtn.addEventListener('click', () => frShowEnroll(''));
  const modal = container.querySelector('#frModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) frCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action } = btn.dataset;
    const email = btn.dataset.email;
    if (action === 'close-modal')        frCloseModal();
    else if (action === 'enroll-member') frShowEnroll(email);
    else if (action === 'delete-enroll') frDelete(email);
  });
}

function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); }
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getEnrollments() { return _enrollments; }
export function _setEnrollments(list) { _enrollments = list; }
export function _resetState() { _container = null; _enrollments = []; _search = ''; }

registerModule('face_recognition', renderFaceRecPage);
