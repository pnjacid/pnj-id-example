import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./server.js', import.meta.url), 'utf8');
const handlerSource = source.slice(source.indexOf('createServer(async'), source.indexOf('\n  server.requestTimeout')).trim().replace(/;$/, '');

test('shared server delegates Next pages and assets while retaining OIDC/API routes', async () => {
  const rendered = [];
  const handler = runInNewContext(handlerSource, {
    createServer: handler => handler,
    URL, console, secure: false,
    redirectUri: new URL('http://localhost:5173/auth/callback'),
    render: async (request, response) => { rendered.push(request.url); response.end('Next page'); },
    sessions: { read: async () => undefined },
    files: new Map(),
    json: (response, status, body) => { response.status = status; response.body = body; }
  });
  for (const path of ['/', '/_next/static/app.js', '/api/session', '/api/backend-profile', '/auth/callback']) {
    const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body) { this.body = body; } };
    await handler({ method: 'GET', url: path }, response);
    if (path === '/' || path.startsWith('/_next/')) assert.equal(response.body, 'Next page');
    else if (path === '/api/session') {
      assert.equal(response.status, 200);
      assert.equal(response.body.authenticated, false);
    } else assert.equal(response.status, path === '/auth/callback' ? 400 : 401);
  }
  assert.deepEqual(rendered, ['/', '/_next/static/app.js']);
});
