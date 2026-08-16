/**
 * modules/school_hpc/school_hpc.js
 *
 * Holistic Progress Card: Capture | Peer | Four-voice | Coverage.
 * Pattern: render… → hpcLoadData() → hpcRender().
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

const VIEWS = ['capture', 'peer', 'four_voice', 'coverage'];
const STAGES = ['foundational', 'preparatory', 'middle', 'secondary'];
const ABILITIES = ['awareness', 'sensitivity', 'creativity'];
const LEVELS = ['beginner', 'proficient', 'advanced'];
const LEVEL_SHORT = { beginner: 'B', proficient: 'P', advanced: 'A' };
const PEER_BATCH_MAX = 200;
const MIDDLE_STMT_MAX = 6;
const MIDDLE_STMT_ROWS = 6;

let _container = null;
let _view = 'capture';
let _students = [];
let _studentId = '';
let _competencies = [];
let _stageFilter = '';
let _classLabel = '';
let _section = '';
/** @type {Record<string, string>} competencyId → level for non-middle */
let _levels = {};
/** @type {Record<string, boolean[]>} competencyId → 18 statement flags (6×3) */
let _statements = {};
let _sessionRef = '';
let _fourVoice = [];
let _coverage = [];
/** @type {Record<string, { B: number, P: number, A: number }>} */
let _matrixCounts = {};
let _peerCompetencyId = '';
let _peerIndex = 0;
let _peerSlot = 0;
/** @type {object[]} */
let _peerBuffer = [];
let _noteCompetencyId = null;
let _evidenceByComp = {};

function _esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function _actor() {
  const s = getSession() || {};
  return s.email || s.name || 'teacher';
}

function _as() {
  return api.school('school-assessment');
}

function _id() {
  return api.school('school-identity');
}

/**
 * Mirror server deriveLevelFromCircled (0–2 B, 3–4 P, 5–6 A).
 * Server remains authority on submit.
 * @param {number} circled
 * @returns {'beginner'|'proficient'|'advanced'|null}
 */
export function deriveLevelFromCircled(circled) {
  if (!Number.isInteger(circled) || circled < 0 || circled > 6) return null;
  if (circled <= 2) return 'beginner';
  if (circled <= 4) return 'proficient';
  return 'advanced';
}

/**
 * Count checked statements (cap awareness for live chip).
 * @param {boolean[]} flags
 */
export function countCircled(flags) {
  return (flags || []).filter(Boolean).length;
}

/**
 * Split inputs into bulk chunks ≤200.
 * @param {object[]} inputs
 * @param {number} [max]
 */
export function chunkPeerBatch(inputs, max) {
  const size = max != null ? max : PEER_BATCH_MAX;
  const out = [];
  for (let i = 0; i < inputs.length; i += size) {
    out.push(inputs.slice(i, i + size));
  }
  return out;
}

/**
 * Group four-voice rows for render.
 * @param {object[]} competencies
 */
export function groupFourVoice(competencies) {
  return (competencies || []).map(function (c) {
    return {
      competencyId: c.competencyId,
      label: c.label,
      stage: c.stage,
      ability: c.ability,
      voices: c.voices || { self: null, peer: null, teacher: null, parent: null },
      inputCount: c.inputCount || 0,
      evidenceRef: c.evidenceRef || c.evidence_ref || null,
    };
  });
}

/**
 * Build competency × B/P/A count matrix from student voice snapshots.
 * @param {Array<{ competencies: object[] }>} studentViews
 */
export function buildGradeMatrix(studentViews) {
  const counts = {};
  (studentViews || []).forEach(function (view) {
    (view.competencies || []).forEach(function (c) {
      const level = c.voices && c.voices.teacher;
      if (!level) return;
      if (!counts[c.competencyId]) {
        counts[c.competencyId] = { B: 0, P: 0, A: 0, label: c.label };
      }
      const short = LEVEL_SHORT[level];
      if (short) counts[c.competencyId][short] += 1;
    });
  });
  return counts;
}

