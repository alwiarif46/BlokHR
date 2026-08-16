/**
 * modules/training/training.js
 * Training & LMS — tabbed UI over /api/training (learning service).
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { promptDialog, confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _tab = 'my';
let _courses = [];
let _enrollments = [];
let _skills = [];
let _employeeSkills = [];
let _requests = [];
let _budgets = [];
let _compliance = [];
let _editingCourse = null;
let _courseDetail = null;
let _saving = false;
let _courseFileId = null;
let _courseFileName = '';
let _lessonFileId = null;
let _lessonFileName = '';
let _viewerObjectUrl = null;

function _isAdmin() {
  const session = getSession();
  return !!(session && (session.is_admin || session.role === 'admin'));
}

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _readFileAsDataUrl(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(String(reader.result || ''));
    };
    reader.onerror = function () {
      reject(new Error('Could not read file'));
    };
    reader.readAsDataURL(file);
  });
}

async function _uploadTrainingFile(file, contextType, contextId) {
  const dataUrl = await _readFileAsDataUrl(file);
  const result = await api.post('/api/storage/upload', {
    file: dataUrl,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contextType: contextType || 'training',
    contextId: contextId || '',
  });
  if (!result || result._error) {
    throw new Error((result && result.message) || 'Upload failed');
  }
  return result;
}

async function _fetchFileBlob(fileId, inline) {
  const session = getSession();
  const headers = {};
  if (session && session.email) headers['X-User-Email'] = session.email;
  if (session && session.name) headers['X-User-Name'] = session.name;
  if (session && session.sessionToken) headers['Authorization'] = 'Bearer ' + session.sessionToken;
  const url =
    '/api/storage/files/' +
    encodeURIComponent(fileId) +
    '/download' +
    (inline ? '?inline=1' : '');
  const res = await fetch(url, { headers: headers });
  if (!res.ok) throw new Error('Could not load file');
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/);
  const name = (match && match[1]) || 'file';
  return { blob: blob, mimeType: blob.type || res.headers.get('Content-Type') || '', name: name };
}

function _uploadZoneHtml(opts) {
  const id = opts.inputId;
  const label = opts.label || 'Upload file';
  const fileId = opts.fileId || '';
  const fileName = opts.fileName || '';
  const hasFile = !!fileId;
  return (
    '<div class="trn-field">' +
    '<label>' +
    _esc(label) +
    '</label>' +
    '<div class="trn-upload" data-upload-for="' +
    _esc(id) +
    '">' +
    '<input type="file" id="' +
    _esc(id) +
    '" class="trn-upload-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.mp4,.webm,.png,.jpg,.jpeg,.gif,.webp,.svg">' +
    '<div class="trn-upload-zone" data-action="pick-file" data-for="' +
    _esc(id) +
    '">' +
    '<div class="trn-upload-icon">&#128206;</div>' +
    '<div class="trn-upload-text">' +
    (hasFile ? _esc(fileName || 'Attached file') : 'Drop file or click to upload') +
    '</div>' +
    '<div class="trn-upload-hint">PDF, Office, images, video — readable in-app</div>' +
    '</div>' +
    '<input type="hidden" id="' +
    _esc(id) +
    '_id" value="' +
    _esc(fileId) +
    '">' +
    (hasFile
      ? '<div class="trn-upload-meta">' +
        '<button type="button" class="trn-btn ghost sm" data-action="open-file" data-file-id="' +
        _esc(fileId) +
        '">Open</button>' +
        '<button type="button" class="trn-btn ghost sm" data-action="clear-file" data-for="' +
        _esc(id) +
        '">Remove</button></div>'
      : '') +
    '</div></div>'
  );
}

function _materialActions(fileId, contentUrl) {
  let html = '';
  if (fileId) {
    html +=
      '<button class="trn-btn ghost sm" data-action="open-file" data-file-id="' +
      _esc(fileId) +
      '">Open</button>';
  } else if (contentUrl) {
    html +=
      '<button class="trn-btn ghost sm" data-action="open-url" data-url="' +
      _esc(contentUrl) +
      '">Open</button>';
  }
  return html;
}

async function trnOpenFile(fileId) {
  if (!fileId) return;
  try {
    toast('Loading file…', 'info');
    const file = await _fetchFileBlob(fileId, true);
    if (_viewerObjectUrl) URL.revokeObjectURL(_viewerObjectUrl);
    _viewerObjectUrl = URL.createObjectURL(file.blob);
    const mime = (file.mimeType || '').toLowerCase();
    const box = _container.querySelector('#trnModalBox');
    if (!box) return;
    let body = '';
    if (mime.indexOf('image/') === 0) {
      body = '<img class="trn-viewer-media" src="' + _viewerObjectUrl + '" alt="">';
    } else if (mime.indexOf('video/') === 0) {
      body =
        '<video class="trn-viewer-media" controls src="' + _viewerObjectUrl + '"></video>';
    } else if (mime === 'application/pdf' || mime.indexOf('text/') === 0) {
      body =
        '<iframe class="trn-viewer-frame" title="Document" src="' +
        _viewerObjectUrl +
        '"></iframe>';
    } else {
      body =
        '<div class="trn-viewer-fallback">' +
        '<p>Preview is not available for this file type.</p>' +
        '<a class="trn-btn" href="' +
        _viewerObjectUrl +
        '" download="' +
        _esc(file.name) +
        '">Download ' +
        _esc(file.name) +
        '</a></div>';
    }
    box.innerHTML =
      '<div class="trn-modal-title">View: ' +
      _esc(file.name) +
      '</div>' +
      '<div class="trn-viewer">' +
      body +
      '</div>' +
      '<div class="trn-form-actions">' +
      '<a class="trn-btn ghost" href="' +
      _viewerObjectUrl +
      '" download="' +
      _esc(file.name) +
      '">Download</a>' +
      '<button class="trn-btn" data-action="close-modal">Close</button></div>';
    box.classList.add('wide');
    _container.querySelector('#trnModal').classList.add('open');
  } catch (err) {
    toast((err && err.message) || 'Could not open file', 'error');
  }
}

function trnOpenUrl(url) {
  if (!url) return;
  const box = _container.querySelector('#trnModalBox');
  if (!box) return;
  const safe = String(url);
  const isHttp = /^https?:\/\//i.test(safe);
  box.innerHTML =
    '<div class="trn-modal-title">Open link</div>' +
    '<div class="trn-viewer">' +
    (isHttp
      ? '<iframe class="trn-viewer-frame" title="Link" src="' + _esc(safe) + '"></iframe>'
      : '<div class="trn-viewer-fallback"><p>' + _esc(safe) + '</p></div>') +
    '</div>' +
    '<div class="trn-form-actions">' +
    (isHttp
      ? '<a class="trn-btn ghost" href="' + _esc(safe) + '" target="_blank" rel="noopener">Open in new tab</a>'
      : '') +
    '<button class="trn-btn" data-action="close-modal">Close</button></div>';
  _container.querySelector('#trnModal').classList.add('open');
}

export function renderTrainingPage(container) {
  _container = container;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="trn-wrap" id="trnWrap">' +
      '<div class="trn-toolbar">' +
        '<div class="trn-title"><span>&#127891;</span> Training &amp; LMS</div>' +
        '<div class="trn-spacer"></div>' +
        (admin ? '<button class="trn-btn" id="trnAddCourseBtn">+ Course</button>' : '') +
      '</div>' +
      '<div class="trn-tabs" id="trnTabs">' +
        '<button class="trn-tab active" data-tab="my">My Learning</button>' +
        '<button class="trn-tab" data-tab="catalog">Catalog</button>' +
        (admin ? '<button class="trn-tab" data-tab="compliance">Compliance</button>' : '') +
        '<button class="trn-tab" data-tab="skills">Skills</button>' +
        '<button class="trn-tab" data-tab="requests">Requests</button>' +
        (admin ? '<button class="trn-tab" data-tab="budgets">Budgets</button>' : '') +
      '</div>' +
      '<div class="trn-stats" id="trnStats"></div>' +
      '<div id="trnContent"></div>' +
      '<div class="trn-modal" id="trnModal"><div class="trn-modal-box" id="trnModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _tab = 'my';
  trnLoadData();
}

export async function trnLoadData() {
  const admin = _isAdmin();
  const [coursesRes, enrollRes, skillsRes, empSkillsRes, reqRes] = await Promise.all([
    api.get('/api/training/courses'),
    api.get('/api/training/my-courses'),
    api.get('/api/training/skills'),
    api.get('/api/training/skills/employee'),
    api.get('/api/training/external-requests'),
  ]);

  _courses = coursesRes && !coursesRes._error ? coursesRes.courses || [] : [];
  _enrollments = enrollRes && !enrollRes._error ? enrollRes.enrollments || [] : [];
  _skills = skillsRes && !skillsRes._error ? skillsRes.skills || [] : [];
  _employeeSkills =
    empSkillsRes && !empSkillsRes._error ? empSkillsRes.skills || [] : [];
  _requests = reqRes && !reqRes._error ? reqRes.requests || [] : [];

  if (admin) {
    const year = new Date().getFullYear();
    const [compRes, budRes] = await Promise.all([
      api.get('/api/training/reports/compliance'),
      api.get('/api/training/budgets?year=' + year),
    ]);
    _compliance = compRes && !compRes._error ? compRes.report || [] : [];
    _budgets = budRes && !budRes._error ? budRes.budgets || (budRes.budget ? [budRes.budget] : []) : [];
  }

  trnRenderStats();
  trnRender();
}

export function trnRenderStats() {
  const el = _container && _container.querySelector('#trnStats');
  if (!el) return;
  const completed = _enrollments.filter(function (e) {
    return e.status === 'completed';
  }).length;
  const inProgress = _enrollments.filter(function (e) {
    return e.status === 'in_progress' || e.status === 'enrolled';
  }).length;
  el.innerHTML =
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--accent)">' +
    _courses.length +
    '</div><div class="trn-stat-label">Courses</div></div>' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--status-in)">' +
    _enrollments.length +
    '</div><div class="trn-stat-label">My enrollments</div></div>' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--status-break)">' +
    inProgress +
    '</div><div class="trn-stat-label">In progress</div></div>' +
    '<div class="trn-stat"><div class="trn-stat-num" style="color:var(--status-out)">' +
    completed +
    '</div><div class="trn-stat-label">Completed</div></div>';
}

export function trnRender() {
  const el = _container && _container.querySelector('#trnContent');
  if (!el) return;
  if (_tab === 'my') el.innerHTML = _renderMyLearning();
  else if (_tab === 'catalog') el.innerHTML = _renderCatalog();
  else if (_tab === 'compliance') el.innerHTML = _renderCompliance();
  else if (_tab === 'skills') el.innerHTML = _renderSkills();
  else if (_tab === 'requests') el.innerHTML = _renderRequests();
  else if (_tab === 'budgets') el.innerHTML = _renderBudgets();
  else el.innerHTML = '';
}

function _progressBar(pct) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return (
    '<div class="trn-progress"><div class="trn-progress-fill" style="width:' +
    p +
    '%"></div></div><div class="trn-progress-label">' +
    p +
    '%</div>'
  );
}

function _renderMyLearning() {
  if (!_enrollments.length) {
    return (
      '<div class="trn-empty"><div class="trn-empty-icon">&#127891;</div>' +
      '<div class="trn-empty-text">No enrollments yet</div>' +
      '<div class="trn-empty-sub">Browse the Catalog to enroll in a course</div></div>'
    );
  }
  let html = '<div class="trn-list">';
  _enrollments.forEach(function (enr, i) {
    html +=
      '<div class="trn-card trn-card-wide" data-enroll-id="' +
      _esc(enr.id) +
      '">' +
      '<div class="trn-card-head">' +
      '<div><div class="trn-card-title">' +
      _esc(enr.courseTitle || 'Course') +
      '</div>' +
      '<div class="trn-card-sub">' +
      _esc(enr.courseCategory || '') +
      ' · ' +
      _esc(enr.courseFormat || '') +
      (enr.courseMandatory ? ' · Mandatory' : '') +
      '</div></div>' +
      '<span class="trn-card-badge">' +
      _esc(enr.status) +
      '</span></div>' +
      _progressBar(enr.progressPct) +
      '<div class="trn-lessons">';
    (enr.lessons || []).forEach(function (lesson) {
      const done = lesson.progress && lesson.progress.status === 'completed';
      html +=
        '<div class="trn-lesson' +
        (done ? ' done' : '') +
        '">' +
        '<div class="trn-lesson-info">' +
        '<span class="trn-lesson-title">' +
        _esc(lesson.title) +
        '</span>' +
        '<span class="trn-lesson-meta">' +
        _esc(lesson.type) +
        (lesson.durationMinutes ? ' · ' + lesson.durationMinutes + 'm' : '') +
        (lesson.required ? ' · required' : '') +
        '</span></div>' +
        '<div class="trn-lesson-actions">' +
        _materialActions(lesson.fileId, lesson.contentUrl);
      if (!done && enr.status !== 'completed') {
        html +=
          '<button class="trn-btn ghost sm" data-action="complete-lesson" data-enroll="' +
          _esc(enr.id) +
          '" data-lesson="' +
          _esc(lesson.id) +
          '">Mark done</button>';
      } else {
        html += '<span class="trn-done-check">&#10003;</span>';
      }
      html += '</div></div>';
    });
    if (!(enr.lessons || []).length) {
      html += '<div class="trn-hint">No lessons yet — progress is tracked when modules are added.</div>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function _renderCatalog() {
  const admin = _isAdmin();
  if (!_courses.length) {
    return (
      '<div class="trn-empty"><div class="trn-empty-icon">&#127891;</div>' +
      '<div class="trn-empty-text">No courses in catalog</div></div>'
    );
  }
  let html = '<div class="trn-grid">';
  _courses.forEach(function (course, i) {
    const enrolled = _enrollments.some(function (e) {
      return e.courseId === course.id;
    });
    html +=
      '<div class="trn-card" data-id="' +
      _esc(course.id) +
      '">' +
      '<div class="trn-card-head">' +
      '<div class="trn-card-title">' +
      _esc(course.title) +
      '</div>' +
      '<span class="trn-card-badge">' +
      _esc(course.status) +
      '</span></div>' +
      '<div class="trn-card-sub">' +
      _esc(course.category) +
      ' · ' +
      _esc(course.format) +
      ' · ' +
      _esc(course.level) +
      ' · ' +
      (course.durationMinutes || 0) +
      'm' +
      (course.mandatory ? ' · Mandatory' : '') +
      '</div>' +
      (course.description
        ? '<div class="trn-card-desc">' + _esc(course.description) + '</div>'
        : '') +
      '<div class="trn-card-actions">';
    if (course.status === 'published' && !enrolled) {
      html +=
        '<button data-action="enroll" data-id="' + _esc(course.id) + '">Enroll</button>';
    }
    if (enrolled) {
      html += '<span class="trn-hint">Enrolled</span>';
    }
    html +=
      '<button data-action="view-course" data-id="' + _esc(course.id) + '">View</button>';
    if (admin) {
      html +=
        '<button data-action="edit-course" data-id="' + _esc(course.id) + '">Edit</button>';
      if (course.status !== 'published') {
        html +=
          '<button data-action="publish-course" data-id="' +
          _esc(course.id) +
          '">Publish</button>';
      }
      html +=
        '<button class="danger" data-action="delete-course" data-id="' +
        _esc(course.id) +
        '">Delete</button>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  return html;
}

function _renderCompliance() {
  if (!_compliance.length) {
    return (
      '<div class="trn-empty"><div class="trn-empty-text">No mandatory courses with enrollments</div></div>'
    );
  }
  let html = '<div class="trn-table-wrap"><table class="trn-table"><thead><tr>' +
    '<th>Course</th><th>Enrolled</th><th>Completed</th><th>Overdue</th><th>Rate</th>' +
    '</tr></thead><tbody>';
  _compliance.forEach(function (row) {
    html +=
      '<tr><td>' +
      _esc(row.courseTitle) +
      '</td><td>' +
      row.totalEnrolled +
      '</td><td>' +
      row.completed +
      '</td><td>' +
      row.overdue +
      '</td><td>' +
      row.completionRate +
      '%</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function _renderSkills() {
  const admin = _isAdmin();
  let html = '<div class="trn-split">';
  html += '<div><div class="trn-section-title">My skills</div>';
  if (!_employeeSkills.length) {
    html += '<div class="trn-hint">No skills recorded yet</div>';
  } else {
    html += '<div class="trn-chip-row">';
    _employeeSkills.forEach(function (s) {
      html +=
        '<span class="trn-chip">' +
        _esc(s.skillName || s.name) +
        ' · ' +
        _esc(s.proficiency) +
        '</span>';
    });
    html += '</div>';
  }
  html += '</div>';
  if (admin) {
    html +=
      '<div><div class="trn-section-title">Skill catalog ' +
      '<button class="trn-btn ghost sm" data-action="add-skill">+ Add</button></div>';
    if (!_skills.length) {
      html += '<div class="trn-hint">No skills defined</div>';
    } else {
      html += '<div class="trn-chip-row">';
      _skills.forEach(function (s) {
        html +=
          '<span class="trn-chip">' +
          _esc(s.name) +
          (s.category ? ' · ' + _esc(s.category) : '') +
          '</span>';
      });
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div>';
  return html;
}

function _renderRequests() {
  const admin = _isAdmin();
  let html =
    '<div class="trn-toolbar-inner">' +
    '<button class="trn-btn" data-action="add-request">+ Request external training</button></div>';
  if (!_requests.length) {
    html += '<div class="trn-empty"><div class="trn-empty-text">No external training requests</div></div>';
    return html;
  }
  html += '<div class="trn-list">';
  _requests.forEach(function (r) {
    html +=
      '<div class="trn-card trn-card-wide">' +
      '<div class="trn-card-head"><div><div class="trn-card-title">' +
      _esc(r.title) +
      '</div><div class="trn-card-sub">' +
      _esc(r.email) +
      (r.provider ? ' · ' + _esc(r.provider) : '') +
      (r.cost ? ' · ' + r.cost : '') +
      '</div></div><span class="trn-card-badge">' +
      _esc(r.status) +
      '</span></div>';
    if (r.reason) html += '<div class="trn-card-desc">' + _esc(r.reason) + '</div>';
    if (admin && (r.status === 'pending' || r.status === 'manager_approved')) {
      html += '<div class="trn-card-actions">';
      if (r.status === 'pending') {
        html +=
          '<button data-action="approve-req" data-id="' +
          _esc(r.id) +
          '" data-role="manager">Manager approve</button>';
      }
      if (r.status === 'manager_approved') {
        html +=
          '<button data-action="approve-req" data-id="' +
          _esc(r.id) +
          '" data-role="hr">HR approve</button>';
      }
      html +=
        '<button class="danger" data-action="reject-req" data-id="' +
        _esc(r.id) +
        '">Reject</button></div>';
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function _renderBudgets() {
  let html =
    '<div class="trn-toolbar-inner">' +
    '<button class="trn-btn" data-action="set-budget">Set budget</button></div>';
  if (!_budgets.length) {
    html += '<div class="trn-empty"><div class="trn-empty-text">No budgets configured</div></div>';
    return html;
  }
  html +=
    '<div class="trn-table-wrap"><table class="trn-table"><thead><tr>' +
    '<th>Group</th><th>Year</th><th>Annual</th><th>Spent</th><th>Per-employee cap</th>' +
    '</tr></thead><tbody>';
  _budgets.forEach(function (b) {
    html +=
      '<tr><td>' +
      _esc(b.groupId) +
      '</td><td>' +
      b.year +
      '</td><td>' +
      b.annualBudget +
      '</td><td>' +
      b.spent +
      '</td><td>' +
      b.perEmployeeCap +
      '</td></tr>';
  });
  html += '</tbody></table></div>';
  return html;
}

function trnShowCourseForm(course) {
  const isEdit = !!course;
  const c = course || {};
  const box = _container.querySelector('#trnModalBox');
  if (!box) return;
  box.classList.remove('wide');
  _editingCourse = course || null;
  _courseFileId = c.fileId || null;
  _courseFileName = '';
  box.innerHTML =
    '<div class="trn-modal-title">' +
    (isEdit ? 'Edit course' : 'Add course') +
    '</div>' +
    '<div class="trn-field"><label>Title *</label><input type="text" id="trnF_title" value="' +
    _esc(c.title || '') +
    '"></div>' +
    '<div class="trn-field"><label>Description</label><textarea id="trnF_description" rows="3">' +
    _esc(c.description || '') +
    '</textarea></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Category</label><input type="text" id="trnF_category" value="' +
    _esc(c.category || 'general') +
    '"></div>' +
    '<div class="trn-field"><label>Level</label><select id="trnF_level">' +
    _opts(['beginner', 'intermediate', 'advanced'], c.level || 'beginner') +
    '</select></div></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Format</label><select id="trnF_format">' +
    _opts(['video', 'doc', 'link', 'scorm', 'classroom', 'other'], c.format || 'doc') +
    '</select></div>' +
    '<div class="trn-field"><label>Duration (minutes)</label><input type="number" id="trnF_duration" value="' +
    _esc(String(c.durationMinutes != null ? c.durationMinutes : 60)) +
    '"></div></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Recurrence</label><select id="trnF_recurrence">' +
    _opts(['none', 'annual', 'biannual', 'quarterly'], c.recurrence || 'none') +
    '</select></div>' +
    '<div class="trn-field"><label>Valid for (days)</label><input type="number" id="trnF_validFor" value="' +
    _esc(c.validForDays != null ? String(c.validForDays) : '') +
    '"></div></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Pass score</label><input type="number" id="trnF_passScore" value="' +
    _esc(c.passScore != null ? String(c.passScore) : '') +
    '"></div>' +
    '<div class="trn-field"><label>Content URL</label><input type="text" id="trnF_contentUrl" value="' +
    _esc(c.contentUrl || '') +
    '"></div></div>' +
    _uploadZoneHtml({
      inputId: 'trnF_file',
      label: 'Course material (upload)',
      fileId: _courseFileId || '',
      fileName: _courseFileName || (c.fileId ? 'Attached file' : ''),
    }) +
    '<div class="trn-field"><label>Auto-assign group IDs (comma-separated)</label><input type="text" id="trnF_groups" value="' +
    _esc(c.autoAssignGroupIds || '') +
    '"></div>' +
    '<div class="trn-field"><label>Auto-assign member types</label><input type="text" id="trnF_types" value="' +
    _esc(c.autoAssignMemberTypes || '') +
    '"></div>' +
    '<div class="trn-field"><label><input type="checkbox" id="trnF_mandatory"' +
    (c.mandatory ? ' checked' : '') +
    '> Mandatory</label></div>' +
    '<div class="trn-form-actions">' +
    '<button class="trn-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button class="trn-btn" id="trnSaveCourseBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  _container.querySelector('#trnModal').classList.add('open');
  box.querySelector('#trnSaveCourseBtn').addEventListener('click', trnSaveCourse);
  if (_courseFileId) {
    api.get('/api/storage/files/' + _courseFileId).then(function (meta) {
      if (meta && !meta._error && meta.original_name) {
        _courseFileName = meta.original_name;
        const text = box.querySelector('.trn-upload-text');
        if (text) text.textContent = meta.original_name;
      }
    });
  }
}

function _opts(list, selected) {
  return list
    .map(function (v) {
      return (
        '<option value="' +
        v +
        '"' +
        (v === selected ? ' selected' : '') +
        '>' +
        v +
        '</option>'
      );
    })
    .join('');
}

async function trnSaveCourse() {
  if (_saving) return;
  const title = (_container.querySelector('#trnF_title').value || '').trim();
  if (!title) {
    toast('Title is required', 'error');
    return;
  }
  const body = {
    title: title,
    description: _container.querySelector('#trnF_description').value || '',
    category: _container.querySelector('#trnF_category').value || 'general',
    level: _container.querySelector('#trnF_level').value,
    format: _container.querySelector('#trnF_format').value,
    durationMinutes: Number(_container.querySelector('#trnF_duration').value) || 60,
    recurrence: _container.querySelector('#trnF_recurrence').value,
    validForDays: _container.querySelector('#trnF_validFor').value
      ? Number(_container.querySelector('#trnF_validFor').value)
      : null,
    passScore: _container.querySelector('#trnF_passScore').value
      ? Number(_container.querySelector('#trnF_passScore').value)
      : null,
    contentUrl: _container.querySelector('#trnF_contentUrl').value || '',
    fileId: (function () {
      const el = _container.querySelector('#trnF_file_id');
      const v = (el && el.value) || _courseFileId || '';
      return v || null;
    })(),
    autoAssignGroupIds: _container.querySelector('#trnF_groups').value || '',
    autoAssignMemberTypes: _container.querySelector('#trnF_types').value || '',
    mandatory: !!_container.querySelector('#trnF_mandatory').checked,
  };
  _saving = true;
  const btn = _container.querySelector('#trnSaveCourseBtn');
  if (btn) btn.disabled = true;
  let result;
  if (_editingCourse && _editingCourse.id) {
    result = await api.put('/api/training/courses/' + _editingCourse.id, body);
  } else {
    result = await api.post('/api/training/courses', body);
  }
  _saving = false;
  if (btn) btn.disabled = false;
  if (result && !result._error) {
    toast(_editingCourse ? 'Course updated' : 'Course created', 'success');
    trnCloseModal();
    const created = result.course;
    if (created && created.id) {
      await trnLoadData();
      await trnShowCourseDetail(created.id);
    } else {
      await trnLoadData();
    }
    return;
  }
  toast((result && result.message) || 'Failed to save', 'error');
}

async function trnShowCourseDetail(courseId) {
  const res = await api.get('/api/training/courses/' + courseId);
  if (!res || res._error) {
    toast((res && res.message) || 'Failed to load course', 'error');
    return;
  }
  _courseDetail = res;
  const course = res.course;
  const lessons = res.lessons || [];
  const skills = res.skills || [];
  const admin = _isAdmin();
  const box = _container.querySelector('#trnModalBox');
  if (!box) return;
  let html =
    '<div class="trn-modal-title">' +
    _esc(course.title) +
    '</div>' +
    '<div class="trn-card-sub">' +
    _esc(course.category) +
    ' · ' +
    _esc(course.format) +
    ' · ' +
    _esc(course.status) +
    '</div>' +
    (course.description
      ? '<div class="trn-card-desc">' + _esc(course.description) + '</div>'
      : '') +
    (course.fileId || course.contentUrl
      ? '<div class="trn-card-actions" style="margin-bottom:8px">' +
        _materialActions(course.fileId, course.contentUrl) +
        '</div>'
      : '') +
    '<div class="trn-section-title">Modules / lessons</div>';
  if (!lessons.length) {
    html += '<div class="trn-hint">No lessons yet</div>';
  } else {
    html += '<div class="trn-lessons">';
    lessons.forEach(function (lesson, idx) {
      html +=
        '<div class="trn-lesson">' +
        '<div class="trn-lesson-info"><span class="trn-lesson-title">' +
        (idx + 1) +
        '. ' +
        _esc(lesson.title) +
        '</span><span class="trn-lesson-meta">' +
        _esc(lesson.type) +
        (lesson.durationMinutes ? ' · ' + lesson.durationMinutes + 'm' : '') +
        (lesson.required ? ' · required' : '') +
        '</span></div>' +
        '<div class="trn-lesson-actions">' +
        _materialActions(lesson.fileId, lesson.contentUrl);
      if (admin) {
        html +=
          '<button class="danger sm" data-action="delete-lesson" data-id="' +
          _esc(lesson.id) +
          '">Remove</button>';
      }
      html += '</div></div>';
    });
    html += '</div>';
  }
  if (admin) {
    _lessonFileId = null;
    _lessonFileName = '';
    html +=
      '<div class="trn-section-title">Add lesson</div>' +
      '<div class="trn-row">' +
      '<div class="trn-field"><label>Title</label><input type="text" id="trnL_title"></div>' +
      '<div class="trn-field"><label>Type</label><select id="trnL_type">' +
      _opts(['video', 'doc', 'link', 'scorm', 'quiz', 'classroom'], 'doc') +
      '</select></div></div>' +
      '<div class="trn-row">' +
      '<div class="trn-field"><label>Duration (m)</label><input type="number" id="trnL_duration" value="15"></div>' +
      '<div class="trn-field"><label>Content URL</label><input type="text" id="trnL_url"></div></div>' +
      _uploadZoneHtml({
        inputId: 'trnL_file',
        label: 'Lesson material (upload)',
        fileId: '',
        fileName: '',
      }) +
      '<div class="trn-field"><label><input type="checkbox" id="trnL_required" checked> Required</label></div>' +
      '<button class="trn-btn" data-action="add-lesson" data-course="' +
      _esc(course.id) +
      '">Add lesson</button>';
  }
  if (skills.length) {
    html += '<div class="trn-section-title">Skills granted</div><div class="trn-chip-row">';
    skills.forEach(function (s) {
      html +=
        '<span class="trn-chip">' +
        _esc(s.skillName) +
        ' · ' +
        _esc(s.proficiencyGranted) +
        '</span>';
    });
    html += '</div>';
  }
  if (admin && _skills.length) {
    html +=
      '<div class="trn-section-title">Link skill</div>' +
      '<div class="trn-row">' +
      '<div class="trn-field"><select id="trnLink_skill">' +
      _skills
        .map(function (s) {
          return '<option value="' + _esc(s.id) + '">' + _esc(s.name) + '</option>';
        })
        .join('') +
      '</select></div>' +
      '<div class="trn-field"><select id="trnLink_prof">' +
      _opts(['beginner', 'intermediate', 'advanced', 'expert'], 'beginner') +
      '</select></div></div>' +
      '<button class="trn-btn ghost" data-action="link-skill" data-course="' +
      _esc(course.id) +
      '">Link</button>';
  }
  html +=
    '<div class="trn-form-actions"><button class="trn-btn ghost" data-action="close-modal">Close</button></div>';
  box.innerHTML = html;
  _container.querySelector('#trnModal').classList.add('open');
}

export function trnCloseModal() {
  const modal = _container && _container.querySelector('#trnModal');
  if (modal) modal.classList.remove('open');
  const box = _container && _container.querySelector('#trnModalBox');
  if (box) box.classList.remove('wide');
  _editingCourse = null;
  _courseDetail = null;
  if (_viewerObjectUrl) {
    URL.revokeObjectURL(_viewerObjectUrl);
    _viewerObjectUrl = null;
  }
}

function _bindEvents(container) {
  const tabs = container.querySelector('#trnTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tab]');
      if (!btn) return;
      _tab = btn.dataset.tab;
      tabs.querySelectorAll('.trn-tab').forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === _tab);
      });
      trnRender();
    });
  }
  const addBtn = container.querySelector('#trnAddCourseBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      trnShowCourseForm(null);
    });
  }
  const modal = container.querySelector('#trnModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) trnCloseModal();
    });
  }
  container.addEventListener('change', async function (e) {
    const input = e.target;
    if (!input || input.type !== 'file') return;
    if (input.id !== 'trnF_file' && input.id !== 'trnL_file') return;
    const file = input.files && input.files[0];
    if (!file) return;
    const isCourse = input.id === 'trnF_file';
    const contextType = isCourse ? 'training_course' : 'training_lesson';
    const contextId =
      (isCourse && _editingCourse && _editingCourse.id) ||
      (_courseDetail && _courseDetail.course && _courseDetail.course.id) ||
      '';
    try {
      toast('Uploading…', 'info');
      const uploaded = await _uploadTrainingFile(file, contextType, contextId);
      const fileId = uploaded.id;
      const name = uploaded.original_name || file.name;
      const hidden = _container.querySelector('#' + input.id + '_id');
      if (hidden) hidden.value = fileId;
      if (isCourse) {
        _courseFileId = fileId;
        _courseFileName = name;
      } else {
        _lessonFileId = fileId;
        _lessonFileName = name;
      }
      const wrap = _container.querySelector('[data-upload-for="' + input.id + '"]');
      if (wrap) {
        const text = wrap.querySelector('.trn-upload-text');
        if (text) text.textContent = name;
        let meta = wrap.querySelector('.trn-upload-meta');
        if (!meta) {
          meta = document.createElement('div');
          meta.className = 'trn-upload-meta';
          wrap.appendChild(meta);
        }
        meta.innerHTML =
          '<button type="button" class="trn-btn ghost sm" data-action="open-file" data-file-id="' +
          _esc(fileId) +
          '">Open</button>' +
          '<button type="button" class="trn-btn ghost sm" data-action="clear-file" data-for="' +
          _esc(input.id) +
          '">Remove</button>';
      }
      toast('Uploaded', 'success');
    } catch (err) {
      toast((err && err.message) || 'Upload failed', 'error');
      input.value = '';
    }
  });
  container.addEventListener('click', async function (e) {
    const pick = e.target.closest('[data-action="pick-file"]');
    if (pick) {
      const input = _container.querySelector('#' + pick.dataset.for);
      if (input) input.click();
      return;
    }
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'close-modal') {
      trnCloseModal();
      return;
    }
    if (action === 'open-file') {
      await trnOpenFile(btn.dataset.fileId);
      return;
    }
    if (action === 'open-url') {
      trnOpenUrl(btn.dataset.url);
      return;
    }
    if (action === 'clear-file') {
      const forId = btn.dataset.for;
      const hidden = _container.querySelector('#' + forId + '_id');
      const input = _container.querySelector('#' + forId);
      if (hidden) hidden.value = '';
      if (input) input.value = '';
      if (forId === 'trnF_file') {
        _courseFileId = null;
        _courseFileName = '';
      }
      if (forId === 'trnL_file') {
        _lessonFileId = null;
        _lessonFileName = '';
      }
      const zone = _container.querySelector('[data-upload-for="' + forId + '"] .trn-upload-text');
      if (zone) zone.textContent = 'Drop file or click to upload';
      const meta = _container.querySelector('[data-upload-for="' + forId + '"] .trn-upload-meta');
      if (meta) meta.remove();
      return;
    }
    if (action === 'enroll') {
      const result = await api.post('/api/training/enroll', { courseId: btn.dataset.id });
      if (result && !result._error) {
        toast('Enrolled', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'view-course') {
      await trnShowCourseDetail(btn.dataset.id);
      return;
    }
    if (action === 'edit-course') {
      const course = _courses.find(function (c) {
        return c.id === btn.dataset.id;
      });
      if (course) trnShowCourseForm(course);
      return;
    }
    if (action === 'publish-course') {
      const result = await api.post('/api/training/courses/' + btn.dataset.id + '/publish', {});
      if (result && !result._error) {
        toast('Published', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'delete-course') {
      if (!(await confirmDialog({ message: 'Delete this course and its lessons?', confirmLabel: 'Delete', danger: true }))) return;
      const result = await api.delete('/api/training/courses/' + btn.dataset.id);
      if (result && !result._error) {
        toast('Deleted', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'complete-lesson') {
      const result = await api.put(
        '/api/training/enrollments/' + btn.dataset.enroll + '/lessons/' + btn.dataset.lesson,
        {},
      );
      if (result && !result._error) {
        toast('Lesson completed', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'add-lesson') {
      const title = (_container.querySelector('#trnL_title').value || '').trim();
      if (!title) {
        toast('Lesson title required', 'error');
        return;
      }
      const result = await api.post('/api/training/courses/' + btn.dataset.course + '/lessons', {
        title: title,
        type: _container.querySelector('#trnL_type').value,
        durationMinutes: Number(_container.querySelector('#trnL_duration').value) || 0,
        contentUrl: _container.querySelector('#trnL_url').value || '',
        fileId:
          (_container.querySelector('#trnL_file_id') &&
            _container.querySelector('#trnL_file_id').value) ||
          _lessonFileId ||
          null,
        required: !!_container.querySelector('#trnL_required').checked,
      });
      if (result && !result._error) {
        toast('Lesson added', 'success');
        _lessonFileId = null;
        _lessonFileName = '';
        await trnShowCourseDetail(btn.dataset.course);
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'delete-lesson') {
      if (!(await confirmDialog({ message: 'Remove this lesson?', confirmLabel: 'Remove', danger: true }))) return;
      const courseId = _courseDetail && _courseDetail.course && _courseDetail.course.id;
      const result = await api.delete('/api/training/lessons/' + btn.dataset.id);
      if (result && !result._error) {
        toast('Lesson removed', 'success');
        if (courseId) await trnShowCourseDetail(courseId);
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'link-skill') {
      const skillId = _container.querySelector('#trnLink_skill').value;
      const proficiency = _container.querySelector('#trnLink_prof').value;
      const result = await api.post('/api/training/courses/' + btn.dataset.course + '/skills', {
        skillId: skillId,
        proficiency: proficiency,
      });
      if (result && !result._error) {
        toast('Skill linked', 'success');
        await trnShowCourseDetail(btn.dataset.course);
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'add-skill') {
      const name = await promptDialog({
        title: 'New skill',
        label: 'Skill name',
        placeholder: 'e.g. Advanced Excel',
        confirmLabel: 'Create skill',
        required: true,
      });
      if (!name) return;
      const result = await api.post('/api/training/skills', { name: name });
      if (result && !result._error) {
        toast('Skill created', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'add-request') {
      _showRequestForm();
      return;
    }
    if (action === 'approve-req') {
      const result = await api.post(
        '/api/training/external-requests/' + btn.dataset.id + '/approve',
        { role: btn.dataset.role },
      );
      if (result && !result._error) {
        toast('Approved', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'reject-req') {
      const reason = await promptDialog({
        title: 'Reject training request',
        label: 'Rejection reason',
        placeholder: 'Why is this being rejected?',
        confirmLabel: 'Reject',
        required: true,
        danger: true,
      });
      if (reason === null) return;
      const result = await api.post(
        '/api/training/external-requests/' + btn.dataset.id + '/reject',
        { reason: reason },
      );
      if (result && !result._error) {
        toast('Rejected', 'success');
        await trnLoadData();
      } else toast((result && result.message) || 'Failed', 'error');
      return;
    }
    if (action === 'set-budget') {
      _showBudgetForm();
      return;
    }
    if (action === 'save-request') {
      await _saveRequest();
      return;
    }
    if (action === 'save-budget') {
      await _saveBudget();
      return;
    }
  });
}

function _showRequestForm() {
  const box = _container.querySelector('#trnModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="trn-modal-title">Request external training</div>' +
    '<div class="trn-field"><label>Title *</label><input type="text" id="trnR_title"></div>' +
    '<div class="trn-field"><label>Provider</label><input type="text" id="trnR_provider"></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Cost</label><input type="number" id="trnR_cost" value="0"></div>' +
    '<div class="trn-field"><label>Group ID (for budget)</label><input type="text" id="trnR_group"></div></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Start</label><input type="date" id="trnR_start"></div>' +
    '<div class="trn-field"><label>End</label><input type="date" id="trnR_end"></div></div>' +
    '<div class="trn-field"><label>Reason</label><textarea id="trnR_reason" rows="3"></textarea></div>' +
    '<div class="trn-form-actions">' +
    '<button class="trn-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button class="trn-btn" data-action="save-request">Submit</button></div>';
  _container.querySelector('#trnModal').classList.add('open');
}

async function _saveRequest() {
  const title = (_container.querySelector('#trnR_title').value || '').trim();
  if (!title) {
    toast('Title required', 'error');
    return;
  }
  const session = getSession();
  const result = await api.post('/api/training/external-requests', {
    email: session && session.email,
    name: session && session.name,
    title: title,
    provider: _container.querySelector('#trnR_provider').value || '',
    cost: Number(_container.querySelector('#trnR_cost').value) || 0,
    groupId: _container.querySelector('#trnR_group').value || '',
    startDate: _container.querySelector('#trnR_start').value || '',
    endDate: _container.querySelector('#trnR_end').value || '',
    reason: _container.querySelector('#trnR_reason').value || '',
  });
  if (result && !result._error) {
    toast('Request submitted', 'success');
    trnCloseModal();
    await trnLoadData();
  } else toast((result && result.message) || 'Failed', 'error');
}

function _showBudgetForm() {
  const box = _container.querySelector('#trnModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="trn-modal-title">Set department budget</div>' +
    '<div class="trn-field"><label>Group ID *</label><input type="text" id="trnB_group"></div>' +
    '<div class="trn-row">' +
    '<div class="trn-field"><label>Year</label><input type="number" id="trnB_year" value="' +
    new Date().getFullYear() +
    '"></div>' +
    '<div class="trn-field"><label>Annual budget *</label><input type="number" id="trnB_annual" value="0"></div></div>' +
    '<div class="trn-field"><label>Per-employee cap</label><input type="number" id="trnB_cap" value="0"></div>' +
    '<div class="trn-form-actions">' +
    '<button class="trn-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button class="trn-btn" data-action="save-budget">Save</button></div>';
  _container.querySelector('#trnModal').classList.add('open');
}

async function _saveBudget() {
  const groupId = (_container.querySelector('#trnB_group').value || '').trim();
  if (!groupId) {
    toast('Group ID required', 'error');
    return;
  }
  const result = await api.put('/api/training/budgets', {
    groupId: groupId,
    year: Number(_container.querySelector('#trnB_year').value) || new Date().getFullYear(),
    annualBudget: Number(_container.querySelector('#trnB_annual').value) || 0,
    perEmployeeCap: Number(_container.querySelector('#trnB_cap').value) || 0,
  });
  if (result && !result._error) {
    toast('Budget saved', 'success');
    trnCloseModal();
    await trnLoadData();
  } else toast((result && result.message) || 'Failed', 'error');
}

export function _getData() {
  return { courses: _courses, enrollments: _enrollments };
}
export function _resetState() {
  _container = null;
  _courses = [];
  _enrollments = [];
  _tab = 'my';
}

registerModule('training', renderTrainingPage);
