import { createRemoteJWKSet, jwtVerify } from 'jose';

const issuer = process.env.OIDC_ISSUER ?? 'https://dev-id.pnj.ac.id/cas/oidc';
const clientId = process.env.OIDC_CLIENT_ID ?? 'al-localhost5173testread-1012';
const requiredScope = 'test.read';
const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`));

export function hasScope(payload, requiredScope) {
  const scopes = Array.isArray(payload.scope)
    ? payload.scope
    : String(payload.scope ?? '').split(' ');

  return scopes.includes(requiredScope);
}

export async function verifyAccessToken(token) {
  if (token.split('.').length === 3) {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    if (!hasScope(payload, requiredScope)) {
      throw new Error(`Token tidak memiliki scope ${requiredScope}`);
    }
    return payload;
  }

  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  if (!clientSecret) throw new Error('OIDC_CLIENT_SECRET belum dikonfigurasi');

  const response = await fetch(`${issuer}/introspect`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({ token })
  });

  if (!response.ok) {
    throw new Error(`Introspection token gagal (${response.status})`);
  }

  const payload = await response.json();
  if (!payload.active) throw new Error('Token tidak aktif');
  if (payload.client_id !== clientId) throw new Error('Token diterbitkan untuk client lain');
  if (!hasScope(payload, requiredScope)) throw new Error(`Token tidak memiliki scope ${requiredScope}`);
  return payload;
}
