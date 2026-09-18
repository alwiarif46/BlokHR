import { createPublicKey, createVerify } from 'crypto';

export interface Jwk {
  kty?: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
}

export interface JwkSet {
  keys: Jwk[];
}

export interface JwtVerifyOptions {
  jwksUri: string;
  audience?: string | string[];
  issuer?: string | string[];
  /** Test hook — skip network. */
  fetchJwks?: (uri: string) => Promise<JwkSet>;
}

function decodeBase64UrlJson(part: string): Record<string, unknown> {
  const json = Buffer.from(part, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

function matchesClaim(expected: string | string[] | undefined, actual: unknown): boolean {
  if (expected === undefined) return true;
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (typeof actual === 'string') return allowed.includes(actual);
  if (Array.isArray(actual)) {
    return actual.some((value) => typeof value === 'string' && allowed.includes(value));
  }
  return false;
}

async function defaultFetchJwks(uri: string): Promise<JwkSet> {
  const res = await fetch(uri, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error('Unable to load signing keys');
  }
  const body = (await res.json()) as JwkSet;
  if (!body || !Array.isArray(body.keys)) {
    throw new Error('Invalid JWKS document');
  }
  return body;
}

/**
 * Verify an RS256 JWT against a JWKS endpoint. Rejects unsigned, expired,
 * audience-mismatched, and issuer-mismatched tokens.
 */
export async function verifyRs256Jwt(
  token: string,
  opts: JwtVerifyOptions,
): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeBase64UrlJson(parts[0]);
    payload = decodeBase64UrlJson(parts[1]);
  } catch {
    throw new Error('Invalid token encoding');
  }

  if (header.alg !== 'RS256') {
    throw new Error('Unsupported JWT algorithm');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && payload.exp < now) {
    throw new Error('Token expired');
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    throw new Error('Token not yet valid');
  }
  if (!matchesClaim(opts.issuer, payload.iss)) {
    throw new Error('Invalid token issuer');
  }
  if (!matchesClaim(opts.audience, payload.aud)) {
    throw new Error('Invalid token audience');
  }

  const fetchJwks = opts.fetchJwks ?? defaultFetchJwks;
  const jwks = await fetchJwks(opts.jwksUri);
  const kid = typeof header.kid === 'string' ? header.kid : '';
  const jwk = jwks.keys.find((key) => {
    if (key.kty !== 'RSA') return false;
    if (kid && key.kid && key.kid !== kid) return false;
    return true;
  });
  if (!jwk) {
    throw new Error('Signing key not found');
  }

  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const signature = Buffer.from(parts[2], 'base64url');
  if (!verifier.verify(key, signature)) {
    throw new Error('Invalid token signature');
  }

  return payload;
}

export async function discoverOidcJwksUri(
  issuerUrl: string,
  fetchDoc?: (uri: string) => Promise<{ jwks_uri?: string }>,
): Promise<string> {
  const issuer = issuerUrl.replace(/\/+$/, '');
  const wellKnown = `${issuer}/.well-known/openid-configuration`;
  const loader =
    fetchDoc ??
    (async (uri: string) => {
      const res = await fetch(uri, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Unable to load OpenID configuration');
      return (await res.json()) as { jwks_uri?: string };
    });
  const doc = await loader(wellKnown);
  if (!doc.jwks_uri) {
    throw new Error('OpenID configuration missing jwks_uri');
  }
  return doc.jwks_uri;
}
