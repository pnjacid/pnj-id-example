import test from 'node:test';
import assert from 'node:assert/strict';
import { hasScope, verifyAccessToken } from './auth.js';

test('scope must match a complete string or array entry', () => {
  for (const scope of ['openid test.read', ['openid', 'test.read']]) {
    assert.equal(hasScope({ scope }, 'test.read'), true);
  }
  for (const scope of [undefined, '', 'test.read.extra', ['test.read.extra']]) {
    assert.equal(hasScope({ scope }, 'test.read'), false);
  }
});

test('opaque token requires active status, matching client, and scope', async t => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.OIDC_CLIENT_SECRET;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.OIDC_CLIENT_SECRET;
    else process.env.OIDC_CLIENT_SECRET = originalSecret;
  });
  process.env.OIDC_CLIENT_SECRET = 'test-secret';
  const valid = {
    active: true,
    client_id: process.env.OIDC_CLIENT_ID ?? 'al-localhost5173testread-1012',
    scope: 'test.read',
    sub: 'test-subject'
  };
  for (const [changes, error] of [
    [{}, null],
    [{ active: false }, /Token tidak aktif/],
    [{ client_id: 'other' }, /client lain/],
    [{ scope: 'test.read.extra' }, /scope test.read/]
  ]) {
    globalThis.fetch = async (url, options) => {
      assert.ok(url.endsWith('/introspect'));
      assert.equal(options.method, 'POST');
      assert.equal(options.body.get('token'), 'opaque-token');
      assert.ok(options.headers.authorization.startsWith('Basic '));
      return { ok: true, json: async () => ({ ...valid, ...changes }) };
    };
    if (error) await assert.rejects(verifyAccessToken('opaque-token'), error);
    else assert.deepEqual(await verifyAccessToken('opaque-token'), valid);
  }
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(verifyAccessToken('opaque-token'), /Introspection token gagal \(503\)/);
  delete process.env.OIDC_CLIENT_SECRET;
  await assert.rejects(verifyAccessToken('opaque-token'), /belum dikonfigurasi/);
});
