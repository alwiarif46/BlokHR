import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { toast, setToastDuration } from '../../shared/toast.js';

describe('toast deduplication', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toasts"></div>';
    vi.useFakeTimers();
    setToastDuration(3500);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows only one active toast for identical error messages', () => {
    toast('upstream_unavailable', 'error');
    toast('upstream_unavailable', 'error');
    toast('upstream_unavailable', 'error');
    expect(document.querySelectorAll('.toast.error')).toHaveLength(1);
  });

  it('allows a duplicate after the previous toast has faded out', () => {
    toast('same', 'error');
    expect(document.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(3500);
    expect(document.querySelector('.toast')?.classList.contains('fade-out')).toBe(true);
    toast('same', 'error');
    expect(document.querySelectorAll('.toast:not(.fade-out)')).toHaveLength(1);
    expect(document.querySelectorAll('.toast')).toHaveLength(2);
  });

  it('allows different messages or types side by side', () => {
    toast('one', 'error');
    toast('two', 'error');
    toast('one', 'success');
    expect(document.querySelectorAll('.toast')).toHaveLength(3);
  });
});
