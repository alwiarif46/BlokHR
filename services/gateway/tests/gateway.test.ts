import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import pino from 'pino';
import type { AddressInfo } from 'net';
import { createGatewayApp } from '../src/index';
import { loadGatewayConfig, SERVICE_NAMES, type GatewayConfig, type ServiceName } from '../src/config';

const logger = pino({ level: 'silent' });

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve(addr.port);
    });
    server.on('error', reject);
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Stub that echoes method, path, and selected headers. */
function createEchoServer(): http.Server {
  return http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const headers: Record<string, string | string[] | undefined> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        headers[k.toLowerCase()] = v;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          method: req.method,
          path: req.url,
          service: 'echo',
          headers,
        }),
      );
    });
  });
}

function baseEnv(
  monolithPort: number,
  echoPort: number,
  frontendDir: string,
  extra: NodeJS.ProcessEnv = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: 'test',
    PORT: '8080',
    MONOLITH_URL: `http://127.0.0.1:${monolithPort}`,
    FRONTEND_DIR: frontendDir,
    INTERNAL_SECRET: 'gw-test-secret',
    ...extra,
  };
  for (const name of SERVICE_NAMES) {
    const key = `SVC_${name.replace(/-/g, '_').toUpperCase()}_URL`;
    env[key] = `http://127.0.0.1:${echoPort}`;
  }
  return env;
}

describe('Gateway G-01', () => {
  let frontendDir: string;
  let echoServer: http.Server;
  let monolithServer: http.Server;
  let echoPort: number;
  let monolithPort: number;
  let config: GatewayConfig;

  beforeEach(async () => {
    frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blokhr-gw-fe-'));
    fs.writeFileSync(
      path.join(frontendDir, 'shell.html'),
      '<!doctype html><html><body>shell-ok</body></html>',
      'utf8',
    );
    fs.writeFileSync(path.join(frontendDir, 'shared.css'), '/* asset */', 'utf8');

    echoServer = createEchoServer();
    monolithServer = createEchoServer();
    echoPort = await listen(echoServer);
    monolithPort = await listen(monolithServer);

    config = loadGatewayConfig(
      baseEnv(monolithPort, echoPort, frontendDir),
      path.resolve(__dirname, '..'),
    );
  });

  afterEach(async () => {
    await close(echoServer);
    await close(monolithServer);
    fs.rmSync(frontendDir, { recursive: true, force: true });
  });

  it('GET /healthz returns ok and service map keys', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.services).toEqual([...SERVICE_NAMES]);
  });

  it('rewrites /svc/:service path when proxying', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/svc/school-identity/api/identity/t1/students');
    expect(res.status).toBe(200);
    expect(res.body.path).toBe('/api/identity/t1/students');
    expect(res.body.method).toBe('GET');
  });

  it('returns 404 for unknown service without proxying', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/svc/not-a-service/api/x');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('unknown_service');
  });

  it('proxies /api/* to the monolith unchanged', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/api/setup/status');
    expect(res.status).toBe(200);
    expect(res.body.path).toBe('/api/setup/status');
  });

  it('serves shell.html at /', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('shell-ok');
  });

  it('serves shell.html as history-mode fallback for extensionless paths', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/attendance');
    expect(res.status).toBe(200);
    expect(res.text).toContain('shell-ok');
  });

  it('returns 502 when upstream is down', async () => {
    const deadPort = echoPort;
    await close(echoServer);
    const deadUrls = {} as GatewayConfig['serviceUrls'];
    for (const name of SERVICE_NAMES) {
      deadUrls[name as ServiceName] = `http://127.0.0.1:${deadPort}`;
    }
    const deadConfig: GatewayConfig = {
      ...config,
      serviceUrls: deadUrls,
    };
    const { app } = createGatewayApp({ config: deadConfig, logger });
    const res = await request(app).get('/svc/school-identity/api/identity/t1/students');
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('upstream_unavailable');
    expect(res.body.service).toBe('school-identity');
    echoServer = http.createServer();
    await listen(echoServer);
  });
});

describe('Gateway G-02 — header hygiene', () => {
  let frontendDir: string;
  let echoServer: http.Server;
  let monolithServer: http.Server;
  let echoPort: number;
  let monolithPort: number;
  let config: GatewayConfig;

  beforeEach(async () => {
    frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blokhr-gw-fe-'));
    fs.writeFileSync(
      path.join(frontendDir, 'shell.html'),
      '<!doctype html><html><body>shell-ok</body></html>',
      'utf8',
    );
    echoServer = createEchoServer();
    monolithServer = createEchoServer();
    echoPort = await listen(echoServer);
    monolithPort = await listen(monolithServer);
    config = loadGatewayConfig(
      baseEnv(monolithPort, echoPort, frontendDir, { INTERNAL_SECRET: 'gw-test-secret' }),
      path.resolve(__dirname, '..'),
    );
  });

  afterEach(async () => {
    await close(echoServer);
    await close(monolithServer);
    fs.rmSync(frontendDir, { recursive: true, force: true });
  });

  it('strips inbound X-Blok-Tenant spoof before upstream', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('X-Blok-Tenant', 'spoofed-tenant');
    expect(res.status).toBe(200);
    expect(res.body.headers['x-blok-tenant']).toBeUndefined();
  });

  it('injects X-Blok-Internal with configured secret', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app).get('/api/setup/status');
    expect(res.status).toBe(200);
    expect(res.body.headers['x-blok-internal']).toBe('gw-test-secret');
  });

  it('forwards Authorization, X-User-Email, X-User-Name byte-identical', async () => {
    const { app } = createGatewayApp({ config, logger });
    const res = await request(app)
      .get('/api/auth/providers')
      .set('Authorization', 'Bearer tok-abc-123')
      .set('X-User-Email', 'alice@school.edu')
      .set('X-User-Name', 'Alice Teacher');
    expect(res.status).toBe(200);
    expect(res.body.headers.authorization).toBe('Bearer tok-abc-123');
    expect(res.body.headers['x-user-email']).toBe('alice@school.edu');
    expect(res.body.headers['x-user-name']).toBe('Alice Teacher');
  });
});

