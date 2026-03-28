import type { Logger } from 'pino';
import type { EventMap, EventName } from './event-types';

// ── Listener type ──

export type EventListener<K extends EventName> = (payload: EventMap[K], meta: EventMeta) => void | Promise<void>;

export interface EventMeta {
  eventId: string;
  timestamp: string;
  emittedBy: string;
}

// ── Interface ──

export interface EventBus {
  /** Emit a typed event. Fire-and-forget — never throws, never blocks the caller. */
  emit<K extends EventName>(event: K, payload: EventMap[K], emittedBy?: string): void;

  /** Subscribe to a typed event. Returns an unsubscribe function. */
  on<K extends EventName>(event: K, listener: EventListener<K>): () => void;

  /** Subscribe to ALL events (wildcard). */
  onAny(listener: (event: EventName, payload: EventMap[EventName], meta: EventMeta) => void | Promise<void>): () => void;

  /** Graceful shutdown. */
  close(): Promise<void>;
}

// ── In-Memory Implementation ──

let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  return `mem-${Date.now()}-${_idCounter}`;
}

/**
 * In-memory EventBus. Zero dependencies. Works for single-process deployments.
 * Events live only in memory — lost on restart. Sufficient for dev and single-instance prod.
 */
export class InMemoryEventBus implements EventBus {
  private readonly listeners: Map<string, Set<EventListener<EventName>>> = new Map();
  private readonly anyListeners: Set<(event: EventName, payload: EventMap[EventName], meta: EventMeta) => void | Promise<void>> = new Set();

  constructor(private readonly logger: Logger) {
    this.logger.info('EventBus initialized (in-memory mode)');
  }

  emit<K extends EventName>(event: K, payload: EventMap[K], emittedBy?: string): void {
    const meta: EventMeta = {
      eventId: nextId(),
      timestamp: new Date().toISOString(),
      emittedBy: emittedBy ?? 'system',
    };

    // Fire-and-forget: schedule async, never block caller
    setImmediate(() => {
      this.dispatch(event, payload, meta);
    });
  }

  on<K extends EventName>(event: K, listener: EventListener<K>): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as EventListener<EventName>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(listener as EventListener<EventName>);
    };
  }

  onAny(listener: (event: EventName, payload: EventMap[EventName], meta: EventMeta) => void | Promise<void>): () => void {
    this.anyListeners.add(listener);
    return () => { this.anyListeners.delete(listener); };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    this.anyListeners.clear();
    this.logger.info('EventBus closed (in-memory)');
  }

  private dispatch<K extends EventName>(event: K, payload: EventMap[K], meta: EventMeta): void {
    const key = event as string;

    // Typed listeners
    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        try {
          const result = listener(payload, meta);
          // If the listener returns a promise, catch errors on it
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch((err) => {
              this.logger.error({ event, eventId: meta.eventId, err: String(err) }, 'Event listener error (async)');
            });
          }
        } catch (err) {
          this.logger.error({ event, eventId: meta.eventId, err: String(err) }, 'Event listener error (sync)');
        }
      }
    }

    // Wildcard listeners
    for (const listener of this.anyListeners) {
      try {
        const result = listener(event, payload as EventMap[EventName], meta);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            this.logger.error({ event, eventId: meta.eventId, err: String(err) }, 'Wildcard listener error (async)');
          });
        }
      } catch (err) {
        this.logger.error({ event, eventId: meta.eventId, err: String(err) }, 'Wildcard listener error (sync)');
      }
    }

    this.logger.debug({ event, eventId: meta.eventId }, 'Event dispatched');
  }
}

// ── Redis Implementation ──

/**
 * Redis/Valkey-backed EventBus. Uses Redis Pub/Sub for real-time dispatch
 * and Redis Streams for durable event history with auto-trimming.
 *
 * Requires `ioredis` package. Falls back to in-memory if connection fails.
 *
 * This implementation is designed so the interface is identical to InMemoryEventBus.
 * The caller doesn't know or care which transport is active.
 */
export class RedisEventBus implements EventBus {
  private readonly listeners: Map<string, Set<EventListener<EventName>>> = new Map();
  private readonly anyListeners: Set<(event: EventName, payload: EventMap[EventName], meta: EventMeta) => void | Promise<void>> = new Set();
  private pub: RedisClient | null = null;
  private sub: RedisClient | null = null;
  private connected = false;
  private readonly retentionDays: number;
  private readonly streamPrefix: string;
  private readonly channelPrefix: string;

  constructor(
    private readonly redisUrl: string,
    private readonly logger: Logger,
    retentionDays = 90,
  ) {
    this.retentionDays = retentionDays;
    this.streamPrefix = 'shaavir:stream:';
    this.channelPrefix = 'shaavir:event:';
  }