function _emptyStatements() {
  const flags = [];
  for (let i = 0; i < MIDDLE_STMT_ROWS * ABILITIES.length; i++) flags.push(false);
  return flags;
}

/**
 * @param {HTMLElement} container
 */
export function renderSchoolHpcPage(container) {
  _container = container;
  _view = 'capture';
  _studentId = '';
  _levels = {};
  _statements = {};
  _peerBuffer = [];
  _peerIndex = 0;
  _peerSlot = 0;
  _fourVoice = [];
  _coverage = [];
  _matrixCounts = {};
  _evidenceByComp = {};

  container.innerHTML =
    '<div class="hpc-wrap" id="hpcWrap">' +
    '<div class="hpc-title">HPC</div>' +
    '<div class="hpc-tabs" id="hpcTabs">' +
    VIEWS.map(function (v) {
      const label = v.replace(/_/g, ' ');
      return (
        '<button type="button" class="hpc-tab' +
        (v === _view ? ' active' : '') +
        '" data-view="' +
        v +
        '">' +
        _esc(label) +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div id="hpcContent"></div>' +
    '<div class="hpc-modal" id="hpcModal"><div class="hpc-modal-box" id="hpcModalBox"></div></div>' +
    '</div>';

  container.querySelector('#hpcTabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.hpc-tab');
    if (!btn || !btn.dataset.view) return;
    hpcSwitchView(btn.dataset.view);
  });

  const modal = container.querySelector('#hpcModal');
  modal.addEventListener('click', function (e) {
    if (e.target === modal) hpcCloseModal();
  });

  hpcLoadData();
}

/**
 * @param {string} view
 */
export function hpcSwitchView(view) {
  if (VIEWS.indexOf(view) < 0) return;
  _view = view;
  _container.querySelectorAll('.hpc-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  hpcLoadData();
}

export async function hpcLoadData() {
  if (!_competencies.length) {
    const res = await _as().get('/hpc/competencies');
    _competencies = res && !res._error ? res.competencies || [] : [];
    if (res && res._error) toast(res.message || 'Could not load competencies', 'error');
  }

  if (_view === 'capture' || _view === 'peer' || _view === 'coverage' || _view === 'four_voice') {
    await _ensureStudents();
  }

  if (_view === 'four_voice' && _studentId) await _loadFourVoice();
  if (_view === 'coverage') await _loadCoverage();
  if (_view === 'peer' && !_peerCompetencyId && _competencies.length) {
    _peerCompetencyId = _competencies[0].id;
  }

  hpcRender();
}

async function _ensureStudents() {
  const qs =
    '/students?status=active&limit=100&offset=0' +
    (_classLabel ? '&class=' + encodeURIComponent(_classLabel) : '') +
    (_section ? '&section=' + encodeURIComponent(_section) : '');
  const res = await _id().get(qs);
  _students = res && !res._error ? res.items || [] : [];
  if (res && res._error) toast(res.message || 'Could not load students', 'error');
  if (!_studentId && _students.length) _studentId = _students[0].id;
}

async function _loadFourVoice() {
  const res = await _as().get(
    '/hpc/students/' +
      encodeURIComponent(_studentId) +
      (_sessionRef ? '?session=' + encodeURIComponent(_sessionRef) : ''),
  );
  if (res && !res._error) {
    _fourVoice = groupFourVoice(res.competencies || []).map(function (c) {
      if (_evidenceByComp[c.competencyId] && !c.evidenceRef) {
        c.evidenceRef = _evidenceByComp[c.competencyId];
      }
      return c;
    });
  } else {
    _fourVoice = [];
    if (res && res._error) toast(res.message || 'Could not load four-voice', 'error');
  }
}

async function _loadCoverage() {
  const ids = _students.map(function (s) {
    return s.id;
  });
  if (!ids.length) {
    _coverage = [];
    _matrixCounts = {};
    return;
  }
  const path =
    '/hpc/coverage?section_students=' +
    encodeURIComponent(JSON.stringify(ids)) +
    (_stageFilter ? '&stage=' + encodeURIComponent(_stageFilter) : '');
  const res = await _as().get(path);
  if (res && !res._error) _coverage = res.coverage || [];
  else {
    _coverage = [];
    if (res && res._error) toast(res.message || 'Could not load coverage', 'error');
  }

  const views = await Promise.all(
    ids.slice(0, 40).map(async function (id) {
      const v = await _as().get('/hpc/students/' + encodeURIComponent(id));
      return {
        studentId: id,
        competencies: v && !v._error ? v.competencies || [] : [],
      };
    }),
  );
  _matrixCounts = buildGradeMatrix(views);
}

export function hpcRender() {
  const content = _container && _container.querySelector('#hpcContent');
  if (!content) return;
  if (_view === 'capture') _renderCapture(content);
  else if (_view === 'peer') _renderPeer(content);
  else if (_view === 'four_voice') _renderFourVoice(content);
  else if (_view === 'coverage') _renderCoverage(content);
}

function _studentListHtml(selectedId, dataAttr) {
  return _students
    .map(function (s) {
      const name = (s.firstName || '') + ' ' + (s.lastName || '');
      return (
        '<button type="button" class="hpc-list-item' +
        (s.id === selectedId ? ' active' : '') +
        '" ' +
        dataAttr +
        '="' +
        _esc(s.id) +
        '">' +
        _esc(name) +
        '</button>'
      );
    })
    .join('');
}

function _renderCapture(content) {
  const comps = _stageFilter
    ? _competencies.filter(function (c) {
        return c.stage === _stageFilter;
      })
    : _competencies;

  content.innerHTML =
    '<div class="hpc-toolbar">' +
    '<input class="hpc-input" id="hpcClass" placeholder="Class" value="' +
    _esc(_classLabel) +
    '">' +
    '<input class="hpc-input" id="hpcSection" placeholder="Section" value="' +
    _esc(_section) +
    '">' +
    '<button type="button" class="hpc-btn ghost" id="hpcReload">Load class</button>' +
    '<select class="hpc-select" id="hpcStage">' +
    '<option value="">All stages</option>' +
    STAGES.map(function (s) {
      return (
        '<option value="' +
        s +
        '"' +
        (_stageFilter === s ? ' selected' : '') +
        '>' +
        s +
        '</option>'
      );
    }).join('') +
    '</select>' +
    '<span class="hpc-locked" id="hpcSourceLock">Source: teacher</span>' +
    '</div>' +
    '<div class="hpc-layout">' +
    '<div id="hpcStudentList">' +
    (_students.length
      ? _studentListHtml(_studentId, 'data-hpc-student')
      : '<div class="hpc-empty">No students</div>') +
    '</div>' +
    '<div id="hpcCaptureGrid"></div></div>';

  content.querySelector('#hpcReload').addEventListener('click', function () {
    _classLabel = (content.querySelector('#hpcClass').value || '').trim();
    _section = (content.querySelector('#hpcSection').value || '').trim();
    hpcLoadData();
  });
  content.querySelector('#hpcStage').addEventListener('change', function (e) {
    _stageFilter = e.target.value;
    hpcRender();
  });
  content.querySelectorAll('[data-hpc-student]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      _studentId = btn.getAttribute('data-hpc-student');
      hpcRender();
    });
  });

  _renderCaptureGrid(content.querySelector('#hpcCaptureGrid'), comps);
}

