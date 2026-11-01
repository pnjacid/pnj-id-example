import { createServer as createViteServer } from 'vite';
import { startServer } from '../nodejs/server.js';

const server = startServer(async (request, response) => {
  const vite = await ready;
  await new Promise((resolve, reject) => {
    response.once('finish', resolve);
    response.once('close', resolve);
    vite.middlewares(request, response, error => {
      if (error) return reject(error);
      response.writeHead(404);
      response.end('Endpoint tidak ditemukan');
    });
  });
});
const ready = createViteServer({
  server: { middlewareMode: true, hmr: { server } }
});
await ready;
server.on('close', async () => { await (await ready).close(); });
