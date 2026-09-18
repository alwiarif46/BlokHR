/**
 * Legacy face stub — Capture Admin owns on-device face templates.
 * Azure Face API path remains frozen in the monolith.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';

export function renderFaceRecognitionPage(container) {
  container.innerHTML =
    '<div class="fr-wrap">' +
    '<div class="fr-card">' +
    '<h2 class="fr-card-title">Face Recognition moved</h2>' +
    '<p>On-device face templates are managed in <strong>Capture Admin</strong>. The Azure Face API path is deprecated and frozen.</p>' +
    '<button type="button" class="fr-card-btn" id="frOpenCapture">Open Capture Admin</button>' +
    '</div>' +
    '</div>';

  const btn = container.querySelector('#frOpenCapture');
  if (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('capture_admin');
    });
  }
}

registerModule('face_recognition', renderFaceRecognitionPage);
