import type { Response } from 'express';
import type { Logger } from 'pino';

/** Valid SSE event types the frontend listens for. */
export type SseEventType =
  | 'attendance-update'
  | 'settings-update'
  | 'leave-update'
  | 'meeting-update'
  | 'chat-message'
  | 'chat-dm'
  | 'chat-channel-update';

interface SseClient {
  id: string;
  res: Response;
  connectedAt: number;
}

/**
 * SSE Broadcaster — manages connected clients and pushes typed events.
 *
 * Usage:
 *   1. Route handler calls `addClient(res)` to register a new SSE connection.
 *   2. Any service calls `broadcast('attendance-update', { ... })` to push to all clients.
 *   3. Heartbeat keeps connections alive (every 30s).
 *   4. Clients are cleaned up on disconnect or error.
 *
 * Thread safety: Node.js is single-threaded, so the Set operations are safe.
 * Memory: clients are removed on disconnect. No unbounded growth.
 */
export class SseBroadcaster {
  private readonly clients: Map<string, SseClient> = new Map();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private clientCounter = 0;

  constructor(
    private readonly logger: Logger,
    private readonly heartbeatMs: number = 30_000,
  ) {}

  /** Start the heartbeat timer. Call once at server startup. */
  start(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatMs);
    // Prevent heartbeat from keeping the process alive during shutdown
    if (this.heartbeatTimer.unref) {
      this.heartbeatTimer.unref();
    }
    this.logger.info({ heartbeatMs: this.heartbeatMs }, 'SSE broadcaster started');
  }

  /** Stop the heartbeat and close all connections. Call during graceful shutdown. */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    for (const [id, client] of this.clients) {
      try {
        client.res.end();
      } catch {
        // Client already disconnected
      }
      this.clients.delete(id);
    }
    this.logger.info('SSE broadcaster stopped');
  }

  /**
   * Register a new SSE client connection.
   * Sets the required headers, sends initial connection event, and wires up cleanup.
   */
  addClient(res: Response): string {
    this.clientCounter++;
    const id = `sse_${this.clientCounter}_${Date.now()}`;

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ clientId: id })}\n\n`);

    const client: SseClient = { id, res, connectedAt: Date.now() };
    this.clients.set(id, client);

    // Cleanup on client disconnect
    res.on('close', () => {
      this.clients.delete(id);
      this.logger.debug({ clientId: id, remaining: this.clients.size }, 'SSE client disconnected');
    });

    this.logger.debug({ clientId: id, totalClients: this.clients.size }, 'SSE client connected');

    return id;
  }

  /**
   * Broadcast a typed event to all connected clients.
   * Silently drops failed writes (client already disconnected).
   */
  broadcast(eventType: SseEventType, data?: Record<string, unknown>): void {
    if (this.clients.size === 0) return;

    const payload = data ? JSON.stringify(data) : '{}';
    const message = `event: ${eventType}\ndata: ${payload}\n\n`;

    const deadClients: string[] = [];

    for (const [id, client] of this.clients) {
      try {
        const ok = client.res.write(message);
        if (!ok) {
          // Backpressure — client can't keep up. Remove to prevent memory buildup.
          deadClients.push(id);
        }
      } catch {
        deadClients.push(id);
      }
    }

    for (const id of deadClients) {
      const client = this.clients.get(id);
      if (client) {
        try {
          client.res.end();
        } catch {
          // Already dead
        }
        this.clients.delete(id);
      }
    }

    this.logger.debug(
      { eventType, clients: this.clients.size, dropped: deadClients.length },
      'SSE broadcast',
    );
  }

  /** Number of currently connected clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Send a comment heartbeat to keep connections alive through proxies/load balancers. */
  private sendHeartbeat(): void {
    if (this.clients.size === 0) return;

    const deadClients: string[] = [];
    const beat = `:heartbeat ${Date.now()}\n\n`;

    for (const [id, client] of this.clients) {
      try {
        const ok = client.res.write(beat);
        if (!ok) {
          deadClients.push(id);
        }
      } catch {
        deadClients.push(id);
      }
    }

    for (const id of deadClients) {
      const client = this.clients.get(id);
      if (client) {
        try {
          client.res.end();
        } catch {
          // Already dead
        }
        this.clients.delete(id);
      }
    }
  }
}