function _renderCaptureGrid(host, comps) {
  if (!_studentId) {
    host.innerHTML = '<div class="hpc-empty">Select a student.</div>';
    return;
  }

  const byStage = {};
  STAGES.forEach(function (s) {
    byStage[s] = [];
  });
  comps.forEach(function (c) {
    if (byStage[c.stage]) byStage[c.stage].push(c);
  });

  let html = '';
  STAGES.forEach(function (stage) {
    const list = byStage[stage];
    if (!list.length) return;
    html += '<div class="hpc-stage-block" data-stage="' + stage + '"><h4>' + _esc(stage) + '</h4>';
    if (stage === 'middle') {
      list.forEach(function (c) {
        if (!_statements[c.id]) _statements[c.id] = _emptyStatements();
        const flags = _statements[c.id];
        const circled = Math.min(MIDDLE_STMT_MAX, countCircled(flags));
        const derived = deriveLevelFromCircled(circled);
        html +=
          '<div class="hpc-comp-row" data-comp="' +
          _esc(c.id) +
          '"><div class="hpc-comp-label">' +
          _esc(c.label) +
          ' · ' +
          _esc(c.ability) +
          '</div>' +
          '<span class="hpc-level-chip ' +
          _esc(derived || '') +
          '" data-derived="' +
          _esc(c.id) +
          '">' +
          _esc(derived ? LEVEL_SHORT[derived] + ' (' + circled + ')' : '—') +
          '</span>' +
          '<button type="button" class="hpc-btn ghost" data-note="' +
          _esc(c.id) +
          '">Note</button>' +
          '<button type="button" class="hpc-btn ghost" data-save-middle="' +
          _esc(c.id) +
          '">Save</button></div>' +
          '<div class="hpc-checklist" data-checklist="' +
          _esc(c.id) +
          '">' +
          ABILITIES.map(function (ability, ai) {
            let col =
              '<div class="hpc-ability-col"><h5>' + _esc(ability) + '</h5>';
            for (let r = 0; r < MIDDLE_STMT_ROWS; r++) {
              const idx = ai * MIDDLE_STMT_ROWS + r;
              col +=
                '<label class="hpc-stmt"><input type="checkbox" data-stmt="' +
                _esc(c.id) +
                '" data-idx="' +
                idx +
                '"' +
                (flags[idx] ? ' checked' : '') +
                '> Statement ' +
                (r + 1) +
                '</label>';
            }
            col += '</div>';
            return col;
          }).join('') +
          '</div>';
      });
    } else {
      list.forEach(function (c) {
        const cur = _levels[c.id] || '';
        html +=
          '<div class="hpc-comp-row" data-comp="' +
          _esc(c.id) +
          '"><div class="hpc-comp-label">' +
          _esc(c.label) +
          '</div>' +
          '<div class="hpc-seg" data-seg="' +
          _esc(c.id) +
          '">' +
          LEVELS.map(function (lv) {
            return (
              '<button type="button" data-level="' +
              lv +
              '" class="' +
              (cur === lv ? 'active' : '') +
              '">' +
              LEVEL_SHORT[lv] +
              '</button>'
            );
          }).join('') +
          '</div>' +
          '<button type="button" class="hpc-btn ghost" data-note="' +
          _esc(c.id) +
          '">Note</button>' +
          '<button type="button" class="hpc-btn ghost" data-save-level="' +
          _esc(c.id) +
          '">Save</button></div>';
      });
    }
    html += '</div>';
  });

  host.innerHTML = html || '<div class="hpc-empty">No competencies for this filter.</div>';

  host.querySelectorAll('[data-stmt]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const id = cb.getAttribute('data-stmt');
      const idx = Number(cb.getAttribute('data-idx'));
      if (!_statements[id]) _statements[id] = _emptyStatements();
      const next = _statements[id].slice();
      next[idx] = cb.checked;
      if (countCircled(next) > MIDDLE_STMT_MAX) {
        cb.checked = false;
        toast('statements_circled must be 0–6', 'error');
        return;
      }
      _statements[id] = next;
      const circled = countCircled(next);
      const derived = deriveLevelFromCircled(circled);
      const chip = host.querySelector('[data-derived="' + id + '"]');
      if (chip) {
        chip.className = 'hpc-level-chip ' + (derived || '');
        chip.textContent = derived ? LEVEL_SHORT[derived] + ' (' + circled + ')' : '—';
      }
    });
  });

  host.querySelectorAll('[data-seg]').forEach(function (seg) {
    const id = seg.getAttribute('data-seg');
    seg.querySelectorAll('[data-level]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _levels[id] = btn.getAttribute('data-level');
        seg.querySelectorAll('button').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-level') === _levels[id]);
        });
      });
    });
  });

  host.querySelectorAll('[data-note]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hpcOpenNoteDialog(btn.getAttribute('data-note'));
    });
  });

  host.querySelectorAll('[data-save-middle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hpcSaveMiddle(btn.getAttribute('data-save-middle'));
    });
  });
  host.querySelectorAll('[data-save-level]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hpcSaveLevel(btn.getAttribute('data-save-level'));
    });
  });
}

