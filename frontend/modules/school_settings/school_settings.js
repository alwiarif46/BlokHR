import { registerModule } from '../../shared/router.js';
import { createSchoolPlaceholder } from '../_school_placeholder.js';

export function renderSchoolSettingsPage(container) {
  createSchoolPlaceholder(
    'School Settings',
    'School-specific settings shell — placeholder until a dedicated prompt.',
  )(container);
}

registerModule('school_settings', renderSchoolSettingsPage);
