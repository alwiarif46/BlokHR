/**
 * modules/parent_hub/parent_hub.js
 * Parent-role landing module (email login → directory.members.role = parent).
 * Opens the dedicated guardian family app; does not use staff school APIs.
 */

import { registerModule } from '../../shared/router.js';
import { getSession } from '../../shared/session.js';

/**
 * @param {HTMLElement} container
 */
export function renderParentHubPage(container) {
  const sess = getSession() || {};
  const email = sess.email || '';
  container.innerHTML =
    '<div class="ph-wrap">' +
      '<h1 class="ph-title">Parent Portal</h1>' +
      '<p class="ph-lead">Your account is signed in as a parent. Family attendance, messages, forms, and fees live in the Family app.</p>' +
      (email
        ? '<p class="ph-meta">Signed in as <strong>' + escapeHtml(email) + '</strong></p>'
        : '') +
      '<div class="ph-actions">' +
        '<a class="ph-btn" id="phOpenGuardian" href="/guardian">Open Family app</a>' +
      '</div>' +
      '<p class="ph-note">Staff school modules are hidden for the parent role. Use the Family app with your guardian phone login if prompted.</p>' +
    '</div>';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

registerModule('parent_hub', renderParentHubPage);
