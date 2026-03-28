import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initRouter, navigate, getCurrentRoute, destroyRouter } from '../js/router.js';

describe('router', () => {
  const tabs = [
    { id: 'horizon', label: 'Horizon', src: 'horizon.html' },
    { id: 'apex', label: 'Apex', src: 'apex.html' },
    { id: 'axis', label: 'Axis', src: 'axis.html' },
  ];

  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    destroyRouter();
    window.location.hash = '';
  });

  it('getCurrentRoute returns hash without #', () => {
    window.location.hash = '#apex';
    initRouter(tabs, vi.fn());
    expect(getCurrentRoute()).toBe('apex');
  });

  it('defaults to first tab when no hash', () => {
    initRouter(tabs, vi.fn());
    expect(getCurrentRoute()).toBe('horizon');
  });

  it('navigate sets hash', () => {
    initRouter(tabs, vi.fn());
    navigate('axis');
    expect(window.location.hash).toBe('#axis');
  });

  it('calls onRouteChange with matching tab', () => {
    const handler = vi.fn();
    window.location.hash = '#apex';
    initRouter(tabs, handler);
    expect(handler).toHaveBeenCalledWith(tabs[1]);
  });

  it('falls back to first tab for unknown hash', () => {
    const handler = vi.fn();
    window.location.hash = '#unknown';
    initRouter(tabs, handler);
    expect(handler).toHaveBeenCalledWith(tabs[0]);
  });
});
