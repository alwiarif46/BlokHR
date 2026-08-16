/**
 * modules/documents/documents.js
 * Document Management — policies, pending acks, templates, generated docs.
 * Pattern: renderDocumentsPage() → docLoadData() → docRenderStats() → docRender()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { confirmDialog } from '../../shared/modal.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const DOC_CATEGORIES = [
  { value: 'policy', label: 'Policy' },
  { value: 'handbook', label: 'Handbook' },
  { value: 'code_of_conduct', label: 'Code of Conduct' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'guidelines', label: 'Guidelines' },
  { value: 'form', label: 'Form' },
  { value: 'other', label: 'Other' },
];

const TPL_CATEGORIES = [
  { value: 'offer_letter', label: 'Offer letter' },
  { value: 'appraisal_letter', label: 'Appraisal letter' },
  { value: 'warning_letter', label: 'Warning letter' },
  { value: 'experience_certificate', label: 'Experience certificate' },
  { value: 'salary_certificate', label: 'Salary certificate' },
  { value: 'custom', label: 'Custom' },
];

let _container = null;
let _tab = 'policies';
let _docs = [];
let _pending = [];
let _templates = [];
let _generated = [];
let _variables = [];
let _docsError = null;
let _featureOff = false;
let _saving = false;
let _editingDoc = null;
let _editingTpl = null;
let _generateTpl = null;
let _docFileId = '';
let _docFileName = '';
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

async function _uploadDocFile(file, contextId) {
  const dataUrl = await _readFileAsDataUrl(file);
  const result = await api.post('/api/storage/upload', {
    file: dataUrl,
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contextType: 'document',
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
    '<div class="doc-field">' +
    '<label>' +
    _esc(label) +
    '</label>' +
    '<div class="doc-upload" data-upload-for="' +
    _esc(id) +
    '">' +
    '<input type="file" id="' +
    _esc(id) +
    '" class="doc-upload-input" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp">' +
    '<div class="doc-upload-zone" data-action="pick-file" data-for="' +
    _esc(id) +
    '">' +
    '<div class="doc-upload-icon">&#128206;</div>' +
    '<div class="doc-upload-text">' +
    (hasFile ? _esc(fileName || 'Attached file') : 'Drop file or click to upload') +
    '</div>' +
    '<div class="doc-upload-hint">PDF, Office, images, text — readable in-app</div>' +
    '</div>' +
    '<input type="hidden" id="' +
    _esc(id) +
    '_id" value="' +
    _esc(fileId) +
    '">' +
    (hasFile
      ? '<div class="doc-upload-meta">' +
        '<button type="button" class="doc-btn ghost sm" data-action="open-file" data-file-id="' +
        _esc(fileId) +
        '">Open</button>' +
        '<button type="button" class="doc-btn ghost sm" data-action="clear-file" data-for="' +
        _esc(id) +
        '">Remove</button></div>'
      : '') +
    '</div></div>'
  );
}

async function docOpenFile(fileId) {
  if (!fileId) return;
  try {
    toast('Loading file…', 'info');
    const file = await _fetchFileBlob(fileId, true);
    if (_viewerObjectUrl) URL.revokeObjectURL(_viewerObjectUrl);
    _viewerObjectUrl = URL.createObjectURL(file.blob);
    const mime = (file.mimeType || '').toLowerCase();
    const box = _container.querySelector('#docModalBox');
    if (!box) return;
    let body = '';
    if (mime.indexOf('image/') === 0) {
      body = '<img class="doc-viewer-media" src="' + _viewerObjectUrl + '" alt="">';
    } else if (mime === 'application/pdf' || mime.indexOf('text/') === 0) {
      body =
        '<iframe class="doc-viewer-frame" title="Document" src="' +
        _viewerObjectUrl +
        '"></iframe>';
    } else {
      body =
        '<div class="doc-viewer-fallback">' +
        '<p>Preview is not available for this file type.</p>' +
        '<a class="doc-btn" href="' +
        _viewerObjectUrl +
        '" download="' +
        _esc(file.name) +
        '">Download ' +
        _esc(file.name) +
        '</a></div>';
    }
    box.innerHTML =
      '<div class="doc-modal-title">View: ' +
      _esc(file.name) +
      '</div>' +
      '<div class="doc-viewer">' +
      body +
      '</div>' +
      '<div class="doc-form-actions">' +
      '<a class="doc-btn ghost" href="' +
      _viewerObjectUrl +
      '" download="' +
      _esc(file.name) +
      '">Download</a>' +
      '<button type="button" class="doc-btn" data-action="close-modal">Close</button></div>';
    box.classList.add('wide');
    _container.querySelector('#docModal').classList.add('open');
  } catch (err) {
    toast((err && err.message) || 'Could not open file', 'error');
  }
}

function _catLabel(list, value) {
  const found = list.find((c) => c.value === value);
  return found ? found.label : value || '—';
}

/** Normalize document API row for UI cards. */
export function _normalizeDoc(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    documentGroupId: raw.document_group_id || raw.documentGroupId || '',
    title: raw.title || raw.name || '',
    category: raw.category || 'other',
    version: Number(raw.version) || 1,
    content: raw.content || '',
    fileId: raw.file_id != null ? raw.file_id : raw.fileId || '',
    status: raw.status || 'draft',
    ackRequired: !!(raw.ack_required === 1 || raw.ack_required === true || raw.ackRequired),
    publishedAt: raw.published_at || raw.publishedAt || '',
    createdBy: raw.created_by || raw.createdBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
  };
}

