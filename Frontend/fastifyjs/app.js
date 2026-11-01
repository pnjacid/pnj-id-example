import Fastify from 'fastify';

export function buildApp(handler) {
  const app = Fastify({ requestTimeout: 15000, connectionTimeout: 10000, bodyLimit: 1024 });
  async function route(request, reply) {
    reply.hijack();
    await handler(request.raw, reply.raw);
  }
  app.all('/', route);
  app.all('/*', route);
  return app;
}
