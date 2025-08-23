import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createBus } from '../src/bus/factory.js';

describe('bus factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('creates memory bus by default', async () => {
    delete process.env.BUS_DRIVER;
    const bus = await createBus();
    expect(bus).toBeDefined();
    await bus.close();
  });

  it('creates memory bus when BUS_DRIVER=memory', async () => {
    process.env.BUS_DRIVER = 'memory';
    const bus = await createBus();
    expect(bus).toBeDefined();
    await bus.close();
  });

  const itNats = process.env.BUS_DRIVER === 'nats' ? it : it.skip;
  itNats('creates nats bus when BUS_DRIVER=nats', async () => {
    process.env.BUS_DRIVER = 'nats';
    process.env.NATS_URL = 'nats://localhost:4222';

    const bus = await createBus();
    expect(bus).toBeDefined();
    await bus.close();
  });
});
