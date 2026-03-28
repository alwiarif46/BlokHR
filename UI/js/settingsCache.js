/**
 * settingsCache.js — Reads tenant settings from server. Never from localStorage.
 */

import { httpClient } from './httpClient.js';

let _settings = null;

export async function loadSettings() {
  const res = await httpClient.get('/api/settings');
  _settings = res.settings ?? res;
  return _settings;
}

export function getSettings() {
  return _settings;
}

export function updateSettings(newSettings) {
  _settings = newSettings;
}

export function getNestedValue(obj, dotPath) {
  if (!obj || !dotPath) return undefined;
  return dotPath.split('.').reduce((cur, key) => cur?.[key], obj);
}

export function dotPathToObject(path, value) {
  const keys = path.split('.');
  const result = {};
  let cur = result;
  keys.forEach((k, i) => {
    cur[k] = i === keys.length - 1 ? value : {};
    if (i < keys.length - 1) cur = cur[k];
  });
  return result;
}
