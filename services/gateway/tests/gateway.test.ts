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
import { StaffIntrospectUnavailableError } from '../src/guards/staff-introspect';

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
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: async () => ({
        active: true,
        email: 'staff@school.edu',
        name: 'Staff',
        tenantId: 'default',
        isAdmin: false,
        isGlobalManager: false,
        isGlobalHR: false,
        managerOf: [],
        hrOf: [],
        role: 'teacher',
        memberId: 'mem-1',
      }),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer staff-tok');
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
    const { app } = createGatewayApp({
      config: deadConfig,
      logger,
      staffIntrospect: async () => ({
        active: true,
        email: 'staff@school.edu',
        name: 'Staff',
        tenantId: 'default',
        isAdmin: false,
        isGlobalManager: false,
        isGlobalHR: false,
        managerOf: [],
        hrOf: [],
        role: 'teacher',
        memberId: null,
      }),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer staff-tok');
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
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: async () => ({
        active: true,
        email: 'staff@school.edu',
        name: 'Staff',
        tenantId: 'tenant-real',
        isAdmin: false,
        isGlobalManager: false,
        isGlobalHR: false,
        managerOf: [],
        hrOf: [],
        role: 'office',
        memberId: 'mem-9',
      }),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer staff-tok')
      .set('X-Blok-Tenant', 'spoofed-tenant')
      .set('X-Blok-Role', 'admin');
    expect(res.status).toBe(200);
    // Spoofed inbound stripped; gateway-set staff headers win
    expect(res.body.headers['x-blok-tenant']).toBe('tenant-real');
    expect(res.body.headers['x-blok-role']).toBe('office');
    expect(res.body.headers['x-blok-principal']).toBe('staff');
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
  it('names monolith, identity, timetable, academics, and gateway processes', () => {
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
    expect(script).toMatch(/academics/i);
    expect(script).toMatch(/gateway/i);
    expect(script).toContain('backend');
    expect(script).toContain('school-identity');
    expect(script).toContain('school-timetable');
    expect(script).toContain('school-academics');
    expect(script).toContain('services/gateway');
  });
});

