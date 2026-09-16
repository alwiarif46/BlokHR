/**
 * Legacy iris stub — Capture Admin owns gated iris under DPIA + guardian consent.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';

export function renderIrisScanPage(container) {
  container.innerHTML =
    '<div class="fr-deprecated">' +
    '<h2 class="fr-deprecated-title">Iris Scan moved</h2>' +
    '<p>Iris capture lives in <strong>Capture Admin</strong> (DPIA + guardian consent). The legacy Azure iris path is deprecated.</p>' +
    '<button type="button" class="fr-deprecated-btn" id="irisOpenCapture">Open Capture Admin</button>' +
    '</div>';

  const btn = container.querySelector('#irisOpenCapture');
  if (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('capture_admin');
    });
  }
  setTimeout(function () {
    navigateToModule('capture_admin');
  }, 50);
}

registerModule('iris_scan', renderIrisScanPage);
