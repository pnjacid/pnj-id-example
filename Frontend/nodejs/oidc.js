import { createHash, randomBytes } from 'node:crypto';

export function randomUrlSafe(size = 32) {
  return randomBytes(size).toString('base64url');
}

export function codeChallenge(verifier) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export async function loadProvider(issuer) {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!response.ok) throw new Error(`OIDC discovery gagal (${response.status})`);
  return response.json();
}

export function endSessionUrl(provider, idToken) {
  if (!provider.end_session_endpoint) throw new Error('Provider tidak menyediakan endpoint logout OIDC');
  const url = new URL(provider.end_session_endpoint);
  if (idToken) url.searchParams.set('id_token_hint', idToken);
  return url.toString();
}
