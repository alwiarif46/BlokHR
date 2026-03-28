/**
 * themeManager.js — 4 themes + dark/light/system mode.
 * Theme is applied via CSS class on <body>. Never stored in localStorage.
 */

const THEMES = ['chromium', 'neural', 'holodeck', 'clean'];
const DARK_MODES = ['dark', 'light', 'system'];

let _currentTheme = 'chromium';
let _currentDarkMode = 'system';
let _mediaQuery = null;

export function setTheme(name) {
  if (!THEMES.includes(name)) return;
  _currentTheme = name;
  THEMES.forEach(t => document.body.classList.remove(`theme-${t}`));
  document.body.classList.add(`theme-${name}`);
}

export function getTheme() {
  return _currentTheme;
}

export function setDarkMode(mode) {
  if (!DARK_MODES.includes(mode)) return;
  _currentDarkMode = mode;
  document.body.classList.remove('dark-mode', 'light-mode');

  if (mode === 'dark') {
    document.body.classList.add('dark-mode');
  } else if (mode === 'light') {
    document.body.classList.add('light-mode');
  } else {
    _applySystemPreference();
    _listenSystemPreference();
  }
}

export function getDarkMode() {
  return _currentDarkMode;
}

export function getAvailableThemes() {
  return [...THEMES];
}

export function getAvailableDarkModes() {
  return [...DARK_MODES];
}

function _applySystemPreference() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.classList.remove('dark-mode', 'light-mode');
  document.body.classList.add(prefersDark ? 'dark-mode' : 'light-mode');
}

function _listenSystemPreference() {
  if (_mediaQuery) return;
  _mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  _mediaQuery.addEventListener('change', () => {
    if (_currentDarkMode === 'system') _applySystemPreference();
  });
}
