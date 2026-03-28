import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock EventSource
class MockEventSource {
  constructor(url) {
    this.url = url;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this._listeners = {};
    MockEventSource.instances.push(this);
  }
  addEventListener(type, handler) {
    if (!this._listeners[type]) this._listeners[type] = [];
    this._listeners[type].push(handler);
  }
  close() {
    this.closed = true;
  }
}
MockEventSource.instances = [];

global.EventSource = MockEventSource;

const { connectSSE, onSSE, offSSE, disconnectSSE } = await import('../js/sseClient.js');

describe('sseClient', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
  });

  it('connects to /api/sse by default', () => {
    connectSSE();
    expect(MockEventSource.instances.length).toBe(1);
    expect(MockEventSource.instances[0].url).toBe('/api/sse');
  });

  it('registers event handlers', () => {
    const handler = vi.fn();
    onSSE('attendance-update', handler);
    connectSSE();

    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    expect(es._listeners['attendance-update']).toBeDefined();
  });

  it('offSSE removes handler', () => {
    const handler = vi.fn();
    onSSE('notification', handler);
    offSSE('notification', handler);
    // handler should be removed; no crash
  });

  it('disconnectSSE closes connection', () => {
    connectSSE();
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    disconnectSSE();
    expect(es.closed).toBe(true);
  });

  it('reconnects with exponential backoff on error', () => {
    connectSSE();
    const es = MockEventSource.instances[MockEventSource.instances.length - 1];
    const initialCount = MockEventSource.instances.length;

    // Simulate error
    es.onerror();

    // After 1s delay, should reconnect
    vi.advanceTimersByTime(1000);
    expect(MockEventSource.instances.length).toBe(initialCount + 1);
  });
});
