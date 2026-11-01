import { createServer } from 'node:http';
import { verifyAccessToken } from './auth.js';

const port = Number(process.env.PORT ?? 90);

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return json(response, 200, { status: 'ok' });
  }

  if (request.method !== 'GET' || request.url !== '/api/profile') {
    return json(response, 404, { error: 'Endpoint tidak ditemukan' });
  }

  const [scheme, token] = (request.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return json(response, 401, { error: 'Bearer token diperlukan' });
  }

  try {
    const claims = await verifyAccessToken(token);
    return json(response, 200, {
      message: 'Access token valid untuk test.read',
      subject: claims.sub,
      email: claims.email ?? claims.mail,
      scope: claims.scope
    });
  } catch (error) {
    return json(response, 401, { error: error.message });
  }
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} sedang dipakai. Hentikan proses lain atau jalankan dengan PORT=<port-lain> bun run dev.`);
    return;
  }
  throw error;
});

server.listen(port, () => {
  console.log(`Backend berjalan di http://localhost:${port}`);
});
