/**
 * Legacy face stub — redirects to Capture Admin (on-device templates via services/capture).
 * Azure Face growth is frozen.
 */
import { navigateToModule, registerModule } from '../../shared/router.js';
import { toast } from '../../shared/toast.js';

export function renderFaceRecognitionPage(container) {
  container.innerHTML =
    '<div style="padding:24px">' +
    '<p>Face capture moved to <strong>Capture Admin</strong> (on-device embeddings). Azure Face API path is deprecated.</p>' +
    '</div>';
  toast('Opening Capture Admin', 'success');
  setTimeout(() => navigateToModule('capture_admin'), 200);
}

registerModule('face_recognition', renderFaceRecognitionPage);
