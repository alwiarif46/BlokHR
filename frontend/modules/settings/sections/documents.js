/**
 * modules/documents/documents.js
 * Document management: upload, templates, generated docs, download.
 * Pattern: renderDocumentsPage() → docLoadData() → docRenderStats()
 *          → docRender() → CRUD → docCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _docs = [];
let _templates = [];
let _generated = [];
let _tab = 'docs';  // 'docs' | 'templates' | 'generated'
let _search = '';
let _filterType = '';

const _docTypes = ['Offer Letter', 'Employment Contract', 'NDA', 'Policy Document', 'Certificate', 'Pay Slip', 'Tax Form', 'ID Proof', 'Other'];

const _mockDocs = [
  { id: 'd1', name: 'Employment Contract - Arif.pdf',   type: 'Employment Contract', size: 245000, uploaded_by: 'admin@co.com', uploaded_on: '2024-01-15', accessible_to: 'arif@co.com',  mime: 'application/pdf' },
  { id: 'd2', name: 'NDA - Sarah Chen.pdf',             type: 'NDA',                 size: 128000, uploaded_by: 'admin@co.com', uploaded_on: '2023-06-01', accessible_to: 'sarah@co.com', mime: 'application/pdf' },
  { id: 'd3', name: 'Company Policy 2026.pdf',          type: 'Policy Document',     size: 512000, uploaded_by: 'admin@co.com', uploaded_on: '2026-01-01', accessible_to: 'all',          mime: 'application/pdf' },
  { id: 'd4', name: 'IT Security Guidelines.pdf',       type: 'Policy Document',     size: 198000, uploaded_by: 'admin@co.com', uploaded_on: '2026-01-10', accessible_to: 'all',          mime: 'application/pdf' },
  { id: 'd5', name: 'Bob Builder - Offer Letter.docx',  type: 'Offer Letter',        size: 45000,  uploaded_by: 'admin@co.com', uploaded_on: '2023-03-15', accessible_to: 'bob@co.com',   mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
];

const _mockTemplates = [
  { id: 't1', name: 'Offer Letter Template',     fields: ['employee_name', 'designation', 'department', 'salary', 'joining_date'], created_on: '2024-01-01' },
  { id: 't2', name: 'Experience Certificate',    fields: ['employee_name', 'designation', 'from_date', 'to_date'],                 created_on: '2024-01-01' },
  { id: 't3', name: 'Salary Slip Template',      fields: ['employee_name', 'month', 'basic', 'hra', 'da', 'deductions'],           created_on: '2024-01-01' },
  { id: 't4', name: 'NOC Letter',                fields: ['employee_name', 'purpose', 'valid_till'],                               created_on: '2024-03-01' },
];

const _mockGenerated = [
  { id: 'g1', template: 'Offer Letter Template',  employee: 'Priya Sharma', generated_on: '2026-03-20', generated_by: 'admin@co.com', status: 'ready' },
  { id: 'g2', template: 'Experience Certificate', employee: 'Omar Hassan',  generated_on: '2026-02-14', generated_by: 'admin@co.com', status: 'ready' },
];

export function renderDocumentsPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="doc-wrap">' +
      '<div class="doc-toolbar">' +
        '<div class="doc-tabs" id="docTabs">' +
          '<button class="doc-tab active" data-tab="docs">Documents</button>' +
          (isAdmin ? '<button class="doc-tab" data-tab="templates">Templates</button>' : '') +
          '<button class="doc-tab" data-tab="generated">Generated</button>' +
        '</div>' +
        '<input class="doc-search" id="docSearch" placeholder="Search…" autocomplete="off">' +
        '<select class="doc-select" id="docTypeFilter">' +
          '<option value="">All Types</option>' +
          _docTypes.map(t => '<option value="' + t + '">' + t + '</option>').join('') +
        '</select>' +
        (isAdmin ? '<button class="doc-btn" id="docUploadBtn">&#8593; Upload</button>' : '') +
      '</div>' +
      '<div id="docStats" class="doc-stats"></div>' +
      '<div id="docContent"></div>' +
      '<div class="doc-modal" id="docModal"><div class="doc-modal-box" id="docModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  docLoadData();
}

export async function docLoadData() {
  const [docsData, templatesData, generatedData] = await Promise.all([
    api.get('/api/documents'),
    api.get('/api/documents/templates'),
    api.get('/api/documents/generated'),
  ]);
  _docs = (docsData && !docsData._error) ? (docsData.documents || docsData || []) : _mockDocs;
  if (!Array.isArray(_docs)) _docs = _mockDocs;
  _templates = (templatesData && !templatesData._error) ? (templatesData.templates || templatesData || []) : _mockTemplates;
  if (!Array.isArray(_templates)) _templates = _mockTemplates;
  _generated = (generatedData && !generatedData._error) ? (generatedData.generated || generatedData || []) : _mockGenerated;
  if (!Array.isArray(_generated)) _generated = _mockGenerated;
  docRenderStats();
  docRender();
}

export function docRenderStats() {
  const el = _container && _container.querySelector('#docStats');
  if (!el) return;
  const totalSize = _docs.reduce((s, d) => s + (d.size || 0), 0);
  el.innerHTML =
    _sc(_docs.length, 'Documents', 'var(--accent)') +
    _sc(_templates.length, 'Templates', 'var(--status-in)') +
    _sc(_generated.length, 'Generated', 'var(--status-break)') +
    _sc(_fmtSize(totalSize), 'Total Size', 'var(--tx2)');
}

function _sc(n, l, c) {
  return '<div class="doc-stat"><div class="doc-stat-n" style="color:' + c + '">' + n + '</div><div class="doc-stat-l">' + l + '</div></div>';
}

export function docRender() {
  if (_tab === 'templates') _renderTemplates();
  else if (_tab === 'generated') _renderGenerated();
  else _renderDocs();
}

function _renderDocs() {
  const el = _container && _container.querySelector('#docContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  let items = _docs;
  if (!isAdmin) items = items.filter(d => d.accessible_to === (session && session.email) || d.accessible_to === 'all');
  if (_filterType) items = items.filter(d => d.type === _filterType);
  if (_search) items = items.filter(d => d.name.toLowerCase().includes(_search));

  if (!items.length) { el.innerHTML = '<div class="doc-empty"><div style="font-size:2rem">&#128196;</div><div>No documents found</div></div>'; return; }

  let html = '<div class="doc-list">';
  items.forEach(function (d, i) {
    html +=
      '<div class="doc-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="doc-icon">' + _fileIcon(d.mime) + '</div>' +
        '<div class="doc-info">' +
          '<div class="doc-name">' + _esc(d.name) + '</div>' +
          '<div class="doc-meta">' + _esc(d.type || '') + ' &middot; ' + _fmtSize(d.size || 0) + ' &middot; ' + _fmtDate(d.uploaded_on) + '</div>' +
          (isAdmin && d.accessible_to !== 'all' ? '<div class="doc-access">Visible to: ' + _esc(d.accessible_to) + '</div>' : '') +
        '</div>' +
        '<div class="doc-actions">' +
          '<button data-action="download" data-id="' + _esc(d.id) + '" class="doc-btn-sm">&#8595; Download</button>' +
          (isAdmin ? '<button data-action="delete-doc" data-id="' + _esc(d.id) + '" class="doc-btn-sm danger">Delete</button>' : '') +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderTemplates() {
  const el = _container && _container.querySelector('#docContent');
  if (!el) return;
  const items = _templates.filter(t => !_search || t.name.toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="doc-empty"><div style="font-size:2rem">&#128211;</div><div>No templates</div></div>'; return; }
  let html = '<div class="doc-tpl-grid">';
  items.forEach(function (t, i) {
    html +=
      '<div class="doc-tpl-card" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="doc-tpl-icon">&#128211;</div>' +
        '<div class="doc-tpl-name">' + _esc(t.name) + '</div>' +
        '<div class="doc-tpl-fields">' + t.fields.length + ' fields: ' + t.fields.slice(0, 3).map(f => '<code>' + f + '</code>').join(', ') + (t.fields.length > 3 ? '…' : '') + '</div>' +
        '<div class="doc-tpl-actions">' +
          '<button data-action="generate" data-id="' + _esc(t.id) + '" class="doc-btn-sm">Generate</button>' +
          '<button data-action="edit-tpl" data-id="' + _esc(t.id) + '" class="doc-btn-sm">Edit</button>' +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderGenerated() {
  const el = _container && _container.querySelector('#docContent');
  if (!el) return;
  const items = _generated.filter(g => !_search || (g.template + ' ' + g.employee).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="doc-empty"><div style="font-size:2rem">&#128195;</div><div>No generated documents</div></div>'; return; }
  let html = '<div class="doc-list">';
  items.forEach(function (g, i) {
    html +=
      '<div class="doc-row" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="doc-icon">&#128195;</div>' +
        '<div class="doc-info">' +
          '<div class="doc-name">' + _esc(g.template) + ' &mdash; ' + _esc(g.employee) + '</div>' +
          '<div class="doc-meta">Generated ' + _fmtDate(g.generated_on) + ' by ' + _esc(g.generated_by) + '</div>' +
        '</div>' +
        '<div class="doc-actions">' +
          '<button data-action="download-gen" data-id="' + _esc(g.id) + '" class="doc-btn-sm">&#8595; Download</button>' +
          '<button data-action="delete-gen" data-id="' + _esc(g.id) + '" class="doc-btn-sm danger">Delete</button>' +
        '</div>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function docShowUploadForm() {
  const box = _container && _container.querySelector('#docModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="doc-modal-title">Upload Document</div>' +
    '<div class="doc-field"><label>File *</label><input type="file" id="docFFile" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"></div>' +
    '<div class="doc-field"><label>Document Type</label><select id="docFType">' + _docTypes.map(t => '<option value="' + t + '">' + t + '</option>').join('') + '</select></div>' +
    '<div class="doc-field"><label>Accessible To</label><input type="text" id="docFAccess" value="all" placeholder="email or &quot;all&quot;"></div>' +
    '<div class="doc-form-actions"><button class="doc-btn ghost" data-action="close-modal">Cancel</button><button class="doc-btn" id="docUploadSaveBtn">Upload</button></div>';
  _container.querySelector('#docModal').classList.add('open');
  box.querySelector('#docUploadSaveBtn').addEventListener('click', async function () {
    const file = box.querySelector('#docFFile').files[0];
    if (!file) { toast('Please select a file', 'error'); return; }
    const body = { name: file.name, type: box.querySelector('#docFType').value, size: file.size, mime: file.type, accessible_to: (box.querySelector('#docFAccess').value || 'all').trim(), uploaded_on: new Date().toISOString().split('T')[0] };
    const result = await api.post('/api/documents', body);
    if (result && !result._error) { toast('Uploaded', 'success'); docCloseModal(); docLoadData(); return; }
    _docs.unshift({ id: 'd' + Date.now(), ...body, uploaded_by: (getSession() || {}).email || 'admin' });
    toast('Uploaded (demo)', 'success'); docCloseModal(); docRenderStats(); docRender();
  });
}

export function docShowGenerateForm(templateId) {
  const tpl = _templates.find(t => t.id === templateId);
  if (!tpl) return;
  const box = _container && _container.querySelector('#docModalBox');
  if (!box) return;
  let fieldsHtml = tpl.fields.map(f =>
    '<div class="doc-field"><label>' + _esc(f.replace(/_/g, ' ')) + '</label><input type="text" id="docFG_' + f + '" placeholder="' + _esc(f) + '"></div>'
  ).join('');
  box.innerHTML =
    '<div class="doc-modal-title">Generate: ' + _esc(tpl.name) + '</div>' +
    fieldsHtml +
    '<div class="doc-form-actions"><button class="doc-btn ghost" data-action="close-modal">Cancel</button><button class="doc-btn" id="docGenBtn">Generate</button></div>';
  _container.querySelector('#docModal').classList.add('open');
  box.querySelector('#docGenBtn').addEventListener('click', async function () {
    const values = {};
    tpl.fields.forEach(f => { values[f] = (box.querySelector('#docFG_' + f) || {}).value || ''; });
    const result = await api.post('/api/documents/generate', { template_id: templateId, values });
    if (result && !result._error) { toast('Generated', 'success'); docCloseModal(); docLoadData(); return; }
    const empField = tpl.fields.find(f => f.includes('name')) || tpl.fields[0];
    _generated.unshift({ id: 'g' + Date.now(), template: tpl.name, employee: values[empField] || 'Employee', generated_on: new Date().toISOString().split('T')[0], generated_by: (getSession() || {}).email || 'admin', status: 'ready' });
    toast('Generated (demo)', 'success'); docCloseModal(); docRenderStats(); docRender();
  });
}

export function docDownload(id) {
  toast('Download started (demo)', 'info');
}

export function docCloseModal() {
  const m = _container && _container.querySelector('#docModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#docTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.doc-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.doc-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    docRender();
  });
  const s = container.querySelector('#docSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); docRender(); });
  const tf = container.querySelector('#docTypeFilter');
  if (tf) tf.addEventListener('change', function () { _filterType = this.value; docRender(); });
  const ub = container.querySelector('#docUploadBtn');
  if (ub) ub.addEventListener('click', () => docShowUploadForm());
  const modal = container.querySelector('#docModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) docCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal') docCloseModal();
    else if (action === 'download' || action === 'download-gen') docDownload(id);
    else if (action === 'generate') docShowGenerateForm(id);
    else if (action === 'delete-doc') { if (confirm('Delete this document?')) { _docs = _docs.filter(d => d.id !== id); docRenderStats(); docRender(); toast('Deleted (demo)', 'success'); } }
    else if (action === 'delete-gen') { if (confirm('Delete generated document?')) { _generated = _generated.filter(g => g.id !== id); docRenderStats(); docRender(); toast('Deleted (demo)', 'success'); } }
  });
}

function _fileIcon(mime) {
  if (!mime) return '&#128196;';
  if (mime.includes('pdf')) return '&#128209;';
  if (mime.includes('image')) return '&#128247;';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '&#128200;';
  return '&#128196;';
}
function _fmtSize(bytes) { if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; return (bytes / 1048576).toFixed(1) + ' MB'; }
function _fmtDate(ds) { if (!ds) return ''; return new Date(ds.split('T')[0] + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getDocs() { return _docs; }
export function _setDocs(list) { _docs = list; }
export function _resetState() { _container = null; _docs = []; _templates = []; _generated = []; _tab = 'docs'; _search = ''; _filterType = ''; }

registerModule('documents', renderDocumentsPage);