/** Normalize pending-ack row (uses document_id). */
export function _normalizePending(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.document_id || raw.documentId || raw.id,
    title: raw.title || '',
    category: raw.category || '',
    version: Number(raw.version) || 1,
    fileId: raw.file_id != null ? raw.file_id : raw.fileId || '',
    content: raw.content || '',
  };
}

/** Normalize template row. */
export function _normalizeTemplate(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    name: raw.name || '',
    category: raw.category || 'custom',
    contentTemplate: raw.content_template || raw.contentTemplate || '',
    description: raw.description || '',
    createdBy: raw.created_by || raw.createdBy || '',
  };
}

/** Normalize generated document row. */
export function _normalizeGenerated(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  return {
    id: raw.id,
    templateId: raw.template_id || raw.templateId || '',
    templateName: raw.template_name || raw.templateName || '',
    templateCategory: raw.template_category || raw.templateCategory || '',
    targetEmail: raw.target_email || raw.targetEmail || '',
    generatedBy: raw.generated_by || raw.generatedBy || '',
    createdAt: raw.created_at || raw.createdAt || '',
    fileId: raw.file_id != null ? raw.file_id : raw.fileId,
  };
}

export function renderDocumentsPage(container) {
  _container = container;
  _tab = 'policies';
  _editingDoc = null;
  _editingTpl = null;
  _generateTpl = null;
  const admin = _isAdmin();
  container.innerHTML =
    '<div class="doc-wrap" id="docWrap">' +
      '<div class="doc-toolbar">' +
        '<div style="font-size:13px;font-weight:700;color:var(--tx);display:flex;align-items:center;gap:8px"><span>&#128196;</span> Document Management</div>' +
        '<div class="doc-spacer"></div>' +
        '<button type="button" class="doc-btn" id="docAddBtn" style="display:none">+ Add</button>' +
      '</div>' +
      '<div class="doc-tabs" id="docTabs">' +
        '<button type="button" class="doc-tab active" data-tab="policies">Policies</button>' +
        '<button type="button" class="doc-tab" data-tab="pending">Pending Acks</button>' +
        '<button type="button" class="doc-tab" data-tab="templates">Templates</button>' +
        '<button type="button" class="doc-tab" data-tab="generated">Generated</button>' +
      '</div>' +
      '<div class="doc-stats" id="docStats"></div>' +
      '<div id="docContent"></div>' +
      '<div class="doc-modal" id="docModal"><div class="doc-modal-box wide" id="docModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  _syncAddButton();
  docLoadData();
}

