/**
 * modules/geo_fencing/geo_fencing.js
 * Geo-fencing: zones, violations, resolve, enable/disable.
 * Pattern: renderGeoFencingPage() → geoLoadData() → geoRenderStats()
 *          → geoRender() → CRUD → geoCloseModal()
 */

import { api } from '../../shared/api.js';
import { toast } from '../../shared/toast.js';
import { getSession } from '../../shared/session.js';
import { registerModule } from '../../shared/router.js';

let _container = null;
let _zones = [];
let _violations = [];
let _tab = 'zones';   // 'zones' | 'violations'
let _search = '';

const _mockZones = [
  { id: 'z1', name: 'Main Office',       lat: 28.6139, lng: 77.2090, radius_meters: 200, address: 'Connaught Place, New Delhi', active: true,  clock_in_required: true,  clock_out_required: true  },
  { id: 'z2', name: 'Client Site A',     lat: 28.5355, lng: 77.3910, radius_meters: 300, address: 'Noida Sector 62, UP',         active: true,  clock_in_required: true,  clock_out_required: false },
  { id: 'z3', name: 'Remote Work Hub',   lat: 28.4595, lng: 77.0266, radius_meters: 500, address: 'Gurgaon Cyber City, Haryana', active: false, clock_in_required: false, clock_out_required: false },
];

const _mockViolations = [
  { id: 'vl1', email: 'arif@co.com',  name: 'Arif Alwi',    zone: 'Main Office',  event: 'clock.in',  distance_meters: 480, timestamp: '2026-03-30T09:05:00', resolved: false, resolution: null },
  { id: 'vl2', email: 'bob@co.com',   name: 'Bob Builder',  zone: 'Main Office',  event: 'clock.in',  distance_meters: 1200, timestamp: '2026-03-29T09:10:00', resolved: true,  resolution: 'Approved — travelling from branch' },
  { id: 'vl3', email: 'priya@co.com', name: 'Priya Sharma', zone: 'Client Site A',event: 'clock.out', distance_meters: 650, timestamp: '2026-03-28T18:30:00', resolved: false, resolution: null },
];

export function renderGeoFencingPage(container) {
  _container = container;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  container.innerHTML =
    '<div class="geo-wrap">' +
      '<div class="geo-toolbar">' +
        '<div class="geo-tabs" id="geoTabs">' +
          '<button class="geo-tab active" data-tab="zones">Zones</button>' +
          '<button class="geo-tab" data-tab="violations">Violations</button>' +
        '</div>' +
        '<input class="geo-search" id="geoSearch" placeholder="Search…" autocomplete="off">' +
        (isAdmin ? '<button class="geo-btn" id="geoAddBtn">+ Add Zone</button>' : '') +
      '</div>' +
      '<div id="geoStats" class="geo-stats"></div>' +
      '<div id="geoContent"></div>' +
      '<div class="geo-modal" id="geoModal"><div class="geo-modal-box" id="geoModalBox"></div></div>' +
    '</div>';
  _bindEvents(container);
  geoLoadData();
}

export async function geoLoadData() {
  const [zonesData, violsData] = await Promise.all([
    api.get('/api/geo/zones'),
    api.get('/api/geo/violations'),
  ]);
  _zones      = (zonesData && !zonesData._error) ? (zonesData.zones      || zonesData || []) : _mockZones;
  if (!Array.isArray(_zones)) _zones = _mockZones;
  _violations = (violsData && !violsData._error) ? (violsData.violations || violsData || []) : _mockViolations;
  if (!Array.isArray(_violations)) _violations = _mockViolations;
  geoRenderStats();
  geoRender();
}

export function geoRenderStats() {
  const el = _container && _container.querySelector('#geoStats');
  if (!el) return;
  const activeZones  = _zones.filter(z => z.active).length;
  const unresolved   = _violations.filter(v => !v.resolved).length;
  const today        = new Date().toISOString().split('T')[0];
  const todayViols   = _violations.filter(v => (v.timestamp || '').startsWith(today)).length;
  el.innerHTML =
    _sc(_zones.length,   'Zones',        'var(--accent)') +
    _sc(activeZones,     'Active',       'var(--status-in)') +
    _sc(_violations.length, 'Violations','var(--status-absent)') +
    _sc(unresolved,      'Unresolved',   unresolved > 0 ? 'var(--status-absent)' : 'var(--tx3)');
}

function _sc(n, l, c) {
  return '<div class="geo-stat"><div class="geo-stat-n" style="color:' + c + '">' + n + '</div><div class="geo-stat-l">' + l + '</div></div>';
}

export function geoRender() {
  _tab === 'violations' ? _renderViolations() : _renderZones();
}

