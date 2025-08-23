import Fastify from 'fastify';
import { registerSse } from './server/sse.js';

export function buildServer() {
  const app = Fastify();
  app.get('/health', async () => ({ ok: true }));
  registerSse(app);
  return app;
}
