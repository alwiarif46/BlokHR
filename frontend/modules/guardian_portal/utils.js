/**
 * Shared helpers for the guardian parent portal (no HTTP / storage).
 */

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7);
}

export function daysAgoIso(n, from = new Date()) {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function expandDateRange(from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { error: 'Use YYYY-MM-DD dates' };
  }
  if (to < from) return { error: 'End date must be on or after start' };
  const today = todayIso();
  if (from < today) return { error: 'Start date must be today or later' };
  const out = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (out.length > 15) return { error: 'At most 15 dates allowed' };
    const t = Date.parse(cur + 'T00:00:00.000Z') + 86_400_000;
    cur = new Date(t).toISOString().slice(0, 10);
  }
  return { dates: out };
}

export function studentLabel(s) {
  const name = [s.firstName || s.first_name, s.lastName || s.last_name]
    .filter(Boolean)
    .join(' ');
  return name || s.admissionNumber || s.admission_number || s.id;
}

export function studentMeta(s) {
  const cls = s.classLabel || s.class_label || '';
  const sec = s.section || '';
  return [cls && ('Class ' + cls), sec && ('Sec ' + sec)].filter(Boolean).join(' · ');
}

export function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** True when the gateway/service has not implemented the route yet. */
export function isUnavailable(res) {
  return !!(res && res._error && (res.status === 404 || res.status === 501));
}

/** True when the guardian is not allowed to access this resource. */
export function isForbidden(res) {
  return !!(res && res._error && res.status === 403);
}

/** True when the session is no longer valid. */
export function isUnauthorized(res) {
  return !!(res && res._error && res.status === 401);
}

/**
 * Map API errors to parent-friendly copy (never dump raw gateway codes alone).
 * @param {any} res
 * @param {string} [fallback]
 */
export function friendlyError(res, fallback) {
  if (isUnauthorized(res)) {
    return 'Session expired — please sign in again.';
  }
  if (isForbidden(res)) {
    return 'You do not have access to this information.';
  }
  if (isUnavailable(res)) {
    return 'This feature is not available yet.';
  }
  const msg = (res && (res.message || res.error)) || '';
  if (typeof msg === 'string' && msg.trim() && !/^unauthorized$/i.test(msg.trim())) {
    return msg.trim();
  }
  return fallback || 'Something went wrong. Try again.';
}

export function emptyState(title, detail) {
  return `<div class="gp-empty" role="status">
    <p class="gp-empty-title">${escapeHtml(title)}</p>
    <p class="gp-empty-detail">${escapeHtml(detail || 'Nothing to show yet.')}</p>
  </div>`;
}

export function errorBlock(message) {
  return `<p class="gp-error" role="alert">${escapeHtml(message || 'Something went wrong')}</p>`;
}

export function retryButton(label, actionAttr) {
  return `<button type="button" class="gp-btn secondary gp-retry" data-retry="${escapeHtml(actionAttr)}">${escapeHtml(label || 'Retry')}</button>`;
}
