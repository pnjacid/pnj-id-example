import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.js';

test('Fastify forwards method, URL, cookie and Origin to the shared handler', async t => {
  const app = buildApp(async (request, response) => {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'set-cookie': 'pnj_session=test; HttpOnly; SameSite=Lax; Path=/' });
    response.end(JSON.stringify({ method: request.method, url: request.url, cookie: request.headers.cookie, origin: request.headers.origin }));
  });
  t.after(() => app.close());
  for (const [method, url] of [['GET', '/'], ['GET', '/app.js'], ['GET', '/auth/callback?code=test&state=test'], ['GET', '/api/session'], ['GET', '/api/backend-profile'], ['POST', '/auth/logout']]) {
    const response = await app.inject({ method, url, headers: { cookie: 'pnj_session=test', origin: 'http://localhost:5173' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { method, url, cookie: 'pnj_session=test', origin: 'http://localhost:5173' });
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers['set-cookie'], /HttpOnly/);
  }
});

test('Fastify preserves redirect responses from the shared handler', async t => {
  const app = buildApp(async (_request, response) => {
    response.writeHead(302, { location: 'https://provider.example/authorize' });
    response.end();
  });
  t.after(() => app.close());
  const response = await app.inject('/auth/login');
  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, 'https://provider.example/authorize');
});
