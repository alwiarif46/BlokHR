#!/usr/bin/env node
/**
 * Probe local school stack readiness against gateway SERVICE_MAP defaults.
 * Usage: npm run check:school
 */

import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

/** Keep in sync with services/gateway/src/config.ts SERVICE_MAP (G-03 covers startup parity). */
const SERVICE_MAP = {
  'school-identity': 3011,
  'school-timetable': 3012,
  'school-attendance': 3013,
  'school-academics': 3014,
  'school-assessment': 3015,
  'school-engagement': 3016,
  'school-fees': 3017,
  'school-transport': 3018,
  'school-compliance': 3019,
  'school-library': 3020,
  learning: 3021,
  'school-surveys': 3022,
  'school-family-ops': 3023,
  'time-tracking': 3030,
  overtime: 3031,
};

const GATEWAY_PORT = Number(process.env.GATEWAY_PORT || 8080);
const MONOLITH_PORT = Number(process.env.MONOLITH_PORT || 3000);
const TIMEOUT_MS = 2500;

/**
 * @param {string} url
 * @returns {Promise<{ ok: boolean, status?: number, error?: string }>}
 */
function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: TIMEOUT_MS }, (res) => {
      res.resume();
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 500, status: res.statusCode });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: err.code || err.message });
    });
  });
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('check:school: run from BlokHR repo root');
    process.exit(2);
  }

  /** @type {{ name: string, url: string }[]} */
  const targets = [
    { name: 'gateway', url: `http://127.0.0.1:${GATEWAY_PORT}/healthz` },
    { name: 'monolith', url: `http://127.0.0.1:${MONOLITH_PORT}/api/health` },
  ];

  for (const [name, port] of Object.entries(SERVICE_MAP)) {
    targets.push({ name, url: `http://127.0.0.1:${port}/health` });
  }

  console.log('School stack readiness\n');

  let failed = 0;
  for (const t of targets) {
    const result = await probe(t.url);
    if (result.ok) {
      console.log(`  OK   ${t.name.padEnd(22)} ${t.url} (${result.status})`);
    } else {
      failed += 1;
      const detail = result.error || `status ${result.status}`;
      console.log(`  FAIL ${t.name.padEnd(22)} ${t.url} — ${detail}`);
    }
  }

  console.log('');
  if (failed) {
    console.log(
      `${failed} target(s) unavailable. Start the full stack with:\n  npm run dev:school\nThen re-run:\n  npm run check:school`,
    );
    process.exit(1);
  }
  console.log('All configured services are healthy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
