import { buildServer } from './server.js';

const port = Number(process.env.PORT || 3000);

async function start() {
  const app = await buildServer();

  await app.listen({ port, host: '0.0.0.0' });
  console.log(`[api] listening on :${port}`);
}

start().catch((err) => {
  console.error('[api] failed to start:', err);
  process.exit(1);
});