/**
 * @param {string} competencyId
 */
export function hpcOpenNoteDialog(competencyId) {
  _noteCompetencyId = competencyId;
  const box = _container.querySelector('#hpcModalBox');
  const modal = _container.querySelector('#hpcModal');
  box.innerHTML =
    '<div class="hpc-title" style="font-size:14px">Observational note</div>' +
    '<div class="hpc-field"><label>Challenge</label><textarea id="hpcChallenge"></textarea></div>' +
    '<div class="hpc-field"><label>How resolved</label><textarea id="hpcResolution"></textarea></div>' +
    '<div class="hpc-field"><label>Evidence ref</label><input id="hpcEvidence" placeholder="storage ref"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end">' +
    '<button type="button" class="hpc-btn ghost" id="hpcNoteCancel">Cancel</button>' +
    '<button type="button" class="hpc-btn" id="hpcNoteSave">Keep</button>' +
    '</div>';
  modal.classList.add('open');
  box.querySelector('#hpcNoteCancel').addEventListener('click', hpcCloseModal);
  box.querySelector('#hpcNoteSave').addEventListener('click', function () {
    const challenge = (box.querySelector('#hpcChallenge').value || '').trim();
    const resolution = (box.querySelector('#hpcResolution').value || '').trim();
    const evidence = (box.querySelector('#hpcEvidence').value || '').trim();
    if (!challenge || !resolution) {
      toast('Challenge and how resolved are required', 'error');
      return;
    }
    _levels['__note_' + competencyId] = JSON.stringify({
      observational_challenge: challenge,
      observational_resolution: resolution,
      evidence_ref: evidence || null,
    });
    if (evidence) _evidenceByComp[competencyId] = evidence;
    toast('Note ready — save the competency to persist', 'info');
    hpcCloseModal();
  });
}