function _syncAddButton() {
  const btn = _container && _container.querySelector('#docAddBtn');
  if (!btn) return;
  const admin = _isAdmin();
  const show =
    (admin && _tab === 'policies') || (admin && _tab === 'templates');
  btn.style.display = show ? '' : 'none';
  btn.textContent = _tab === 'templates' ? '+ Template' : '+ Add';
}

export async function docLoadData() {
  _docsError = null;
  _featureOff = false;

  const admin = _isAdmin();
  const genPath = admin ? '/api/generated-documents' : '/api/generated-documents/mine';

  const [docsRes, pendingRes, tplRes, genRes, varsRes] = await Promise.all([
    api.get('/api/documents'),
    api.get('/api/documents/my/pending-acks'),
    api.get('/api/document-templates'),
    api.get(genPath),
    api.get('/api/document-templates/variables'),
  ]);

  if (docsRes && docsRes._error) {
    _docs = [];
    _docsError = docsRes.message || 'Could not load documents';
    if (docsRes.status === 404) {
      _featureOff = true;
      _docsError = 'Document Management is disabled for this workspace';
    }
  } else {
    const rows = (docsRes && (docsRes.documents || docsRes)) || [];
    _docs = (Array.isArray(rows) ? rows : []).map(_normalizeDoc);
  }

  if (pendingRes && !pendingRes._error) {
    const rows = pendingRes.pending || [];
    _pending = (Array.isArray(rows) ? rows : []).map(_normalizePending);
  } else {
    _pending = [];
  }

  if (tplRes && !tplRes._error) {
    const rows = tplRes.templates || [];
    _templates = (Array.isArray(rows) ? rows : []).map(_normalizeTemplate);
  } else {
    _templates = [];
  }

  if (genRes && !genRes._error) {
    const rows = genRes.documents || [];
    _generated = (Array.isArray(rows) ? rows : []).map(_normalizeGenerated);
  } else {
    _generated = [];
  }

  if (varsRes && !varsRes._error && Array.isArray(varsRes.variables)) {
    _variables = varsRes.variables;
  } else {
    _variables = [];
  }

  docRenderStats();
  docRender();
}

export function docRenderStats() {
  const el = _container && _container.querySelector('#docStats');
  if (!el) return;
  el.innerHTML =
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--accent)">' +
    _docs.length +
    '</div><div class="doc-stat-label">Total Docs</div></div>' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--status-in)">' +
    _templates.length +
    '</div><div class="doc-stat-label">Templates</div></div>' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--status-break)">' +
    _generated.length +
    '</div><div class="doc-stat-label">Generated</div></div>' +
    '<div class="doc-stat"><div class="doc-stat-num" style="color:var(--status-absent)">' +
    _pending.length +
    '</div><div class="doc-stat-label">Pending Acks</div></div>';
}

function _empty(icon, text) {
  return (
    '<div class="doc-empty"><div class="doc-empty-icon">' +
    icon +
    '</div><div class="doc-empty-text">' +
    _esc(text) +
    '</div></div>'
  );
}

