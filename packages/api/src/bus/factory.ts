import type { Bus } from './Bus.js';
import { createMemoryBus } from './memoryBus.js';

export async function createBus(): Promise<Bus> {
  const driver = (process.env.BUS_DRIVER ?? 'memory').toLowerCase();
  if (driver === 'nats') {
    const { createNatsBus } = await import('./natsBus.js');
    return createNatsBus({
      url: process.env.NATS_URL ?? 'nats://localhost:4222',
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASS,
      token: process.env.NATS_TOKEN,
      name: process.env.NATS_NAME ?? 'prompt2prod-api',
    });
  }
  return createMemoryBus();
}
