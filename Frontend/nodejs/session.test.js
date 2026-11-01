import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionStore } from './session.js';

test('secure sessions rotate, expire in store, consume once, and destroy', async () => {
  const values = new Map();
  const redis = {
    async set(key, data, options) { assert.equal(options.EX, 600); values.set(key, data); },
    async get(key) { return values.get(key); },
    async getDel(key) { const data = values.get(key); values.delete(key); return data; },
    async del(key) { values.delete(key); }
  };
  const store = sessionStore(redis, true);
  let cookie;
  const response = { setHeader(name, value) { cookie = value; } };
  await store.create(response, { transaction: { state: 'test' } }, 600);
  assert.match(cookie, /^__Host-pnj_session=/);
  for (const flag of ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=600']) assert.ok(cookie.includes(flag));
  const request = { headers: { cookie: cookie.split(';')[0] } };
  assert.equal((await store.read(request)).transaction.state, 'test');
  assert.ok(await store.read(request, true));
  assert.equal(await store.read(request, true), undefined);
  await store.create(response, { user: {} }, 600);
  assert.notEqual(cookie.split(';')[0], request.headers.cookie);
  const authenticated = { headers: { cookie: cookie.split(';')[0] } };
  await store.destroy(authenticated, response);
  assert.equal(await store.read(authenticated), undefined);
  assert.match(cookie, /Max-Age=0/);
  assert.equal(await store.read({ headers: { cookie: '__Host-pnj_session=bad' } }), undefined);
});
