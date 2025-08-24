import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerSse } from './server/sse.js';
import { createBus } from './bus/factory.js';
import { registerRunRoutes } from './runs/routes.js';
import { registerPrRoutes } from './runs/pr.routes.js';
import { registerPrComposeRoutes } from './runs/pr.compose.routes.js';
import { createMemoryRunsRepo } from './runs/repo.memory.js';

export function buildServer() {
  const app = Fastify();

  // Register CORS plugin
  app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  });

  app.get('/health', async () => ({ ok: true }));

  const repo = createMemoryRunsRepo();

  // Create the bus ONCE and register all routes that depend on it
  void createBus().then((bus) => {
    registerSse(app, bus);
    registerRunRoutes(app, { bus, repo });
    registerPrRoutes(app);
    registerPrComposeRoutes(app);
  });

  return app;
}