export function docRender() {
  const el = _container && _container.querySelector('#docContent');
  if (!el) return;
  _syncAddButton();

  if (_featureOff) {
    el.innerHTML = _empty('&#128274;', _docsError || 'Document Management is disabled');
    return;
  }

  if (_tab === 'policies') {
    if (_docsError && !_docs.length) {
      el.innerHTML = _empty('&#9888;', _docsError);
      return;
    }
    if (!_docs.length) {
      el.innerHTML = _empty(
        '&#128196;',
        _isAdmin() ? 'No policies yet — create one' : 'No published policies yet',
      );
      return;
    }
    el.innerHTML = '<div class="doc-grid">' + _docs.map(_renderDocCard).join('') + '</div>';
    return;
  }

  if (_tab === 'pending') {
    if (!_pending.length) {
      el.innerHTML = _empty(
        '&#128196;',
        'No documents waiting for your acknowledgment',
      );
      return;
    }
    el.innerHTML =
      '<div class="doc-grid">' +
      _pending
        .map(function (item, i) {
          let actions =
            '<button type="button" data-action="acknowledge" data-idx="' +
            i +
            '">Acknowledge</button>';
          if (item.fileId) {
            actions =
              '<button type="button" data-action="open-file" data-file-id="' +
              _esc(item.fileId) +
              '">Open</button>' +
              actions;
          }
          return (
            '<div class="doc-card" data-id="' +
            _esc(item.id) +
            '">' +
            '<div class="doc-card-title">' +
            _esc(item.title) +
            '</div>' +
            '<div class="doc-card-sub">' +
            _esc(_catLabel(DOC_CATEGORIES, item.category)) +
            ' · v' +
            _esc(String(item.version)) +
            '</div>' +
            '<div class="doc-card-actions">' +
            actions +
            '</div></div>'
          );
        })
        .join('') +
      '</div>';
    return;
  }

  if (_tab === 'templates') {
    if (!_templates.length) {
      el.innerHTML = _empty(
        '&#128196;',
        _isAdmin() ? 'No templates yet — create one' : 'No templates available',
      );
      return;
    }
    el.innerHTML =
      '<div class="doc-grid">' + _templates.map(_renderTplCard).join('') + '</div>';
    return;
  }

  if (_tab === 'generated') {
    if (!_generated.length) {
      el.innerHTML = _empty('&#128196;', 'No generated documents yet');
      return;
    }
    el.innerHTML =
      '<div class="doc-grid">' +
      _generated
        .map(function (item) {
          return (
            '<div class="doc-card" data-id="' +
            _esc(item.id) +
            '">' +
            '<div class="doc-card-title">' +
            _esc(item.templateName || 'Generated document') +
            '</div>' +
            '<div class="doc-card-sub">' +
            _esc(item.targetEmail) +
            (item.createdAt ? ' · ' + _esc(String(item.createdAt).slice(0, 10)) : '') +
            '</div>' +
            '<span class="doc-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
            _esc(_catLabel(TPL_CATEGORIES, item.templateCategory) || 'generated') +
            '</span>' +
            '</div>'
          );
        })
        .join('') +
      '</div>';
  }
}

function _renderDocCard(item, i) {
  const admin = _isAdmin();
  const status = item.status || 'draft';
  let actions = '';
  if (item.fileId) {
    actions +=
      '<button type="button" data-action="open-file" data-file-id="' +
      _esc(item.fileId) +
      '">Open</button>';
  }
  if (admin && status === 'draft') {
    actions +=
      '<button type="button" data-action="edit-doc" data-idx="' +
      i +
      '">Edit</button>' +
      '<button type="button" data-action="publish" data-idx="' +
      i +
      '">Publish</button>' +
      '<button type="button" class="danger" data-action="delete-doc" data-idx="' +
      i +
      '">Delete</button>';
  }
  if (admin && status === 'published') {
    actions +=
      '<button type="button" data-action="version" data-idx="' +
      i +
      '">New version</button>' +
      '<button type="button" data-action="archive" data-idx="' +
      i +
      '">Archive</button>';
  }
  return (
    '<div class="doc-card" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="doc-card-title">' +
    _esc(item.title) +
    '</div>' +
    '<div class="doc-card-sub">' +
    _esc(_catLabel(DOC_CATEGORIES, item.category)) +
    ' · v' +
    _esc(String(item.version)) +
    (item.ackRequired ? ' · Ack required' : '') +
    (item.fileId ? ' · File attached' : '') +
    '</div>' +
    '<span class="doc-card-badge" style="background:var(--accent-dim);color:var(--accent)">' +
    _esc(status) +
    '</span>' +
    (actions ? '<div class="doc-card-actions">' + actions + '</div>' : '') +
    '</div>'
  );
}

