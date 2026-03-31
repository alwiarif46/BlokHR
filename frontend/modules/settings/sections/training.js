/**
 * modules/training/training.js
 * Training & LMS: courses, enrolment, module completion, certificates.
 * Pattern: renderTrainingPage() → trnLoadData() → trnRenderStats()
 *          → trnRender() → CRUD → trnCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _courses = [];
let _myCourses = [];
let _certs = [];
let _tab = 'browse';  // 'browse' | 'my' | 'certificates'
let _search = '';

const _mockCourses = [
  { id: 'c1', name: 'Workplace Safety & Compliance',  modules: 5,  duration_hours: 3,  enrolled: 45, completed: 38, mandatory: true,  category: 'Compliance',    status: 'active' },
  { id: 'c2', name: 'Data Privacy & GDPR',            modules: 3,  duration_hours: 2,  enrolled: 45, completed: 42, mandatory: true,  category: 'Compliance',    status: 'active' },
  { id: 'c3', name: 'Leadership Essentials',          modules: 8,  duration_hours: 12, enrolled: 12, completed: 5,  mandatory: false, category: 'Leadership',    status: 'active' },
  { id: 'c4', name: 'Advanced Excel for HR',          modules: 6,  duration_hours: 6,  enrolled: 20, completed: 15, mandatory: false, category: 'Technical',     status: 'active' },
  { id: 'c5', name: 'Effective Communication',        modules: 4,  duration_hours: 4,  enrolled: 30, completed: 22, mandatory: false, category: 'Soft Skills',   status: 'active' },
  { id: 'c6', name: 'Cybersecurity Awareness',        modules: 7,  duration_hours: 5,  enrolled: 45, completed: 30, mandatory: true,  category: 'Compliance',    status: 'active' },
];

const _mockMyCourses = [
  { id: 'mc1', course_id: 'c1', course_name: 'Workplace Safety & Compliance', progress: 100, completed: true,  enrolled_on: '2026-01-10', completed_on: '2026-01-15' },
  { id: 'mc2', course_id: 'c2', course_name: 'Data Privacy & GDPR',           progress: 100, completed: true,  enrolled_on: '2026-01-10', completed_on: '2026-01-20' },
  { id: 'mc3', course_id: 'c3', course_name: 'Leadership Essentials',         progress: 38,  completed: false, enrolled_on: '2026-02-01', completed_on: null },
  { id: 'mc4', course_id: 'c6', course_name: 'Cybersecurity Awareness',       progress: 60,  completed: false, enrolled_on: '2026-02-15', completed_on: null },
];

const _mockCerts = [
  { id: 'cert1', course_name: 'Workplace Safety & Compliance', issued_on: '2026-01-15', expires_on: '2027-01-15', credential_id: 'WS-2026-001' },
  { id: 'cert2', course_name: 'Data Privacy & GDPR',           issued_on: '2026-01-20', expires_on: '2027-01-20', credential_id: 'DP-2026-002' },
];

export function renderTrainingPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="trn-wrap">' +
      '<div class="trn-toolbar">' +
        '<div class="trn-tabs" id="trnTabs">' +
          '<button class="trn-tab active" data-tab="browse">Browse Courses</button>' +
          '<button class="trn-tab" data-tab="my">My Learning</button>' +
          '<button class="trn-tab" data-tab="certificates">Certificates</button>' +
        '</div>' +
        '<input class="trn-search" id="trnSearch" placeholder="Search courses…" autocomplete="off">' +
        (isAdmin ? '<button class="trn-btn" id="trnAddBtn">+ Add Course</button>' : '') +
      '</div>' +
      '<div id="trnStats" class="trn-stats"></div>' +
      '<div id="trnContent"></div>' +
      '<div class="trn-modal" id="trnModal"><div class="trn-modal-box" id="trnModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  trnLoadData();
}

export async function trnLoadData() {
  const [coursesData, myData, certsData] = await Promise.all([
    api.get('/api/training'),
    api.get('/api/training/my'),
    api.get('/api/training/certificates'),
  ]);
  _courses = (coursesData && !coursesData._error) ? (coursesData.courses || coursesData || []) : _mockCourses;
  if (!Array.isArray(_courses)) _courses = _mockCourses;
  _myCourses = (myData && !myData._error) ? (myData.courses || myData || []) : _mockMyCourses;
  if (!Array.isArray(_myCourses)) _myCourses = _mockMyCourses;
  _certs = (certsData && !certsData._error) ? (certsData.certificates || certsData || []) : _mockCerts;
  if (!Array.isArray(_certs)) _certs = _mockCerts;
  trnRenderStats();
  trnRender();
}

export function trnRenderStats() {
  const el = _container && _container.querySelector('#trnStats');
  if (!el) return;
  const totalEnrolled = _courses.reduce((s, c) => s + (c.enrolled || 0), 0);
  const completed = _myCourses.filter(c => c.completed).length;
  const inProgress = _myCourses.filter(c => !c.completed).length;
  const mandatory = _courses.filter(c => c.mandatory).length;
  el.innerHTML =
    _sc(_courses.length, 'Courses', 'var(--accent)') +
    _sc(completed, 'Completed', 'var(--status-in)') +
    _sc(inProgress, 'In Progress', 'var(--status-break)') +
    _sc(mandatory, 'Mandatory', 'var(--status-absent)');
}

function _sc(n, l, c) {
  return '<div class="trn-stat"><div class="trn-stat-n" style="color:' + c + '">' + n + '</div><div class="trn-stat-l">' + l + '</div></div>';
}

export function trnRender() {
  if (_tab === 'my') _renderMyCourses();
  else if (_tab === 'certificates') _renderCerts();
  else _renderBrowse();
}

function _renderBrowse() {
  const el = _container && _container.querySelector('#trnContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const enrolled = new Set(_myCourses.map(m => m.course_id));
  const items = _courses.filter(c => !_search || c.name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="trn-empty"><div style="font-size:2rem">&#127891;</div><div>No courses found</div></div>'; return; }
  let html = '<div class="trn-grid">';
  items.forEach(function (c, i) {
    const isEnrolled = enrolled.has(c.id);
    const my = _myCourses.find(m => m.course_id === c.id);
    const pct = my ? my.progress : 0;
    html +=
      '<div class="trn-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="trn-card-hdr">' +
          '<div class="trn-card-cat">' + _esc(c.category || '') + '</div>' +
          (c.mandatory ? '<span class="trn-badge trn-mandatory">Mandatory</span>' : '') +
        '</div>' +
        '<div class="trn-card-title">' + _esc(c.name) + '</div>' +
        '<div class="trn-card-meta">' + c.modules + ' modules &middot; ' + c.duration_hours + 'h &middot; ' + c.enrolled + ' enrolled</div>' +
        (isEnrolled
          ? '<div class="trn-progress"><div class="trn-progress-bar"><div class="trn-progress-fill" style="width:' + pct + '%"></div></div><span>' + pct + '%</span></div>'
          : '') +
        '<div class="trn-card-actions">' +
          (!isEnrolled ? '<button data-action="enroll" data-id="' + _esc(c.id) + '" class="trn-btn-sm">Enroll</button>' : '') +
          (isEnrolled && pct < 100 ? '<button data-action="continue" data-id="' + _esc(c.id) + '" class="trn-btn-sm">Continue</button>' : '') +
          (isEnrolled && pct === 100 ? '<span class="trn-completed-lbl">&#10003; Completed</span>' : '') +
          (isAdmin ? '<button data-action="edit-course" data-id="' + _esc(c.id) + '" class="trn-btn-sm">Edit</button>' : '') +
          (isAdmin ? '<button data-action="delete-course" data-id="' + _esc(c.id) + '" class="trn-btn-sm danger">Delete</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderMyCourses() {
  const el = _container && _container.querySelector('#trnContent');
  if (!el) return;
  const items = _myCourses.filter(m => !_search || m.course_name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="trn-empty"><div style="font-size:2rem">&#128218;</div><div>You are not enrolled in any courses</div></div>'; return; }
  let html = '<div class="trn-my-list">';
  items.forEach(function (m, i) {
    html +=
      '<div class="trn-my-row" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="trn-my-info">' +
          '<div class="trn-my-name">' + _esc(m.course_name) + '</div>' +
          '<div class="trn-my-dates">Enrolled: ' + _fmtDate(m.enrolled_on) + (m.completed_on ? ' &middot; Completed: ' + _fmtDate(m.completed_on) : '') + '</div>' +
        '</div>' +
        '<div class="trn-my-right">' +
          '<div class="trn-progress-wrap">' +
            '<div class="trn-progress-bar"><div class="trn-progress-fill" style="width:' + m.progress + '%"></div></div>' +
            '<span class="trn-pct">' + m.progress + '%</span>' +
          '</div>' +
          (m.completed ? '<span class="trn-badge trn-done">&#10003; Done</span>' : '<button data-action="continue" data-id="' + _esc(m.course_id) + '" class="trn-btn-sm">Continue</button>') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderCerts() {
  const el = _container && _container.querySelector('#trnContent');
  if (!el) return;
  const items = _certs.filter(c => !_search || c.course_name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="trn-empty"><div style="font-size:2rem">&#127885;</div><div>No certificates earned yet</div></div>'; return; }
  let html = '<div class="trn-cert-grid">';
  items.forEach(function (c, i) {
    const expired = c.expires_on && c.expires_on < new Date().toISOString().split('T')[0];
    html +=
      '<div class="trn-cert' + (expired ? ' trn-cert-expired' : '') + '" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="trn-cert-icon">&#127885;</div>' +
        '<div class="trn-cert-course">' + _esc(c.course_name) + '</div>' +
        '<div class="trn-cert-id">ID: ' + _esc(c.credential_id || '') + '</div>' +
        '<div class="trn-cert-dates">Issued: ' + _fmtDate(c.issued_on) + (c.expires_on ? ' &middot; Expires: ' + _fmtDate(c.expires_on) : '') + '</div>' +
        (expired ? '<div class="trn-cert-exp-badge">Expired</div>' : '') +
        '<button data-action="download-cert" data-id="' + _esc(c.id) + '" class="trn-btn-sm">&#8595; Download</button>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function trnShowForm(course) {
  const isEdit = !!course;
  const c = course || {};
  const box = _container && _container.querySelector('#trnModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="trn-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Course</div>' +
    '<div class="trn-field"><label>Course Name *</label><input type="text" id="trnFName" value="' + _esc(c.name || '') + '"></div>' +
    '<div class="trn-row2">' +
      '<div class="trn-field"><label>Modules</label><input type="number" id="trnFMod" value="' + (c.modules || 1) + '" min="1"></div>' +
      '<div class="trn-field"><label>Duration (hours)</label><input type="number" id="trnFDur" value="' + (c.duration_hours || 1) + '" min="0.5" step="0.5"></div>' +
    '</div>' +
    '<div class="trn-field"><label>Category</label><input type="text" id="trnFCat" value="' + _esc(c.category || '') + '" placeholder="e.g. Compliance, Technical"></div>' +
    '<div class="trn-field"><label><input type="checkbox" id="trnFMand"' + (c.mandatory ? ' checked' : '') + '> Mandatory for all employees</label></div>' +
    '<div class="trn-form-actions"><button class="trn-btn ghost" data-action="close-modal">Cancel</button><button class="trn-btn" id="trnSaveBtn">' + (isEdit ? 'Update' : 'Create') + '</button></div>';
  _container.querySelector('#trnModal').classList.add('open');
  box.querySelector('#trnSaveBtn').addEventListener('click', async function () {
    const name = (box.querySelector('#trnFName').value || '').trim();
    if (!name) { toast('Course name is required', 'error'); return; }
    const body = { name, modules: parseInt(box.querySelector('#trnFMod').value) || 1, duration_hours: parseFloat(box.querySelector('#trnFDur').value) || 1, category: (box.querySelector('#trnFCat').value || '').trim(), mandatory: box.querySelector('#trnFMand').checked, status: 'active', enrolled: c.enrolled || 0, completed: c.completed || 0 };
    const result = isEdit ? await api.put('/api/training/' + course.id, body) : await api.post('/api/training', body);
    if (result && !result._error) { toast(isEdit ? 'Updated' : 'Created', 'success'); trnCloseModal(); trnLoadData(); return; }
    if (isEdit) { const i = _courses.findIndex(x => x.id === course.id); if (i >= 0) Object.assign(_courses[i], body); }
    else _courses.push({ id: 'c' + Date.now(), ...body });
    toast((isEdit ? 'Updated' : 'Created') + ' (demo)', 'success'); trnCloseModal(); trnRenderStats(); trnRender();
  });
}

export async function trnEnroll(courseId) {
  const result = await api.post('/api/training/' + courseId + '/enroll', {});
  if (result && !result._error) { toast('Enrolled!', 'success'); trnLoadData(); return; }
  const c = _courses.find(x => x.id === courseId);
  if (c) {
    _myCourses.push({ id: 'mc' + Date.now(), course_id: courseId, course_name: c.name, progress: 0, completed: false, enrolled_on: new Date().toISOString().split('T')[0], completed_on: null });
    c.enrolled = (c.enrolled || 0) + 1;
  }
  toast('Enrolled! (demo)', 'success'); trnRenderStats(); trnRender();
}

export function trnCloseModal() {
  const m = _container && _container.querySelector('#trnModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#trnTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.trn-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.trn-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    trnRender();
  });
  const s = container.querySelector('#trnSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); trnRender(); });
  const ab = container.querySelector('#trnAddBtn');
  if (ab) ab.addEventListener('click', () => trnShowForm(null));
  const modal = container.querySelector('#trnModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) trnCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') trnCloseModal();
    else if (action === 'enroll') trnEnroll(id);
    else if (action === 'continue') toast('Opening course player… (demo)', 'info');
    else if (action === 'download-cert') toast('Downloading certificate… (demo)', 'info');
    else if (action === 'edit-course') { const c = _courses.find(x => x.id === id); if (c) trnShowForm(c); }
    else if (action === 'delete-course') { if (confirm('Delete this course?')) { _courses = _courses.filter(c => c.id !== id); trnRenderStats(); trnRender(); toast('Deleted (demo)', 'success'); } }
  });
}

function _fmtDate(ds) { if (!ds) return ''; return new Date(ds.split('T')[0] + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getCourses() { return _courses; }
export function _setCourses(list) { _courses = list; }
export function _resetState() { _container = null; _courses = []; _myCourses = []; _certs = []; _tab = 'browse'; _search = ''; }

registerModule('training', renderTrainingPage);