describe('loadGatewayConfig', () => {
  it('fails fast on malformed PORT', () => {
    expect(() =>
      loadGatewayConfig({
        NODE_ENV: 'test',
        PORT: 'nope',
        MONOLITH_URL: 'http://localhost:3000',
      }),
    ).toThrow(/PORT/);
  });

  it('fails fast on malformed MONOLITH_URL', () => {
    expect(() =>
      loadGatewayConfig({ NODE_ENV: 'test', PORT: '8080', MONOLITH_URL: 'not-a-url' }),
    ).toThrow(/MONOLITH_URL/);
  });

  it('fails fast when INTERNAL_SECRET is missing outside test env', () => {
    expect(() =>
      loadGatewayConfig({
        NODE_ENV: 'production',
        PORT: '8080',
        MONOLITH_URL: 'http://localhost:3000',
      }),
    ).toThrow(/INTERNAL_SECRET/);
  });

  it('allows missing INTERNAL_SECRET when NODE_ENV=test', () => {
    const cfg = loadGatewayConfig({
      NODE_ENV: 'test',
      PORT: '8080',
      MONOLITH_URL: 'http://localhost:3000',
    });
    expect(cfg.internalSecret).toBe('test-internal-secret');
  });
});

describe('Gateway G-03 — SSE passthrough', () => {
  let frontendDir: string;
  let sseServer: http.Server;
  let echoServer: http.Server;
  let ssePort: number;
  let echoPort: number;
  let config: GatewayConfig;
  let gatewayServer: http.Server;
  let gatewayPort: number;

  beforeEach(async () => {
    frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blokhr-gw-fe-'));
    fs.writeFileSync(
      path.join(frontendDir, 'shell.html'),
      '<!doctype html><html><body>shell-ok</body></html>',
      'utf8',
    );

    sseServer = http.createServer((req, res) => {
      const pathOnly = (req.url || '').split('?')[0];
      if (pathOnly !== '/api/sse/stream') {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('event: ping\ndata: one\n\n');
      setTimeout(() => {
        res.write('event: ping\ndata: two\n\n');
        res.end();
      }, 100);
    });
    echoServer = createEchoServer();
    ssePort = await listen(sseServer);
    echoPort = await listen(echoServer);

    config = loadGatewayConfig(
      baseEnv(ssePort, echoPort, frontendDir),
      path.resolve(__dirname, '..'),
    );

    const { app } = createGatewayApp({ config, logger });
    gatewayServer = http.createServer(app);
    gatewayPort = await listen(gatewayServer);
  });

  afterEach(async () => {
    await close(gatewayServer);
    await close(sseServer);
    await close(echoServer);
    fs.rmSync(frontendDir, { recursive: true, force: true });
  });

  it('streams SSE events incrementally without buffering', async () => {
    const seen: string[] = [];
    const seenAt: number[] = [];
    const started = Date.now();

    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${gatewayPort}/api/sse/stream?email=a%40b.com`,
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(String(res.headers['content-type'] || '')).toMatch(/text\/event-stream/);
          expect(String(res.headers['connection'] || '').toLowerCase()).toContain('keep-alive');

          let buf = '';
          res.on('data', (chunk: Buffer) => {
            buf += chunk.toString('utf8');
            if (buf.includes('data: one') && !seen.includes('one')) {
              seen.push('one');
              seenAt.push(Date.now() - started);
            }
            if (buf.includes('data: two') && !seen.includes('two')) {
              seen.push('two');
              seenAt.push(Date.now() - started);
              req.destroy();
              resolve();
            }
          });
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      setTimeout(() => reject(new Error('SSE stream timed out')), 5000);
    });

    expect(seen).toEqual(['one', 'two']);
    // Second event is emitted 100ms after the first — must not arrive in one buffered burst at t≈100.
    expect(seenAt[0]).toBeLessThan(80);
    expect(seenAt[1]! - seenAt[0]!).toBeGreaterThanOrEqual(80);
  });
});

describe('Gateway G-03 — root dev:school script', () => {
  it('names monolith, identity, timetable, and gateway processes', () => {
    const rootPkgPath = path.resolve(__dirname, '../../../package.json');
    const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8')) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies?.concurrently).toBeTruthy();
    const script = pkg.scripts?.['dev:school'] || '';
    expect(script).toContain('concurrently');
    expect(script).toMatch(/monolith/i);
    expect(script).toMatch(/identity/i);
    expect(script).toMatch(/timetable/i);
    expect(script).toMatch(/gateway/i);
    expect(script).toContain('backend');
    expect(script).toContain('school-identity');
    expect(script).toContain('school-timetable');
    expect(script).toContain('services/gateway');
  });
});