function _renderTplCard(item, i) {
  const admin = _isAdmin();
  let actions =
    '<button type="button" data-action="generate" data-idx="' +
    i +
    '">Generate</button>';
  if (admin) {
    actions +=
      '<button type="button" data-action="edit-tpl" data-idx="' +
      i +
      '">Edit</button>' +
      '<button type="button" class="danger" data-action="delete-tpl" data-idx="' +
      i +
      '">Delete</button>';
  }
  return (
    '<div class="doc-card" data-id="' +
    _esc(item.id) +
    '">' +
    '<div class="doc-card-title">' +
    _esc(item.name) +
    '</div>' +
    '<div class="doc-card-sub">' +
    _esc(_catLabel(TPL_CATEGORIES, item.category)) +
    (item.description ? ' · ' + _esc(item.description) : '') +
    '</div>' +
    '<div class="doc-card-actions">' +
    actions +
    '</div></div>'
  );
}

function _optionsHtml(list, selected) {
  return list
    .map(function (c) {
      return (
        '<option value="' +
        _esc(c.value) +
        '"' +
        (c.value === selected ? ' selected' : '') +
        '>' +
        _esc(c.label) +
        '</option>'
      );
    })
    .join('');
}

export function docShowForm(item) {
  _editingDoc = item || null;
  _docFileId = (item && item.fileId) || '';
  _docFileName = '';
  const isEdit = !!item;
  const box = _container && _container.querySelector('#docModalBox');
  if (!box) return;
  const cat = (item && item.category) || 'policy';
  box.innerHTML =
    '<div class="doc-modal-title">' +
    (isEdit ? 'Edit policy' : 'Add policy') +
    '</div>' +
    '<div class="doc-field"><label>Title *</label><input type="text" id="docF_title" value="' +
    _esc((item && item.title) || '') +
    '"></div>' +
    '<div class="doc-field"><label>Category</label><select id="docF_category">' +
    _optionsHtml(DOC_CATEGORIES, cat) +
    '</select></div>' +
    '<div class="doc-field"><label>Content</label><textarea id="docF_content" rows="6">' +
    _esc((item && item.content) || '') +
    '</textarea></div>' +
    _uploadZoneHtml({
      inputId: 'docF_file',
      label: 'Attachment (upload)',
      fileId: _docFileId,
      fileName: _docFileId ? 'Attached file' : '',
    }) +
    '<div class="doc-field"><label><input type="checkbox" id="docF_ack"' +
    (item && item.ackRequired ? ' checked' : '') +
    '> Require acknowledgment</label></div>' +
    '<div class="doc-form-actions">' +
    '<button type="button" class="doc-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="doc-btn" id="docSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#docModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#docSaveBtn').addEventListener('click', function () {
    _saveDoc();
  });
  if (_docFileId) {
    api.get('/api/storage/files/' + _docFileId).then(function (meta) {
      if (meta && !meta._error && (meta.original_name || meta.originalName)) {
        _docFileName = meta.original_name || meta.originalName;
        const text = box.querySelector('.doc-upload-text');
        if (text) text.textContent = _docFileName;
      }
    });
  }
}

async function _saveDoc() {
  if (_saving) return;
  const titleEl = _container.querySelector('#docF_title');
  const catEl = _container.querySelector('#docF_category');
  const contentEl = _container.querySelector('#docF_content');
  const ackEl = _container.querySelector('#docF_ack');
  const fileIdEl = _container.querySelector('#docF_file_id');
  const title = (titleEl && titleEl.value.trim()) || '';
  if (!title) {
    toast('Title is required', 'error');
    return;
  }
  const fileId = (fileIdEl && fileIdEl.value) || _docFileId || null;
  const body = {
    title: title,
    category: (catEl && catEl.value) || 'policy',
    content: (contentEl && contentEl.value) || '',
    ackRequired: !!(ackEl && ackEl.checked),
    fileId: fileId || null,
  };
  _saving = true;
  try {
    let result;
    if (_editingDoc && _editingDoc.id) {
      result = await api.put('/api/documents/' + _editingDoc.id, body);
    } else {
      result = await api.post('/api/documents', body);
    }
    if (result && result._error) {
      toast(result.message || 'Failed to save', 'error');
      return;
    }
    toast(_editingDoc ? 'Updated' : 'Created', 'success');
    docCloseModal();
    await docLoadData();
  } finally {
    _saving = false;
  }
}

