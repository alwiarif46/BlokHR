/**
 * Legacy iris stub — Capture Admin owns gated iris under DPIA + guardian consent.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';

export function renderIrisScanPage(container) {
  container.innerHTML =
    '<div class="iris-wrap">' +
    '<div class="iris-card">' +
    '<h2 class="iris-card-title">Iris Scan moved</h2>' +
    '<p>Iris capture lives in <strong>Capture Admin</strong>, with DPIA and guardian consent. The legacy Azure iris path is deprecated.</p>' +
    '<button type="button" class="iris-card-btn" id="irisOpenCapture">Open Capture Admin</button>' +
    '</div>' +
    '</div>';

  const btn = container.querySelector('#irisOpenCapture');
  if (btn) {
    btn.addEventListener('click', function () {
      navigateToModule('capture_admin');
    });
  }
}

registerModule('iris_scan', renderIrisScanPage);
