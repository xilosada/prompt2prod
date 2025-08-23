import Fastify from 'fastify';
import { registerSse } from './server/sse.js';
import { createBus } from './bus/factory.js';

export function buildServer() {
  const app = Fastify();
  app.get('/health', async () => ({ ok: true }));
  // create once and inject
  void createBus().then((bus) => registerSse(app, bus));
  return app;
}
