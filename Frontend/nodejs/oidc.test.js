import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { oidc, completeLogin, pnjClientSecretBasic } from './oidc.js';

test('PNJ Basic authentication preserves special characters in credentials', () => {
  const headers = new Headers();
  const body = new URLSearchParams();
  pnjClientSecretBasic('test+secret!%')({}, { client_id: 'test-client' }, body, headers);
  const credentials = Buffer.from(headers.get('authorization').slice(6), 'base64').toString();
  assert.equal(credentials, 'test-client:test+secret!%');
  assert.equal(body.has('client_secret'), false);
});

test('OIDC validates signed ID token, claims, state, and UserInfo subject', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const issuer = 'https://provider.example';
  const transaction = { state: 'expected-state', nonce: 'expected-nonce', codeVerifier: 'a'.repeat(43) };
  const config = new oidc.Configuration({
    issuer, token_endpoint: `${issuer}/token`, jwks_uri: `${issuer}/jwks`,
    userinfo_endpoint: `${issuer}/userinfo`, id_token_signing_alg_values_supported: ['RS256']
  }, 'test-client', 'test-secret', pnjClientSecretBasic('test-secret'));
  oidc.enableNonRepudiationChecks(config);
  let changes = {};
  let invalidSignature = false;
  let subject = 'test-user';
  config[oidc.customFetch] = async input => {
    const url = input.toString();
    let body;
    if (url.endsWith('/jwks')) body = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'key', alg: 'RS256', use: 'sig' }] };
    else if (url.endsWith('/userinfo')) body = { sub: subject, email: 'test@example.com' };
    else {
      const now = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const message = `${encode({ alg: 'RS256', kid: 'key' })}.${encode({ iss: issuer, aud: 'test-client', sub: 'test-user', iat: now, exp: now + 300, nonce: transaction.nonce, ...changes })}`;
      const signature = invalidSignature ? Buffer.alloc(256) : sign('RSA-SHA256', Buffer.from(message), privateKey);
      body = { access_token: 'access-token', token_type: 'Bearer', expires_in: 300, id_token: `${message}.${signature.toString('base64url')}` };
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  };
  const callback = new URL('https://app.example/auth/callback?code=code&state=expected-state');
  assert.equal((await completeLogin(config, callback, transaction)).user.sub, 'test-user');
  for (const invalid of [{ iss: 'https://other.example' }, { aud: 'other-client' }, { exp: 1 }, { nonce: 'wrong' }]) {
    changes = invalid;
    await assert.rejects(completeLogin(config, callback, transaction));
  }
  changes = {};
  invalidSignature = true;
  await assert.rejects(completeLogin(config, callback, transaction));
  invalidSignature = false;
  await assert.rejects(completeLogin(config, new URL('https://app.example/auth/callback?code=code&state=wrong'), transaction));
  subject = 'other-user';
  await assert.rejects(completeLogin(config, callback, transaction));
});
