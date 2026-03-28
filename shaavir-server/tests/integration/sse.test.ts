import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { SseBroadcaster } from '../../src/sse/broadcaster';
import { createTestApp } from '../helpers/setup';
import { testLogger } from '../helpers/setup';

// ── Unit tests for SseBroadcaster class ──

describe('SseBroadcaster', () => {
  let broadcaster: SseBroadcaster;

  beforeEach(() => {
    broadcaster = new SseBroadcaster(testLogger, 60_000);
  });

  afterEach(() => {
    broadcaster.stop();
  });

  it('starts with zero clients', () => {
    expect(broadcaster.clientCount).toBe(0);
  });

  it('tracks client count after addClient', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);
    expect(broadcaster.clientCount).toBe(1);
  });

  it('sends SSE headers on addClient', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);
    expect(mockRes._headers['Content-Type']).toBe('text/event-stream');
    expect(mockRes._headers['Cache-Control']).toBe('no-cache');
    expect(mockRes._headers['Connection']).toBe('keep-alive');
  });

  it('sends initial connected event on addClient', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);
    const written = mockRes._written.join('');
    expect(written).toContain('event: connected');
    expect(written).toContain('"clientId"');
  });

  it('removes client on close event', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);
    expect(broadcaster.clientCount).toBe(1);

    // Simulate client disconnect
    mockRes._triggerClose();
    expect(broadcaster.clientCount).toBe(0);
  });

  it('broadcasts to all connected clients', () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    broadcaster.addClient(res1);
    broadcaster.addClient(res2);

    broadcaster.broadcast('attendance-update', { source: 'test' });

    const msg1 = res1._written.join('');
    const msg2 = res2._written.join('');
    expect(msg1).toContain('event: attendance-update');
    expect(msg1).toContain('"source":"test"');
    expect(msg2).toContain('event: attendance-update');
  });

  it('broadcasts all event types', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);

    broadcaster.broadcast('attendance-update');
    broadcaster.broadcast('settings-update');
    broadcaster.broadcast('leave-update');
    broadcaster.broadcast('meeting-update');

    const written = mockRes._written.join('');
    expect(written).toContain('event: attendance-update');
    expect(written).toContain('event: settings-update');
    expect(written).toContain('event: leave-update');
    expect(written).toContain('event: meeting-update');
  });

  it('removes clients that error on write', () => {
    const goodRes = createMockResponse();
    const badRes = createMockResponse();
    broadcaster.addClient(goodRes);
    broadcaster.addClient(badRes);
    expect(broadcaster.clientCount).toBe(2);

    // Set failure AFTER connection (initial connected event already sent)
    badRes._failOnWrite = true;
    broadcaster.broadcast('attendance-update');

    expect(broadcaster.clientCount).toBe(1);
  });

  it('handles broadcast with no clients gracefully', () => {
    // Should not throw
    broadcaster.broadcast('attendance-update', { test: true });
    expect(broadcaster.clientCount).toBe(0);
  });

  it('stop() closes all connections', () => {
    const res1 = createMockResponse();
    const res2 = createMockResponse();
    broadcaster.addClient(res1);
    broadcaster.addClient(res2);
    expect(broadcaster.clientCount).toBe(2);

    broadcaster.stop();

    expect(broadcaster.clientCount).toBe(0);
    expect(res1._ended).toBe(true);
    expect(res2._ended).toBe(true);
  });

  it('start() initializes heartbeat without error', () => {
    broadcaster.start();
    // No assertion needed — just verify it doesn't throw
    broadcaster.stop();
  });

  it('broadcasts empty object when no data provided', () => {
    const mockRes = createMockResponse();
    broadcaster.addClient(mockRes);

    broadcaster.broadcast('settings-update');

    const written = mockRes._written.join('');
    expect(written).toContain('data: {}');
  });
});

// ── Integration test for GET /api/sse endpoint ──

describe('GET /api/sse', () => {
  let app: Express;
  let db: DatabaseEngine;
  let broadcaster: SseBroadcaster;
  let server: http.Server;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    broadcaster = setup.broadcaster;
    server = app.listen(0);
  });

  afterEach(async () => {
    broadcaster.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  });

  it('establishes an SSE connection with correct headers', async () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server not bound');

    const result = await new Promise<{ headers: http.IncomingHttpHeaders; data: string }>(
      (resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${address.port}/api/sse`, (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
            // We got the initial event — close and resolve
            req.destroy();
            resolve({ headers: res.headers, data });
          });
          res.on('error', reject);
        });
        req.on('error', reject);
        setTimeout(() => {
          req.destroy();
          reject(new Error('SSE timeout'));
        }, 3000);
      },
    );

    expect(result.headers['content-type']).toBe('text/event-stream');
    expect(result.headers['cache-control']).toBe('no-cache');
    expect(result.data).toContain('event: connected');
  });

  it('receives broadcast events after connection', async () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server not bound');

    const result = await new Promise<string>((resolve, reject) => {
      const chunks: string[] = [];
      const req = http.get(`http://127.0.0.1:${address.port}/api/sse`, (res) => {
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk.toString());
          // After getting the connected event, send a broadcast
          if (chunks.length === 1) {
            broadcaster.broadcast('attendance-update', { test: true });
          }
          // After getting both events, resolve
          if (chunks.length >= 2) {
            req.destroy();
            resolve(chunks.join(''));
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      setTimeout(() => {
        req.destroy();
        reject(new Error('SSE timeout'));
      }, 3000);
    });

    expect(result).toContain('event: connected');
    expect(result).toContain('event: attendance-update');
    expect(result).toContain('"test":true');
  });

  it('tracks client count', async () => {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Server not bound');

    expect(broadcaster.clientCount).toBe(0);

    await new Promise<void>((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${address.port}/api/sse`, (res) => {
        res.on('data', () => {
          expect(broadcaster.clientCount).toBe(1);
          req.destroy();
          resolve();
        });
        res.on('error', reject);
      });
      req.on('error', reject);
      setTimeout(() => {
        req.destroy();
        reject(new Error('SSE timeout'));
      }, 3000);
    });
  });
});

// ── Mock Response helper ──

interface MockResponse {
  _headers: Record<string, string>;
  _written: string[];
  _ended: boolean;
  _failOnWrite: boolean;
  _closeListeners: Array<() => void>;
  _triggerClose: () => void;
  writeHead: (status: number, headers: Record<string, string>) => void;
  write: (data: string) => boolean;
  end: () => void;
  on: (event: string, fn: () => void) => void;
}

function createMockResponse(): MockResponse {
  const mock: MockResponse = {
    _headers: {},
    _written: [],
    _ended: false,
    _failOnWrite: false,
    _closeListeners: [],
    _triggerClose(): void {
      for (const fn of mock._closeListeners) {
        fn();
      }
    },
    writeHead(status: number, headers: Record<string, string>): void {
      Object.assign(mock._headers, headers);
    },
    write(data: string): boolean {
      if (mock._failOnWrite) throw new Error('Write failed');
      mock._written.push(data);
      return true;
    },
    end(): void {
      mock._ended = true;
    },
    on(event: string, fn: () => void): void {
      if (event === 'close') {
        mock._closeListeners.push(fn);
      }
    },
  };
  // Cast to Response for the broadcaster
  return mock;
}