describe('Gateway P9-02 — guardian principal guard', () => {
  let frontendDir: string;
  let echoServer: http.Server;
  let monolithServer: http.Server;
  let echoPort: number;
  let monolithPort: number;
  let config: GatewayConfig;
  let introspectCalls: number;
  let introspectMode: 'active' | 'inactive' | 'down';

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
      baseEnv(monolithPort, echoPort, frontendDir),
      path.resolve(__dirname, '..'),
    );
    introspectCalls = 0;
    introspectMode = 'active';
  });

  afterEach(async () => {
    await close(echoServer);
    await close(monolithServer);
    fs.rmSync(frontendDir, { recursive: true, force: true });
  });

  function stubIntrospect() {
    return async () => {
      introspectCalls += 1;
      if (introspectMode === 'down') {
        throw new Error('identity down');
      }
      if (introspectMode === 'inactive') {
        return { active: false as const };
      }
      return {
        active: true as const,
        tenantId: 'tenant-from-token',
        guardianId: 'guardian-from-token',
        studentIds: ['stu-linked-1', 'stu-9'],
      };
    };
  }

  it('allowlist happy paths inject guardian headers from introspect', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    const students = await request(app)
      .get('/guardian/me/students')
      .set('Authorization', 'Bearer good-token')
      .set('X-Blok-Guardian', 'spoofed-guardian');
    expect(students.status).toBe(200);
    expect(students.body.path).toBe(
      '/api/identity/tenant-from-token/guardians/guardian-from-token/students',
    );
    expect(students.body.headers['x-blok-principal']).toBe('guardian');
    expect(students.body.headers['x-blok-guardian']).toBe('guardian-from-token');
    expect(students.body.headers['x-blok-tenant']).toBe('tenant-from-token');
    expect(students.body.headers['x-blok-students']).toBe('stu-linked-1,stu-9');
    expect(students.body.headers['x-blok-internal']).toBe('gw-test-secret');

    const attendance = await request(app)
      .get('/guardian/students/stu-9/attendance?from=2026-01-01')
      .set('Authorization', 'Bearer good-token');
    expect(attendance.status).toBe(200);
    expect(attendance.body.path).toBe(
      '/api/attendance/tenant-from-token/guardian/students/stu-9/summary?from=2026-01-01',
    );

    const absence = await request(app)
      .post('/guardian/reported-absences')
      .set('Authorization', 'Bearer good-token')
      .send({ student_id: 'stu-9' });
    expect(absence.status).toBe(200);
    expect(absence.body.path).toBe(
      '/api/attendance/tenant-from-token/reported-absences',
    );
    expect(absence.body.method).toBe('POST');

    const threads = await request(app)
      .get('/guardian/threads?state=open')
      .set('Authorization', 'Bearer good-token');
    expect(threads.status).toBe(200);
    expect(threads.body.path).toContain(
      '/api/engagement/tenant-from-token/threads?',
    );
    expect(threads.body.path).toContain('guardian_ref=guardian-from-token');
    expect(threads.body.path).toContain('state=open');

    const surveys = await request(app)
      .get('/guardian/surveys')
      .set('Authorization', 'Bearer good-token');
    expect(surveys.status).toBe(200);
    expect(surveys.body.path).toBe(
      '/api/surveys/tenant-from-token/guardian/pending',
    );
    expect(surveys.body.headers['x-blok-principal']).toBe('guardian');

    const surveyOne = await request(app)
      .get('/guardian/surveys/sv-1')
      .set('Authorization', 'Bearer good-token');
    expect(surveyOne.status).toBe(200);
    expect(surveyOne.body.path).toBe(
      '/api/surveys/tenant-from-token/guardian/surveys/sv-1',
    );

    const respond = await request(app)
      .post('/guardian/surveys/sv-1/respond')
      .set('Authorization', 'Bearer good-token')
      .send({ answers: { q1: 5 }, student_ref: 'stu-9' });
    expect(respond.status).toBe(200);
    expect(respond.body.path).toBe(
      '/api/surveys/tenant-from-token/guardian/surveys/sv-1/respond',
    );
    expect(respond.body.method).toBe('POST');

    const diary = await request(app)
      .get('/guardian/diary?student_ref=stu-9&from=2026-01-01')
      .set('Authorization', 'Bearer good-token');
    expect(diary.status).toBe(200);
    expect(diary.body.path).toBe(
      '/api/engagement/tenant-from-token/guardian/diary?student_ref=stu-9&from=2026-01-01',
    );
    expect(diary.body.headers['x-blok-students']).toBe('stu-linked-1,stu-9');

    const diaryAck = await request(app)
      .post('/guardian/diary/entry-1/ack')
      .set('Authorization', 'Bearer good-token')
      .send({ student_ref: 'stu-9' });
    expect(diaryAck.status).toBe(200);
    expect(diaryAck.body.path).toBe(
      '/api/engagement/tenant-from-token/guardian/diary/entry-1/ack',
    );
    expect(diaryAck.body.method).toBe('POST');
  });

  it('diary student_ref must be a linked child', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    const own = await request(app)
      .get('/guardian/diary?student_ref=stu-linked-1')
      .set('Authorization', 'Bearer good-token');
    expect(own.status).toBe(200);

    const other = await request(app)
      .get('/guardian/diary?student_ref=not-my-child')
      .set('Authorization', 'Bearer good-token');
    expect(other.status).toBe(403);
    expect(other.body.error).toBe('forbidden');
  });

  it('deny matrix: guardian cannot reach non-guardian paths', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    for (const path of [
      '/api/members',
      '/svc/school-identity/api/identity/t1/students',
      '/api/settings',
    ]) {
      const byHeader = await request(app)
        .get(path)
        .set('X-Blok-Principal', 'guardian');
      expect(byHeader.status).toBe(403);
      expect(byHeader.body.error).toBe('guardian_scope');

      const byToken = await request(app)
        .get(path)
        .set('Authorization', 'Bearer good-token');
      expect(byToken.status).toBe(403);
      expect(byToken.body.error).toBe('guardian_scope');
    }
  });

  it('expired/inactive token → 401; introspect down → 503', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    introspectMode = 'inactive';
    const unauthorized = await request(app)
      .get('/guardian/me/students')
      .set('Authorization', 'Bearer dead-token');
    expect(unauthorized.status).toBe(401);

    introspectMode = 'down';
    const down = await request(app)
      .get('/guardian/me/students')
      .set('Authorization', 'Bearer any');
    expect(down.status).toBe(503);
    expect(down.body.error).toBe('introspect_unavailable');
  });

  it('cache hit skips second introspect call', async () => {
    const { app, introspectCache } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    await request(app)
      .get('/guardian/me/students')
      .set('Authorization', 'Bearer cached-token');
    await request(app)
      .get('/guardian/me/students')
      .set('Authorization', 'Bearer cached-token');

    expect(introspectCalls).toBe(1);
    expect(introspectCache.callCount).toBe(1);
  });

  it('IDENTITY_URL defaults to school-identity service URL', () => {
    expect(config.identityUrl).toBe(config.serviceUrls['school-identity']);
  });

  it('serves guardian.html at /guardian and proxies login without bearer', async () => {
    fs.writeFileSync(
      path.join(frontendDir, 'guardian.html'),
      '<!doctype html><html><body>guardian-portal-ok</body></html>',
      'utf8',
    );
    const { app } = createGatewayApp({
      config,
      logger,
      introspect: stubIntrospect(),
    });

    const page = await request(app).get('/guardian');
    expect(page.status).toBe(200);
    expect(page.text).toContain('guardian-portal-ok');

    const login = await request(app)
      .post('/guardian/login')
      .send({ phone: '999', password: 'x' });
    expect(login.status).toBe(200);
    expect(login.body.path).toBe('/api/identity/guardian-auth/login');
    expect(login.body.method).toBe('POST');
  });
});

