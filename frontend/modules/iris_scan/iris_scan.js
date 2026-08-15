/**
 * Legacy iris stub — redirects to Capture Admin.
 * Monolith iris Azure path is frozen; students use gated capture_iris_students.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';
import { toast } from '../../shared/toast.js';

export function renderIrisScanPage(container) {
  container.innerHTML =
    '<div style="padding:24px">' +
    '<p>Iris capture moved to <strong>Capture Admin</strong> under DPIA + guardian consent. Legacy API is deprecated.</p>' +
    '</div>';
  toast('Opening Capture Admin', 'success');
  setTimeout(() => navigateToModule('capture_admin'), 200);
}

registerModule('iris_scan', renderIrisScanPage);
