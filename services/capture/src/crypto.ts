import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import type { CaptureDb } from './db';

const ALGO = 'aes-256-gcm';

/** Per-tenant AES key stored in capture DB (dev/self-hosted). Rotate via ops. */
export async function getOrCreateTenantKey(db: CaptureDb, tenantId: string): Promise<Buffer> {
  const row = await db.get<{ key_hex: string }>(
    'SELECT key_hex FROM tenant_crypto_keys WHERE tenant_id = ?',
    [tenantId],
  );
  if (row?.key_hex) return Buffer.from(row.key_hex, 'hex');
  const key = randomBytes(32);
  await db.run('INSERT INTO tenant_crypto_keys (tenant_id, key_hex) VALUES (?, ?)', [
    tenantId,
    key.toString('hex'),
  ]);
  return key;
}

export function encryptPayload(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptPayload(key: Buffer, ciphertextB64: string): string {
  const buf = Buffer.from(ciphertextB64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** Constant-time compare for exact ID match modalities (qr/nfc). */
export function payloadsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Simple template similarity for face/fingerprint stubs (cosine-ish on bytes). */
export function templateScore(aB64: string, bB64: string): number {
  try {
    const a = Buffer.from(aB64, 'base64');
    const b = Buffer.from(bB64, 'base64');
    if (!a.length || !b.length) return 0;
    const n = Math.min(a.length, b.length);
    let same = 0;
    for (let i = 0; i < n; i++) if (a[i] === b[i]) same++;
    return same / Math.max(a.length, b.length);
  } catch {
    return 0;
  }
}

export function deriveDeviceSecret(seed: string): string {
  return scryptSync(seed, 'blokhr-capture', 16).toString('hex');
}