export function hpcCloseModal() {
  const modal = _container && _container.querySelector('#hpcModal');
  if (modal) modal.classList.remove('open');
  _noteCompetencyId = null;
}

function _notePayload(competencyId) {
  const raw = _levels['__note_' + competencyId];
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

export async function hpcSaveMiddle(competencyId) {
  const flags = _statements[competencyId] || _emptyStatements();
  const circled = countCircled(flags);
  if (circled > MIDDLE_STMT_MAX) {
    toast('statements_circled must be 0–6', 'error');
    return null;
  }
  const body = Object.assign(
    {
      student_id: _studentId,
      competency_id: competencyId,
      source: 'teacher',
      statements_circled: circled,
      recorded_by: _actor(),
      academic_session_ref: _sessionRef || null,
    },
    _notePayload(competencyId),
  );
  const res = await _as().post('/hpc/inputs', body);
  if (res && !res._error) {
    toast('Saved · level ' + (res.level || deriveLevelFromCircled(circled)), 'success');
    return res;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return null;
}

export async function hpcSaveLevel(competencyId) {
  const level = _levels[competencyId];
  if (!level) {
    toast('Select B / P / A', 'error');
    return null;
  }
  const body = Object.assign(
    {
      student_id: _studentId,
      competency_id: competencyId,
      source: 'teacher',
      level: level,
      recorded_by: _actor(),
      academic_session_ref: _sessionRef || null,
    },
    _notePayload(competencyId),
  );
  const res = await _as().post('/hpc/inputs', body);
  if (res && !res._error) {
    toast('Saved', 'success');
    return res;
  }
  toast((res && res.message) || 'Save failed', 'error');
  return null;
}

function _renderPeer(content) {
  const student = _students[_peerIndex];
  const comp = _competencies.find(function (c) {
    return c.id === _peerCompetencyId;
  });

  content.innerHTML =
    '<div class="hpc-toolbar">' +
    '<select class="hpc-select" id="hpcPeerComp">' +
    _competencies
      .map(function (c) {
        return (
          '<option value="' +
          _esc(c.id) +
          '"' +
          (c.id === _peerCompetencyId ? ' selected' : '') +
          '>' +
          _esc(c.label) +
          '</option>'
        );
      })
      .join('') +
    '</select>' +
    '<button type="button" class="hpc-btn" id="hpcPeerFlush">Flush buffer (' +
    _peerBuffer.length +
    ')</button>' +
    '</div>' +
    '<div class="hpc-peer-stage" id="hpcPeerStage"></div>';

  content.querySelector('#hpcPeerComp').addEventListener('change', function (e) {
    _peerCompetencyId = e.target.value;
    _peerIndex = 0;
    _peerSlot = 0;
    hpcRender();
  });
  content.querySelector('#hpcPeerFlush').addEventListener('click', function () {
    hpcFlushPeerBuffer();
  });

  const stage = content.querySelector('#hpcPeerStage');
  if (!student || !comp) {
    stage.innerHTML = '<div class="hpc-empty">Need students and a competency.</div>';
    return;
  }

  stage.innerHTML =
    '<div class="hpc-peer-name">' +
    _esc((student.firstName || '') + ' ' + (student.lastName || '')) +
    '</div>' +
    '<div class="hpc-peer-sub">' +
    _esc(comp.label) +
    ' · peer entry ' +
    (_peerSlot + 1) +
    ' of 2 · student ' +
    (_peerIndex + 1) +
    '/' +
    _students.length +
    '</div>' +
    '<div class="hpc-peer-actions">' +
    LEVELS.map(function (lv) {
      return (
        '<button type="button" class="hpc-btn lg" data-peer-level="' +
        lv +
        '">' +
        LEVEL_SHORT[lv] +
        '</button>'
      );
    }).join('') +
    '</div>' +
    '<div class="hpc-help">Large targets · auto-advances after two peer marks · bulk ≤' +
    PEER_BATCH_MAX +
    '</div>';

  stage.querySelectorAll('[data-peer-level]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      hpcPeerMark(btn.getAttribute('data-peer-level'));
    });
  });
}

