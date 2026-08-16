/**
 * shared/school-roles.js — L6 cosmetic school role helpers (P12-06).
 * Server enforcement lives in P12-03..05; this only drives sidebar/UI.
 */

/**
 * @param {string|null|undefined} schoolRole
 * @param {boolean} isAdmin
 * @param {string} allowedCsv — e.g. "teacher,school_admin"
 * @returns {boolean}
 */
export function schoolRoleAllows(schoolRole, isAdmin, allowedCsv) {
  if (isAdmin) return true;
  const role = (schoolRole || '').trim();
  if (!role) return false;
  const allowed = String(allowedCsv || '')
    .split(',')
    .map(function (r) {
      return r.trim();
    })
    .filter(Boolean);
  if (!allowed.length) return true;
  return allowed.indexOf(role) >= 0;
}

/**
 * Apply data-school-roles intersection on sidebar items.
 * Visible iff existing display would allow AND (no attr OR role/admin matches).
 * Does not clear `.hidden` from feature flags — CSS keeps those hidden.
 *
 * @param {ParentNode} [root]
 * @param {{ schoolRole?: string, isAdmin?: boolean }} opts
 */
export function applySchoolRoleGates(root, opts) {
  const doc = root || (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.querySelectorAll) return;
  const schoolRole = opts && opts.schoolRole;
  const isAdmin = !!(opts && opts.isAdmin);
  doc.querySelectorAll('[data-school-roles]').forEach(function (el) {
    const csv = el.getAttribute('data-school-roles') || '';
    const ok = schoolRoleAllows(schoolRole, isAdmin, csv);
    if (!ok) {
      el.style.display = 'none';
      return;
    }
    /* Only restore when not also role/admin-gated to none by applyRoleGates */
    if (!el.classList.contains('role-gated') && !el.classList.contains('admin-gated')) {
      el.style.display = '';
    }
  });
}

/**
 * Roles that may approve regularizations / open Settings+Nudge (school_admin+).
 * @param {string|null|undefined} schoolRole
 * @param {boolean} isAdmin
 * @returns {boolean}
 */
export function canSchoolAdminOps(schoolRole, isAdmin) {
  return schoolRoleAllows(schoolRole, isAdmin, 'school_admin');
}

/**
 * Teacher keeps lessons; review + course writes are school_admin+.
 * @param {string|null|undefined} schoolRole
 * @param {boolean} isAdmin
 * @returns {boolean}
 */
export function canAcademicsCourseWrite(schoolRole, isAdmin) {
  return schoolRoleAllows(schoolRole, isAdmin, 'school_admin');
}
