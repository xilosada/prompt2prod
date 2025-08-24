import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerSse } from './server/sse.js';
import { createBus } from './bus/factory.js';
import { registerRunRoutes } from './runs/routes.js';
import { registerPrRoutes } from './runs/pr.routes.js';
import { registerPrComposeRoutes } from './runs/pr.compose.routes.js';
import { createMemoryRunsRepo } from './runs/repo.memory.js';
import { createMemoryAgentRegistry, STATUS_THRESHOLDS } from './agents/registry.memory.js';
import { registerAgentRoutes } from './agents/routes.js';
import { registerAgentDevRoutes } from './agents/dev.routes.js';
import { registerRunDevRoutes } from './runs/dev.routes.js';
import { topics } from './bus/topics.js';

export async function buildServer() {
  const app = Fastify();

  // Register CORS plugin
  app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  });

  app.get('/health', async () => ({
    ok: true,
    agentRegistry: {
      thresholds: {
        onlineTtlMs: STATUS_THRESHOLDS.ONLINE_TTL,
        staleTtlMs: STATUS_THRESHOLDS.STALE_TTL,
        minHeartbeatIntervalMs: parseInt(process.env.AGENT_MIN_HEARTBEAT_INTERVAL_MS ?? '250'),
      },
    },
  }));

  const repo = createMemoryRunsRepo();
  const agentRegistry = createMemoryAgentRegistry();

  // Create a map to track active subscriptions
  const agentSubscriptions = new Map<string, () => void>();

  // Cleanup subscriptions on server close
  app.addHook('onClose', async () => {
    try {
      for (const unsub of agentSubscriptions.values()) {
        await unsub();
      }
      agentSubscriptions.clear();
    } catch {
      // Ignore cleanup errors
    }
  });

  // Register agent routes immediately (they don't depend on bus)
  registerAgentRoutes(app, agentRegistry);

  // Register dev-only test routes when enabled
  if (process.env.ENABLE_TEST_ENDPOINTS === '1') {
    registerAgentDevRoutes(app, agentRegistry);
    app.log.info('[dev] Test endpoints: enabled');
  }

  // Create the bus synchronously and register all routes immediately
  const bus = await createBus();

  registerSse(app, bus);
  registerRunRoutes(app, { bus, repo });
  registerPrRoutes(app);
  registerPrComposeRoutes(app);

  // Register dev-only run routes when enabled
  if (process.env.ENABLE_TEST_ENDPOINTS === '1') {
    registerRunDevRoutes(app, bus);
    app.log.info('[dev] Test run-status endpoints enabled');
  }

  // Start the headless PR composer worker
  try {
    const { startComposer } = await import('./composer/worker.js');
    startComposer(app, bus, repo);
  } catch (err) {
    // Composer may fail to start if required env vars are missing
    app.log.warn('[server] composer failed to start: %s', (err as Error)?.message);
  }

  // Subscribe to agent heartbeats
  // Note: Memory bus doesn't support wildcards, so we'll handle this differently
  // For now, we'll create a helper that can subscribe to specific agent topics
  // In a real implementation with NATS, this would use wildcards

  // Helper function to subscribe to a specific agent's heartbeat
  const subscribeToAgent = async (agentId: string) => {
    if (agentSubscriptions.has(agentId)) return; // Already subscribed

    const unsub = await bus.subscribe<{ at: number; caps?: Record<string, unknown> }>(
      topics.agentHeartbeat(agentId),
      async (heartbeat) => {
        agentRegistry.upsertHeartbeat(agentId, heartbeat.caps);
      },
    );

    agentSubscriptions.set(agentId, unsub);
  };

  // For memory bus, we'll need to manually subscribe to agents as they appear
  // In a production NATS setup, this would use wildcards
  // For now, we'll expose this function for testing purposes
  (agentRegistry as { _subscribeToAgent?: typeof subscribeToAgent })._subscribeToAgent =
    subscribeToAgent;

  // Memory bus guard: log info about wildcard limitation
  const driver = (process.env.BUS_DRIVER ?? 'memory').toLowerCase();
  if (driver === 'memory') {
    console.log('Agent registry: Memory bus detected - manual agent subscription required');
    console.log('For production with NATS, wildcard subscriptions will be used automatically');
  }

  return app;
}