/**
 * @param {string} level
 */
export function hpcPeerMark(level) {
  const student = _students[_peerIndex];
  if (!student || !_peerCompetencyId) return;
  _peerBuffer.push({
    student_id: student.id,
    competency_id: _peerCompetencyId,
    source: 'peer',
    level: level,
    recorded_by: _actor(),
    academic_session_ref: _sessionRef || null,
  });
  _peerSlot += 1;
  if (_peerSlot >= 2) {
    _peerSlot = 0;
    _peerIndex += 1;
    if (_peerIndex >= _students.length) {
      _peerIndex = 0;
      toast('Roster complete — flushing buffer', 'info');
      hpcFlushPeerBuffer();
      return;
    }
  }
  if (_peerBuffer.length >= PEER_BATCH_MAX) {
    hpcFlushPeerBuffer();
  }
  hpcRender();
}

/**
 * Flush peer buffer in chunks ≤200.
 */
export async function hpcFlushPeerBuffer() {
  if (!_peerBuffer.length) {
    toast('Buffer empty', 'info');
    return [];
  }
  const chunks = chunkPeerBatch(_peerBuffer, PEER_BATCH_MAX);
  const saved = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].length > PEER_BATCH_MAX) {
      toast('bulk limit is 200 inputs per call', 'error');
      return saved;
    }
    const res = await _as().post('/hpc/inputs/bulk', { inputs: chunks[i] });
    if (res && !res._error) {
      saved.push.apply(saved, res.inputs || []);
    } else {
      toast((res && res.message) || 'Bulk save failed', 'error');
      return saved;
    }
  }
  _peerBuffer = [];
  toast('Peer batch saved (' + saved.length + ')', 'success');
  hpcRender();
  return saved;
}