export function docShowTemplateForm(item) {
  _editingTpl = item || null;
  const isEdit = !!item;
  const box = _container && _container.querySelector('#docModalBox');
  if (!box) return;
  const cat = (item && item.category) || 'custom';
  const varsHint =
    _variables.length > 0
      ? '<div class="doc-field-hint">Variables: ' +
        _esc(
          _variables
            .map(function (v) {
              return typeof v === 'string' ? v : v.key || v.name || JSON.stringify(v);
            })
            .join(', '),
        ) +
        '</div>'
      : '';
  box.innerHTML =
    '<div class="doc-modal-title">' +
    (isEdit ? 'Edit template' : 'Add template') +
    '</div>' +
    '<div class="doc-field"><label>Name *</label><input type="text" id="docT_name" value="' +
    _esc((item && item.name) || '') +
    '"></div>' +
    '<div class="doc-field"><label>Category</label><select id="docT_category">' +
    _optionsHtml(TPL_CATEGORIES, cat) +
    '</select></div>' +
    '<div class="doc-field"><label>Description</label><input type="text" id="docT_desc" value="' +
    _esc((item && item.description) || '') +
    '"></div>' +
    '<div class="doc-field"><label>Content template *</label><textarea id="docT_content" rows="10">' +
    _esc((item && item.contentTemplate) || '') +
    '</textarea>' +
    varsHint +
    '</div>' +
    '<div class="doc-form-actions">' +
    '<button type="button" class="doc-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="doc-btn" id="docTplSaveBtn">' +
    (isEdit ? 'Update' : 'Create') +
    '</button></div>';
  const modal = _container.querySelector('#docModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#docTplSaveBtn').addEventListener('click', function () {
    _saveTemplate();
  });
}

async function _saveTemplate() {
  if (_saving) return;
  const name = ((_container.querySelector('#docT_name') || {}).value || '').trim();
  const contentTemplate = ((_container.querySelector('#docT_content') || {}).value || '').trim();
  if (!name) {
    toast('Name is required', 'error');
    return;
  }
  if (!contentTemplate) {
    toast('Content template is required', 'error');
    return;
  }
  const body = {
    name: name,
    category: ((_container.querySelector('#docT_category') || {}).value) || 'custom',
    description: ((_container.querySelector('#docT_desc') || {}).value || '').trim(),
    contentTemplate: contentTemplate,
  };
  _saving = true;
  try {
    let result;
    if (_editingTpl && _editingTpl.id) {
      result = await api.put('/api/document-templates/' + _editingTpl.id, body);
    } else {
      result = await api.post('/api/document-templates', body);
    }
    if (result && result._error) {
      toast(result.message || 'Failed to save', 'error');
      return;
    }
    toast(_editingTpl ? 'Updated' : 'Created', 'success');
    docCloseModal();
    await docLoadData();
  } finally {
    _saving = false;
  }
}

export function docShowGenerateForm(tpl) {
  _generateTpl = tpl;
  const box = _container && _container.querySelector('#docModalBox');
  if (!box || !tpl) return;
  const session = getSession() || {};
  box.innerHTML =
    '<div class="doc-modal-title">Generate: ' +
    _esc(tpl.name) +
    '</div>' +
    '<div class="doc-field"><label>Target email *</label><input type="email" id="docG_email" value="' +
    _esc(session.email || '') +
    '"></div>' +
    '<div class="doc-form-actions">' +
    '<button type="button" class="doc-btn ghost" data-action="close-modal">Cancel</button>' +
    '<button type="button" class="doc-btn ghost" id="docPreviewBtn">Preview</button>' +
    '<button type="button" class="doc-btn" id="docGenerateBtn">Generate</button></div>' +
    '<pre class="doc-preview" id="docPreviewOut" style="display:none"></pre>';
  const modal = _container.querySelector('#docModal');
  if (modal) modal.classList.add('open');
  box.querySelector('#docPreviewBtn').addEventListener('click', function () {
    _runGenerate(true);
  });
  box.querySelector('#docGenerateBtn').addEventListener('click', function () {
    _runGenerate(false);
  });
}

