import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

test('Vite middleware and hot reload attach to the shared frontend server', async () => {
  const source = (await readFile(new URL('./server.js', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
  const server = new EventEmitter();
  let render;
  let closed = false;
  const vite = {
    middlewares(request, response) { response.emit('finish'); },
    async close() { closed = true; }
  };
  await runInNewContext(`(async () => { ${source} })()`, {
    startServer(handler) { render = handler; return server; },
    async createViteServer(options) {
      assert.equal(options.server.middlewareMode, true);
      assert.equal(options.server.hmr.server, server);
      return vite;
    }
  });
  await render({ url: '/' }, new EventEmitter());
  server.emit('close');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, true);
});