  /** Connect to Redis. Call once at startup. */
  async connect(): Promise<void> {
    try {
      // Dynamic import — ioredis is optional, only needed when REDIS_URL is set
      const IoRedis = (await import('ioredis')).default;

      this.pub = new IoRedis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 200, 5000),
        lazyConnect: false,
      }) as unknown as RedisClient;

      this.sub = new IoRedis(this.redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 200, 5000),
        lazyConnect: false,
      }) as unknown as RedisClient;

      // Subscribe to the event channel
      await (this.sub as RedisClientWithSubscribe).subscribe(this.channelPrefix + '*');
      (this.sub as RedisClientWithMessage).on('message', (_channel: string, message: string) => {
        try {
          const parsed = JSON.parse(message) as { event: EventName; payload: EventMap[EventName]; meta: EventMeta };
          this.dispatchLocal(parsed.event, parsed.payload, parsed.meta);
        } catch (err) {
          this.logger.error({ err: String(err) }, 'Redis message parse error');
        }
      });

      this.connected = true;
      this.logger.info({ retentionDays: this.retentionDays }, 'EventBus initialized (Redis mode)');
    } catch (err) {
      this.logger.error({ err: String(err) }, 'Redis connection failed — falling back to local dispatch only');
      this.connected = false;
    }
  }

  emit<K extends EventName>(event: K, payload: EventMap[K], emittedBy?: string): void {
    const meta: EventMeta = {
      eventId: `redis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      emittedBy: emittedBy ?? 'system',
    };

    if (this.connected && this.pub) {
      // Publish to Redis Pub/Sub for real-time delivery to all instances
      const message = JSON.stringify({ event, payload, meta });
      (this.pub as RedisClientWithPublish).publish(this.channelPrefix + event, message).catch((err: unknown) => {
        this.logger.error({ event, err: String(err) }, 'Redis publish failed');
      });

      // Also write to Redis Stream for durability + history
      const streamKey = this.streamPrefix + event;
      (this.pub as RedisClientWithXadd).xadd(
        streamKey, 'MAXLEN', '~', '40000', '*',
        'payload', JSON.stringify(payload),
        'meta', JSON.stringify(meta),
      ).catch((err: unknown) => {
        this.logger.error({ event, err: String(err) }, 'Redis XADD failed');
      });
    } else {
      // Fallback: dispatch locally if Redis is down
      setImmediate(() => {
        this.dispatchLocal(event, payload, meta);
      });
    }
  }

  on<K extends EventName>(event: K, listener: EventListener<K>): () => void {
    const key = event as string;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as EventListener<EventName>);
    return () => { this.listeners.get(key)?.delete(listener as EventListener<EventName>); };
  }

  onAny(listener: (event: EventName, payload: EventMap[EventName], meta: EventMeta) => void | Promise<void>): () => void {
    this.anyListeners.add(listener);
    return () => { this.anyListeners.delete(listener); };
  }

  async close(): Promise<void> {
    this.listeners.clear();
    this.anyListeners.clear();
    if (this.sub) {
      try { await (this.sub as RedisClientWithQuit).quit(); } catch { /* already closed */ }
      this.sub = null;
    }
    if (this.pub) {
      try { await (this.pub as RedisClientWithQuit).quit(); } catch { /* already closed */ }
      this.pub = null;
    }
    this.connected = false;
    this.logger.info('EventBus closed (Redis)');
  }

  /** Trim streams older than retentionDays. Called by scheduler. */
  async trimStreams(eventNames: EventName[]): Promise<void> {
    if (!this.connected || !this.pub) return;
    const cutoffMs = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
    const minId = `${cutoffMs}-0`;
    for (const event of eventNames) {
      try {
        await (this.pub as RedisClientWithXtrim).xtrim(this.streamPrefix + event, 'MINID', minId);
      } catch (err) {
        this.logger.error({ event, err: String(err) }, 'Redis XTRIM failed');
      }
    }
  }

  private dispatchLocal<K extends EventName>(event: K, payload: EventMap[K], meta: EventMeta): void {
    const listeners = this.listeners.get(event as string);
    if (listeners) {
      for (const listener of listeners) {
        try {
          const result = listener(payload, meta);
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch((err) => {
              this.logger.error({ event, err: String(err) }, 'Event listener error');
            });
          }
        } catch (err) {
          this.logger.error({ event, err: String(err) }, 'Event listener error');
        }
      }
    }
    for (const listener of this.anyListeners) {
      try {
        const result = listener(event, payload as EventMap[EventName], meta);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          (result as Promise<void>).catch((err) => {
            this.logger.error({ event, err: String(err) }, 'Wildcard listener error');
          });
        }
      } catch (err) {
        this.logger.error({ event, err: String(err) }, 'Wildcard listener error');
      }
    }
    this.logger.debug({ event, eventId: meta.eventId }, 'Event dispatched');
  }
}

// ── Factory ──

/**
 * Create the appropriate EventBus based on config.
 * If redisUrl is provided, creates a Redis-backed bus. Otherwise in-memory.
 */
export async function createEventBus(
  logger: Logger,
  redisUrl?: string,
  retentionDays?: number,
): Promise<EventBus> {
  if (redisUrl) {
    const bus = new RedisEventBus(redisUrl, logger, retentionDays);
    await bus.connect();
    return bus;
  }
  return new InMemoryEventBus(logger);
}

// ── Redis client type stubs (avoids hard ioredis dependency at compile time) ──

interface RedisClient {
  on(event: string, cb: (...args: unknown[]) => void): void;
}

interface RedisClientWithPublish extends RedisClient {
  publish(channel: string, message: string): Promise<number>;
}

interface RedisClientWithSubscribe extends RedisClient {
  subscribe(...channels: string[]): Promise<number>;
}

interface RedisClientWithMessage extends RedisClient {
  on(event: 'message', cb: (channel: string, message: string) => void): void;
}

interface RedisClientWithXadd extends RedisClient {
  xadd(key: string, ...args: (string | number)[]): Promise<string>;
}

interface RedisClientWithXtrim extends RedisClient {
  xtrim(key: string, strategy: string, ...args: (string | number)[]): Promise<number>;
}

interface RedisClientWithQuit extends RedisClient {
  quit(): Promise<string>;
}
