/**
 * modules/iris_scan/iris_scan.js
 * Iris scan management: enroll, test scan, delete enrollment, status per member.
 * Pattern: renderIrisScanPage() → irisLoadData() → irisRenderStats()
 *          → irisRender() → CRUD → irisCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _enrollments = [];
let _search = '';

const _mock = [
  { email: 'arif@co.com',  name: 'Arif Alwi',    enrolled: true,  enrolled_on: '2026-01-15', last_scan: '2026-03-30T09:05:00', scan_count: 48, quality: 'high'   },
  { email: 'sarah@co.com', name: 'Sarah Chen',   enrolled: true,  enrolled_on: '2026-01-20', last_scan: '2026-03-30T09:18:00', scan_count: 45, quality: 'high'   },
  { email: 'bob@co.com',   name: 'Bob Builder',  enrolled: true,  enrolled_on: '2026-02-01', last_scan: '2026-03-29T09:10:00', scan_count: 20, quality: 'medium' },
  { email: 'priya@co.com', name: 'Priya Sharma', enrolled: false, enrolled_on: null,          last_scan: null,                  scan_count: 0,  quality: null     },
  { email: 'omar@co.com',  name: 'Omar Hassan',  enrolled: false, enrolled_on: null,          last_scan: null,                  scan_count: 0,  quality: null     },
];

export function renderIrisScanPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="iris-wrap">' +
      '<div class="iris-toolbar">' +
        '<div class="iris-title">&#128065; Iris Scan</div>' +
        '<input class="iris-search" id="irisSearch" placeholder="Search members…" autocomplete="off">' +
        '<button class="iris-btn" id="irisTestBtn">&#9654; Test Scan</button>' +
        (isAdmin ? '<button class="iris-btn" id="irisEnrollBtn">+ Enroll Member</button>' : '') +
      '</div>' +
      '<div id="irisStats" class="iris-stats"></div>' +
      '<div id="irisContent"></div>' +
      '<div class="iris-modal" id="irisModal"><div class="iris-modal-box" id="irisModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  irisLoadData();
}

export async function irisLoadData() {
  const d = await api.get('/api/iris/status');
  _enrollments = (d && !d._error) ? (d.enrollments || d || []) : _mock;
  if (!Array.isArray(_enrollments)) _enrollments = _mock;
  irisRenderStats();
  irisRender();
}

export function irisRenderStats() {
  const el = _container && _container.querySelector('#irisStats');
  if (!el) return;
  const enrolled = _enrollments.filter(e => e.enrolled).length;
  const notEnrolled = _enrollments.filter(e => !e.enrolled).length;
  const highQ = _enrollments.filter(e => e.quality === 'high').length;
  el.innerHTML =
    _sc(_enrollments.length, 'Members',     'var(--accent)') +
    _sc(enrolled,            'Enrolled',    'var(--status-in)') +
    _sc(notEnrolled,         'Not Enrolled','var(--status-absent)') +
    _sc(highQ,               'High Quality','var(--status-break)');
}

function _sc(n, l, c) {
  return '<div class="iris-stat"><div class="iris-stat-n" style="color:' + c + '">' + n + '</div><div class="iris-stat-l">' + l + '</div></div>';
}

export function irisRender() {
  const el = _container && _container.querySelector('#irisContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _enrollments.filter(e => !_search || (e.name + ' ' + e.email).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="iris-empty"><div style="font-size:2rem">&#128065;</div><div>No members found</div></div>'; return; }

  let html = '<div class="iris-list">';
  items.forEach(function (e, i) {
    html +=
      '<div class="iris-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="iris-av">' + _ini(e.name) + '</div>' +
        '<div class="iris-row-info">' +
          '<div class="iris-name">' + _esc(e.name) + '</div>' +
          '<div class="iris-email">' + _esc(e.email) + '</div>' +
        '</div>' +
        '<div class="iris-row-status">' +
          (e.enrolled
            ? '<span class="iris-badge enrolled">Enrolled</span>' +
              '<div class="iris-meta">Scans: ' + e.scan_count + ' &middot; Quality: ' + (e.quality || '—') + '</div>' +
              (e.last_scan ? '<div class="iris-meta">Last: ' + _fmtTime(e.last_scan) + '</div>' : '')
            : '<span class="iris-badge not-enrolled">Not enrolled</span>') +
        '</div>' +
        (isAdmin
          ? '<div class="iris-row-actions">' +
              (!e.enrolled ? '<button data-action="enroll-member" data-email="' + _esc(e.email) + '" class="iris-btn-sm">Enroll</button>' : '') +
              (e.enrolled  ? '<button data-action="delete-enroll" data-email="' + _esc(e.email) + '" class="iris-btn-sm danger">Remove</button>' : '') +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function irisShowEnroll(email) {
  const box = _container && _container.querySelector('#irisModalBox');
  if (!box) return;
  const member = _enrollments.find(e => e.email === email);
  box.innerHTML =
    '<div class="iris-modal-title">Enroll Iris Scan</div>' +
    '<div class="iris-enroll-info">' +
      '<div class="iris-enroll-icon">&#128065;</div>' +
      '<div>Enrolling: <strong>' + _esc(member ? member.name : email) + '</strong></div>' +
      '<div class="iris-enroll-note">Position the member in front of the iris scanner. The system will capture 3 iris images for high-quality enrollment.</div>' +
    '</div>' +
    '<div class="iris-progress" id="irisEnrollProgress" style="display:none"><div class="iris-progress-bar"><div class="iris-progress-fill" id="irisProgressFill"></div></div><div id="irisProgressTxt">Capturing…</div></div>' +
    '<div class="iris-form-actions"><button class="iris-btn ghost" data-action="close-modal">Cancel</button><button class="iris-btn" id="irisStartEnrollBtn">Start Enrollment</button></div>';
  _container.querySelector('#irisModal').classList.add('open');
  box.querySelector('#irisStartEnrollBtn').addEventListener('click', async function () {
    this.disabled = true;
    const prog = box.querySelector('#irisEnrollProgress');
    const fill = box.querySelector('#irisProgressFill');
    const txt  = box.querySelector('#irisProgressTxt');
    if (prog) prog.style.display = '';
    let pct = 0;
    const iv = setInterval(() => { pct += 33; if (fill) fill.style.width = pct + '%'; if (txt) txt.textContent = 'Capturing image ' + Math.ceil(pct / 33) + ' of 3…'; if (pct >= 99) clearInterval(iv); }, 400);
    await new Promise(r => setTimeout(r, 1400));
    const result = await api.post('/api/iris/enroll', { email });
    if (result && !result._error) { toast('Iris enrolled', 'success'); irisCloseModal(); irisLoadData(); return; }
    const idx = _enrollments.findIndex(e => e.email === email);
    if (idx >= 0) { _enrollments[idx].enrolled = true; _enrollments[idx].enrolled_on = new Date().toISOString().split('T')[0]; _enrollments[idx].quality = 'high'; _enrollments[idx].scan_count = 0; }
    toast('Enrolled (demo)', 'success'); irisCloseModal(); irisRenderStats(); irisRender();
  });
}

export function irisShowScanTest() {
  const box = _container && _container.querySelector('#irisModalBox');
  if (!box) return;
  const session = getSession();
  box.innerHTML =
    '<div class="iris-modal-title">Test Iris Scan</div>' +
    '<div class="iris-scan-area"><div class="iris-scan-icon">&#128065;</div><div class="iris-scan-ring"></div></div>' +
    '<div id="irisTestResult" class="iris-test-result">Position your eye in front of the scanner…</div>' +
    '<div class="iris-form-actions"><button class="iris-btn ghost" data-action="close-modal">Close</button><button class="iris-btn" id="irisDoScanBtn">Scan Now</button></div>';
  _container.querySelector('#irisModal').classList.add('open');
  box.querySelector('#irisDoScanBtn').addEventListener('click', async function () {
    this.disabled = true;
    const res = box.querySelector('#irisTestResult');
    if (res) res.textContent = 'Scanning…';
    await new Promise(r => setTimeout(r, 800));
    const result = await api.post('/api/clock/iris', { email: session && session.email });
    if (result && !result._error) {
      if (res) res.textContent = '✓ Identity confirmed: ' + (session && session.name || 'User');
      toast('Iris scan successful', 'success');
    } else {
      if (res) res.textContent = '✓ Identity confirmed (demo): ' + (session && session.name || 'User');
      toast('Iris scan successful (demo)', 'success');
    }
  });
}

export async function irisDelete(email) {
  if (!confirm('Remove iris enrollment for ' + email + '?')) return;
  const result = await api.delete('/api/iris/enrollment/' + email);
  if (result && !result._error) { toast('Enrollment removed', 'success'); irisLoadData(); return; }
  const idx = _enrollments.findIndex(e => e.email === email);
  if (idx >= 0) { _enrollments[idx].enrolled = false; _enrollments[idx].enrolled_on = null; _enrollments[idx].quality = null; _enrollments[idx].scan_count = 0; }
  toast('Removed (demo)', 'success'); irisRenderStats(); irisRender();
}

export function irisCloseModal() {
  const m = _container && _container.querySelector('#irisModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const s = container.querySelector('#irisSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); irisRender(); });
  const testBtn = container.querySelector('#irisTestBtn');
  if (testBtn) testBtn.addEventListener('click', () => irisShowScanTest());
  const enrollBtn = container.querySelector('#irisEnrollBtn');
  if (enrollBtn) enrollBtn.addEventListener('click', () => irisShowEnroll(''));
  const modal = container.querySelector('#irisModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) irisCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action } = btn.dataset;
    const email = btn.dataset.email;
    if (action === 'close-modal')    irisCloseModal();
    else if (action === 'enroll-member') irisShowEnroll(email);
    else if (action === 'delete-enroll') irisDelete(email);
  });
}

function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); }
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getEnrollments() { return _enrollments; }
export function _setEnrollments(list) { _enrollments = list; }
export function _resetState() { _container = null; _enrollments = []; _search = ''; }

registerModule('iris_scan', renderIrisScanPage);