function _renderFourVoice(content) {
  content.innerHTML =
    '<div class="hpc-toolbar">' +
    '<select class="hpc-select" id="hpcFvStudent">' +
    _students
      .map(function (s) {
        return (
          '<option value="' +
          _esc(s.id) +
          '"' +
          (s.id === _studentId ? ' selected' : '') +
          '>' +
          _esc((s.firstName || '') + ' ' + (s.lastName || '')) +
          '</option>'
        );
      })
      .join('') +
    '</select>' +
    '<input class="hpc-input" id="hpcSession" placeholder="Session ref" value="' +
    _esc(_sessionRef) +
    '">' +
    '<button type="button" class="hpc-btn ghost" id="hpcFvLoad">Load</button>' +
    '</div>' +
    '<div id="hpcFvBody"></div>';

  content.querySelector('#hpcFvLoad').addEventListener('click', async function () {
    _studentId = content.querySelector('#hpcFvStudent').value;
    _sessionRef = (content.querySelector('#hpcSession').value || '').trim();
    await _loadFourVoice();
    hpcRender();
  });

  const body = content.querySelector('#hpcFvBody');
  if (!_fourVoice.length) {
    body.innerHTML = '<div class="hpc-empty">No HPC inputs for this student.</div>';
    return;
  }

  body.innerHTML =
    '<table class="hpc-table" id="hpcFvTable"><thead><tr>' +
    '<th>Competency</th><th>Self</th><th>Peer</th><th>Teacher</th><th>Parent</th><th>Inputs</th><th>Evidence</th>' +
    '</tr></thead><tbody>' +
    _fourVoice
      .map(function (c) {
        const v = c.voices || {};
        function chip(level) {
          if (!level) return '—';
          return (
            '<span class="hpc-level-chip ' +
            _esc(level) +
            '">' +
            LEVEL_SHORT[level] +
            '</span>'
          );
        }
        return (
          '<tr data-fv-comp="' +
          _esc(c.competencyId) +
          '"><td>' +
          _esc(c.label) +
          '</td><td>' +
          chip(v.self) +
          '</td><td>' +
          chip(v.peer) +
          '</td><td>' +
          chip(v.teacher) +
          '</td><td>' +
          chip(v.parent) +
          '</td><td>' +
          _esc(String(c.inputCount)) +
          '</td><td>' +
          _esc(c.evidenceRef || '—') +
          '</td></tr>'
        );
      })
      .join('') +
    '</tbody></table>';
}