function _renderZones() {
  const el = _container && _container.querySelector('#geoContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _zones.filter(z => !_search || z.name.toLowerCase().includes(_search) || (z.address || '').toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="geo-empty"><div style="font-size:2rem">&#128205;</div><div>No zones configured</div></div>'; return; }
  let html = '<div class="geo-zones">';
  items.forEach(function (z, i) {
    html +=
      '<div class="geo-zone-card' + (!z.active ? ' geo-zone-off' : '') + '" style="animation-delay:' + i * 0.04 + 's">' +
        '<div class="geo-zone-hdr">' +
          '<div class="geo-zone-pin">' + (z.active ? '&#128994;' : '&#128308;') + '</div>' +
          '<div class="geo-zone-info">' +
            '<div class="geo-zone-name">' + _esc(z.name) + '</div>' +
            '<div class="geo-zone-addr">' + _esc(z.address || '') + '</div>' +
          '</div>' +
          '<span class="geo-zone-status ' + (z.active ? 'geo-on' : 'geo-off') + '">' + (z.active ? 'Active' : 'Inactive') + '</span>' +
        '</div>' +
        '<div class="geo-zone-details">' +
          '<span>&#127919; ' + z.radius_meters + 'm radius</span>' +
          '<span>&#127968; ' + z.lat.toFixed(4) + ', ' + z.lng.toFixed(4) + '</span>' +
          (z.clock_in_required  ? '<span class="geo-flag">Clock-in required</span>'  : '') +
          (z.clock_out_required ? '<span class="geo-flag">Clock-out required</span>' : '') +
        '</div>' +
        (isAdmin
          ? '<div class="geo-zone-actions">' +
              '<button data-action="toggle-zone" data-id="' + _esc(z.id) + '" class="geo-btn-sm">' + (z.active ? 'Disable' : 'Enable') + '</button>' +
              '<button data-action="edit-zone"   data-id="' + _esc(z.id) + '" class="geo-btn-sm">Edit</button>' +
              '<button data-action="delete-zone" data-id="' + _esc(z.id) + '" class="geo-btn-sm danger">Delete</button>' +
            '</div>'
          : '') +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

function _renderViolations() {
  const el = _container && _container.querySelector('#geoContent');
  if (!el) return;
  const session = getSession();
  const isAdmin = session && session.is_admin;
  const items = _violations.filter(v => !_search || (v.name + ' ' + v.zone).toLowerCase().includes(_search));
  if (!items.length) { el.innerHTML = '<div class="geo-empty"><div style="font-size:2rem">&#10004;</div><div>No violations recorded</div></div>'; return; }
  let html = '<div class="geo-viols">';
  items.forEach(function (v, i) {
    html +=
      '<div class="geo-viol-row' + (v.resolved ? ' geo-resolved' : '') + '" style="animation-delay:' + i * 0.03 + 's">' +
        '<div class="geo-viol-hdr">' +
          '<div class="geo-viol-av">' + _ini(v.name) + '</div>' +
          '<div class="geo-viol-info">' +
            '<div class="geo-viol-name">' + _esc(v.name) + '</div>' +
            '<div class="geo-viol-meta">' + _esc(v.zone) + ' &middot; ' + _esc(v.event) + ' &middot; ' + _fmtTime(v.timestamp) + '</div>' +
          '</div>' +
          '<span class="geo-viol-dist">' + v.distance_meters + 'm outside zone</span>' +
        '</div>' +
        (v.resolved
          ? '<div class="geo-viol-res positive">&#10003; ' + _esc(v.resolution || 'Resolved') + '</div>'
          : (isAdmin ? '<button data-action="resolve" data-id="' + _esc(v.id) + '" class="geo-btn-sm">Resolve</button>' : '<div class="geo-viol-res negative">Unresolved</div>')) +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
}

export function geoShowForm(zone) {
  const isEdit = !!zone;
  const z = zone || {};
  const box = _container && _container.querySelector('#geoModalBox');
  if (!box) return;
  box.innerHTML =
    '<div class="geo-modal-title">' + (isEdit ? 'Edit' : 'Add') + ' Zone</div>' +
    '<div class="geo-field"><label>Zone Name *</label><input type="text" id="geoFName" value="' + _esc(z.name || '') + '" placeholder="e.g. Main Office"></div>' +
    '<div class="geo-field"><label>Address</label><input type="text" id="geoFAddr" value="' + _esc(z.address || '') + '" placeholder="Street address"></div>' +
    '<div class="geo-row2">' +
      '<div class="geo-field"><label>Latitude *</label><input type="number" id="geoFLat" value="' + (z.lat || '') + '" step="0.0001" placeholder="28.6139"></div>' +
      '<div class="geo-field"><label>Longitude *</label><input type="number" id="geoFLng" value="' + (z.lng || '') + '" step="0.0001" placeholder="77.2090"></div>' +
    '</div>' +
    '<div class="geo-field"><label>Radius (metres)</label><input type="number" id="geoFRadius" value="' + (z.radius_meters || 200) + '" min="50" max="5000"></div>' +
    '<div class="geo-checkrow">' +
      '<label><input type="checkbox" id="geoFCIn"' + (z.clock_in_required ? ' checked' : '') + '> Clock-in required</label>' +
      '<label><input type="checkbox" id="geoFCOut"' + (z.clock_out_required ? ' checked' : '') + '> Clock-out required</label>' +
    '</div>' +
    '<div class="geo-form-actions"><button class="geo-btn ghost" data-action="close-modal">Cancel</button><button class="geo-btn" id="geoSaveBtn">' + (isEdit ? 'Update' : 'Add') + '</button></div>';
  _container.querySelector('#geoModal').classList.add('open');
  box.querySelector('#geoSaveBtn').addEventListener('click', () => _save(zone, isEdit));
}

async function _save(zone, isEdit) {
  const box = _container && _container.querySelector('#geoModalBox');
  if (!box) return;
  const name = (box.querySelector('#geoFName').value || '').trim();
  const lat  = parseFloat(box.querySelector('#geoFLat').value);
  const lng  = parseFloat(box.querySelector('#geoFLng').value);
  if (!name)        { toast('Zone name is required', 'error'); return; }
  if (isNaN(lat))   { toast('Latitude is required', 'error'); return; }
  if (isNaN(lng))   { toast('Longitude is required', 'error'); return; }
  const body = { name, lat, lng, address: (box.querySelector('#geoFAddr').value || '').trim(), radius_meters: parseInt(box.querySelector('#geoFRadius').value) || 200, clock_in_required: box.querySelector('#geoFCIn').checked, clock_out_required: box.querySelector('#geoFCOut').checked, active: true };
  const result = isEdit ? await api.put('/api/geo/zones/' + zone.id, body) : await api.post('/api/geo/zones', body);
  if (result && !result._error) { toast(isEdit ? 'Updated' : 'Added', 'success'); geoCloseModal(); geoLoadData(); return; }
  if (isEdit) { const i = _zones.findIndex(z => z.id === zone.id); if (i >= 0) Object.assign(_zones[i], body); }
  else _zones.push({ id: 'z' + Date.now(), ...body });
  toast((isEdit ? 'Updated' : 'Added') + ' (demo)', 'success');
  geoCloseModal(); geoRenderStats(); geoRender();
}

export async function geoToggle(id) {
  const z = _zones.find(x => x.id === id);
  if (!z) return;
  const newActive = !z.active;
  const result = await api.put('/api/geo/zones/' + id, { active: newActive });
  if (result && !result._error) { toast(newActive ? 'Zone enabled' : 'Zone disabled', 'success'); geoLoadData(); return; }
  z.active = newActive;
  toast((newActive ? 'Enabled' : 'Disabled') + ' (demo)', 'success'); geoRenderStats(); geoRender();
}

export async function geoDelete(id) {
  if (!confirm('Delete this zone?')) return;
  const result = await api.delete('/api/geo/zones/' + id);
  if (result && !result._error) { toast('Deleted', 'success'); geoLoadData(); return; }
  _zones = _zones.filter(z => z.id !== id);
  toast('Deleted (demo)', 'success'); geoRenderStats(); geoRender();
}

export async function geoResolve(id) {
  const reason = prompt('Resolution reason:');
  if (reason === null) return;
  const result = await api.put('/api/geo/violations/' + id + '/resolve', { resolution: reason });
  if (result && !result._error) { toast('Resolved', 'success'); geoLoadData(); return; }
  const v = _violations.find(x => x.id === id);
  if (v) { v.resolved = true; v.resolution = reason; }
  toast('Resolved (demo)', 'success'); geoRenderStats(); geoRender();
}

export function geoCloseModal() {
  const m = _container && _container.querySelector('#geoModal');
  if (m) m.classList.remove('open');
}

function _bindEvents(container) {
  const tabs = container.querySelector('#geoTabs');
  if (tabs) tabs.addEventListener('click', function (e) {
    const tab = e.target.closest('.geo-tab');
    if (!tab) return;
    _tab = tab.dataset.tab;
    tabs.querySelectorAll('.geo-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === _tab));
    geoRender();
  });
  const s = container.querySelector('#geoSearch');
  if (s) s.addEventListener('input', function () { _search = this.value.toLowerCase(); geoRender(); });
  const ab = container.querySelector('#geoAddBtn');
  if (ab) ab.addEventListener('click', () => geoShowForm(null));
  const modal = container.querySelector('#geoModal');
  if (modal) modal.addEventListener('click', e => { if (e.target === modal) geoCloseModal(); });
  container.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'close-modal')  geoCloseModal();
    else if (action === 'toggle-zone') geoToggle(id);
    else if (action === 'delete-zone') geoDelete(id);
    else if (action === 'edit-zone')   { const z = _zones.find(x => x.id === id); if (z) geoShowForm(z); }
    else if (action === 'resolve')     geoResolve(id);
  });
}

function _ini(name) { if (!name) return '??'; const p = String(name).trim().split(/\s+/); return p.length >= 2 ? (p[0][0] + p[p.length-1][0]).toUpperCase() : p[0].substring(0,2).toUpperCase(); }
function _fmtTime(iso) { if (!iso) return ''; return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }); }
function _esc(s) { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; }

export function _getZones() { return _zones; }
export function _setZones(list) { _zones = list; }
export function _getViolations() { return _violations; }
export function _setViolations(list) { _violations = list; }
export function _resetState() { _container = null; _zones = []; _violations = []; _tab = 'zones'; _search = ''; }

registerModule('geo_fencing', renderGeoFencingPage);
