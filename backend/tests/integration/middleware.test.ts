import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp, AppError } from '../../src/app';
import type { AppConfig } from '../../src/config';
import pino from 'pino';

const logger = pino({ level: 'silent' });

function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    nodeEnv: 'test',
    logLevel: 'silent',
    corsOrigins: '*',
    dbEngine: 'sqlite',
    dbPath: ':memory:',
    dbUrl: '',
    azureBlobConnectionString: 'test',
    azureBlobContainer: 'test',
    azureBotAppId: undefined,
    azureBotAppPassword: undefined,
    slackBotToken: undefined,
    slackSigningSecret: undefined,
    googleChatServiceAccountJson: undefined,
    clickupApiToken: undefined,
    discordBotToken: undefined,
    discordAppId: undefined,
    whatsappPhoneId: undefined,
    whatsappToken: undefined,
    telegramBotToken: undefined,
    smtpHost: undefined,
    smtpPort: 587,
    smtpUser: undefined,
    smtpPass: undefined,
    smtpFrom: undefined,
    llmProvider: undefined,
    llmApiKey: undefined,
    llmBaseUrl: undefined,
    llmModel: undefined,
    azureFaceEndpoint: undefined,
    azureFaceKey: undefined,
    serverBaseUrl: undefined,
    actionLinkSecret: undefined,
    defaultTimezone: 'Asia/Kolkata',
    logicalDayChangeTime: '06:00',
    publicDir: '/tmp/shaavir-test-public',
    migrationsDir: '/tmp/shaavir-test-migrations',
    ...overrides,
  };
}

describe('Health check', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.uptime).toBeTypeOf('number');
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe('404 handler', () => {
  it('returns 404 JSON for unknown API routes', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(res.body.correlationId).toBeTruthy();
  });
});

describe('Correlation ID', () => {
  it('generates a UUID correlation ID when none provided', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/nope');
    expect(res.body.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('uses provided X-Correlation-Id header', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/nope').set('X-Correlation-Id', 'my-custom-id');
    expect(res.body.correlationId).toBe('my-custom-id');
  });
});

describe('CORS', () => {
  it('returns CORS headers with wildcard origins', async () => {
    const app = createApp(testConfig({ corsOrigins: '*' }), logger);
    const res = await request(app).get('/api/health').set('Origin', 'https://example.com');
    expect(res.headers['access-control-allow-origin']).toBeTruthy();
  });

  it('handles preflight OPTIONS requests', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
  });
});

describe('Helmet security headers', () => {
  it('sets security headers on responses', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });
});

describe('Identity extraction', () => {
  it('sets identity from X-User-Email and X-User-Name headers', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.get('/api/test-identity', (req, res) => {
        res.json({ identity: req.identity });
      });
    });
    const res = await request(app)
      .get('/api/test-identity')
      .set('X-User-Email', 'Alice@Example.COM')
      .set('X-User-Name', 'Alice%20Smith');
    expect(res.body.identity.email).toBe('alice@example.com');
    expect(res.body.identity.name).toBe('Alice Smith');
  });

  it('sets identity to null when no email header', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.get('/api/test-identity', (req, res) => {
        res.json({ identity: req.identity });
      });
    });
    const res = await request(app).get('/api/test-identity');
    expect(res.body.identity).toBeNull();
  });

  it('uses email as name when X-User-Name is missing', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.get('/api/test-identity', (req, res) => {
        res.json({ identity: req.identity });
      });
    });
    const res = await request(app).get('/api/test-identity').set('X-User-Email', 'bob@example.com');
    expect(res.body.identity.email).toBe('bob@example.com');
    expect(res.body.identity.name).toBe('bob@example.com');
  });
});

describe('Body parsing', () => {
  it('parses JSON body', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.post('/api/test-body', (req, res) => {
        res.json({ received: req.body });
      });
    });
    const res = await request(app)
      .post('/api/test-body')
      .send({ hello: 'world' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.received.hello).toBe('world');
  });

  it('rejects body larger than 5MB', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.post('/api/test-body', (req, res) => {
        res.json({ size: JSON.stringify(req.body).length });
      });
    });
    const bigPayload = { data: 'x'.repeat(6 * 1024 * 1024) };
    const res = await request(app)
      .post('/api/test-body')
      .send(bigPayload)
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(413);
  });
});

describe('Centralized error handler', () => {
  it('returns operational error with correct status code', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.get('/api/test-op-error', () => {
        throw new AppError('Bad input', 400);
      });
    });
    const res = await request(app).get('/api/test-op-error');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Bad input');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('returns 500 for non-operational errors in production', async () => {
    const app = createApp(testConfig({ nodeEnv: 'production' }), logger, (a) => {
      a.get('/api/test-crash', () => {
        throw new Error('Something broke');
      });
    });
    const res = await request(app).get('/api/test-crash');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    expect(res.body.correlationId).toBeTruthy();
  });

  it('returns actual error message in development', async () => {
    const app = createApp(testConfig({ nodeEnv: 'development' }), logger, (a) => {
      a.get('/api/test-crash', () => {
        throw new Error('Dev debug message');
      });
    });
    const res = await request(app).get('/api/test-crash');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Dev debug message');
  });

  it('handles async errors in route handlers', async () => {
    const app = createApp(testConfig(), logger, (a) => {
      a.get('/api/test-async-error', async (_req, _res, next) => {
        try {
          await Promise.reject(new AppError('Async fail', 422));
        } catch (err) {
          next(err);
        }
      });
    });
    const res = await request(app).get('/api/test-async-error');
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('Async fail');
  });
});

describe('Rate limiting', () => {
  it('returns rate limit headers on API requests', async () => {
    const app = createApp(testConfig(), logger);
    const res = await request(app).get('/api/health');
    expect(res.headers['ratelimit-limit']).toBeTruthy();
    expect(res.headers['ratelimit-remaining']).toBeTruthy();
  });
});
