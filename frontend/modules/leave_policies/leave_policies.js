/**
 * modules/leave_policies/leave_policies.js
 * Thin wrapper around the shared Leave Policy Manager.
 */

import { registerModule } from '../../shared/router.js';
import { renderLeavePolicyManager } from './leave_policy_manager.js';

export function renderLeavePoliciesPage(container) {
  renderLeavePolicyManager(container, { embed: false });
}

registerModule('leave_policies', renderLeavePoliciesPage);
