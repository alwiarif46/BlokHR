#!/usr/bin/env node
/**
 * Apply Google App Password from secrets into backend/.env SMTP_PASS.
 * Usage: node scripts/apply-smtp-secret.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'backend', '.env');
const secretPath = path.join(os.homedir(), '.shaavir', 'secrets', 'blokhr-smtp-pass.txt');

if (!fs.existsSync(secretPath)) {
  console.error('Missing', secretPath);
  process.exit(1);
}
const lines = fs
  .readFileSync(secretPath, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));
const pass = (lines[0] || '').replace(/\s+/g, '');
if (pass.length < 8) {
  console.error('blokhr-smtp-pass.txt has no App Password yet (paste the 16-char value).');
  process.exit(2);
}
if (!fs.existsSync(envPath)) {
  console.error('Missing', envPath);
  process.exit(1);
}
let env = fs.readFileSync(envPath, 'utf8');
if (/^SMTP_PASS=/m.test(env)) {
  env = env.replace(/^SMTP_PASS=.*$/m, `SMTP_PASS=${pass}`);
} else {
  env = env.replace(/^(SMTP_FROM=.*)$/m, `$1\nSMTP_PASS=${pass}`);
}
fs.writeFileSync(envPath, env);
console.log('SMTP_PASS applied to backend/.env from secrets file.');
