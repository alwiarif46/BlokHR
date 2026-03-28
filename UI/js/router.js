/**
 * router.js — Hash-based routing for shell.html.
 * Maps #horizon, #apex, #axis, etc. to iframe src.
 */

let _tabs = [];
let _onRouteChange = null;

export function initRouter(tabs, onRouteChange) {
  _tabs = tabs;
  _onRouteChange = onRouteChange;

  window.addEventListener('hashchange', _handleHashChange);
  _handleHashChange();
}

export function navigate(tabId) {
  window.location.hash = `#${tabId}`;
}

export function getCurrentRoute() {
  const hash = window.location.hash.replace('#', '');
  return hash || (_tabs.length > 0 ? _tabs[0].id : '');
}

export function destroyRouter() {
  window.removeEventListener('hashchange', _handleHashChange);
}

function _handleHashChange() {
  const route = getCurrentRoute();
  const tab = _tabs.find(t => t.id === route);
  if (tab && _onRouteChange) {
    _onRouteChange(tab);
  } else if (!tab && _tabs.length > 0 && _onRouteChange) {
    _onRouteChange(_tabs[0]);
  }
}
