import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createSign } from 'crypto';
import { verifyRs256Jwt, type JwkSet } from '../../src/auth/jwt-verify';

function signRs256(payload: Record<string, unknown>, privateKey: string, kid: string): string {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const h = Buffer.from(JSON.stringify(header)).toString('base64url');
  const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  signer.end();
  const sig = signer.sign(privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}

describe('verifyRs256Jwt', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const jwks: JwkSet = { keys: [{ ...jwk, kid: 'test-key', kty: 'RSA' }] };

  it('accepts a signature that matches the JWKS key', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRs256(
      {
        email: 'alice@example.com',
        aud: 'client-1',
        iss: 'https://idp.example.com',
        exp: now + 300,
      },
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      'test-key',
    );
    const claims = await verifyRs256Jwt(token, {
      jwksUri: 'https://idp.example.com/jwks',
      audience: 'client-1',
      issuer: 'https://idp.example.com',
      fetchJwks: async () => jwks,
    });
    expect(claims.email).toBe('alice@example.com');
  });

  it('rejects an unsigned three-part token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({ email: 'forged@example.com', aud: 'client-1', exp: Math.floor(Date.now() / 1000) + 300 }),
    ).toString('base64url');
    await expect(
      verifyRs256Jwt(`${header}.${payload}.fakesig`, {
        jwksUri: 'https://idp.example.com/jwks',
        audience: 'client-1',
        fetchJwks: async () => jwks,
      }),
    ).rejects.toThrow(/signature|encoding|algorithm/i);
  });

  it('rejects a wrong audience', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signRs256(
      { email: 'alice@example.com', aud: 'other-client', exp: now + 300 },
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      'test-key',
    );
    await expect(
      verifyRs256Jwt(token, {
        jwksUri: 'https://idp.example.com/jwks',
        audience: 'client-1',
        fetchJwks: async () => jwks,
      }),
    ).rejects.toThrow(/audience/i);
  });
});
