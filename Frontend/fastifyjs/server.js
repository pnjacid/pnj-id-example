import { buildApp } from './app.js';
import { createRequestHandler, closeSessionStore } from '../nodejs/server.js';

const app = buildApp(createRequestHandler());
app.addHook('onClose', async () => { closeSessionStore(); });
try {
  await app.listen({ port: Number(process.env.PORT ?? 5173), host: '0.0.0.0' });
  console.log(`Frontend Fastify berjalan pada port ${app.server.address().port}`);
} catch (error) {
  console.error('Frontend Fastify gagal dimulai', { code: error.code });
  await app.close();
  process.exitCode = 1;
}
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    const timeout = setTimeout(() => process.exit(1), 10000);
    timeout.unref();
    try {
      await app.close();
      clearTimeout(timeout);
    } catch {
      process.exitCode = 1;
    }
  });
}