function _renderCoverage(content) {
  content.innerHTML =
    '<div class="hpc-toolbar">' +
    '<input class="hpc-input" id="hpcCovClass" placeholder="Class" value="' +
    _esc(_classLabel) +
    '">' +
    '<input class="hpc-input" id="hpcCovSection" placeholder="Section" value="' +
    _esc(_section) +
    '">' +
    '<select class="hpc-select" id="hpcCovStage">' +
    '<option value="">All stages</option>' +
    STAGES.map(function (s) {
      return (
        '<option value="' +
        s +
        '"' +
        (_stageFilter === s ? ' selected' : '') +
        '>' +
        s +
        '</option>'
      );
    }).join('') +
    '</select>' +
    '<button type="button" class="hpc-btn" id="hpcCovLoad">Refresh</button>' +
    '</div>' +
    '<div id="hpcCovBars"></div>' +
    '<h4 class="hpc-help">Matrix · competency × grade (B/P/A teacher levels)</h4>' +
    '<div class="hpc-matrix" id="hpcGradeMatrix"></div>';

  content.querySelector('#hpcCovLoad').addEventListener('click', function () {
    _classLabel = (content.querySelector('#hpcCovClass').value || '').trim();
    _section = (content.querySelector('#hpcCovSection').value || '').trim();
    _stageFilter = content.querySelector('#hpcCovStage').value;
    hpcLoadData();
  });

  const bars = content.querySelector('#hpcCovBars');
  if (!_coverage.length) {
    bars.innerHTML = '<div class="hpc-empty">No coverage data.</div>';
  } else {
    bars.innerHTML = _coverage
      .map(function (row) {
        return (
          '<div class="hpc-bar-row" data-cov="' +
          _esc(row.competencyId) +
          '"><div class="hpc-bar-label"><span>' +
          _esc(row.label) +
          '</span><span>' +
          _esc(String(row.pct)) +
          '% (' +
          row.filledCount +
          '/' +
          row.studentCount +
          ')</span></div>' +
          '<div class="hpc-bar-track"><div class="hpc-bar-fill" style="width:' +
          _esc(String(Math.min(100, row.pct))) +
          '%"></div></div></div>'
        );
      })
      .join('');
  }

  const matrix = content.querySelector('#hpcGradeMatrix');
  const ids = Object.keys(_matrixCounts);
  if (!ids.length) {
    matrix.innerHTML = '<div class="hpc-empty">No teacher levels to matrix yet.</div>';
    return;
  }
  matrix.style.gridTemplateColumns = 'minmax(120px,2fr) repeat(3,minmax(40px,1fr))';
  let html =
    '<div class="cell head">Competency</div><div class="cell head">B</div><div class="cell head">P</div><div class="cell head">A</div>';
  ids.forEach(function (id) {
    const row = _matrixCounts[id];
    html +=
      '<div class="cell" data-matrix-comp="' +
      _esc(id) +
      '">' +
      _esc(row.label || id.slice(0, 8)) +
      '</div>' +
      '<div class="cell ' +
      (row.B ? 'filled' : '') +
      '" data-grade="B">' +
      row.B +
      '</div>' +
      '<div class="cell ' +
      (row.P ? 'filled' : '') +
      '" data-grade="P">' +
      row.P +
      '</div>' +
      '<div class="cell ' +
      (row.A ? 'filled' : '') +
      '" data-grade="A">' +
      row.A +
      '</div>';
  });
  matrix.innerHTML = html;
}

/** @returns {object} */
export function hpcGetState() {
  return {
    view: _view,
    studentId: _studentId,
    students: _students.slice(),
    competencies: _competencies.slice(),
    levels: Object.assign({}, _levels),
    statements: Object.assign({}, _statements),
    fourVoice: _fourVoice.slice(),
    coverage: _coverage.slice(),
    matrixCounts: Object.assign({}, _matrixCounts),
    peerBuffer: _peerBuffer.slice(),
    peerIndex: _peerIndex,
    peerSlot: _peerSlot,
    peerCompetencyId: _peerCompetencyId,
  };
}

/** @param {object} partial */
export function hpcSetState(partial) {
  if (partial.view) _view = partial.view;
  if (partial.studentId) _studentId = partial.studentId;
  if (partial.students) _students = partial.students;
  if (partial.competencies) _competencies = partial.competencies;
  if (partial.levels) _levels = partial.levels;
  if (partial.statements) _statements = partial.statements;
  if (partial.fourVoice) _fourVoice = partial.fourVoice;
  if (partial.coverage) _coverage = partial.coverage;
  if (partial.matrixCounts) _matrixCounts = partial.matrixCounts;
  if (partial.peerBuffer) _peerBuffer = partial.peerBuffer;
  if (partial.peerIndex != null) _peerIndex = partial.peerIndex;
  if (partial.peerSlot != null) _peerSlot = partial.peerSlot;
  if (partial.peerCompetencyId) _peerCompetencyId = partial.peerCompetencyId;
  if (partial.classLabel != null) _classLabel = partial.classLabel;
  if (partial.section != null) _section = partial.section;
  if (_container) {
    _container.querySelectorAll('.hpc-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.view === _view);
    });
    hpcRender();
  }
}

export { PEER_BATCH_MAX, LEVEL_SHORT };

registerModule('school_hpc', renderSchoolHpcPage);