async function _runGenerate(previewOnly) {
  if (_saving || !_generateTpl) return;
  const email = ((_container.querySelector('#docG_email') || {}).value || '').trim();
  if (!email) {
    toast('Target email is required', 'error');
    return;
  }
  const path =
    '/api/document-templates/' +
    _generateTpl.id +
    (previewOnly ? '/preview' : '/generate');
  _saving = true;
  try {
    const result = await api.post(path, { targetEmail: email });
    if (result && result._error) {
      toast(result.message || 'Failed', 'error');
      return;
    }
    if (previewOnly) {
      const out = _container.querySelector('#docPreviewOut');
      if (out) {
        out.style.display = 'block';
        out.textContent = result.content || '';
      }
      toast('Preview ready', 'info');
      return;
    }
    toast('Generated', 'success');
    docCloseModal();
    _tab = 'generated';
    _setActiveTab();
    await docLoadData();
  } finally {
    _saving = false;
  }
}

async function docDeleteDoc(idx) {
  const item = _docs[idx];
  if (!item) return;
  if (!(await confirmDialog({ message: 'Delete this draft document?', confirmLabel: 'Delete', danger: true }))) return;
  const result = await api.delete('/api/documents/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await docLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function docDeleteTpl(idx) {
  const item = _templates[idx];
  if (!item) return;
  if (!(await confirmDialog({ message: 'Delete this template?', confirmLabel: 'Delete', danger: true }))) return;
  const result = await api.delete('/api/document-templates/' + item.id);
  if (result && !result._error) {
    toast('Deleted', 'success');
    await docLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function docLifecycle(action, idx) {
  const item = _docs[idx];
  if (!item) return;
  const result = await api.post('/api/documents/' + item.id + '/' + action, {});
  if (result && !result._error) {
    toast(action === 'publish' ? 'Published' : action === 'archive' ? 'Archived' : 'Version created', 'success');
    await docLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

async function docAcknowledge(idx) {
  const item = _pending[idx];
  if (!item || !item.id) return;
  const result = await api.post('/api/documents/' + item.id + '/acknowledge', {});
  if (result && !result._error) {
    toast('Acknowledged', 'success');
    await docLoadData();
    return;
  }
  toast((result && result.message) || 'Failed', 'error');
}

export function docCloseModal() {
  const modal = _container && _container.querySelector('#docModal');
  if (modal) modal.classList.remove('open');
  if (_viewerObjectUrl) {
    URL.revokeObjectURL(_viewerObjectUrl);
    _viewerObjectUrl = null;
  }
  _editingDoc = null;
  _editingTpl = null;
  _generateTpl = null;
  _docFileId = '';
  _docFileName = '';
}

function _setActiveTab() {
  const tabs = _container && _container.querySelectorAll('.doc-tab');
  if (!tabs) return;
  tabs.forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === _tab);
  });
}

function _bindEvents(container) {
  const addBtn = container.querySelector('#docAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function () {
      if (_tab === 'templates') docShowTemplateForm(null);
      else docShowForm(null);
    });
  }

  const tabs = container.querySelector('#docTabs');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      const tab = e.target.closest('.doc-tab');
      if (!tab) return;
      _tab = tab.dataset.tab || 'policies';
      _setActiveTab();
      docRender();
    });
  }

  const modal = container.querySelector('#docModal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) docCloseModal();
    });
  }

  container.addEventListener('change', async function (e) {
    const input = e.target;
    if (!input || input.type !== 'file' || input.id !== 'docF_file') return;
    const file = input.files && input.files[0];
    if (!file) return;
    const contextId = (_editingDoc && _editingDoc.id) || '';
    try {
      toast('Uploading…', 'info');
      const uploaded = await _uploadDocFile(file, contextId);
      const fileId = uploaded.id;
      const name = uploaded.original_name || uploaded.originalName || file.name;
      const hidden = _container.querySelector('#docF_file_id');
      if (hidden) hidden.value = fileId;
      _docFileId = fileId;
      _docFileName = name;
      const wrap = _container.querySelector('[data-upload-for="docF_file"]');
      if (wrap) {
        const text = wrap.querySelector('.doc-upload-text');
        if (text) text.textContent = name;
        let meta = wrap.querySelector('.doc-upload-meta');
        if (!meta) {
          meta = document.createElement('div');
          meta.className = 'doc-upload-meta';
          wrap.appendChild(meta);
        }
        meta.innerHTML =
          '<button type="button" class="doc-btn ghost sm" data-action="open-file" data-file-id="' +
          _esc(fileId) +
          '">Open</button>' +
          '<button type="button" class="doc-btn ghost sm" data-action="clear-file" data-for="docF_file">Remove</button>';
      }
      toast('Uploaded', 'success');
    } catch (err) {
      toast((err && err.message) || 'Upload failed', 'error');
      input.value = '';
    }
  });

  const content = container.querySelector('#docContent');
  if (content) {
    content.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const idx = parseInt(btn.dataset.idx, 10);
      if (action === 'edit-doc') docShowForm(_docs[idx]);
      else if (action === 'delete-doc') docDeleteDoc(idx);
      else if (action === 'publish') docLifecycle('publish', idx);
      else if (action === 'archive') docLifecycle('archive', idx);
      else if (action === 'version') docLifecycle('version', idx);
      else if (action === 'acknowledge') docAcknowledge(idx);
      else if (action === 'edit-tpl') docShowTemplateForm(_templates[idx]);
      else if (action === 'delete-tpl') docDeleteTpl(idx);
      else if (action === 'generate') docShowGenerateForm(_templates[idx]);
      else if (action === 'open-file') docOpenFile(btn.dataset.fileId);
    });
  }

  container.addEventListener('click', function (e) {
    const pick = e.target.closest('[data-action="pick-file"]');
    if (pick) {
      const input = _container.querySelector('#' + pick.dataset.for);
      if (input) input.click();
      return;
    }
    const clearBtn = e.target.closest('[data-action="clear-file"]');
    if (clearBtn) {
      const forId = clearBtn.dataset.for;
      const hidden = _container.querySelector('#' + forId + '_id');
      const input = _container.querySelector('#' + forId);
      if (hidden) hidden.value = '';
      if (input) input.value = '';
      _docFileId = '';
      _docFileName = '';
      const wrap = _container.querySelector('[data-upload-for="' + forId + '"]');
      if (wrap) {
        const text = wrap.querySelector('.doc-upload-text');
        if (text) text.textContent = 'Drop file or click to upload';
        const meta = wrap.querySelector('.doc-upload-meta');
        if (meta) meta.remove();
      }
      return;
    }
    const openBtn = e.target.closest('[data-action="open-file"]');
    if (openBtn && openBtn.closest('#docModal')) {
      docOpenFile(openBtn.dataset.fileId);
      return;
    }
    if (e.target.closest('[data-action="close-modal"]')) docCloseModal();
  });
}

/* ── Test helpers ── */
export function _getDocs() {
  return _docs;
}
export function _getPending() {
  return _pending;
}
export function _getTemplates() {
  return _templates;
}
export function _getGenerated() {
  return _generated;
}
export function _getTab() {
  return _tab;
}
export function _setTab(t) {
  _tab = t;
}
export function _getData() {
  return _docs;
}
export function _setData(d) {
  _docs = Array.isArray(d) ? d.map(_normalizeDoc) : [];
}
export function _resetState() {
  _container = null;
  _tab = 'policies';
  _docs = [];
  _pending = [];
  _templates = [];
  _generated = [];
  _variables = [];
  _docsError = null;
  _featureOff = false;
  _saving = false;
  _editingDoc = null;
  _editingTpl = null;
  _generateTpl = null;
  _docFileId = '';
  _docFileName = '';
  if (_viewerObjectUrl) {
    URL.revokeObjectURL(_viewerObjectUrl);
    _viewerObjectUrl = null;
  }
}

registerModule('documents', renderDocumentsPage);
