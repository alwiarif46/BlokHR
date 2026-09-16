/**
 * Legacy face stub — Capture Admin owns on-device face templates.
 * Azure Face API path remains frozen in the monolith.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';

export function renderFaceRecognitionPage(container) {
  container.innerHTML =
    '<div class="fr-deprecated">' +
    '<h2 class="fr-deprecated-title">Face Recognition moved</h2>' +
    '<p>On-device face templates are managed in <strong>Capture Admin</strong>. The Azure Face API path is deprecated and frozen.</p>' +
    '<button type="button" class="fr-deprecated-btn" id="frOpenCapture">Open Capture Admin</button>' +
    '</div>';

  const btn = container.querySelector('#frOpenCapture');
  if (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('capture_admin');
    });
  }
  // Auto-open the real module; keep a brief message if navigation is slow.
  setTimeout(function () {
    navigateToModule('capture_admin');
  }, 50);
}

registerModule('face_recognition', renderFaceRecognitionPage);
