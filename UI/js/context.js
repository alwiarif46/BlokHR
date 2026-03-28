/**
 * context.js — postMessage CONTEXT receiver for iframe modules.
 * Validates origin and version (v:1). Applies prefs from CONTEXT.
 */

import { applyPrefsToDOM } from './prefsClient.js';

const SAFE_ORIGIN = window.location.origin;

let settingsCache = null;
let currentUser = null;
let isAdmin = false;
let memberRecord = null;
let memberPrefs = null;

let _onContextReady = null;

export function setOnContextReady(handler) {
  _onContextReady = handler;
}

export function getSettingsCache() {
  return settingsCache;
}

export function getCurrentUser() {
  return currentUser;
}

export function getIsAdmin() {
  return isAdmin;
}

export function getMemberRecord() {
  return memberRecord;
}

export function getMemberPrefs() {
  return memberPrefs;
}

function _handleMessage(event) {
  if (event.origin !== SAFE_ORIGIN) return;
  try {
    const ctx = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (ctx.v !== 1) return;

    settingsCache = ctx.settings;
    currentUser = ctx.user;
    isAdmin = ctx.isAdmin;
    memberRecord = ctx.member;
    memberPrefs = ctx.prefs;

    if (ctx.prefs) applyPrefsToDOM(ctx.prefs);
    if (_onContextReady) _onContextReady(ctx);
  } catch (e) {
    console.error('Invalid CONTEXT', e);
  }
}

window.addEventListener('message', _handleMessage);

export { _handleMessage as __handleMessageForTest };
