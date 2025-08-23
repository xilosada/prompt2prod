import type { Bus } from './Bus.js';
import { createMemoryBus } from './memoryBus.js';

export async function createBus(): Promise<Bus> {
  // Future: switch on process.env.BUS_DRIVER
  return createMemoryBus();
}