describe('Gateway P12-02 — staff guard', () => {
  let frontendDir: string;
  let echoServer: http.Server;
  let monolithServer: http.Server;
  let echoPort: number;
  let monolithPort: number;
  let config: GatewayConfig;
  let staffMode: 'active' | 'inactive' | 'down' | 'active-no-member';

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
      baseEnv(monolithPort, echoPort, frontendDir),
      path.resolve(__dirname, '..'),
    );
    staffMode = 'active';
  });

  afterEach(async () => {
    await close(echoServer);
    await close(monolithServer);
    fs.rmSync(frontendDir, { recursive: true, force: true });
  });

  function stubStaff() {
    return async () => {
      if (staffMode === 'down') {
        throw new StaffIntrospectUnavailableError();
      }
      if (staffMode === 'inactive') {
        return { active: false as const };
      }
      if (staffMode === 'active-no-member') {
        return {
          active: true as const,
          email: 'legacy@school.edu',
          name: 'Legacy',
          tenantId: 't1',
          isAdmin: true,
          isGlobalManager: true,
          isGlobalHR: true,
          managerOf: [] as string[],
          hrOf: [] as string[],
          role: 'admin' as const,
          memberId: null,
        };
      }
      return {
        active: true as const,
        email: 'teach@school.edu',
        name: 'Teach',
        tenantId: 't1',
        isAdmin: false,
        isGlobalManager: false,
        isGlobalHR: false,
        managerOf: [] as string[],
        hrOf: [] as string[],
        role: 'teacher' as const,
        memberId: 'mem-teach',
      };
    };
  }

  it('no token → 401 on /svc', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app).get('/svc/school-identity/api/identity/t1/students');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('introspect down → 503 fail-closed', async () => {
    staffMode = 'down';
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer x');
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('introspect_unavailable');
  });

  it('inactive token → 401', async () => {
    staffMode = 'inactive';
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer dead');
    expect(res.status).toBe(401);
  });

  it('active staff sets exact X-Blok-* headers; strips spoofed role', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/identity/t1/students')
      .set('Authorization', 'Bearer good')
      .set('X-Blok-Role', 'admin')
      .set('X-Blok-Email', 'spoof@evil');
    expect(res.status).toBe(200);
    expect(res.body.headers['x-blok-principal']).toBe('staff');
    expect(res.body.headers['x-blok-email']).toBe('teach@school.edu');
    expect(res.body.headers['x-blok-role']).toBe('teacher');
    expect(res.body.headers['x-blok-admin']).toBe('0');
    expect(res.body.headers['x-blok-tenant']).toBe('t1');
    expect(res.body.headers['x-blok-member']).toBe('mem-teach');
    expect(res.body.headers['x-blok-internal']).toBe('gw-test-secret');
  });

  it('directory-miss fallback role (admin via claims, no member header)', async () => {
    staffMode = 'active-no-member';
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app)
      .get('/svc/school-identity/api/x')
      .set('Authorization', 'Bearer good');
    expect(res.status).toBe(200);
    expect(res.body.headers['x-blok-role']).toBe('admin');
    expect(res.body.headers['x-blok-admin']).toBe('1');
    expect(res.body.headers['x-blok-member']).toBeUndefined();
  });

  it('PUBLIC_PATHS pass without token; sibling paths do not', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });

    const boarding = await request(app).post(
      '/svc/school-transport/api/transport/t1/boarding',
    );
    expect(boarding.status).toBe(200);

    const pings = await request(app).post('/svc/school-transport/api/transport/t1/pings');
    expect(pings.status).toBe(200);

    const capture = await request(app).post(
      '/svc/school-attendance/api/attendance/t1/capture',
    );
    expect(capture.status).toBe(200);

    const prune = await request(app).post(
      '/svc/school-transport/api/transport/t1/pings/prune',
    );
    expect(prune.status).toBe(401);

    const mark = await request(app).post(
      '/svc/school-attendance/api/attendance/t1/mark',
    );
    expect(mark.status).toBe(401);
  });

  it('blocks /api/auth/introspect from outside with 404', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
    });
    const res = await request(app)
      .post('/api/auth/introspect')
      .send({ token: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('whoami: staff / anonymous / guardian-as-anonymous', async () => {
    const { app } = createGatewayApp({
      config,
      logger,
      staffIntrospect: stubStaff(),
      introspect: async () => ({
        active: true,
        tenantId: 't1',
        guardianId: 'g1',
        studentIds: ['s1'],
      }),
    });

    const anon = await request(app).get('/whoami');
    expect(anon.body).toEqual({ principal: 'anonymous' });

    const staff = await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer staff');
    expect(staff.body).toMatchObject({
      principal: 'staff',
      email: 'teach@school.edu',
      role: 'teacher',
      isAdmin: false,
      tenantId: 't1',
      memberId: 'mem-teach',
    });

    staffMode = 'inactive';
    const guardianTok = await request(app)
      .get('/whoami')
      .set('Authorization', 'Bearer guardian-tok');
    expect(guardianTok.body).toEqual({ principal: 'anonymous' });
  });
});
